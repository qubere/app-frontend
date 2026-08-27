// Continuous Party Monitoring (RDPS) -- delta-impact dispatcher.
//
// One cron tick == one DELTA_IMPACT RdpsRun. Claims a bounded batch of
// unconsumed ReferenceDataChangeSet rows (optimistic per-row updateMany
// claim, mirroring CommunityScreeningDispatcher's idiom), builds the reverse
// party-identity index ONCE for the whole batch, unions impacted-party
// candidates across every changed entity in the batch (so a party impacted
// by two changed entities in the same tick is rescreened once, not twice),
// then records one outcome per candidate via the shared outcomeRecorder --
// the exact same recorder FULL_POPULATION uses, so behavior never forks
// between the two run types.
import { db } from "@/lib/db";
import { buildPartyIdentityIndex, findImpactedParties } from "../../agents/compliance/restrictedParty/impactAnalysis";
import type { CandidateReason } from "../../agents/compliance/restrictedParty/candidateGeneration";
import type { ScreeningEntityWithAddresses } from "../../agents/compliance/restrictedParty/restrictedPartyRepository";
import { recordRdpsOutcome } from "./outcomeRecorder";
import { getRdpsDeltaImpactBatchSize } from "./config";

export interface DeltaImpactDispatchResult {
  runId: string | null;
  changeSetCount: number;
  candidatePartyCount: number;
  screenedCount: number;
  worsenedCount: number;
  erroredCount: number;
}

const NOOP_RESULT: DeltaImpactDispatchResult = {
  runId: null,
  changeSetCount: 0,
  candidatePartyCount: 0,
  screenedCount: 0,
  worsenedCount: 0,
  erroredCount: 0,
};

export class RdpsDeltaImpactDispatcher {
  static async dispatchPending(): Promise<DeltaImpactDispatchResult> {
    const batchSize = getRdpsDeltaImpactBatchSize();

    const pending = await db.referenceDataChangeSet.findMany({
      where: { consumedAt: null },
      take: batchSize,
      orderBy: { occurredAt: "asc" },
    });
    if (pending.length === 0) return NOOP_RESULT;

    const occurredAts = pending.map((c) => c.occurredAt.getTime());
    const run = await db.rdpsRun.create({
      data: {
        runType: "DELTA_IMPACT",
        status: "RUNNING",
        triggeredBy: "CRON",
        changeSetRangeStart: new Date(Math.min(...occurredAts)),
        changeSetRangeEnd: new Date(Math.max(...occurredAts)),
        changeSetCount: pending.length,
      },
    });

    const claimed: typeof pending = [];
    for (const row of pending) {
      const claim = await db.referenceDataChangeSet.updateMany({
        where: { id: row.id, consumedAt: null },
        data: { consumedAt: new Date(), consumedByRunId: run.id },
      });
      if (claim.count === 1) claimed.push(row);
    }

    if (claimed.length === 0) {
      await db.rdpsRun.update({ where: { id: run.id }, data: { status: "COMPLETED", completedAt: new Date(), candidatePartyCount: 0 } });
      return { ...NOOP_RESULT, runId: run.id };
    }

    const rollbackClaims = async () => {
      await db.referenceDataChangeSet.updateMany({
        where: { id: { in: claimed.map((c) => c.id) } },
        data: { consumedAt: null, consumedByRunId: null },
      });
    };

    let changedEntities: ScreeningEntityWithAddresses[];
    try {
      const entityIds = Array.from(new Set(claimed.map((c) => c.screeningEntityId)));
      changedEntities = await db.screeningEntity.findMany({ where: { id: { in: entityIds } }, include: { addresses: true, aliases: true } });

      const index = await buildPartyIdentityIndex();

      const candidatesByParty = new Map<string, { accountId: string; reasons: Set<CandidateReason> }>();
      for (const entity of changedEntities) {
        for (const match of findImpactedParties(entity, index)) {
          const existing = candidatesByParty.get(match.partyId);
          if (existing) {
            match.reasons.forEach((r) => existing.reasons.add(r));
          } else {
            candidatesByParty.set(match.partyId, { accountId: match.accountId, reasons: new Set(match.reasons) });
          }
        }
      }

      let screenedCount = 0;
      let worsenedCount = 0;
      let erroredCount = 0;
      for (const [partyId, { accountId, reasons }] of candidatesByParty) {
        const outcome = await recordRdpsOutcome({ runId: run.id, accountId, partyId, candidateReasons: Array.from(reasons) });
        screenedCount += 1;
        if (outcome.isWorsening) worsenedCount += 1;
        if (outcome.errored) erroredCount += 1;
      }

      await db.rdpsRun.update({
        where: { id: run.id },
        data: {
          status: erroredCount > 0 ? "PARTIAL" : "COMPLETED",
          completedAt: new Date(),
          candidatePartyCount: candidatesByParty.size,
          screenedCount,
          worsenedCount,
          erroredCount,
        },
      });

      return { runId: run.id, changeSetCount: claimed.length, candidatePartyCount: candidatesByParty.size, screenedCount, worsenedCount, erroredCount };
    } catch (error) {
      // Whole-batch index/impact-analysis failure -- the one deliberate
      // exception to "never roll back": these change-set claims are pure
      // bookkeeping rows, so unclaiming them lets the next tick retry
      // cleanly instead of losing the batch to a permanently-FAILED run.
      await rollbackClaims();
      const errorMessage = error instanceof Error ? error.message : String(error);
      await db.rdpsRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), errorMessage } });
      throw error;
    }
  }
}
