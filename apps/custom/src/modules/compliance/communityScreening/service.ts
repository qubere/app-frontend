// Community Screening orchestration service. Owns run/party-result
// persistence and the sync/async execution split -- never the RPS/Embargo
// matching logic itself (see evaluator.ts).
import crypto from "crypto";
import { db } from "@/lib/db";
import type { CommunityScreeningRun, Prisma } from "@prisma/client";
import { resolveCommunityScreeningParties } from "./partySource";
import { evaluateParty } from "./evaluator";
import { aggregateRunStatus } from "./aggregation";
import { getCommunityScreeningSyncMaxParties } from "./config";
import type { CommunityScreeningActor, CommunityScreeningCreateInput } from "./types";

export class CommunityScreeningValidationError extends Error {
  constructor(
    message: string,
    public readonly invalidRows: Array<{ rowNumber: number; errors: string[] }> = []
  ) {
    super(message);
    this.name = "CommunityScreeningValidationError";
  }
}

export interface CreateRunResult {
  run: CommunityScreeningRun;
  invalidRows: Array<{ rowNumber: number; errors: string[] }>;
}

export class CommunityScreeningService {
  static async createRun(
    accountId: string,
    input: CommunityScreeningCreateInput,
    actor: CommunityScreeningActor
  ): Promise<CreateRunResult> {
    if (!input.checksEnabled.restrictedParty && !input.checksEnabled.embargo) {
      throw new CommunityScreeningValidationError(
        "At least one check (Restricted Party or Embargo) must be enabled to run a screening."
      );
    }

    const overrides = actor.mayOverride ? input.overrides ?? null : null;

    const { run, invalidRows, partyCount } = await db.$transaction(async (tx) => {
      const { parties, invalidRows: invalid } = await resolveCommunityScreeningParties(tx, accountId, input.input);

      const correlationId = crypto.randomUUID();
      const createdRun = await tx.communityScreeningRun.create({
        data: {
          accountId,
          source: input.source,
          inputMode: input.input.inputMode,
          status: "QUEUED",
          transactionReference: input.transactionReference ?? null,
          complianceCountry: input.complianceCountry ?? null,
          checksEnabled: input.checksEnabled as unknown as Prisma.InputJsonValue,
          overrides: (overrides ?? undefined) as Prisma.InputJsonValue | undefined,
          fileName: input.input.inputMode === "FILE_UPLOAD" ? input.input.fileName : null,
          fileType: input.input.inputMode === "FILE_UPLOAD" ? input.input.fileType : null,
          requestedByUserId: actor.userId ?? null,
          totalParties: parties.length,
          correlationId,
        },
      });

      await tx.communityScreeningPartyResult.createMany({
        data: parties.map((party, index) => ({
          runId: createdRun.id,
          accountId,
          rowNumber: index + 1,
          partyId: party.partyId ?? null,
          externalReference: party.externalReference ?? null,
          snapshotName: party.name,
          snapshotCountry: party.country ?? null,
          snapshotAddress: party.address ?? null,
          snapshotCity: party.city ?? null,
          restrictedPartyEnabled: input.checksEnabled.restrictedParty,
          embargoEnabled: input.checksEnabled.embargo,
          aggregateStatus: "PENDING",
        })),
      });

      return { run: createdRun, invalidRows: invalid, partyCount: parties.length };
    });

    if (partyCount <= getCommunityScreeningSyncMaxParties()) {
      const completedRun = await CommunityScreeningService.runSync(run.id, actor);
      return { run: completedRun, invalidRows };
    }

    return { run, invalidRows };
  }

