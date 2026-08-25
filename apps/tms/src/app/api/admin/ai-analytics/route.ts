import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { getTmsAiAnalytics, TmsAiAnalyticsScope } from "@/lib/tmsAiAnalytics";

export const GET = withAuthenticatedRoute(
  async ({ req }: any) => {
    try {
      const { searchParams } = new URL(req.url);
      const level = (searchParams.get("level") as any) || "OVERALL";
      const accountId = searchParams.get("accountId") || undefined;
      const rangeDays = parseInt(searchParams.get("rangeDays") || "30", 10);

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
