import { db } from "@/lib/db";

export type CbpReconcilableIssue = "VALUE" | "CLASSIFICATION" | "FTA_ELIGIBILITY" | "SECTION_9802";

export interface CbpReconFlagInput {
  accountId: string;
  filingId: string;
  entryNumber: string;
  entryDate: string;
  reconcilableIssues: CbpReconcilableIssue[];
  estimatedDutyDifference?: number;
}

export interface CbpReconEntrySummary {
  reconciliationEntryNumber: string;
  underlyingEntryNumbers: string[];
  issuesCovered: CbpReconcilableIssue[];
  deadlineDate: string; // 21 months from earliest underlying entry date
  status: "FLAGGED" | "PREPARED" | "TRANSMITTED" | "ACCEPTED" | "EXPIRED";
  dutyDeltaTotal: number;
}

/**
 * Calculates the statutory 21-month CBP Reconciliation Program filing deadline.
 */
export function calculateCbpReconciliationDeadline(entryDateStr: string): Date {
  const entryDate = new Date(entryDateStr);
  const deadline = new Date(entryDate);
  deadline.setMonth(deadline.getMonth() + 21);
  return deadline;
}

/**
 * Flags underlying entry summaries for CBP Reconciliation Program.
 */
export async function flagEntryForCbpReconciliation(input: CbpReconFlagInput) {
  const deadline = calculateCbpReconciliationDeadline(input.entryDate);

  const flagRecord = {
    accountId: input.accountId,
    filingId: input.filingId,
    entryNumber: input.entryNumber,
    entryDate: input.entryDate,
    issues: input.reconcilableIssues,
    deadlineDate: deadline.toISOString(),
    status: "FLAGGED" as const,
    estimatedDutyDifference: input.estimatedDutyDifference ?? 0,
    createdAt: new Date().toISOString(),
  };

  return flagRecord;
}

/**
 * Bundles flagged entries into a 21-month CBP Reconciliation Entry Summary.
 */
export function createCbpReconciliationSummary(
  flaggedRecords: CbpReconFlagInput[],
  reconEntryNumber: string
): CbpReconEntrySummary {
  if (flaggedRecords.length === 0) {
    throw new Error("Cannot create CBP reconciliation summary without flagged underlying entries.");
  }

  const earliestDate = flaggedRecords
    .map((r) => new Date(r.entryDate).getTime())
    .reduce((min, t) => Math.min(min, t), Date.now());

  const deadline = calculateCbpReconciliationDeadline(new Date(earliestDate).toISOString());
  const issuesSet = new Set<CbpReconcilableIssue>();
  flaggedRecords.forEach((r) => r.reconcilableIssues.forEach((i) => issuesSet.add(i)));

  return {
    reconciliationEntryNumber: reconEntryNumber,
    underlyingEntryNumbers: flaggedRecords.map((r) => r.entryNumber),
    issuesCovered: Array.from(issuesSet),
    deadlineDate: deadline.toISOString(),
    status: "PREPARED",
    dutyDeltaTotal: flaggedRecords.reduce((sum, r) => sum + (r.estimatedDutyDifference ?? 0), 0),
  };
}
