import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { RdpsDeltaImpactDispatcher } from "@/modules/compliance/rdps/deltaImpactDispatcher";

export const maxDuration = 120;

async function handleDispatch(requestId: string) {
  try {
    const result = await RdpsDeltaImpactDispatcher.dispatchPending();
    return NextResponse.json({ status: "SUCCESS", requestId, ...result });
  } catch (err: any) {
    console.error("[rdps-delta-impact-dispatch] Execution failed:", err);
    return NextResponse.json(
      { status: "FAILED", requestId, error: err.message || "RDPS delta-impact dispatch failed" },
      { status: 502 }
    );
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleDispatch(requestId));

export const POST = withCronRoute(async ({ requestId }) => handleDispatch(requestId));
