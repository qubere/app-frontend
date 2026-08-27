/**
 * GET /api/compliance/rdps/reports/summary
 *
 * Tenant-scoped RDPS reporting summary (monitored-party count, open alerts,
 * recent activity, last run status per run type).
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { getReportsSummary } from "@/modules/compliance/rdps/rdpsQueryService";

export const GET = withAuthenticatedRoute(
  async ({ ctx, requestId }) => {
    const summary = await getReportsSummary(ctx.accountId);
    return NextResponse.json({ summary, requestId });
  },
  { permission: "compliance.rdps.read" }
);
