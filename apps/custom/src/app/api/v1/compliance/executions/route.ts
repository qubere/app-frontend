/**
 * GET /api/v1/compliance/executions
 *
 * Audit search endpoint over the unified ComplianceExecution envelope table
 * (Audit, Service Usage & Compliance History feature). Server-side filters,
 * pagination, and sort -- never an unbounded client-side scan. Tenant is
 * always derived from the authenticated session (ctx.accountId), never from
 * the query string. Requires `audit.read` or `compliance.read`.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validateQueryParams } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { executionSearchSchema, buildExecutionWhere } from "@/modules/compliance/executionQuery";

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const parsed = validateQueryParams(req.url, executionSearchSchema, requestId);
    if ("response" in parsed) return parsed.response;

    const { page, pageSize, sortBy, sortDir, ...filters } = parsed.data;
    const where = buildExecutionWhere(ctx.accountId, filters);

    const [total, rows] = await Promise.all([
      db.complianceExecution.count({ where }),
      db.complianceExecution.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          executionType: true,
          status: true,
          correlationId: true,
          shipmentId: true,
          partyId: true,
          productId: true,
          countryRole: true,
          countryChecked: true,
          source: true,
          initiatedByUserId: true,
          resultRefType: true,
          resultRefId: true,
          finalStatus: true,
          finalSummary: true,
          errorCategory: true,
          errorCode: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          _count: { select: { overrides: true, screeningFindings: true } },
        },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: rows.map((r) => ({
          ...r,
          overrideCount: r._count.overrides,
          findingCount: r._count.screeningFindings,
          _count: undefined,
        })),
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
        requestId,
      },
      { status: 200 }
    );
  },
  { permission: { any: ["audit.read", "compliance.read"] } }
);
