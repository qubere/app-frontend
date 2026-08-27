import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { RdpsFullPopulationDispatcher } from "@/modules/compliance/rdps/fullPopulationDispatcher";

export const maxDuration = 120;

async function handleDispatch(requestId: string) {
  try {
    const result = await RdpsFullPopulationDispatcher.dispatchPending();
    return NextResponse.json({ status: "SUCCESS", requestId, ...result });
  } catch (err: any) {
    console.error("[rdps-full-population-dispatch] Execution failed:", err);
    return NextResponse.json(
      { status: "FAILED", requestId, error: err.message || "RDPS full-population dispatch failed" },
      { status: 502 }
    );
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleDispatch(requestId));

export const POST = withCronRoute(async ({ requestId }) => handleDispatch(requestId));
