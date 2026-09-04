/**
 * POST /api/compliance/rdps/alerts/[id]/disposition
 *
 * Dispositions (resolves/waives/etc.) a worsening RDPS outcome's linked
 * ExceptionItem. [id] is the RdpsPartyOutcome id, tenant-scoped via
 * accountId. Reuses ExceptionService.updateException via the outcome's
 * exceptionItemId rather than reimplementing resolution/version-conflict
 * logic -- the outcome IS the evidence, the ExceptionItem IS the workflow.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse, errorMessage } from "@/lib/api/error";
import { parseAndValidateBody, validatePathParams } from "@/lib/api/validation";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { hasPermission } from "@/lib/auth";
import { RISK_ACCEPTANCE_PERMISSION, isRiskAcceptance, normalizeExceptionStatus } from "@/modules/exceptions/exceptionState";
import { dispositionAlert, RdpsAlertNotFoundError } from "@/modules/compliance/rdps/rdpsQueryService";

const paramsSchema = z.object({ id: z.string().min(1) });

const bodySchema = z.object({
  status: z.string().min(1),
  resolutionReason: z.string().optional(),
  resolutionReasonCode: z.string().optional(),
  expectedVersion: z.number().int({ message: "expectedVersion integer is required for concurrency control" }),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params, requestId }) => {
    const paramsVal = validatePathParams(params, paramsSchema, requestId);
    if ("response" in paramsVal) return paramsVal.response;
    const { id } = paramsVal.data;

    const bodyVal = await parseAndValidateBody(req, bodySchema, requestId);
    if ("response" in bodyVal) return bodyVal.response;

    const requestedState = normalizeExceptionStatus(bodyVal.data.status);
    if (requestedState && isRiskAcceptance(requestedState)) {
      const allowed = await hasPermission(RISK_ACCEPTANCE_PERMISSION);
      if (!allowed) {
        return buildErrorResponse(
          403,
          "FORBIDDEN",
          `Waiving an RDPS alert accepts the risk it describes. Missing required permission: ${RISK_ACCEPTANCE_PERMISSION}`,
          undefined,
          requestId
        );
      }
    }

    try {
      const resolverName = [ctx.firstName, ctx.lastName].filter(Boolean).join(" ") || ctx.email;
      const updated = await dispositionAlert(ctx.accountId, id, bodyVal.data, {
        userId: ctx.userId,
        name: resolverName,
      });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: AuditAction.RDPS_ALERT_DISPOSITIONED,
        entity: "RdpsPartyOutcome",
        entityId: id,
        source: "UI",
        metadata: { newStatus: updated.status, exceptionItemId: updated.id },
        requestId,
      });

      return NextResponse.json({ exception: updated, requestId });
    } catch (error: unknown) {
      if (error instanceof RdpsAlertNotFoundError) {
        return buildErrorResponse(404, "NOT_FOUND", error.message, undefined, requestId);
      }
      const msg = errorMessage(error);
      if (msg === "NOT_FOUND") return buildErrorResponse(404, "NOT_FOUND", "Linked exception item not found", undefined, requestId);
      if (msg === "STALE_VERSION") {
        return buildErrorResponse(409, "CONFLICT", "Stale update detected. This alert has been modified by another user.", undefined, requestId);
      }
      if (msg.includes("required to move") || msg.includes("requires a reason code") || msg.includes("not valid for category") || msg.includes("is a risk acceptance")) {
        return buildErrorResponse(422, "UNPROCESSABLE_ENTITY", msg, undefined, requestId);
      }
      return buildErrorResponse(400, "BUSINESS_RULE_FAILURE", msg || "Failed to disposition RDPS alert", undefined, requestId);
    }
  },
  { permission: "compliance.rdps.manage", write: true }
);
