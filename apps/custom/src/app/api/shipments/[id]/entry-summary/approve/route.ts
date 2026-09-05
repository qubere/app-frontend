import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { parseAndValidateBody } from "@/lib/api/validation";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { approveDraft, latestVersion, DraftNotExportable, DraftLocked, type DraftDbClient } from "@/modules/entrySummary/draft.service";
import { entrySummaryDraftSchema } from "@/modules/entrySummary/model";
import type { ValidationResult } from "@/modules/entrySummary/validation/engine";
import { recordDraftApproved } from "@/modules/entrySummary/lifecycle";

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({ version: z.number().int().positive().optional() });

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, requestId, params }) => {
    const parsedParams = validatePathParams(params, paramsSchema, requestId);
    if ("response" in parsedParams) return parsedParams.response;
    const shipmentId = parsedParams.data.id;

    const bodyResult = await parseAndValidateBody(req, bodySchema, requestId);
    if ("response" in bodyResult) return bodyResult.response;
    const body = bodyResult.data;

    let version = body.version;
    if (!version) {
      const latest = await latestVersion(db as unknown as DraftDbClient, ctx.accountId, shipmentId);
      if (!latest) {
        return buildErrorResponse(404, "DRAFT_NOT_FOUND", `No EntrySummaryDraft found for shipment ${shipmentId}.`, undefined, requestId);
      }
      version = latest.version;
    }

    let row;
    try {
      row = await approveDraft(db as unknown as DraftDbClient, {
        accountId: ctx.accountId,
        shipmentId,
        version,
        approvedBy: ctx.userId,
      });
    } catch (err) {
      if (err instanceof DraftNotExportable) {
        return buildErrorResponse(422, "DRAFT_NOT_EXPORTABLE", err.message, { blockingCount: err.blockingCount }, requestId);
      }
      if (err instanceof DraftLocked) {
        return buildErrorResponse(409, "DRAFT_LOCKED", err.message, undefined, requestId);
      }
      if (err instanceof Error && err.message.includes("not found")) {
        return buildErrorResponse(404, "DRAFT_NOT_FOUND", err.message, undefined, requestId);
      }
      throw err;
    }

    const draftParsed = entrySummaryDraftSchema.parse(row.draftData);

    await recordDraftApproved(
      { accountId: ctx.accountId, userId: ctx.userId, shipmentId, filingId: row.filingId },
      { version: row.version, draft: draftParsed, validation: row.validationData as ValidationResult }
    );

    return NextResponse.json({
      draft: {
        version: row.version,
        shipmentId: row.shipmentId,
        filingId: row.filingId,
        isExportable: row.isExportable,
        approvedAt: row.approvedAt,
        approvedBy: row.approvedBy,
      },
      requestId,
    });
  },
  { permission: "filing.entry_summary.approve", write: true }
);
