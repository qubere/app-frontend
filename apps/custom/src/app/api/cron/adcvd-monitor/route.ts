import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { AdcvdMonitoringService } from "@/modules/adcvd/adcvdMonitoring.service";

export const maxDuration = 60;

async function handleSweep(requestId: string): Promise<Response> {
  try {
    const sweepResult = await AdcvdMonitoringService.runAdcvdMonitoringSweep();
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
        error: err.message || "Failed to execute AD/CVD monitoring sweep",
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
