import { inngest } from "../client";
import { db } from "@/lib/db";
import { syncSearchTokensForEntities } from "@/modules/screening/searchTokenSync";

export const RPS_SEARCH_TOKEN_BACKFILL_DATASET_ID = "rps-search-token-backfill";
const DATASET_NAME = "RPS Search Token Backfill";
const BATCH_SIZE = 500;
// Mirrors candidateIndexService.ts's COVERAGE_MATERIAL_GAP_THRESHOLD -- the
// same fraction that gates whether CANDIDATE_PRIMARY trusts the index at
// read time also decides whether a backfill run that leaves that much
// coverage behind gets to report SUCCESS.
const COVERAGE_MATERIAL_GAP_THRESHOLD = 0.01;

interface BackfillCheckpoint {
  lastId: string | null;
  entitiesProcessed: number;
  tokensCreated: number;
}

function parseCheckpoint(summary: string | null | undefined): BackfillCheckpoint {
  if (!summary) return { lastId: null, entitiesProcessed: 0, tokensCreated: 0 };
  try {
    const parsed = JSON.parse(summary);
    return {
      lastId: typeof parsed.lastId === "string" ? parsed.lastId : null,
      entitiesProcessed: typeof parsed.entitiesProcessed === "number" ? parsed.entitiesProcessed : 0,
      tokensCreated: typeof parsed.tokensCreated === "number" ? parsed.tokensCreated : 0,
    };
  } catch {
    return { lastId: null, entitiesProcessed: 0, tokensCreated: 0 };
  }
}

