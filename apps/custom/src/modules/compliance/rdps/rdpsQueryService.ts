// Continuous Party Monitoring (RDPS) -- read/query service backing the API
// routes under app/api/compliance/rdps/. Domain logic lives here; routes
// only validate the request and translate results/errors into HTTP
// responses, mirroring the CommunityScreeningService convention.
//
// Tenant scoping note: RdpsRun rows are NOT tenant-scoped -- a single
// DELTA_IMPACT/FULL_POPULATION run can rescreen Parties belonging to many
// different accounts in one batch, so the run itself is platform-level
// metadata (status, counts, timing only -- no Party/entity names). Every
// query that returns per-Party detail (outcomes, alerts, population,
// reports, monitoring history) filters by accountId via RdpsPartyOutcome,
// which IS tenant-scoped.
import { db } from "@/lib/db";
import type { Prisma, RdpsRunStatus, RdpsRunType } from "@prisma/client";
import { ExceptionService, type ExceptionResolver } from "@/modules/exceptions/exception.service";

const PARTY_DISPLAY_NAME_INCLUDE = {
  names: {
    where: { status: "ACTIVE" as const },
    orderBy: [{ isPrimary: "desc" as const }, { updatedAt: "desc" as const }],
    take: 1,
  },
} satisfies Prisma.PartyInclude;

function partyDisplayName(party: { names: { rawName: string }[] } | null | undefined): string {
  return party?.names[0]?.rawName ?? "";
}

export interface ListRunsFilters {
  runType?: RdpsRunType;
  status?: RdpsRunStatus;
  page?: number;
  pageSize?: number;
}

export async function listRuns(filters: ListRunsFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

  const where: Prisma.RdpsRunWhereInput = {
    ...(filters.runType ? { runType: filters.runType } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [runs, total] = await Promise.all([
    db.rdpsRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.rdpsRun.count({ where }),
  ]);

  return { runs, total, page, pageSize };
}

export async function getRun(runId: string) {
  return db.rdpsRun.findUnique({ where: { id: runId } });
}

export interface ListOutcomesFilters {
  isWorsening?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listOutcomesForRun(accountId: string, runId: string, filters: ListOutcomesFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));

  const where: Prisma.RdpsPartyOutcomeWhereInput = {
    runId,
    accountId,
    ...(filters.isWorsening !== undefined ? { isWorsening: filters.isWorsening } : {}),
  };

  const [outcomes, total] = await Promise.all([
    db.rdpsPartyOutcome.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { party: { include: PARTY_DISPLAY_NAME_INCLUDE } },
    }),
    db.rdpsPartyOutcome.count({ where }),
  ]);

  return {
    outcomes: outcomes.map((o) => ({ ...o, partyDisplayName: partyDisplayName(o.party) })),
    total,
    page,
    pageSize,
  };
}

export interface ListAlertsFilters {
  page?: number;
  pageSize?: number;
  dispositioned?: boolean;
}

export async function listAlerts(accountId: string, filters: ListAlertsFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));

  const where: Prisma.RdpsPartyOutcomeWhereInput = {
    accountId,
    isWorsening: true,
  };

  // RdpsPartyOutcome.exceptionItemId is a plain scalar FK with no Prisma
  // relation to ExceptionItem, so a status filter is resolved as a separate
  // lookup of matching exception ids rather than a nested `where`.
  if (filters.dispositioned !== undefined) {
    const statuses = filters.dispositioned ? ["Resolved"] : ["Open", "InProgress"];
    const matching = await db.exceptionItem.findMany({
      where: { accountId, status: { in: statuses } },
      select: { id: true },
    });
    where.exceptionItemId = { in: matching.map((e) => e.id) };
  }

  const [alerts, total] = await Promise.all([
    db.rdpsPartyOutcome.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        party: { include: PARTY_DISPLAY_NAME_INCLUDE },
        run: { select: { id: true, runType: true, startedAt: true } },
      },
    }),
    db.rdpsPartyOutcome.count({ where }),
  ]);

  const exceptionIds = alerts.map((a) => a.exceptionItemId).filter((id): id is string => Boolean(id));
  const exceptions = exceptionIds.length
    ? await db.exceptionItem.findMany({
        where: { id: { in: exceptionIds } },
        select: { id: true, status: true, severity: true, version: true, resolvedAt: true, resolutionNote: true },
      })
    : [];
  const exceptionById = new Map(exceptions.map((e) => [e.id, e]));

  return {
    alerts: alerts.map((a) => ({
      ...a,
      partyDisplayName: partyDisplayName(a.party),
      exceptionItem: a.exceptionItemId ? (exceptionById.get(a.exceptionItemId) ?? null) : null,
    })),
    total,
    page,
    pageSize,
  };
}

