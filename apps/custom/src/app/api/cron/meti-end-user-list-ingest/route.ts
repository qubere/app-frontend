import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { MetiForeignEndUserListIngestionService } from "@/modules/screening/metiForeignEndUserListIngestionService";

export const maxDuration = 120;

const DATASET_ID = "meti-foreign-end-user-list";
const DATASET_NAME = "METI Foreign End User List (Japan)";

async function handleIngest(requestId: string) {
  const alreadyRunning = await db.datasetRefreshLog.findFirst({
    where: { datasetId: DATASET_ID, status: "RUNNING" },
  });
  if (alreadyRunning) {
    const staleCutoffMs = maxDuration * 1000 * 1.5;
    const isStale = Date.now() - alreadyRunning.startedAt.getTime() > staleCutoffMs;
    if (!isStale) {
      return NextResponse.json(
        {
          status: "ALREADY_RUNNING",
          requestId,
          note: `METI Foreign End User List ingestion already has a run in progress (started ${alreadyRunning.startedAt.toISOString()}).`,
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
    const result = await MetiForeignEndUserListIngestionService.fetchAndIngest();
    await db.datasetRefreshLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        summary: `Parsed ${result.parsedCount} entries, ${result.supersededCount} superseded. Source checksum: ${result.checksum}.`,
        itemsIngested: result.parsedCount,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({
      status: "SUCCESS",
      requestId,
      parsedCount: result.parsedCount,
      supersededCount: result.supersededCount,
      checksum: result.checksum,
    });
  } catch (err: any) {
    const errorMessage = err.message || "METI Foreign End User List ingestion failed";
    await db.datasetRefreshLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage, completedAt: new Date() },
    });
    console.error("[meti-end-user-list-ingest] Execution failed:", err);
    return NextResponse.json({ status: "FAILED", requestId, error: errorMessage }, { status: 502 });
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleIngest(requestId));

export const POST = withCronRoute(async ({ requestId }) => handleIngest(requestId));