// Manually triggered, one-shot backfill for the ~80k existing ScreeningEntity
// rows (see searchTokenGeneration.ts / candidateIndexService.ts). Ingestion
// services keep ScreeningSearchToken current for new/updated rows going
// forward -- this job only needs to run once per environment, plus again
// after any change to the token-generation logic itself.
export const rpsSearchTokenBackfillJob = (inngest.createFunction as any)(
  { id: "rps-search-token-backfill", triggers: [{ event: "rps-search-token-backfill/run.requested" }] },
  async ({ step, event }: { step: any; event: any }) => {
    const { logId, checkpoint } = await step.run("create-or-resume-run-log", async () => {
      const alreadyRunning = await db.datasetRefreshLog.findFirst({
        where: { datasetId: RPS_SEARCH_TOKEN_BACKFILL_DATASET_ID, status: "RUNNING" },
      });
      if (alreadyRunning) {
        throw new Error(
          `RPS search token backfill already has a run in progress (started ${alreadyRunning.startedAt.toISOString()}).`
        );
      }

      // Resume from the most recent FAILED run's checkpoint, if any -- a
      // crashed/killed backfill picks up after its last completed batch
      // instead of restarting the full scan from zero. Each batch is
      // idempotent (syncSearchTokensForEntities does delete-then-insert), so
      // re-processing the checkpointed batch itself would also be harmless.
      const lastFailed = await db.datasetRefreshLog.findFirst({
        where: { datasetId: RPS_SEARCH_TOKEN_BACKFILL_DATASET_ID, status: "FAILED" },
        orderBy: { startedAt: "desc" },
      });
      const resumeCheckpoint = parseCheckpoint(lastFailed?.summary);

      const log = await db.datasetRefreshLog.create({
        data: {
          datasetId: RPS_SEARCH_TOKEN_BACKFILL_DATASET_ID,
          datasetName: DATASET_NAME,
          triggeredBy: event?.name === "rps-search-token-backfill/run.requested" ? "MANUAL" : "CRON",
          status: "RUNNING",
          startedAt: new Date(),
          summary: JSON.stringify(resumeCheckpoint),
        },
      });
      return { logId: log.id, checkpoint: resumeCheckpoint };
    });

    let cursor = checkpoint.lastId;
    let entitiesProcessed = checkpoint.entitiesProcessed;
    let tokensCreated = checkpoint.tokensCreated;
    let batchIndex = 0;

    try {
      while (true) {
        const result: { ids: string[]; lastId: string | null; tokenCount: number } = await step.run(
          `process-batch-${batchIndex}`,
          async () => {
            const batch = await db.screeningEntity.findMany({
              where: cursor ? { id: { gt: cursor } } : undefined,
              orderBy: { id: "asc" },
              take: BATCH_SIZE,
              select: { id: true },
            });
            if (batch.length === 0) return { ids: [], lastId: cursor, tokenCount: 0 };

            const ids = batch.map((e) => e.id);
            await syncSearchTokensForEntities(ids);
            const tokenCount = await db.screeningSearchToken.count({ where: { screeningEntityId: { in: ids } } });

            return { ids, lastId: ids[ids.length - 1], tokenCount };
          }
        );

        if (result.ids.length === 0) break;

        cursor = result.lastId;
        entitiesProcessed += result.ids.length;
        tokensCreated += result.tokenCount;
        batchIndex += 1;

        await step.run(`checkpoint-${batchIndex}`, async () => {
          await db.datasetRefreshLog.update({
            where: { id: logId },
            data: {
              summary: JSON.stringify({ lastId: cursor, entitiesProcessed, tokensCreated }),
              itemsIngested: entitiesProcessed,
            },
          });
        });

        if (result.ids.length < BATCH_SIZE) break;
      }

      const validation: { totalEntities: number; entitiesIndexed: number; entitiesWithZeroTokens: number } =
        await step.run("validate-coverage", async () => {
          const totalEntities = await db.screeningEntity.count();
          const indexedEntityIds = await db.screeningSearchToken.findMany({
            where: { fieldType: "NAME" },
            select: { screeningEntityId: true },
            distinct: ["screeningEntityId"],
          });
          const entitiesWithZeroTokens = totalEntities - indexedEntityIds.length;
          if (entitiesWithZeroTokens > 0) {
            console.warn(
              `[rps-search-token-backfill] ${entitiesWithZeroTokens} of ${totalEntities} ScreeningEntity rows have no indexed NAME token after backfill.`
            );
          }
          return { totalEntities, entitiesIndexed: indexedEntityIds.length, entitiesWithZeroTokens };
        });

      // A gap this large means CANDIDATE_PRIMARY's own consumption-side
      // coverage gate (isIndexCoverageAcceptable) would refuse to trust the
      // index anyway -- surface that as a FAILED run instead of a silent
      // SUCCESS, so the gap is visible/actionable via DatasetRefreshLog.
      const gapFraction = validation.totalEntities === 0 ? 0 : validation.entitiesWithZeroTokens / validation.totalEntities;
      if (gapFraction > COVERAGE_MATERIAL_GAP_THRESHOLD) {
        throw new Error(
          `RPS search token backfill left ${validation.entitiesWithZeroTokens} of ${validation.totalEntities} ScreeningEntity rows (${(gapFraction * 100).toFixed(2)}%) with no indexed NAME token -- exceeds the ${COVERAGE_MATERIAL_GAP_THRESHOLD * 100}% material-gap threshold.`
        );
      }

      await step.run("finalize-run-log-success", async () => {
        await db.datasetRefreshLog.update({
          where: { id: logId },
          data: {
            status: "SUCCESS",
            summary: JSON.stringify({ lastId: cursor, entitiesProcessed, tokensCreated, ...validation }),
            itemsIngested: entitiesProcessed,
            completedAt: new Date(),
          },
        });
      });

      return { entitiesProcessed, tokensCreated, ...validation };
    } catch (err: any) {
      await step.run("finalize-run-log-failure", async () => {
        await db.datasetRefreshLog.update({
          where: { id: logId },
          data: {
            status: "FAILED",
            errorMessage: err?.message || "RPS search token backfill failed",
            summary: JSON.stringify({ lastId: cursor, entitiesProcessed, tokensCreated }),
            completedAt: new Date(),
          },
        });
      });
      throw err;
    }
  }
);
