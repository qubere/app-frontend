import { db } from "@/lib/db";
import {
  ShipmentStage,
  stageDefinition,
  nextStage,
  isTerminalStage,
  INITIAL_STAGE,
  StageCheckContext,
} from "./stages";

export interface StageAdvanceResult {
  advanced: boolean;
  currentStage: ShipmentStage;
  stageStatus: "IN_PROGRESS" | "GATE_PENDING" | "BLOCKED" | "COMPLETE";
  gateDecisionId?: string | null;
  reason?: string;
  historyId?: string;
}

/**
 * Builds the StageCheckContext for a given shipment by checking:
 * 1. Completed agent decisions (non-BLOCKED)
 * 2. Open ExceptionItem categories
 */
export async function buildStageCheckContext(
  shipmentId: string,
  accountId: string
): Promise<StageCheckContext> {
  const [decisions, openExceptions] = await Promise.all([
    db.agentDecision.findMany({
      where: {
        shipmentId,
        accountId,
        triageState: { notIn: ["BLOCKED", "REJECTED"] },
      },
      select: { agentName: true },
    }),
    db.exceptionItem.findMany({
      where: {
        shipmentId,
        accountId,
        status: "Open",
      },
      select: { category: true },
    }),
  ]);

  const completedAgents = new Set<string>(decisions.map((d) => d.agentName));
  const openExceptionCategories = new Set<string>(
    openExceptions.map((e) => e.category).filter((c): c is string => Boolean(c))
  );

  return { completedAgents, openExceptionCategories };
}

/**
 * Evaluates and advances the stage for a shipment if all entry/completion criteria are met.
 * Handles auto-advance vs HUMAN_GATE mode via StageGatePolicy.
 */
