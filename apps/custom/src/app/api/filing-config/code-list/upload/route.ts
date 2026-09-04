import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { hasCsvExtension, CsvParseError } from "@/modules/filingConfig/codeListCsv";
import { importCodeListCsv } from "@/modules/filingConfig/codeListService";

/** 8 MB is roughly 40,000 rows -- matches the party importer's limit. */
const uploadSchema = z.object({
  content: z.string().min(1).max(8_000_000),
  fileName: z.string().trim().max(255).optional(),
});

/**
 * POST /api/filing-config/code-list/upload
 * Bulk-loads FilingCodeListHeader + FilingCodeListItem +
 * FilingCodeListItemTranslation from one CSV in a single request. Each row
 * is independent for write purposes: a malformed row is reported and
 * skipped rather than failing the whole file.
 */
export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    if (!ctx.isPlatformAdmin) {
      return buildErrorResponse(403, "FORBIDDEN", "Filing configuration is available to Platform Admins only.", undefined, requestId);
    }

    const body = await parseAndValidateBody(req, uploadSchema, requestId);
    if ("response" in body) return body.response;

    if (body.data.fileName && !hasCsvExtension(body.data.fileName)) {
      return buildErrorResponse(400, "INVALID_FILE", "Please upload a CSV file (.csv).", undefined, requestId);
    }

    try {
      const summary = await importCodeListCsv(body.data.content, ctx.userId ?? "system");
      return NextResponse.json({ summary, requestId });
    } catch (err) {
      if (err instanceof CsvParseError) {
        return buildErrorResponse(400, "INVALID_FILE", err.message, undefined, requestId);
      }
      throw err;
    }
  },
  { write: true }
);