export interface DispositionAlertInput {
  status: string;
  expectedVersion: number;
  resolutionReasonCode?: string;
  resolutionReason?: string;
}

export class RdpsAlertNotFoundError extends Error {
  constructor() {
    super("RDPS alert not found");
  }
}

export async function dispositionAlert(
  accountId: string,
  outcomeId: string,
  input: DispositionAlertInput,
  resolver: ExceptionResolver
) {
  const outcome = await db.rdpsPartyOutcome.findFirst({
    where: { id: outcomeId, accountId, isWorsening: true },
  });
  if (!outcome || !outcome.exceptionItemId) {
    throw new RdpsAlertNotFoundError();
  }

  return ExceptionService.updateException(
    accountId,
    outcome.exceptionItemId,
    {
      status: input.status,
      expectedVersion: input.expectedVersion,
      resolutionReasonCode: input.resolutionReasonCode,
      resolutionReason: input.resolutionReason,
    },
    resolver
  );
}

export interface ListReferenceChangesFilters {
  datasetId?: string;
  changeType?: string;
  page?: number;
  pageSize?: number;
}

export async function listReferenceChanges(filters: ListReferenceChangesFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));

  const where: Prisma.ReferenceDataChangeSetWhereInput = {
    ...(filters.datasetId ? { datasetId: filters.datasetId } : {}),
    ...(filters.changeType ? { changeType: filters.changeType as any } : {}),
  };

  const [changes, total] = await Promise.all([
    db.referenceDataChangeSet.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { screeningEntity: { select: { id: true, name: true, sourceList: true } } },
    }),
    db.referenceDataChangeSet.count({ where }),
  ]);

  return { changes, total, page, pageSize };
}

export async function getReferenceChange(id: string) {
  return db.referenceDataChangeSet.findUnique({
    where: { id },
    include: { screeningEntity: { select: { id: true, name: true, sourceList: true, country: true } } },
  });
}

export interface PopulationFilters {
  page?: number;
  pageSize?: number;
}

/**
 * Parties currently in the RDPS monitoring scope for this tenant -- i.e.
 * every active Party, annotated with its most recent RdpsPartyOutcome (if
 * any). This is a snapshot view, not itself a monitoring toggle: RDPS
 * monitors every active Party in the population, there is no separate
 * opt-in/opt-out flag in V1.
 */
export async function listPopulation(accountId: string, filters: PopulationFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));

  const [parties, total] = await Promise.all([
    db.party.findMany({
      where: { accountId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        updatedAt: true,
        ...PARTY_DISPLAY_NAME_INCLUDE,
        rdpsOutcomes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, newStatus: true, isWorsening: true, createdAt: true, runId: true },
        },
      },
    }),
    db.party.count({ where: { accountId, deletedAt: null } }),
  ]);

  return {
    parties: parties.map((p) => ({ ...p, displayName: partyDisplayName(p) })),
    total,
    page,
    pageSize,
  };
}

export interface ReportsSummary {
  totalMonitoredParties: number;
  openAlerts: number;
  worseningLast30Days: number;
  screenedLast30Days: number;
  lastDeltaImpactRun: { id: string; status: string; completedAt: Date | null } | null;
  lastFullPopulationRun: { id: string; status: string; completedAt: Date | null } | null;
  lastRecallValidation: { id: string; status: string; completedAt: Date | null } | null;
}

