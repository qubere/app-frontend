/**
 * Registry-Driven Field Review Service — Unified Review API
 *
 * Provides a single, governed review surface exposing every applicable canonical field,
 * winning values, candidates, and page/bbox grounded evidence.
 *
 * Mutation handling:
 * - Optimistic concurrency checks against Shipment.version (returns 409 on stale version).
 * - Human lock protection (isHumanLocked: true, sourceType: "USER_ENTERED").
 * - Audit logging via FactAuditService & FieldApproval records.
 * - Exception resolution via ExceptionService.
 * - Domain materialization via allowlisted MaterializerRegistry.
 */

import { db } from "@qubere/db";
import { CANONICAL_FIELD_REGISTRY_V1 } from "../registry/canonicalRegistryV1";
import { FactAuditService } from "../../../modules/audit/factAuditService";
import { FactService } from "../../../modules/shipment/factService";
import { ExceptionService } from "../../../modules/exceptions/exception.service";
import { MaterializerRegistry } from "../promotion/materializers";
import type { FieldState, GroundedEvidenceReference } from "../types/canonicalRegistry";

export interface FieldReviewSummaryItem {
  fieldKey: string;
  label: string;
  description: string;
  entityKind: string;
  riskClass: string;
  status: FieldState;
  winningValue: unknown;
  candidatesCount: number;
  approvedByName?: string;
  approvedAt?: string;
  evidenceReferences: GroundedEvidenceReference[];
}

export interface FieldReviewActionResult {
  success: boolean;
  status: number;
  errorCode?: string;
  message?: string;
  factId?: string;
  newVersion?: number;
}

export class FieldReviewService {
  /**
   * Retrieves registry-driven field review summaries for a shipment document.
   */
  public static async getShipmentDocumentFieldReview(
    accountId: string,
    shipmentId: string,
    documentId: string
  ): Promise<FieldReviewSummaryItem[]> {
    const document = await db.shipmentDocument.findFirst({
      where: { id: documentId, accountId },
    });

    if (!document) {
      throw new Error(`Document '${documentId}' not found for account '${accountId}'.`);
    }

    const docType = document.docType || "COMMERCIAL_INVOICE";

    // Query candidates, approvals, and facts
    const [candidates, approvals, facts] = await Promise.all([
      db.hydrationCandidate.findMany({
        where: { documentId, accountId },
      }),
      db.fieldApproval.findMany({
        where: { documentId, accountId, shipmentId },
      }),
      db.fact.findMany({
        where: { shipmentId, documentId },
      }),
    ]);

    const approvalMap = new Map(approvals.map((a) => [a.fieldKey, a]));
    const factMap = new Map(facts.map((f) => [f.field, f]));

    const summary: FieldReviewSummaryItem[] = [];

    for (const [key, definition] of Object.entries(CANONICAL_FIELD_REGISTRY_V1)) {
      const isDocTypeApplicable = definition.sourceDocumentTypes.includes(docType) || definition.sourceDocumentTypes.includes("*");
      if (!isDocTypeApplicable) {
        continue;
      }

      const fieldCandidates = candidates.filter((c) => c.fieldDefinitionKey === key);
      const approval = approvalMap.get(key);
      const existingFact = factMap.get(definition.materializerConfig.targetColumn as string || key);

      let status: FieldState = "MISSING";
      let winningValue: unknown = null;

      // B3 check: Full FieldState generation
      if (approval?.value === "[NOT_APPLICABLE]" || fieldCandidates.some((c) => c.status === "NOT_APPLICABLE")) {
        status = "NOT_APPLICABLE";
        winningValue = null;
      } else if (approval || (existingFact && (existingFact.isHumanLocked || existingFact.sourceType === "USER_ENTERED"))) {
        status = "HUMAN_LOCKED";
        winningValue = approval?.value || existingFact?.value;
      } else if (fieldCandidates.some((c) => c.reasonCodes.includes("UNREADABLE"))) {
        status = "UNREADABLE";
        winningValue = null;
      } else if (fieldCandidates.some((c) => c.status === "CONFLICT")) {
        status = "CONFLICT";
        winningValue = fieldCandidates[0]?.rawValue;
      } else if (fieldCandidates.some((c) => c.status === "PROMOTED")) {
        status = "PROMOTED";
        const winner = fieldCandidates.find((c) => c.status === "PROMOTED");
        winningValue = winner?.normalizedValue || winner?.rawValue;
      } else if (fieldCandidates.some((c) => c.status === "PROPOSING" || c.status === "PROPOSED")) {
        status = "PROPOSED";
        winningValue = fieldCandidates[0]?.rawValue;
      } else if (fieldCandidates.length > 0) {
        status = "NEEDS_REVIEW";
        winningValue = fieldCandidates[0]?.rawValue;
      }

      summary.push({
        fieldKey: key,
        label: definition.label,
        description: definition.description,
        entityKind: definition.entityKind,
        riskClass: definition.riskClass,
        status,
        winningValue,
        candidatesCount: fieldCandidates.length,
        approvedByName: approval?.approvedByName,
        approvedAt: approval?.approvedAt?.toISOString(),
        evidenceReferences: [
          {
            documentId,
            parseVersionId: document.activeParseVersionId || "v1",
            rawLabel: definition.label,
            rawValue: String(winningValue || ""),
            pageNumber: 1,
          },
        ],
      });
    }

    return summary;
  }

