import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseCsvRows, validateBulkRows } from "@/modules/onboarding/bulkImport.service";
import type { BulkImportRow } from "@/modules/onboarding/bulkImport.service";

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const contentType = req.headers.get("content-type") ?? "";
    let rows: BulkImportRow[];

    if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
      const text = await req.text();
      rows = await parseCsvRows(text);
    } else {
      let body: { rows?: BulkImportRow[] };
      try {
        body = await req.json();
      } catch {
        return buildErrorResponse(400, "MALFORMED_JSON", "Invalid request body", undefined, requestId);
      }
      if (!Array.isArray(body.rows)) {
        return buildErrorResponse(400, "VALIDATION_ERROR", "body.rows must be an array", undefined, requestId);
      }
      rows = body.rows;
    }

    if (rows.length === 0) {
      return buildErrorResponse(400, "VALIDATION_ERROR", "No rows found in import data", undefined, requestId);
    }
    if (rows.length > 500) {
      return buildErrorResponse(400, "VALIDATION_ERROR", "Bulk import is limited to 500 rows per batch", undefined, requestId);
    }

    const result = await validateBulkRows(ctx.accountId, rows);
    return NextResponse.json({ ...result, requestId });
  },
  { permission: "onboarding.manage" }
);