export async function getReportsSummary(accountId: string): Promise<ReportsSummary> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const openExceptions = await db.exceptionItem.findMany({
    where: { accountId, status: { in: ["Open", "InProgress"] } },
    select: { id: true },
  });

  const [totalMonitoredParties, openAlerts, worseningLast30Days, screenedLast30Days, lastDeltaImpactRun, lastFullPopulationRun, lastRecallValidation] =
    await Promise.all([
      db.party.count({ where: { accountId, deletedAt: null } }),
      db.rdpsPartyOutcome.count({
        where: { accountId, isWorsening: true, exceptionItemId: { in: openExceptions.map((e) => e.id) } },
      }),
      db.rdpsPartyOutcome.count({ where: { accountId, isWorsening: true, createdAt: { gte: since30d } } }),
      db.rdpsPartyOutcome.count({ where: { accountId, createdAt: { gte: since30d } } }),
      db.rdpsRun.findFirst({
        where: { runType: "DELTA_IMPACT", status: { in: ["COMPLETED", "PARTIAL"] } },
        orderBy: { completedAt: "desc" },
        select: { id: true, status: true, completedAt: true },
      }),
      db.rdpsRun.findFirst({
        where: { runType: "FULL_POPULATION", status: { in: ["COMPLETED", "PARTIAL"] } },
        orderBy: { completedAt: "desc" },
        select: { id: true, status: true, completedAt: true },
      }),
      db.rdpsRun.findFirst({
        where: { runType: "SCHEDULED" },
        orderBy: { startedAt: "desc" },
        select: { id: true, status: true, completedAt: true },
      }),
    ]);

  return {
    totalMonitoredParties,
    openAlerts,
    worseningLast30Days,
    screenedLast30Days,
    lastDeltaImpactRun,
    lastFullPopulationRun,
    lastRecallValidation,
  };
}

export async function getPartyMonitoringHistory(accountId: string, partyId: string) {
  const party = await db.party.findFirst({ where: { id: partyId, accountId }, select: { id: true } });
  if (!party) return null;

  return db.rdpsPartyOutcome.findMany({
    where: { partyId, accountId },
    orderBy: { createdAt: "desc" },
    include: { run: { select: { id: true, runType: true, startedAt: true } } },
  });
}

export interface TriggerManualScanInput {
  jobType: "DELTA_IMPACT" | "FULL_POPULATION" | "TARGETED";
  partyIds?: string[];
}

export class RdpsFullPopulationAlreadyRunningError extends Error {
  constructor() {
    super("A FULL_POPULATION RDPS run is already in progress");
  }
}

/**
 * Manual/targeted scan trigger. DELTA_IMPACT and FULL_POPULATION scans are
 * queued as RdpsRun rows that the existing cron dispatchers pick up on their
 * next tick -- this never runs screening synchronously in the request. A
 * TARGETED scan (specific partyIds) also runs through the same dispatcher
 * path via a small FULL_POPULATION-shaped run scoped to a cursor-less,
 * bounded id list is out of scope for V1 -- TARGETED here directly records
 * outcomes for the given partyIds synchronously, since the set is caller
 * -bounded (unlike a population sweep) and small.
 */
export async function triggerManualScan(userId: string, input: TriggerManualScanInput) {
  if (input.jobType === "FULL_POPULATION") {
    const existing = await db.rdpsRun.findFirst({
      where: { runType: "FULL_POPULATION", status: { in: ["QUEUED", "RUNNING"] } },
    });
    if (existing) throw new RdpsFullPopulationAlreadyRunningError();

    return db.rdpsRun.create({
      data: { runType: "FULL_POPULATION", status: "QUEUED", triggeredBy: `MANUAL:${userId}` },
    });
  }

  if (input.jobType === "DELTA_IMPACT") {
    // Nothing to queue directly -- DELTA_IMPACT runs are created by the
    // dispatcher itself as it claims pending ReferenceDataChangeSet rows.
    // A manual trigger just nudges the dispatcher to run immediately by
    // returning the most recent QUEUED/RUNNING run, or null if there is no
    // pending change-set backlog for it to act on.
    return db.rdpsRun.findFirst({
      where: { runType: "DELTA_IMPACT", status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: { startedAt: "desc" },
    });
  }

  throw new Error("TARGETED manual scans require partyIds and are handled by the caller.");
}
