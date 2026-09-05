/**
 * Stage-gate engine surface for autonomous shipment stage advancement.
 *
 * The primitives live in `@/lib/workflow/stageEngine` and are called reactively
 * from the pipeline orchestrator and from decision/exception resolution. This
 * module adds the *proactive* path: a backstop sweep that re-evaluates every
 * in-progress shipment whose gate may have opened for a reason that never wrote
 * to a decision or exception (a deadline passing, an external tracking event,
 * an auto-advance toggle flipped). It is driven by the `stage-advance` cron.
 */
import { db } from "@/lib/db";
import {
  evaluateAndAdvanceShipmentStage,
  type StageAdvanceResult,
} from "@/lib/workflow/stageEngine";

export {
  evaluateAndAdvanceShipmentStage,
  buildStageCheckContext,
  recordStageFailureAndCheckBreaker,
  recordStageSuccess,
  type StageAdvanceResult,
} from "@/lib/workflow/stageEngine";

export interface StageSweepResult {
  shipmentsChecked: number;
  shipmentsAdvanced: number;
  advancedShipmentIds: string[];
  errors: number;
}

/**
 * Re-evaluates the stage gate for every non-terminal, non-blocked shipment
 * across all accounts and advances the ones whose gate now passes. Safe to run
 * on a schedule: `evaluateAndAdvanceShipmentStage` is idempotent and a no-op
 * when nothing changed.
 */
export async function sweepStuckShipmentStages(
  opts: { batchSize?: number } = {}
): Promise<StageSweepResult> {
  const batchSize = opts.batchSize ?? 250;

  const candidates = await db.shipment.findMany({
    where: {
      deletedAt: null,
      autoAdvance: true,
      stageStatus: { in: ["IN_PROGRESS", "GATE_PENDING"] },
      currentStage: { notIn: ["DELIVERED", "CLOSED", "CANCELLED"] },
    },
    select: { id: true, accountId: true },
    orderBy: { stageUpdatedAt: "asc" },
    take: batchSize,
  });

  const result: StageSweepResult = {
    shipmentsChecked: candidates.length,
    shipmentsAdvanced: 0,
    advancedShipmentIds: [],
    errors: 0,
  };

  for (const shipment of candidates) {
    try {
      const outcome: StageAdvanceResult = await evaluateAndAdvanceShipmentStage(
        shipment.id,
        shipment.accountId,
        "SYSTEM"
      );
      if (outcome.advanced) {
        result.shipmentsAdvanced += 1;
        result.advancedShipmentIds.push(shipment.id);
      }
    } catch {
      result.errors += 1;
    }
  }

  return result;
}
