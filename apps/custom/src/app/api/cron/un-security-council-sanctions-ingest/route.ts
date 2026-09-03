import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { UnSecurityCouncilSanctionsIngestionService } from "@/modules/screening/unSecurityCouncilSanctionsIngestionService";

export const maxDuration = 120;

const DATASET_ID = "un-security-council-sanctions";
const DATASET_NAME = "UN Security Council Consolidated List";

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
          note: `UN Security Council Consolidated List ingestion already has a run in progress (started ${alreadyRunning.startedAt.toISOString()}).`,
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
    const result = await UnSecurityCouncilSanctionsIngestionService.fetchAndIngest();
    await db.datasetRefreshLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        summary: `Parsed ${result.parsedCount} records, ${result.supersededCount} superseded.`,
        itemsIngested: result.parsedCount,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({
      status: "SUCCESS",
      requestId,
      parsedCount: result.parsedCount,
      supersededCount: result.supersededCount,
    });
  } catch (err: any) {
    const errorMessage = err.message || "UN Security Council Consolidated List ingestion failed";
    await db.datasetRefreshLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage, completedAt: new Date() },
    });
    console.error("[un-security-council-sanctions-ingest] Execution failed:", err);
    return NextResponse.json({ status: "FAILED", requestId, error: errorMessage }, { status: 502 });
  }
}

export const GET = withCronRoute(async ({ requestId }) => handleIngest(requestId));

export const POST = withCronRoute(async ({ requestId }) => handleIngest(requestId));