  /** Evaluates every PENDING row of a run inline, then finalizes the run's counters/status. Used by the sync path and, per claimed batch, by the dispatcher. */
  static async runSync(runId: string, actor: CommunityScreeningActor): Promise<CommunityScreeningRun> {
    const run = await db.communityScreeningRun.findUniqueOrThrow({ where: { id: runId } });

    if (run.status === "QUEUED") {
      await db.communityScreeningRun.update({ where: { id: runId }, data: { status: "RUNNING", startedAt: new Date() } });
    }

    const rows = await db.communityScreeningPartyResult.findMany({
      where: { runId, aggregateStatus: "PENDING" },
    });

    const checksEnabled = run.checksEnabled as { restrictedParty: boolean; embargo: boolean };
    const overrides = run.overrides as
      | { nameThreshold?: number; addressThreshold?: number; countryMatchRequired?: boolean; redFlagCheckEnabled?: boolean }
      | null;

    for (const row of rows) {
      await evaluateParty(row, {
        accountId: run.accountId,
        runId: run.id,
        checksEnabled,
        overrides,
        complianceCountry: run.complianceCountry,
        requestedByUserId: run.requestedByUserId ?? actor.userId,
        requestId: actor.requestId,
      });
    }

    return CommunityScreeningService.finalizeRunIfComplete(runId);
  }

  /** Recomputes run counters/status from its party rows. Marks the run terminal only once no row is left PENDING. */
  static async finalizeRunIfComplete(runId: string): Promise<CommunityScreeningRun> {
    const rows = await db.communityScreeningPartyResult.findMany({
      where: { runId },
      select: { aggregateStatus: true },
    });

    const statuses = rows.map((r) => r.aggregateStatus);
    const status = aggregateRunStatus(statuses);

    const counters = {
      totalParties: rows.length,
      passedCount: statuses.filter((s) => s === "PASSED").length,
      failedCount: statuses.filter((s) => s === "FAILED").length,
      incompleteCount: statuses.filter((s) => s === "INCOMPLETE").length,
      errorCount: statuses.filter((s) => s === "ERROR").length,
    };

    const isTerminal = status !== "RUNNING" && status !== "QUEUED";

    return db.communityScreeningRun.update({
      where: { id: runId },
      data: {
        status,
        ...counters,
        completedAt: isTerminal ? new Date() : undefined,
      },
    });
  }

  static async getRun(accountId: string, runId: string) {
    return db.communityScreeningRun.findFirst({ where: { id: runId, accountId } });
  }

  static async listRuns(
    accountId: string,
    params: { page?: number; pageSize?: number; status?: string; source?: string } = {}
  ) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

    const where = {
      accountId,
      ...(params.status ? { status: params.status as CommunityScreeningRun["status"] } : {}),
      ...(params.source ? { source: params.source as CommunityScreeningRun["source"] } : {}),
    };

    const [total, runs] = await Promise.all([
      db.communityScreeningRun.count({ where }),
      db.communityScreeningRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { runs, total, page, pageSize };
  }

  static async getRunResults(
    accountId: string,
    runId: string,
    params: { page?: number; pageSize?: number; status?: string } = {}
  ) {
    const run = await db.communityScreeningRun.findFirst({ where: { id: runId, accountId } });
    if (!run) return null;

    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));

    const where = {
      runId,
      ...(params.status ? { aggregateStatus: params.status as CommunityScreeningRun["status"] } : {}),
    } as const;

    const [total, results] = await Promise.all([
      db.communityScreeningPartyResult.count({ where: where as never }),
      db.communityScreeningPartyResult.findMany({
        where: where as never,
        orderBy: { rowNumber: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { run, results, total, page, pageSize };
  }

  /** Re-runs only the FAILED/ERROR/INCOMPLETE rows of an existing run in place. */
  static async rescreenRun(accountId: string, runId: string, actor: CommunityScreeningActor) {
    const run = await db.communityScreeningRun.findFirst({ where: { id: runId, accountId } });
    if (!run) return null;

    await db.communityScreeningPartyResult.updateMany({
      where: { runId, aggregateStatus: { in: ["FAILED", "ERROR", "INCOMPLETE"] } },
      data: { aggregateStatus: "PENDING", errorMessage: null, failureReason: null },
    });

    await db.communityScreeningRun.update({ where: { id: runId }, data: { status: "RUNNING" } });

    return CommunityScreeningService.runSync(runId, actor);
  }
}
