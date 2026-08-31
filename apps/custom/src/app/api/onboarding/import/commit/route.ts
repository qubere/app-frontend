import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseCsvRows, commitBulkImport } from "@/modules/onboarding/bulkImport.service";
import type { BulkImportRow } from "@/modules/onboarding/bulkImport.service";

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const contentType = req.headers.get("content-type") ?? "";
    let rows: BulkImportRow[];
    let skipInvalid = true;

    if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
      const text = await req.text();
      rows = await parseCsvRows(text);
    } else {
      let body: { rows?: BulkImportRow[]; skipInvalid?: boolean };
      try {
        body = await req.json();
      } catch {
        return buildErrorResponse(400, "MALFORMED_JSON", "Invalid request body", undefined, requestId);
      }
      if (!Array.isArray(body.rows)) {
        return buildErrorResponse(400, "VALIDATION_ERROR", "body.rows must be an array", undefined, requestId);
      }
      rows = body.rows;
      if (typeof body.skipInvalid === "boolean") skipInvalid = body.skipInvalid;
    }

    if (rows.length === 0) {
      return buildErrorResponse(400, "VALIDATION_ERROR", "No rows found in import data", undefined, requestId);
    }
    if (rows.length > 500) {
      return buildErrorResponse(400, "VALIDATION_ERROR", "Bulk import is limited to 500 rows per batch", undefined, requestId);
    }

    const result = await commitBulkImport(ctx.accountId, ctx.userId ?? null, rows, skipInvalid);
    return NextResponse.json({ ...result, requestId }, { status: 201 });
  },
  { permission: "onboarding.manage" }
);
