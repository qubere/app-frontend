import { db, generateCustomsCaseNumber } from "@qubere/db";
import { assertProductEntitlement } from "@qubere/auth";
import { evaluateDocumentRelevance } from "./customsDocumentRelevanceService";
import { dispatchCustomsHandoffOutboxEvent } from "../../../lib/customsHandoffOutbox";

export interface SendToCustomsInput {
  accountId: string;
  userId: string;
  shipmentId: string;
}

export interface SendToCustomsResult {
  ok: boolean;
  shipmentId: string;
  customsCaseId: string;
  workspaceId: string;
  documentsEvaluated: number;
  alreadyExisted: boolean;
}

export async function sendToCustoms(input: SendToCustomsInput): Promise<SendToCustomsResult> {
  const { accountId, userId, shipmentId } = input;

  // 0. Verify account has an ACTIVE CUSTOMS entitlement (Bug 3)
  await assertProductEntitlement(accountId, "CUSTOMS");

  const shipment = await db.shipment.findFirst({
    where: { id: shipmentId, accountId, deletedAt: null },
    include: { documents: true },
  });

  if (!shipment) {
    throw new Error(`Shipment ${shipmentId} not found or unauthorized.`);
  }

  const { workspace, customsCase, alreadyExisted, documentsEvaluated, eventKey } = await db.$transaction(
    async (tx) => {
      // 1. Activate or reuse Customs Product Workspace
      const existingWorkspace = await tx.shipmentProductWorkspace.findFirst({
        where: { shipmentId, product: "CUSTOMS" },
      });

      let workspace;
      if (existingWorkspace) {
        workspace = await tx.shipmentProductWorkspace.update({
          where: { id: existingWorkspace.id },
          data: {
            status: "ACTIVE",
            activatedAt: new Date(),
            activatedByUserId: userId,
          },
        });
      } else {
        workspace = await tx.shipmentProductWorkspace.create({
          data: {
            accountId,
            shipmentId,
            product: "CUSTOMS",
            status: "ACTIVE",
            source: "HANDOFF",
            activatedByUserId: userId,
          },
        });
      }

      // 2. Find or create CustomsCase (Bug 9: ignore CLOSED cases so re-handoff opens a new case)
      const existingLink = await tx.customsCaseShipment.findFirst({
        where: {
          accountId,
          shipmentId,
          customsCase: {
            status: { not: "CLOSED" },
            deletedAt: null,
          },
        },
        include: { customsCase: true },
      });

      let customsCase;
      let alreadyExisted = false;

      if (existingLink) {
        customsCase = existingLink.customsCase;
        alreadyExisted = true;
      } else {
        // Bug 10: Shared collision-safe case number generator
        const caseNumber = await generateCustomsCaseNumber(tx, accountId);
        // Bug 8: Record provenance metadata
        customsCase = await tx.customsCase.create({
          data: {
            accountId,
            caseNumber,
            status: "OPEN",
            importerOfRecordId: shipment.importerOfRecordId,
            entryType: shipment.entryType,
            countryOfOrigin: shipment.countryOfOrigin,
            destinationCountry: shipment.destinationCountry,
            copiedFromShipmentId: shipment.id,
            copiedAtVersion: shipment.version,
          },
        });

        await tx.customsCaseShipment.create({
          data: {
            accountId,
            customsCaseId: customsCase.id,
            shipmentId,
          },
        });
      }

      // 3. Evaluate and link documents for Customs
      let docsEvaluatedCount = 0;
      for (const doc of shipment.documents) {
        docsEvaluatedCount++;
        const rel = evaluateDocumentRelevance(doc);
        const linkStatus =
          rel.recommendation === "INCLUDE"
            ? "INCLUDED"
            : rel.recommendation === "EXCLUDE"
            ? "EXCLUDED"
            : "SUGGESTED";

        const existingDocLink = await tx.customsCaseDocument.findFirst({
          where: {
            customsCaseId: customsCase.id,
            documentId: doc.id,
          },
        });

        if (!existingDocLink) {
          await tx.customsCaseDocument.create({
            data: {
              accountId,
              customsCaseId: customsCase.id,
              documentId: doc.id,
              status: linkStatus,
              documentRole: rel.documentRole,
              relevanceReason: rel.reasons.join("; "),
              relevanceConfidence: rel.confidence,
              sourceChecksum: doc.checksum,
              documentVersionId: doc.version,
              includedAt: rel.recommendation === "INCLUDE" ? new Date() : null,
              includedByUserId: rel.recommendation === "INCLUDE" ? userId : null,
            },
          });
        }
      }

      // 4. Update shipment customsRequired flag
      await tx.shipment.update({
        where: { id: shipmentId },
        data: { customsRequired: true },
      });

      // 5. Create audit log
      await tx.auditLog.create({
        data: {
          accountId,
          userId,
          action: "CUSTOMS_HANDOFF_REQUESTED",
          entity: "Shipment",
          entityId: shipmentId,
          metadata: {
            customsCaseId: customsCase.id,
            workspaceId: workspace.id,
            documentsEvaluated: docsEvaluatedCount,
            alreadyExisted,
          },
        },
      });

      // 6. Create outbox event in the same transaction (Bug 5: unique event key per handoff attempt / case)
      const eventKey = `customs_handoff_${shipmentId}_${customsCase.id}`;

      const existingEvent = await tx.workflowOutboxEvent.findFirst({
        where: { eventKey },
      });

      if (existingEvent) {
        await tx.workflowOutboxEvent.update({
          where: { id: existingEvent.id },
          data: {
            payload: {
              shipmentId,
              customsCaseId: customsCase.id,
              workspaceId: workspace.id,
              userId,
              accountId,
            },
            status: "PENDING",
            updatedAt: new Date(),
          },
        });
      } else {
        await tx.workflowOutboxEvent.create({
          data: {
            accountId,
            eventKey,
            eventType: "CUSTOMS_HANDOFF_REQUESTED",
            aggregateType: "CustomsCase",
            aggregateId: customsCase.id,
            payload: {
              shipmentId,
              customsCaseId: customsCase.id,
              workspaceId: workspace.id,
              userId,
              accountId,
            },
            status: "PENDING",
          },
        });
      }

      return {
        workspace,
        customsCase,
        alreadyExisted,
        documentsEvaluated: docsEvaluatedCount,
        eventKey,
      };
    }
  );

  // Dispatch outbox event after transaction commits successfully
  dispatchCustomsHandoffOutboxEvent(eventKey).catch((err) => {
    console.error(`Failed to immediately dispatch outbox event ${eventKey}`, err);
  });

  return {
    ok: true,
    shipmentId,
    customsCaseId: customsCase.id,
    workspaceId: workspace.id,
    documentsEvaluated,
    alreadyExisted,
  };
}
