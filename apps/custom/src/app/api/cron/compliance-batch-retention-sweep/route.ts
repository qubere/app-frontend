import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { sweepExpiredBatches } from "@/modules/complianceBatch/retention";

export const maxDuration = 60;

async function handleSweep(requestId: string) {
  try {
    const result = await sweepExpiredBatches();
    return NextResponse.json({ status: "SUCCESS", requestId, ...result });
  } catch (err: any) {
    console.error("[compliance-batch-retention-sweep] Execution failed:", err);
    return NextResponse.json(
      { status: "FAILED", requestId, error: err.message || "Compliance batch retention sweep failed" },
      { status: 502 }
    );
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleSweep(requestId));

export const POST = withCronRoute(async ({ requestId }) => handleSweep(requestId));
