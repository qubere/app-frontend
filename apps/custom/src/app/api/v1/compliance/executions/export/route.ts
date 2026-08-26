/**
 * GET /api/v1/compliance/executions/export
 *
 * CSV export over the same filter set as /executions, restricted to safe
 * summary fields only -- never raw request/response snapshots, never any
 * other potentially sensitive free-text. Bounded row count to avoid an
 * unbounded export. Requires `audit.export` specifically (stricter than the
 * read-only search/summary endpoints).
 */
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validateQueryParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { executionFilterSchema, buildExecutionWhere } from "@/modules/compliance/executionQuery";

/** Hard cap on exported rows -- an audit-history export is a point-in-time report, not a full-table dump. */
const MAX_EXPORT_ROWS = 5000;

const SAFE_HEADERS = [
  "Execution ID",
  "Started At",
  "Completed At",
  "Type",
  "Source",
  "Status",
  "Final Status",
  "Shipment ID",
  "Party ID",
  "Product ID",
  "Country Checked",
  "Correlation ID",
  "Initiated By User ID",
  "Duration (ms)",
  "Override Count",
] as const;

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
}

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const parsed = validateQueryParams(req.url, executionFilterSchema, requestId);
    if ("response" in parsed) return new Response(JSON.stringify({ error: "Validation error", requestId }), { status: 400, headers: { "Content-Type": "application/json" } });

    const where = buildExecutionWhere(ctx.accountId, parsed.data);

    const rows = await db.complianceExecution.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        executionType: true,
        source: true,
        status: true,
        finalStatus: true,
        shipmentId: true,
        partyId: true,
        productId: true,
        countryChecked: true,
        correlationId: true,
        initiatedByUserId: true,
        durationMs: true,
        _count: { select: { overrides: true } },
      },
    });

    const lines = [
      SAFE_HEADERS.join(","),
      ...rows.map((r) =>
        [
          r.id,
          r.startedAt.toISOString(),
          r.completedAt ? r.completedAt.toISOString() : "",
          r.executionType,
          r.source,
          r.status,
          r.finalStatus ?? "",
          r.shipmentId ?? "",
          r.partyId ?? "",
          r.productId ?? "",
          r.countryChecked ?? "",
          r.correlationId,
          r.initiatedByUserId ?? "",
          r.durationMs ?? "",
          r._count.overrides,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ];

    return new Response(lines.join("\r\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="compliance-execution-history-${requestId}.csv"`,
      },
    });
  },
  { permission: "audit.export" }
);
