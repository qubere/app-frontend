/**
 * GET /api/compliance/license-alerts -- current expiry/utilization alerts
 * for the tenant (computed on demand, not persisted).
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { computeLicenseAlerts } from "@/modules/licenses/alertsService";

export const GET = withAuthenticatedRoute(
  async ({ ctx, requestId }) => {
    const alerts = await computeLicenseAlerts(ctx.accountId);
    return NextResponse.json({ alerts, requestId });
  },
  { permission: "licenses.alerts" }
);
