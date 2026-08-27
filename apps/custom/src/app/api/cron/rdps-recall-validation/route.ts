import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import {
  validateRecallForWindow,
  recordRecallValidationResult,
  selectRecallValidationSample,
} from "@/modules/agents/compliance/restrictedParty/rdpsRecallValidator";
import { getRdpsRecallValidationSampleSize } from "@/modules/compliance/rdps/config";

export const maxDuration = 120;

/**
 * Daily bounded-sample recall validation -- the cost-bounded counterpart to
 * the exhaustive check RdpsFullPopulationDispatcher runs after every
 * FULL_POPULATION sweep. Samples the least-recently-validated parties so
 * coverage rotates across the population over time rather than always
 * checking the same slice.
 */
async function handleDispatch(requestId: string) {
  try {
    const sampleSize = getRdpsRecallValidationSampleSize();
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

    const sample = await selectRecallValidationSample(sampleSize);

    const run = await db.rdpsRun.create({
      data: {
        runType: "SCHEDULED",
        status: "RUNNING",
        triggeredBy: "CRON:recall-validation-daily",
        changeSetRangeStart: windowStart,
        changeSetRangeEnd: windowEnd,
      },
    });

    const result = await validateRecallForWindow(windowStart, windowEnd, { partyIdSample: sample });
    await recordRecallValidationResult(run.id, result);

    return NextResponse.json({ status: "SUCCESS", requestId, runId: run.id, ...result });
  } catch (err: any) {
    console.error("[rdps-recall-validation] Execution failed:", err);
    return NextResponse.json(
      { status: "FAILED", requestId, error: err.message || "RDPS recall validation failed" },
      { status: 502 }
    );
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleDispatch(requestId));

export const POST = withCronRoute(async ({ requestId }) => handleDispatch(requestId));
