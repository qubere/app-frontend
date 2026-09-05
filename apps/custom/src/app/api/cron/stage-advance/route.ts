import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { sweepStuckShipmentStages } from "@/modules/work/stageGateEngine";

export const maxDuration = 120;

async function handleSweep(requestId: string): Promise<Response> {
  try {
    const sweep = await sweepStuckShipmentStages();
    return NextResponse.json({ status: "OK", requestId, sweep });
  } catch (err: any) {
    return NextResponse.json(
      { status: "ERROR", requestId, error: err?.message || "Stage advance sweep failed" },
      { status: 500 }
    );
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleSweep(requestId));
export const POST = withCronRoute(async ({ requestId }) => handleSweep(requestId));
