/**
 * GET /api/v1/compliance/executions/summary
 *
 * Service-usage summary endpoint: aggregate counts over the SAME filter set
 * as the search endpoint (executionFilterSchema / buildExecutionWhere), so
 * the two always reconcile -- summary.total must always equal the total a
 * search with identical filters reports. Uses Prisma groupBy/aggregate, not
 * a client-side loop over unbounded rows. Requires `audit.read` or
 * `compliance.read`.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validateQueryParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { executionFilterSchema, buildExecutionWhere } from "@/modules/compliance/executionQuery";

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const parsed = validateQueryParams(req.url, executionFilterSchema, requestId);
    if ("response" in parsed) return parsed.response;

    const where = buildExecutionWhere(ctx.accountId, parsed.data);

    const [total, byType, byStatus, bySource, durationAgg, reviewRequiredCount, overriddenCount] = await Promise.all([
      db.complianceExecution.count({ where }),
      db.complianceExecution.groupBy({ by: ["executionType"], where, _count: { _all: true } }),
      db.complianceExecution.groupBy({ by: ["status"], where, _count: { _all: true } }),
      db.complianceExecution.groupBy({ by: ["source"], where, _count: { _all: true } }),
      db.complianceExecution.aggregate({ where, _avg: { durationMs: true } }),
      db.complianceExecution.count({ where: { ...where, status: { in: ["FAILED", "PARTIAL"] } } }),
      db.complianceExecution.count({ where: { ...where, overrides: { some: {} } } }),
    ]);

    return NextResponse.json(
      {
        success: true,
        summary: {
          total,
          byType: byType.map((r) => ({ executionType: r.executionType, count: r._count._all })),
          byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
          bySource: bySource.map((r) => ({ source: r.source, count: r._count._all })),
          reviewRequiredCount,
          overriddenCount,
          avgDurationMs: durationAgg._avg.durationMs ?? null,
        },
        requestId,
      },
      { status: 200 }
    );
  },
  { permission: { any: ["audit.read", "compliance.read"] } }
);
