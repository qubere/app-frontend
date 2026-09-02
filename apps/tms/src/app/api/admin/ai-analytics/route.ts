import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { getTmsAiAnalytics, TmsAiAnalyticsScope } from "@/lib/tmsAiAnalytics";

export const GET = withAuthenticatedRoute(
  async ({ req, ctx }: any) => {
    try {
      const { searchParams } = new URL(req.url);
      const requestedLevel = (searchParams.get("level") as any) || "OVERALL";
      const requestedAccountId = searchParams.get("accountId") || undefined;
      const rangeDays = parseInt(searchParams.get("rangeDays") || "30", 10);

      // OVERALL aggregates every tenant's usage, and ACCOUNT can be pointed at
      // any accountId — both are platform-admin-only views. A regular tenant
      // caller (gated only by the per-tenant admin.view permission) is locked
      // to its own account regardless of what the query string asks for.
      const level: TmsAiAnalyticsScope["level"] = ctx.isPlatformAdmin ? requestedLevel : "ACCOUNT";
      const accountId = ctx.isPlatformAdmin ? requestedAccountId : ctx.accountId;

      const scope: TmsAiAnalyticsScope = {
        level,
        accountId,
        rangeDays,
      };

      const data = await getTmsAiAnalytics(scope);
      return NextResponse.json(data);
    } catch (err) {
      console.error("[api/admin/ai-analytics] Error loading AI telemetry data:", err);
      return NextResponse.json({ error: "Failed to load AI analytics" }, { status: 500 });
    }
  },
  { permission: "admin.view", write: false }
);
