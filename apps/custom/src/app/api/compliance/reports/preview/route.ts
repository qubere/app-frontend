import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { getCatalogEntry } from "@/modules/reports/catalog";
import { REPORT_QUERIES } from "@/modules/reports/queries";
import { PREVIEW_ROW_LIMIT } from "@/modules/reports/queryHelpers";

/** Bounded preview: never generates a full file, always capped to PREVIEW_ROW_LIMIT rows. */
export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json().catch(() => null);
  const reportType = typeof body?.reportType === "string" ? body.reportType : undefined;
  const filters = (body?.filters ?? {}) as Record<string, unknown>;

  if (!reportType) {
    return NextResponse.json({ error: "reportType is required.", code: "INVALID_REQUEST" }, { status: 400 });
  }

  const catalogEntry = getCatalogEntry(reportType);
  const queryFn = REPORT_QUERIES[reportType];
  if (!catalogEntry || !queryFn) {
    return NextResponse.json({ error: "Unknown report type.", code: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const { rows, totalCount } = await queryFn(ctx.accountId, filters, PREVIEW_ROW_LIMIT);
    return NextResponse.json({ columns: catalogEntry.columns, rows, totalCount, previewLimit: PREVIEW_ROW_LIMIT });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to preview report.", code: "QUERY_ERROR" },
      { status: 500 }
    );
  }
}, { permission: "compliance.reports.generate" });
