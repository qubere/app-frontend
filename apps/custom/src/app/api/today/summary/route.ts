import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActionableDecisionWhereFilter } from "@/modules/decisions/decisionState";
import {
  DOCUMENT_ACTIONABLE_STATUSES,
  EXCEPTION_ACTIONABLE_STATUSES,
} from "@/modules/work/workQueue";
import { loadTodayLaneCounts } from "@/modules/today/loadTodayLanes";

/**
 * Cross-domain "Today" counts for the sidebar badge. Cheap count() queries
 * only -- the full grouped view is assembled on /app/actions itself.
 *
 * Operations is an approximation of the grouped inbox count (open decisions +
 * open exceptions + documents needing review); compliance and billing are the
 * same open-status filters the lane loaders use, and are omitted from the
 * total when the caller lacks the permission that guards that lane.
 */
export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  const [mayViewCompliance, mayViewBilling] = await Promise.all([
    hasPermission("compliance.read"),
    hasPermission("billing.exception.view"),
  ]);

  const [openDecisions, openExceptions, reviewDocuments] = await Promise.all([
    db.agentDecision.count({
      where: { accountId: ctx.accountId, ...getActionableDecisionWhereFilter() },
    }),
    db.exceptionItem.count({
      where: {
        accountId: ctx.accountId,
        status: { in: EXCEPTION_ACTIONABLE_STATUSES },
        shipmentId: { not: null },
      },
    }),
    db.shipmentDocument.count({
      where: { accountId: ctx.accountId, status: { in: DOCUMENT_ACTIONABLE_STATUSES } },
    }),
  ]);

  const operations = openDecisions + openExceptions + reviewDocuments;
  const counts = await loadTodayLaneCounts(ctx.accountId, operations);

  const compliance = mayViewCompliance ? counts.compliance : 0;
  const billing = mayViewBilling ? counts.billing : 0;

  return NextResponse.json({
    operations,
    compliance,
    billing,
    total: operations + compliance + billing,
    requestId,
  });
});
