import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams, parseAndValidateBody } from "@/lib/api/validation";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { latestVersion, getDraft, DraftNotExportable, type DraftDbClient } from "@/modules/entrySummary/draft.service";
import { entrySummaryDraftSchema } from "@/modules/entrySummary/model";
import { getProfileById } from "@/modules/entrySummary/filerProfile";
import {
  requestExport,
  listExportsForShipment,
  DraftNotApproved,
  FILER_EXPORT_FORMATS,
  downloadTransport,
  createHttpsWebhookTransport,
  type ExportDbClient,
  type FilerTransport,
} from "@/modules/entrySummary/export.service";
import type { ValidationResult } from "@/modules/entrySummary/validation/engine";
import { recordExportDispatched, recordExportFailed } from "@/modules/entrySummary/lifecycle";

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({
  filerProfileId: z.string().min(1),
  format: z.enum(FILER_EXPORT_FORMATS),
  version: z.number().int().positive().optional(),
});

/**
 * SFTP is modeled (FilerProfile.transport can be "SFTP", FilerTransport has
 * an "SFTP" kind) but no real SFTP client exists in this codebase yet —
 * export.service.ts's own `createFakeSftpTransport` is explicitly test-only.
 * Requesting an export against an SFTP-transport profile is refused here
 * rather than silently no-op'ing or pretending delivery succeeded.
 */
function resolveTransport(transport: string): FilerTransport | null {
  if (transport === "DOWNLOAD") return downloadTransport;
  if (transport === "HTTPS_WEBHOOK") return createHttpsWebhookTransport();
  return null;
}

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, requestId, params }) => {
    const parsedParams = validatePathParams(params, paramsSchema, requestId);
    if ("response" in parsedParams) return parsedParams.response;
    const shipmentId = parsedParams.data.id;

    const bodyResult = await parseAndValidateBody(req, bodySchema, requestId);
    if ("response" in bodyResult) return bodyResult.response;
    const { filerProfileId, format } = bodyResult.data;

    const profile = await getProfileById(db, ctx.accountId, filerProfileId);
    if (!profile) {
      return buildErrorResponse(404, "FILER_PROFILE_NOT_FOUND", `FilerProfile ${filerProfileId} not found.`, undefined, requestId);
    }

    const transport = resolveTransport(profile.transport);
    if (!transport) {
      return buildErrorResponse(
        422,
        "TRANSPORT_NOT_SUPPORTED",
        `Transport "${profile.transport}" has no live implementation yet (only DOWNLOAD and HTTPS_WEBHOOK are wired up).`,
        undefined,
        requestId
      );
    }

    const draftRow = bodyResult.data.version
      ? await getDraft(db as unknown as DraftDbClient, ctx.accountId, shipmentId, bodyResult.data.version)
      : await latestVersion(db as unknown as DraftDbClient, ctx.accountId, shipmentId);

    if (!draftRow) {
      return buildErrorResponse(404, "DRAFT_NOT_FOUND", `No EntrySummaryDraft found for shipment ${shipmentId}.`, undefined, requestId);
    }

    const draft = entrySummaryDraftSchema.parse(draftRow.draftData);
    const validation = draftRow.validationData as ValidationResult;

    let exportRow;
    try {
      let seqNum = 1;
      exportRow = await requestExport(db as unknown as ExportDbClient, {
        accountId: ctx.accountId,
        draftRow,
        draft,
        validation,
        profile,
        format,
        transport,
        requestedBy: ctx.userId,
        clock: () => new Date(),
        shipmentNumber: shipmentId,
        sequence: () => seqNum++,
      });
    } catch (err) {
      if (err instanceof DraftNotExportable) {
        return buildErrorResponse(422, "DRAFT_NOT_EXPORTABLE", err.message, { blockingCount: err.blockingCount }, requestId);
      }
      if (err instanceof DraftNotApproved) {
        return buildErrorResponse(422, "DRAFT_NOT_APPROVED", err.message, undefined, requestId);
      }
      throw err;
    }

    if (exportRow.status === "Failed") {
      await recordExportFailed(
        { accountId: ctx.accountId, userId: ctx.userId, shipmentId, filingId: draftRow.filingId },
        { exportId: exportRow.id, error: exportRow.lastError ?? "unknown" }
      );
    } else {
      await recordExportDispatched(
        { accountId: ctx.accountId, userId: ctx.userId, shipmentId, filingId: draftRow.filingId },
        {
          exportId: exportRow.id,
          filerProfileName: profile.name,
          format,
          delivered: exportRow.status === "Delivered",
          payloadHash: exportRow.payloadHash,
        }
      );
    }

    return NextResponse.json({
      export: {
        id: exportRow.id,
        status: exportRow.status,
        format: exportRow.format,
        transport: exportRow.transport,
        filerProfileId: exportRow.filerProfileId,
        payloadHash: exportRow.payloadHash,
        payloadSize: exportRow.payloadSize,
        deliveredAt: exportRow.deliveredAt,
        lastError: exportRow.lastError,
      },
      requestId,
    });
  },
  { permission: "filing.entry_summary.export", write: true }
);

/**
 * Lists every FilerExport row across all draft versions of this shipment,
 * newest first (U13 — no list-by-shipment endpoint existed before this
 * unit). Same permission as the POST above: reading export history is part
 * of the export workflow, not a separate read grant.
 */
export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, requestId, params }) => {
    const parsedParams = validatePathParams(params, paramsSchema, requestId);
    if ("response" in parsedParams) return parsedParams.response;
    const shipmentId = parsedParams.data.id;

    const rows = await listExportsForShipment(db as unknown as ExportDbClient, ctx.accountId, shipmentId);

    return NextResponse.json({
      exports: rows.map((row) => ({
        id: row.id,
        draftId: row.draftId,
        filerProfileId: row.filerProfileId,
        format: row.format,
        transport: row.transport,
        status: row.status,
        payloadHash: row.payloadHash,
        payloadSize: row.payloadSize,
        lastError: row.lastError,
        deliveredAt: row.deliveredAt,
        createdAt: row.createdAt,
      })),
      requestId,
    });
  },
  { permission: "filing.entry_summary.export" }
);
