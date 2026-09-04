import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { sweepExpiredReferenceData } from "@/modules/screening/referenceDataExpirySweep";

export const maxDuration = 120;

async function handleSweep(requestId: string) {
  try {
    const result = await sweepExpiredReferenceData();
    return NextResponse.json({ status: "SUCCESS", requestId, ...result });
  } catch (err: any) {
    console.error("[reference-data-expiry-sweep] Execution failed:", err);
    return NextResponse.json(
      { status: "FAILED", requestId, error: err.message || "Reference data expiry sweep failed" },
      { status: 502 }
    );
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleSweep(requestId));

export const POST = withCronRoute(async ({ requestId }) => handleSweep(requestId));
