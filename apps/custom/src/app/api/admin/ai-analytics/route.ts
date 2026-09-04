import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { getAiUsageAnalytics } from "@/lib/ai/aiUsageAnalytics";

export const GET = withAuthenticatedRoute(
  async ({ req }: any) => {
    try {
      const { searchParams } = new URL(req.url);
      const rangeDays = parseInt(searchParams.get("rangeDays") || "30", 10);

      const data = await getAiUsageAnalytics(rangeDays);
      return NextResponse.json(data);
    } catch (err) {
      console.error("[api/admin/ai-analytics] Error loading AI telemetry data:", err);
      return NextResponse.json({ error: "Failed to load AI analytics" }, { status: 500 });
    }
  },
  { permission: "admin.view", write: false }
);
