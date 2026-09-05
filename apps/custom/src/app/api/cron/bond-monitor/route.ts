import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { BondMonitoringService } from "@/modules/onboarding/bondMonitoring.service";

export const maxDuration = 60;

async function handleSweep(requestId: string): Promise<Response> {
  try {
    const sweepResult = await BondMonitoringService.runBondMonitoringSweep();
    return NextResponse.json({
      status: "OK",
      requestId,
      sweep: sweepResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "ERROR",
        requestId,
        error: err.message || "Failed to execute bond monitoring sweep",
      },
      { status: 500 }
    );
  }
}

export const GET = withCronRoute(async ({ requestId }) => {
  return handleSweep(requestId);
});

export const POST = withCronRoute(async ({ requestId }) => {
  return handleSweep(requestId);
});
