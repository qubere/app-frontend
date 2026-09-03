import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { RPS_SEARCH_TOKEN_BACKFILL_DATASET_ID } from "@/lib/inngest/functions/restrictedPartySearchTokenBackfill";

// One-shot, manually-triggered backfill of ScreeningSearchToken for the
// existing ~80k ScreeningEntity corpus (see restrictedPartySearchTokenBackfill.ts).
// This route only enqueues the durable Inngest job and returns immediately;
// that job owns the DatasetRefreshLog RUNNING/SUCCESS/FAILED lifecycle itself.
export const POST = withCronRoute(async ({ requestId }) => {
  const alreadyRunning = await db.datasetRefreshLog.findFirst({
    where: { datasetId: RPS_SEARCH_TOKEN_BACKFILL_DATASET_ID, status: "RUNNING" },
  });
  if (alreadyRunning) {
    return NextResponse.json(
      {
        status: "ALREADY_RUNNING",
        requestId,
        note: `RPS search token backfill already has a run in progress (started ${alreadyRunning.startedAt.toISOString()}).`,
      },
      { status: 409 }
    );
  }

  await inngest.send({ name: "rps-search-token-backfill/run.requested", data: { requestId } });

  return NextResponse.json({
    status: "ENQUEUED",
    requestId,
    note: "RPS search token backfill enqueued as a background Inngest job. Check the Dataset Refresh Log for completion.",
  });
});
