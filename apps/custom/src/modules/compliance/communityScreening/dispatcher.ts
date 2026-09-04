// Async processing for large/file-sourced Community Screening runs. Mirrors
// ComplianceNotificationDispatcher's optimistic per-row claim -- no
// long-lived reclaim/lease semantics needed since a claimed row either
// finishes (terminal aggregateStatus) or the whole dispatch tick is retried
// on the next cron invocation.
import { db } from "@/lib/db";
import { evaluateParty } from "./evaluator";
import { getCommunityScreeningBatchSize } from "./config";
import { CommunityScreeningService } from "./service";

export interface CommunityScreeningDispatchResult {
  claimedCount: number;
  runsFinalized: number;
  errors: Array<{ rowId: string; error: string }>;
}

export class CommunityScreeningDispatcher {
  static async dispatchPending(): Promise<CommunityScreeningDispatchResult> {
    const batchSize = getCommunityScreeningBatchSize();

    const candidates = await db.communityScreeningPartyResult.findMany({
      where: { aggregateStatus: "PENDING", run: { status: { in: ["QUEUED", "RUNNING"] } } },
      take: batchSize,
      include: { run: true },
    });

    let claimedCount = 0;
    const errors: Array<{ rowId: string; error: string }> = [];
    const touchedRunIds = new Set<string>();

    for (const row of candidates) {
      const claim = await db.communityScreeningPartyResult.updateMany({
        where: { id: row.id, aggregateStatus: "PENDING" },
        data: { aggregateStatus: "PROCESSING" },
      });
      if (claim.count !== 1) continue;

      claimedCount += 1;
      touchedRunIds.add(row.runId);

      if (row.run.status === "QUEUED") {
        await db.communityScreeningRun.update({
          where: { id: row.runId },
          data: { status: "RUNNING", startedAt: row.run.startedAt ?? new Date() },
        });
      }

      const checksEnabled = row.run.checksEnabled as { restrictedParty: boolean; embargo: boolean };
      const overrides = row.run.overrides as
        | { nameThreshold?: number; addressThreshold?: number; countryMatchRequired?: boolean; redFlagCheckEnabled?: boolean }
        | null;

      try {
        await evaluateParty(row, {
          accountId: row.accountId,
          runId: row.runId,
          checksEnabled,
          overrides,
          complianceCountry: row.run.complianceCountry,
          requestedByUserId: row.run.requestedByUserId,
        });
      } catch (error) {
        errors.push({ rowId: row.id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    let runsFinalized = 0;
    for (const runId of touchedRunIds) {
      const remaining = await db.communityScreeningPartyResult.count({ where: { runId, aggregateStatus: "PENDING" } });
      if (remaining === 0) {
        await CommunityScreeningService.finalizeRunIfComplete(runId);
        runsFinalized += 1;
      }
    }

    return { claimedCount, runsFinalized, errors };
  }
}
