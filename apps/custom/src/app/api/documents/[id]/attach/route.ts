import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams, parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { linkDocument } from "@/modules/documentAssociations/service";
import { PipelineOrchestrator } from "@/modules/agents/pipelineOrchestrator";
import { loadDocumentBytes } from "@/modules/documents/loadDocumentBytes";
import { runReconciliationEngine, type DocumentGroup } from "@/lib/reconciliation/reconciliationEngine";
import { computeReadinessBreakdown } from "@/lib/shipmentReadiness";
import { recomputeShipmentDeadlines } from "@/modules/deadlines/deadline.service";
import { logEvent } from "@/lib/logging/logger";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({ shipmentId: z.string().min(1) });

// Attaches a (typically previously-detached) document to a shipment,
// porting over its already-extracted data as-is.
//
// F-4: If the shipment already has other extracted documents we trigger
// reconciliation + readiness only — no re-OCR or re-classification of
// existing docs. If this is the first document, the full pipeline runs
// so the new doc gets classified and extracted.
export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, requestId, params }) => {
  const paramsVal = validatePathParams(params, paramsSchema, requestId);
  if ("response" in paramsVal) return paramsVal.response;
  const { id } = paramsVal.data;

  const bodyVal = await parseAndValidateBody(req, bodySchema, requestId);
  if ("response" in bodyVal) return bodyVal.response;
  const { shipmentId } = bodyVal.data;

  const doc = await db.shipmentDocument.findFirst({
    where: { id, accountId: ctx.accountId },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" });
  }

  const targetShipment = await db.shipment.findFirst({
    where: { id: shipmentId, accountId: ctx.accountId, deletedAt: null },
    select: { id: true },
  });

  if (!targetShipment) {
    return NextResponse.json({ error: "Target shipment not found in this account" }, { status: 400 });
  }

  const updated = await db.shipmentDocument.update({
    where: { id },
    data: { shipmentId },
  });

  // The document now has a shipment -- clear any "pick the right shipment"
  // conflict notifications that were raised for it.
  await db.notification
    .updateMany({
      where: { accountId: ctx.accountId, type: "DOCUMENT_MATCH_CONFLICT", entityId: id, read: false },
      data: { read: true },
    })
    .catch(() => {});

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "document.attach",
    entity: "ShipmentDocument",
    entityId: id,
    source: "UI",
    metadata: { fileName: doc.fileName, previousShipmentId: doc.shipmentId, newShipmentId: shipmentId },
    success: true,
  });

  // Mirror the direct shipmentId FK into the generalized association table
  // (dual-write -- the direct FK remains the source of truth, this keeps the
  // Trade Repository / EntityDocuments views in sync). Non-fatal on failure.
  await linkDocument({
    accountId: ctx.accountId,
    documentId: id,
    entityType: "SHIPMENT",
    entityId: shipmentId,
    relationshipType: "GENERAL",
    source: "USER",
    linkedBy: ctx.userId,
    auditSource: "UI",
  }).catch(() => {});

  logEvent({
    action: "document.attached",
    message: `POST /api/documents/${id}/attach document ${id} (${doc.fileName}) attached to shipment ${shipmentId}`,
    accountId: ctx.accountId,
    userId: ctx.userId,
    resourceType: "document",
    resourceId: id,
    requestId,
    metadata: { previousShipmentId: doc.shipmentId, newShipmentId: shipmentId },
  });

  // Check whether the shipment has other documents that are already extracted.
  const otherExtractedDocs = await db.shipmentDocument.findMany({
    where: { shipmentId, id: { not: id }, accountId: ctx.accountId },
    include: { extractionFields: { take: 1 } },
  });
  const shipmentHasExtractedDocs = otherExtractedDocs.some((d) => d.extractionFields.length > 0);

  try {
    if (shipmentHasExtractedDocs) {
      // F-4: Reconciliation-only — don't re-OCR/re-classify already-processed docs.
      const allDocs = await db.shipmentDocument.findMany({
        where: { shipmentId, accountId: ctx.accountId },
        include: { extractionFields: true },
      });

      const documentGroups: DocumentGroup[] = allDocs
        .filter((d) => d.extractionFields.length > 0)
        .map((d) => ({
          documentId: d.id,
          docType: d.docType,
          fields: d.extractionFields.map((f) => ({
            fieldName: f.fieldName,
            value: f.value,
            confidence: f.confidence,
          })),
        }));

      const { results } = runReconciliationEngine(documentGroups);
      const blockingCount = results.filter((r) => r.severity === "BLOCKING").length;

      const shipmentFull = await db.shipment.findFirst({
        where: { id: shipmentId },
        include: {
          documents: { include: { extractionFields: true } },
          lineItems: { orderBy: { lineNumber: "asc" } },
          exceptionItems: { where: { status: { not: "Resolved" } } },
        },
      });

      if (shipmentFull) {
        const allFields = shipmentFull.documents.flatMap((d) => d.extractionFields);
        const avgExtractionConfidence =
          allFields.length === 0
            ? undefined
            : allFields.reduce((s, f) => s + (f.confidence ?? 0), 0) / allFields.length;

        const { totalScore } = computeReadinessBreakdown({
          documents: shipmentFull.documents.map((d) => ({ docType: d.docType ?? "", status: d.status ?? "" })),
          lineItems: shipmentFull.lineItems.map((li) => ({
            htsCode: li.htsCode ?? "",
            countryOfOrigin: li.countryOfOrigin ?? "",
            quantity: Number(li.quantity),
            unitPrice: li.unitPrice,
            status: li.status,
          })),
          exceptionItems: shipmentFull.exceptionItems.map((e) => ({
            status: e.status ?? "Open",
            severity: e.severity ?? "Medium",
            blocking: e.severity === "Critical" || e.severity === "High",
          })),
          avgExtractionConfidence,
          blockingReconciliationIssues: blockingCount,
        });

        const healthStatus =
          totalScore >= 80 ? "Healthy" : totalScore >= 50 ? "At Risk" : "Critical";

        await db.shipment.update({
          where: { id: shipmentId },
          data: { readinessScore: totalScore, healthStatus },
        });
        await recomputeShipmentDeadlines(shipmentId, ctx.accountId);
      }
    } else {
      // First document on this shipment — run the full pipeline so this doc
      // gets classified and extracted before reconciliation can run. Load the
      // original bytes so the extraction agents have a document to read even
      // when it came in via the portal (rawContent / local quarantine only).
      const loaded = await loadDocumentBytes(id);
      await PipelineOrchestrator.processEvent({
        shipmentId,
        accountId: ctx.accountId,
        userId: ctx.userId,
        triggerEvent: "DOCUMENT_UPLOADED",
        payload: {
          documentId: id,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl || undefined,
          fileBuffer: loaded?.buffer,
          mimeType: doc.mimeType || loaded?.mimeType || undefined,
          reattached: true,
        },
      });
    }
  } catch (err: unknown) {
    console.error("Post-attach processing failed:", err);
  }

  return NextResponse.json({ document: updated, requestId });

}, { permission: { any: ["document.update", "documents.create"] }, write: true });