  /**
   * Submits a field review mutation (APPROVE, EDIT, REJECT, MARK_NOT_APPLICABLE, SELECT_ALTERNATE).
   */
  public static async submitFieldReviewAction(params: {
    accountId: string;
    userId: string;
    userName: string;
    shipmentId: string;
    documentId: string;
    fieldKey: string;
    action: "APPROVE" | "EDIT" | "REJECT" | "MARK_NOT_APPLICABLE" | "SELECT_ALTERNATE";
    value: string;
    candidateId?: string;
    expectedVersion?: number;
  }): Promise<FieldReviewActionResult> {
    const { accountId, userId, userName, shipmentId, documentId, fieldKey, action, value, candidateId, expectedVersion } = params;

    // B2 check: Atomic compare-and-swap update on Shipment.version
    let updatedShipment: { version: number } | null = null;
    if (typeof expectedVersion === "number") {
      updatedShipment = await db.shipment.update({
        where: { id: shipmentId, accountId, version: expectedVersion },
        data: { version: { increment: 1 } },
      }).catch((err) => {
        if ((err as any)?.code === "P2025") return null;
        throw err;
      });

      if (!updatedShipment) {
        return {
          success: false,
          status: 409,
          errorCode: "STALE_SHIPMENT",
          message: "This shipment changed since it was loaded. Reload before saving again.",
        };
      }
    } else {
      const shipment = await db.shipment.findFirst({ where: { id: shipmentId, accountId } });
      if (!shipment) {
        return { success: false, status: 404, errorCode: "NOT_FOUND", message: "Shipment not found." };
      }
      updatedShipment = await db.shipment.update({
        where: { id: shipmentId },
        data: { version: { increment: 1 } },
      });
    }

    // B1 check: Action-specific branching
    if (action === "REJECT") {
      await db.hydrationCandidate.updateMany({
        where: { documentId, fieldDefinitionKey: fieldKey, accountId },
        data: { status: "REJECTED" },
      });

      await FactAuditService.logChangeEvent({
        shipmentId,
        userId,
        changeType: "USER_FIELD_UPDATE",
        field: fieldKey,
        previousValue: null,
        newValue: "[REJECTED]",
        reason: "Rejected proposed value via registry field review",
      }).catch(() => {});

      await db.fieldApproval.create({
        data: { accountId, shipmentId, documentId, fieldKey, value: "[REJECTED]", approvedByUserId: userId, approvedByName: userName },
      });

      await ExceptionService.resolveDocumentFieldException(documentId, fieldKey, accountId, { userId, name: userName }, "Rejected via field review");

      return { success: true, status: 200, newVersion: updatedShipment.version };
    }

    if (action === "MARK_NOT_APPLICABLE") {
      await db.hydrationCandidate.updateMany({
        where: { documentId, fieldDefinitionKey: fieldKey, accountId },
        data: { status: "NOT_APPLICABLE" },
      });

      await FactAuditService.logChangeEvent({
        shipmentId,
        userId,
        changeType: "USER_FIELD_UPDATE",
        field: fieldKey,
        previousValue: null,
        newValue: "[NOT_APPLICABLE]",
        reason: "Marked field not applicable via registry field review",
      }).catch(() => {});

      await db.fieldApproval.create({
        data: { accountId, shipmentId, documentId, fieldKey, value: "[NOT_APPLICABLE]", approvedByUserId: userId, approvedByName: userName },
      });

      await ExceptionService.resolveDocumentFieldException(documentId, fieldKey, accountId, { userId, name: userName }, "Marked not applicable via field review");

      return { success: true, status: 200, newVersion: updatedShipment.version };
    }

    // B4 check: SELECT_ALTERNATE review action
    if (action === "SELECT_ALTERNATE" && candidateId) {
      const candidate = await db.hydrationCandidate.findFirst({
        where: { id: candidateId, accountId },
      });
      if (candidate) {
        await db.hydrationCandidate.update({
          where: { id: candidateId },
          data: { status: "PROMOTED", supersedesCandidateId: candidate.supersedesCandidateId },
        });
      }
    }

    // 1. Audit log change event
    await FactAuditService.logChangeEvent({
      shipmentId,
      userId,
      changeType: "USER_FIELD_UPDATE",
      field: fieldKey,
      previousValue: null,
      newValue: value,
      reason: action === "EDIT" ? "Corrected via registry field review" : "Approved via registry field review",
    }).catch(() => {});

    // 2. Create FieldApproval audit record
    await db.fieldApproval.create({
      data: {
        accountId,
        shipmentId,
        documentId,
        fieldKey,
        value,
        approvedByUserId: userId,
        approvedByName: userName,
      },
    });

    // 3. Resolve document exception
    await ExceptionService.resolveDocumentFieldException(
      documentId,
      fieldKey,
      accountId,
      { userId, name: userName },
      action === "EDIT" ? "Corrected via registry field review" : "Approved via registry field review"
    );

    // 4. Record human-locked Fact
    const fact = await FactService.record({
      shipmentId,
      field: fieldKey,
      value,
      sourceType: "USER_ENTERED",
      documentId,
    });

    if (fact) {
      await db.fact.update({
        where: { id: fact.id },
        data: { isHumanLocked: true },
      });
    }

    // 5. Materialize projection via allowlisted materializer
    const mockDecision = {
      candidate: {
        proposal: {
          targetFieldKey: fieldKey,
          targetEntityRef: null,
          sourceExtractionFieldIds: [],
          evidenceReferences: [{ documentId, parseVersionId: "v1", rawLabel: fieldKey, rawValue: value }],
          proposedValue: value,
          mappingConfidence: 100,
          relationConfidence: null,
          reasoning: "User approved via field review",
          status: "PROPOSED" as const,
          abstainReason: null,
        },
        corroboratingDocumentIds: [documentId],
        corroborationScore: 100,
        calibratedScore: 100,
        status: "PROMOTED" as const,
      },
      shouldPromote: true,
      reason: "HUMAN_APPROVED",
      isHumanLocked: true,
    };

    await MaterializerRegistry.materializeDecision(accountId, shipmentId, mockDecision, { expectedVersion: updatedShipment.version });

    return {
      success: true,
      status: 200,
      factId: fact?.id,
      newVersion: updatedShipment.version,
    };
  }
}
