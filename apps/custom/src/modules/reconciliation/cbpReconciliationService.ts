import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type CbpReconcilableIssue = "VALUE" | "CLASSIFICATION" | "FTA_ELIGIBILITY" | "SECTION_9802";

export const CBP_RECONCILABLE_ISSUES: CbpReconcilableIssue[] = [
  "VALUE",
  "CLASSIFICATION",
  "FTA_ELIGIBILITY",
  "SECTION_9802",
];

export interface CbpReconFlagInput {
  accountId: string;
  filingId?: string | null;
  entryNumber: string;
  entryDate: string;
  reconcilableIssues: CbpReconcilableIssue[];
  estimatedDutyDifference?: number;
  createdByUserId?: string | null;
}

/**
 * The statutory CBP Reconciliation Program window is 21 months from the date
 * of the underlying entry.
 */
export function calculateCbpReconciliationDeadline(entryDateStr: string | Date): Date {
  const entryDate = new Date(entryDateStr);
  const deadline = new Date(entryDate);
  deadline.setMonth(deadline.getMonth() + 21);
  return deadline;
}

/**
 * Flags an underlying entry summary for the CBP Reconciliation Program.
 * Idempotent per (account, entryNumber): re-flagging updates the issue set and
 * duty estimate instead of creating a duplicate.
 */
export async function flagEntryForCbpReconciliation(input: CbpReconFlagInput) {
  if (input.reconcilableIssues.length === 0) {
    throw new Error("At least one reconcilable issue is required to flag an entry.");
  }
  const deadline = calculateCbpReconciliationDeadline(input.entryDate);

  return db.cbpReconciliationFlag.upsert({
    where: { accountId_entryNumber: { accountId: input.accountId, entryNumber: input.entryNumber } },
    create: {
      accountId: input.accountId,
      filingId: input.filingId ?? null,
      entryNumber: input.entryNumber,
      entryDate: new Date(input.entryDate),
      issues: input.reconcilableIssues,
      estimatedDutyDifference: new Prisma.Decimal(input.estimatedDutyDifference ?? 0),
      deadlineDate: deadline,
      status: "FLAGGED",
      createdByUserId: input.createdByUserId ?? null,
    },
    update: {
      filingId: input.filingId ?? undefined,
      entryDate: new Date(input.entryDate),
      issues: input.reconcilableIssues,
      estimatedDutyDifference: new Prisma.Decimal(input.estimatedDutyDifference ?? 0),
      deadlineDate: deadline,
    },
  });
}

export async function listCbpReconciliationFlags(accountId: string, status?: string) {
  return db.cbpReconciliationFlag.findMany({
    where: { accountId, ...(status ? { status } : {}) },
    orderBy: { deadlineDate: "asc" },
    include: { reconciliationEntry: { select: { id: true, reconciliationEntryNumber: true, status: true } } },
    take: 200,
  });
}

export async function withdrawCbpReconciliationFlag(accountId: string, id: string) {
  const flag = await db.cbpReconciliationFlag.findFirst({ where: { id, accountId } });
  if (!flag) return null;
  return db.cbpReconciliationFlag.update({
    where: { id },
    data: { status: "WITHDRAWN", reconciliationEntryId: null },
  });
}

/**
 * Bundles every currently-FLAGGED entry into one 21-month CBP Reconciliation
 * Entry. The recon entry's deadline is driven by the earliest underlying entry
 * (the tightest constraint), and the flags move to INCLUDED.
 */
export async function createCbpReconciliationEntry(input: {
  accountId: string;
  reconciliationEntryNumber: string;
  createdByUserId?: string | null;
}) {
  const flags = await db.cbpReconciliationFlag.findMany({
    where: { accountId: input.accountId, status: "FLAGGED" },
  });
  if (flags.length === 0) {
    return { ok: false as const, reason: "NO_FLAGGED_ENTRIES" as const };
  }

  const earliestEntryDate = flags.reduce(
    (min, f) => (f.entryDate < min ? f.entryDate : min),
    flags[0].entryDate
  );
  const deadline = calculateCbpReconciliationDeadline(earliestEntryDate);

  const issuesCovered = Array.from(new Set(flags.flatMap((f) => f.issues)));
  const dutyDeltaTotal = flags.reduce(
    (sum, f) => sum.add(f.estimatedDutyDifference),
    new Prisma.Decimal(0)
  );

  const entry = await db.cbpReconciliationEntry.create({
    data: {
      accountId: input.accountId,
      reconciliationEntryNumber: input.reconciliationEntryNumber,
      issuesCovered,
      deadlineDate: deadline,
      status: "PREPARED",
      dutyDeltaTotal,
      createdByUserId: input.createdByUserId ?? null,
      flags: { connect: flags.map((f) => ({ id: f.id })) },
    },
    include: { flags: true },
  });

  await db.cbpReconciliationFlag.updateMany({
    where: { accountId: input.accountId, id: { in: flags.map((f) => f.id) } },
    data: { status: "INCLUDED" },
  });

  return { ok: true as const, entry };
}

export async function listCbpReconciliationEntries(accountId: string) {
  return db.cbpReconciliationEntry.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    include: { flags: { select: { id: true, entryNumber: true } } },
    take: 100,
  });
}

export async function transmitCbpReconciliationEntry(accountId: string, id: string) {
  const entry = await db.cbpReconciliationEntry.findFirst({ where: { id, accountId } });
  if (!entry) return null;
  if (entry.status !== "PREPARED") {
    return { ok: false as const, reason: "NOT_PREPARED" as const, status: entry.status };
  }
  const updated = await db.cbpReconciliationEntry.update({
    where: { id },
    data: { status: "TRANSMITTED", transmittedAt: new Date() },
  });
  return { ok: true as const, entry: updated };
}
