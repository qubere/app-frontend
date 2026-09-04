import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { BisCslIngestionService } from "@/modules/screening/bisCslIngestionService";

export const maxDuration = 300;

const DATASET_ID = "bis-consolidated-screening-list";
const DATASET_NAME = "BIS Consolidated Screening List";

async function handleIngest(requestId: string) {
  const alreadyRunning = await db.datasetRefreshLog.findFirst({
    where: { datasetId: DATASET_ID, status: "RUNNING" },
  });
  if (alreadyRunning) {
    // A RUNNING row older than this route's own execution ceiling means the
    // prior invocation was killed (timeout/crash) before reaching its catch
    // block, so it can never self-heal -- reclaim it instead of deadlocking
    // every future run behind a 409 forever.
    const staleCutoffMs = maxDuration * 1000 * 1.5;
    const isStale = Date.now() - alreadyRunning.startedAt.getTime() > staleCutoffMs;
    if (!isStale) {
      return NextResponse.json(
        {
          status: "ALREADY_RUNNING",
          requestId,
          note: `BIS CSL ingestion already has a run in progress (started ${alreadyRunning.startedAt.toISOString()}).`,
        },
        { status: 409 }
      );
    }
    await db.datasetRefreshLog.update({
      where: { id: alreadyRunning.id },
      data: {
        status: "FAILED",
        errorMessage: "Run superseded: exceeded execution ceiling without completing (stale RUNNING row reclaimed).",
        completedAt: new Date(),
      },
    });
  }

  const log = await db.datasetRefreshLog.create({
    data: { datasetId: DATASET_ID, datasetName: DATASET_NAME, triggeredBy: "CRON", status: "RUNNING" },
  });

  try {
    // staged=false: publish directly, matching every other government-source
    // ingester (OFAC SDN, UFLPA Entity List) -- nothing in this codebase ever
    // calls publishStagedEntities(), so staging here left every BIS CSL row
    // (Entity List, DPL, MEU List, etc.) permanently stuck as DRAFT and
    // invisible to screening.
    const result = await BisCslIngestionService.fetchAndIngest(undefined, false);
    await db.datasetRefreshLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        summary: `${result.note} (${result.count} entries, ${result.supersededCount} superseded).`,
        itemsIngested: result.count,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({
      status: "SUCCESS",
      requestId,
      count: result.count,
      supersededCount: result.supersededCount,
      note: result.note,
    });
  } catch (err: any) {
    const errorMessage = err.message || "BIS CSL ingestion failed";
    await db.datasetRefreshLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage, completedAt: new Date() },
    });
    console.error("[bis-csl-ingest] Execution failed:", err);
    return NextResponse.json({ status: "FAILED", requestId, error: errorMessage }, { status: 502 });
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleIngest(requestId));

export const POST = withCronRoute(async ({ requestId }) => handleIngest(requestId));
