import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { FbiWantedIngestionService } from "@/modules/screening/fbiWantedIngestionService";

export const maxDuration = 120;

const DATASET_ID = "fbi-wanted";
const DATASET_NAME = "FBI Wanted";

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
          note: `FBI Wanted ingestion already has a run in progress (started ${alreadyRunning.startedAt.toISOString()}).`,
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
    const result = await FbiWantedIngestionService.fetchAndIngest();
    await db.datasetRefreshLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        summary: `Ingested ${result.count} named subjects (reported total ${result.reportedTotal}, ${result.supersededCount} superseded).`,
        itemsIngested: result.count,
        sourceReportedTotal: result.reportedTotal,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({
      status: "SUCCESS",
      requestId,
      count: result.count,
      reportedTotal: result.reportedTotal,
      supersededCount: result.supersededCount,
    });
  } catch (err: any) {
    const errorMessage = err.message || "FBI Wanted ingestion failed";
    await db.datasetRefreshLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage, completedAt: new Date() },
    });
    console.error("[fbi-wanted-ingest] Execution failed:", err);
    return NextResponse.json({ status: "FAILED", requestId, error: errorMessage }, { status: 502 });
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleIngest(requestId));

export const POST = withCronRoute(async ({ requestId }) => handleIngest(requestId));
