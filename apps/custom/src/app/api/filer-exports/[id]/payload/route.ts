import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { buildErrorResponse } from "@/lib/api/error";
import { db } from "@/lib/db";
import { readStoredObject } from "@/lib/storage";
import { getExport, markDownloadDelivered, type ExportDbClient } from "@/modules/entrySummary/export.service";

const paramsSchema = z.object({ id: z.string().min(1) });

const CONTENT_TYPES: Record<string, string> = {
  CSV: "text/csv",
  CATAIR_AE: "text/plain",
  JSON_API: "application/json",
};

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, requestId, params }) => {
    const parsedParams = validatePathParams(params, paramsSchema, requestId);
    if ("response" in parsedParams) return parsedParams.response;
    const exportId = parsedParams.data.id;

    const exportRow = await getExport(db as unknown as ExportDbClient, ctx.accountId, exportId);
    if (!exportRow) {
      return buildErrorResponse(404, "EXPORT_NOT_FOUND", `FilerExport ${exportId} not found.`, undefined, requestId);
    }
    if (!exportRow.storageUrl) {
      return buildErrorResponse(409, "PAYLOAD_NOT_STORED", `FilerExport ${exportId} has no stored payload.`, undefined, requestId);
    }

    const object = await readStoredObject(exportRow.storageUrl);

    if (exportRow.transport === "DOWNLOAD" && exportRow.status === "Pending") {
      await markDownloadDelivered(db as unknown as ExportDbClient, ctx.accountId, exportId);
    }

    return new Response(new Uint8Array(object.body), {
      status: 200,
      headers: {
        "Content-Type": object.contentType ?? CONTENT_TYPES[exportRow.format] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="filer-export-${exportRow.id}"`,
        "X-Payload-Hash": exportRow.payloadHash,
      },
    });
  },
  { permission: "filing.entry_summary.export" }
);