export async function evaluateAndAdvanceShipmentStage(
  shipmentId: string,
  accountId: string,
  triggerByUserId?: string
): Promise<StageAdvanceResult> {
  const shipment = await db.shipment.findFirst({
    where: { id: shipmentId, accountId },
    select: {
      id: true,
      currentStage: true,
      stageStatus: true,
      stageEnteredAt: true,
      entryType: true,
      autoAdvance: true,
    },
  });

  if (!shipment) {
    throw new Error(`Shipment ${shipmentId} not found`);
  }

  // If autoAdvance is turned off for this shipment or stageStatus is BLOCKED (circuit breaker), pause
  if (shipment.autoAdvance === false) {
    return {
      advanced: false,
      currentStage: (shipment.currentStage as ShipmentStage) || INITIAL_STAGE,
      stageStatus: (shipment.stageStatus as any) || "IN_PROGRESS",
      reason: "Per-shipment auto-advance is disabled.",
    };
  }

  if (shipment.stageStatus === "BLOCKED") {
    return {
      advanced: false,
      currentStage: (shipment.currentStage as ShipmentStage) || INITIAL_STAGE,
      stageStatus: "BLOCKED",
      reason: "Circuit breaker is open (stage execution blocked).",
    };
  }

  const current = (shipment.currentStage as ShipmentStage) || INITIAL_STAGE;
  const ctx = await buildStageCheckContext(shipmentId, accountId);
  const def = stageDefinition(current);

  const isComplete = def.isComplete(ctx);

  if (!isComplete) {
    return {
      advanced: false,
      currentStage: current,
      stageStatus: (shipment.stageStatus as any) || "IN_PROGRESS",
      reason: `Stage ${current} requirements not complete.`,
    };
  }

  // Stage criteria is complete! Check StageGatePolicy for current stage.
  // Resolution order: exact (stage, entryType) -> (stage, null) -> default AUTO_ADVANCE
  let policy = null;
  if (shipment.entryType) {
    policy = await db.stageGatePolicy.findFirst({
      where: { accountId, stage: current, entryType: shipment.entryType },
    });
  }
  if (!policy) {
    policy = await db.stageGatePolicy.findFirst({
      where: { accountId, stage: current, entryType: null },
    });
  }

  const mode = policy?.mode || "AUTO_ADVANCE";

  if (mode === "HUMAN_GATE") {
    // Only a gate decision raised during the CURRENT visit to this stage
    // counts. A stale APPROVED gate from a previous pass (before a manual
    // override / breaker reset sent the shipment back here) must not
    // silently auto-advance past a fresh gate.
    const stageEntryFloor = shipment.stageEnteredAt ?? new Date(0);
    const existingGateDecision = await db.agentDecision.findFirst({
      where: {
        shipmentId,
        accountId,
        agentName: "Stage Gate",
        purpose: `Human gate review for stage ${current}`,
        createdAt: { gte: stageEntryFloor },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingGateDecision?.status === "Approved" || existingGateDecision?.triageState === "APPROVED") {
      // Gate has been approved by human -> proceed with stage advance below
    } else {
      // Create or update Stage Gate review decision
      let gateDecision = existingGateDecision;
      if (!gateDecision) {
        gateDecision = await db.agentDecision.create({
          data: {
            accountId,
            shipmentId,
            agentName: "Stage Gate",
            status: "Review Required",
            triageState: "NEEDS_REVIEW",
            purpose: `Human gate review for stage ${current}`,
            decisionSummary:
              policy?.gateReason ||
              `Stage gate for ${def.label} requires ${policy?.minimumReviewerRole || "SPECIALIST"} approval before advancing.`,
            dataSources: ["Stage Gate Policy", "Workflow Engine"],
          },
        });
      }

      await db.shipment.update({
        where: { id: shipmentId },
        data: {
          stageStatus: "GATE_PENDING",
          stageUpdatedAt: new Date(),
        },
      });

      return {
        advanced: false,
        currentStage: current,
        stageStatus: "GATE_PENDING",
        gateDecisionId: gateDecision.id,
        reason: "Stage gate requires human approval.",
      };
    }
  }

  // Advance to next stage!
  const next = nextStage(current);
  if (!next) {
    // Already at terminal stage (READY_TO_FILE)
    await db.shipment.update({
      where: { id: shipmentId },
      data: {
        stageStatus: "COMPLETE",
        stageUpdatedAt: new Date(),
      },
    });

    return {
      advanced: false,
      currentStage: current,
      stageStatus: "COMPLETE",
      reason: "Terminal stage reached.",
    };
  }

  const now = new Date();

  // Close previous stage history if any
  const openHistory = await db.shipmentStageHistory.findFirst({
    where: { shipmentId, stage: current, exitedAt: null },
    orderBy: { enteredAt: "desc" },
  });
  if (openHistory) {
    await db.shipmentStageHistory.update({
      where: { id: openHistory.id },
      data: {
        exitedAt: now,
        outcome: mode === "HUMAN_GATE" ? "GATE_APPROVED" : "ADVANCED",
        advancedBy: triggerByUserId || "SYSTEM",
      },
    });
  }

  // Create new stage history for next
  const newHistory = await db.shipmentStageHistory.create({
    data: {
      accountId,
      shipmentId,
      stage: next,
      enteredAt: now,
      outcome: "ADVANCED",
      advancedBy: triggerByUserId || "SYSTEM",
    },
  });

  const nextStatus = isTerminalStage(next) ? "COMPLETE" : "IN_PROGRESS";

  await db.shipment.update({
    where: { id: shipmentId },
    data: {
      currentStage: next,
      stageStatus: nextStatus,
      stageEnteredAt: now,
      stageUpdatedAt: now,
    },
  });

  // Check if next stage can also auto-advance (cascade)
  if (nextStatus === "IN_PROGRESS") {
    const cascadeResult = await evaluateAndAdvanceShipmentStage(shipmentId, accountId, triggerByUserId);
    if (cascadeResult.advanced) {
      return cascadeResult;
    }
  }

  return {
    advanced: true,
    currentStage: next,
    stageStatus: nextStatus,
    historyId: newHistory.id,
  };
}

/** Consecutive FAILED attempts at this stage trips the breaker. */
const BREAKER_THRESHOLD = 3;

/**
 * Records a stage execution failure attempt for a shipment and trips the
 * circuit breaker after BREAKER_THRESHOLD *consecutive* failures (a
 * SUCCEEDED run or a breaker reset resets the streak). No-ops when the
 * breaker is already open so it can't stack duplicate exceptions.
 */
export async function recordStageFailureAndCheckBreaker(
  shipmentId: string,
  accountId: string,
  stage: ShipmentStage,
  failureReason: string
) {
  const shipmentRow = await db.shipment.findFirst({
    where: { id: shipmentId, accountId },
    select: { stageStatus: true },
  });
  if (shipmentRow?.stageStatus === "BLOCKED") {
    return { breakerTripped: true, alreadyOpen: true, attempt: null as number | null };
  }

  const runs = await db.pipelineStageRun.findMany({
    where: { shipmentId, stage },
    orderBy: { attempt: "asc" },
  });

  // `attempt` stays monotonic (satisfies @@unique([shipmentId, stage, attempt])).
  const nextAttempt = (runs[runs.length - 1]?.attempt ?? 0) + 1;

  // Count consecutive trailing FAILED runs, then add this one.
  let consecutive = 1;
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].status === "FAILED") consecutive++;
    else break; // SUCCEEDED / BREAKER_OPEN ends the streak
  }

  const now = new Date();

  if (consecutive >= BREAKER_THRESHOLD) {
    await db.pipelineStageRun.create({
      data: {
        accountId,
        shipmentId,
        stage,
        attempt: nextAttempt,
        status: "BREAKER_OPEN",
        failureReason,
        breakerTrippedAt: now,
      },
    });

    await db.shipment.update({
      where: { id: shipmentId },
      data: { stageStatus: "BLOCKED", stageUpdatedAt: now },
    });

    await db.shipmentStageHistory.create({
      data: {
        accountId,
        shipmentId,
        stage,
        enteredAt: now,
        outcome: "BREAKER_TRIPPED",
        note: `Circuit breaker tripped after ${consecutive} consecutive failed attempts: ${failureReason}`,
      },
    });

    const def = stageDefinition(stage);
    await db.exceptionItem.create({
      data: {
        accountId,
        shipmentId,
        category: "SYSTEM",
        type: "broker_hold",
        severity: "Critical",
        description: `${def.label} stage failed ${consecutive}× — manual review required.`,
        requiredAction: `Review execution error: ${failureReason}. Reset breaker from stage stepper when resolved.`,
        blocking: true,
        sourceAgent: "Workflow Engine",
      },
    });

    return { breakerTripped: true, attempt: nextAttempt };
  }

  await db.pipelineStageRun.create({
    data: {
      accountId,
      shipmentId,
      stage,
      attempt: nextAttempt,
      status: "FAILED",
      failureReason,
    },
  });

  return { breakerTripped: false, attempt: nextAttempt };
}

/**
 * Records a successful stage execution — resets the consecutive-failure
 * streak so a later failure starts counting from zero.
 */
export async function recordStageSuccess(
  shipmentId: string,
  accountId: string,
  stage: ShipmentStage
) {
  const runs = await db.pipelineStageRun.findMany({
    where: { shipmentId, stage },
    orderBy: { attempt: "desc" },
    take: 1,
  });
  if (runs.length === 0) return; // nothing failed, nothing to reset
  const nextAttempt = (runs[0]?.attempt ?? 0) + 1;
  await db.pipelineStageRun.create({
    data: { accountId, shipmentId, stage, attempt: nextAttempt, status: "SUCCEEDED" },
  });
}

