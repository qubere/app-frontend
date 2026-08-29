import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { ComplianceBatchDispatcher } from "@/modules/complianceBatch/dispatcher";

export const maxDuration = 120;

async function handleDispatch(requestId: string) {
  try {
    const result = await ComplianceBatchDispatcher.dispatchPending();
    return NextResponse.json({ status: "SUCCESS", requestId, ...result });
  } catch (err: any) {
    console.error("[compliance-batch-dispatch] Execution failed:", err);
    return NextResponse.json(
      { status: "FAILED", requestId, error: err.message || "Compliance batch dispatch failed" },
      { status: 502 }
    );
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleDispatch(requestId));

export const POST = withCronRoute(async ({ requestId }) => handleDispatch(requestId));
