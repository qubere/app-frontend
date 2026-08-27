// Continuous Party Monitoring (RDPS) -- full-population dispatcher.
//
// Advances one QUEUED/RUNNING FULL_POPULATION RdpsRun per tick, in bounded
// keyset-paginated batches (cursorPartyId, committed after every batch so a
// mid-sweep crash resumes correctly on the next tick) -- steady progress
// through a long-lived run rather than one giant transaction. Only ONE
// FULL_POPULATION run may be in flight at a time (guarded via findFirst);
// a second manual trigger while one is already running is rejected at the
// API layer (see runs/route.ts), not here.
//
// When the sweep exhausts the active-party population, this dispatcher
// immediately kicks off an EXHAUSTIVE recall-validation pass over the whole
// run's window as its own RdpsRun (runType SCHEDULED) -- the release-blocking
// safety net from rdpsRecallValidator.ts. This is deliberately a separate
// run row, not a reuse of the FULL_POPULATION run's own status field: the
// sweep's COMPLETED/PARTIAL outcome (driven by screening erroredCount) and
// the validator's COMPLETED/FAILED outcome (driven by recall gaps) are
// orthogonal signals and must not be conflated into one status.
import { db } from "@/lib/db";
import { recordRdpsOutcome } from "./outcomeRecorder";
import { getRdpsFullPopulationBatchSize } from "./config";
import { validateRecallForWindow, recordRecallValidationResult } from "../../agents/compliance/restrictedParty/rdpsRecallValidator";

export interface FullPopulationDispatchResult {
  runId: string | null;
  batchPartyCount: number;
  sweepComplete: boolean;
}

const NOOP_RESULT: FullPopulationDispatchResult = { runId: null, batchPartyCount: 0, sweepComplete: false };

export class RdpsFullPopulationDispatcher {
  static async dispatchPending(): Promise<FullPopulationDispatchResult> {
    const run = await db.rdpsRun.findFirst({
      where: { runType: "FULL_POPULATION", status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: { startedAt: "asc" },
    });
    if (!run) return NOOP_RESULT;

    if (run.status === "QUEUED") {
      await db.rdpsRun.update({ where: { id: run.id }, data: { status: "RUNNING" } });
    }

    const batchSize = getRdpsFullPopulationBatchSize();
    const parties = await db.party.findMany({
      where: { deletedAt: null, ...(run.cursorPartyId ? { id: { gt: run.cursorPartyId } } : {}) },
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true, accountId: true },
    });

    if (parties.length === 0) {
      const finalRun = await db.rdpsRun.update({
        where: { id: run.id },
        data: { status: run.erroredCount > 0 ? "PARTIAL" : "COMPLETED", completedAt: new Date() },
      });

      const validationRun = await db.rdpsRun.create({
        data: {
          runType: "SCHEDULED",
          status: "RUNNING",
          triggeredBy: `CRON:post-full-population:${finalRun.id}`,
          changeSetRangeStart: finalRun.startedAt,
          changeSetRangeEnd: new Date(),
        },
      });
      const result = await validateRecallForWindow(finalRun.startedAt, new Date());
      await recordRecallValidationResult(validationRun.id, result);

      return { runId: run.id, batchPartyCount: 0, sweepComplete: true };
    }

    let screenedCount = 0;
    let worsenedCount = 0;
    let erroredCount = 0;
    let lastPartyId = run.cursorPartyId;
    for (const party of parties) {
      // candidateReasons: [] -- a FULL_POPULATION baseline sweep row, not a
      // reference-data-change-triggered candidate.
      const outcome = await recordRdpsOutcome({ runId: run.id, accountId: party.accountId, partyId: party.id, candidateReasons: [] });
      screenedCount += 1;
      if (outcome.isWorsening) worsenedCount += 1;
      if (outcome.errored) erroredCount += 1;
      lastPartyId = party.id;
    }

    await db.rdpsRun.update({
      where: { id: run.id },
      data: {
        cursorPartyId: lastPartyId,
        candidatePartyCount: { increment: parties.length },
        screenedCount: { increment: screenedCount },
        worsenedCount: { increment: worsenedCount },
        erroredCount: { increment: erroredCount },
      },
    });

    return { runId: run.id, batchPartyCount: parties.length, sweepComplete: false };
  }
}
