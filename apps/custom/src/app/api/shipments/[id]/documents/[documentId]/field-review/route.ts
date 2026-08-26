import { NextResponse, after } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody, validatePathParams } from "@/lib/api/validation";
import { FieldReviewService, type FieldReviewAction } from "@/modules/hydration/review/fieldReviewService";
import { db } from "@/lib/db";
import { runReconciliationEngine, type DocumentGroup } from "@/lib/reconciliation/reconciliationEngine";
import { computeReadinessBreakdown } from "@/lib/shipmentReadiness";
import { recomputeShipmentDeadlines } from "@/modules/deadlines/deadline.service";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1), documentId: z.string().min(1) });

const bodySchema = z.object({
  fieldKey: z.string().min(1, "fieldKey is required"),
  action: z.enum(["APPROVE", "EDIT", "REJECT", "MARK_NOT_APPLICABLE", "SELECT_ALTERNATE"]),
  value: z.string().trim().optional(),
  candidateId: z.string().optional(),
  expectedVersion: z.number().optional(),
});

export const GET = withAuthenticatedRoute<{ id: string; documentId: string }>(async ({ ctx, requestId, params }) => {
  const paramsVal = validatePathParams(params, paramsSchema, requestId);
  if ("response" in paramsVal) return paramsVal.response;
  const { id: shipmentId, documentId } = paramsVal.data;

  try {
    const summary = await FieldReviewService.getShipmentDocumentFieldReview(
      ctx.accountId,
      shipmentId,
      documentId
    );
    return NextResponse.json({ summary, requestId });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMsg, undefined, requestId);
  }
}, { permission: "shipments.read" });

export const POST = withAuthenticatedRoute<{ id: string; documentId: string }>(async ({ req, ctx, requestId, params }) => {
  const paramsVal = validatePathParams(params, paramsSchema, requestId);
  if ("response" in paramsVal) return paramsVal.response;
  const { id: shipmentId, documentId } = paramsVal.data;

  const bodyVal = await parseAndValidateBody(req, bodySchema, requestId);
  if ("response" in bodyVal) return bodyVal.response;
  const { fieldKey, action, value, candidateId, expectedVersion } = bodyVal.data;

  const resolverName = [ctx.firstName, ctx.lastName].filter(Boolean).join(" ") || ctx.email;

  try {
    const result = await FieldReviewService.submitFieldReviewAction({
      accountId: ctx.accountId,
      userId: ctx.userId,
      userName: resolverName,
      shipmentId,
      documentId,
      fieldKey,
      action: action as FieldReviewAction,
      value: value || "",
      candidateId,
      expectedVersion,
    });

    if (!result.success) {
      return buildErrorResponse(
        result.status || 400,
        result.errorCode || "BUSINESS_RULE_FAILURE",
        result.message || "Failed to process field review action",
        undefined,
        requestId
      );
    }

    // Trigger reconciliation + readiness after review mutation
    after(async () => {
      try {
        const fullShipment = await db.shipment.findFirst({
          where: { id: shipmentId },
          include: {
            documents: { include: { extractionFields: true } },
            lineItems: true,
            exceptionItems: { where: { status: { not: "Resolved" } } },
          },
        });
        if (!fullShipment) return;

        const documentGroups: DocumentGroup[] = fullShipment.documents
          .filter((d) => d.extractionFields.length > 0)
          .map((d) => ({
            documentId: d.id,
            docType: d.docType,
            fields: d.extractionFields.map((f) => ({ fieldName: f.fieldName, value: f.value, confidence: f.confidence })),
          }));

        const { results, evaluatedRuleIds } = runReconciliationEngine(documentGroups);
        const severityMap: Record<string, string> = { BLOCKING: "Critical", WARNING: "Warning", INFO: "Info" };
        const openIssues = await db.reconciliationIssue.findMany({ where: { shipmentId, accountId: ctx.accountId, status: "Open" } });
        const evaluatedFields = new Set(evaluatedRuleIds);

        for (const res of results) {
          const existing = openIssues.find((i) => i.field === res.ruleId);
          const data = {
            field: res.ruleId,
            severity: severityMap[res.severity] ?? "Warning",
            expectedValue: `${res.valueA} (${res.docTypeA})`,
            actualValue: `${res.valueB} (${res.docTypeB})`,
            sourceDocuments: [res.docTypeA, res.docTypeB],
          };
          if (existing) {
            await db.reconciliationIssue.update({ where: { id: existing.id }, data });
          } else {
            await db.reconciliationIssue.create({ data: { ...data, shipmentId, accountId: ctx.accountId, status: "Open" } });
          }
        }

        const resolvedRuleIds = new Set(results.map((r) => r.ruleId));
        const staleIds = openIssues
          .filter((i) => evaluatedFields.has(i.field) && !resolvedRuleIds.has(i.field))
          .map((i) => i.id);
        if (staleIds.length > 0) {
          await db.reconciliationIssue.updateMany({ where: { id: { in: staleIds } }, data: { status: "Resolved", resolvedAt: new Date() } });
        }

        const remaining = await db.reconciliationIssue.findMany({ where: { shipmentId, accountId: ctx.accountId, status: "Open" } });
        const blockingCount = remaining.filter((i) => i.severity === "Critical").length;

        const allFields = fullShipment.documents.flatMap((d) => d.extractionFields);
        const avgConf =
          allFields.length === 0 ? undefined : allFields.reduce((s, f) => s + (f.confidence ?? 0), 0) / allFields.length;

        const { totalScore } = computeReadinessBreakdown({
          documents: fullShipment.documents.map((d) => ({ docType: d.docType ?? "", status: d.status ?? "" })),
          lineItems: fullShipment.lineItems.map((li) => ({
            htsCode: li.htsCode ?? "",
            countryOfOrigin: li.countryOfOrigin ?? "",
            quantity: Number(li.quantity),
            unitPrice: li.unitPrice,
            status: li.status,
          })),
          exceptionItems: fullShipment.exceptionItems.map((e) => ({
            status: e.status ?? "Open",
            severity: e.severity ?? "Medium",
            blocking: e.severity === "Critical" || e.severity === "High",
          })),
          avgExtractionConfidence: avgConf,
          blockingReconciliationIssues: blockingCount,
        });

        const healthStatus = totalScore >= 80 ? "Healthy" : totalScore >= 50 ? "At Risk" : "Critical";
        await db.shipment.update({ where: { id: shipmentId }, data: { readinessScore: totalScore, healthStatus } });
        await recomputeShipmentDeadlines(shipmentId, ctx.accountId);
      } catch {
        // Non-fatal background reconciliation
      }
    });

    return NextResponse.json({ success: true, result, requestId });
  } catch (error: unknown) {
    return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", errorMessage(error) || "Failed to save field review", undefined, requestId);
  }
}, { permission: "shipments.manage", write: true });
