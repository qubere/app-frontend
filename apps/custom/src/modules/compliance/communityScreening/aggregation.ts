// Pure aggregation rules for Community Screening. No DB, no side effects --
// fully unit-testable. Disabled checks are ignored entirely (never treated
// as a pass or a failure). Precedence: ERROR > FAILED > INCOMPLETE > PASSED.
// Never map ERROR/INCOMPLETE to PASSED.
import type { CommunityScreeningPartyStatus, CommunityScreeningRunStatus } from "@prisma/client";

export interface CheckOutcome {
  enabled: boolean;
  /** RPS: CLEAR|HIT|REVIEW_REQUIRED|PARTIAL|SKIPPED|ERROR. Embargo: CLEAR|HIT|SKIPPED|ERROR. Null when the check never ran (e.g. a caught exception before it executed). */
  status: string | null;
}

export interface AggregatePartyStatusInput {
  restrictedParty: CheckOutcome;
  embargo: CheckOutcome;
}

const FAILING_STATUSES = new Set(["HIT", "REVIEW_REQUIRED"]);
const INCOMPLETE_STATUSES = new Set(["PARTIAL", "SKIPPED"]);
// PRE_APPROVED_REUSE (a valid PAL gate suppression) is a distinct pass tier
// from an ordinary CLEAR -- see checkPreApprovalGate/evaluator.ts -- but both
// aggregate to PASSED when no other check fails.
const PASSING_STATUSES = new Set(["CLEAR", "PRE_APPROVED_REUSE"]);

export function aggregatePartyStatus(input: AggregatePartyStatusInput): CommunityScreeningPartyStatus {
  const enabledOutcomes = [input.restrictedParty, input.embargo].filter((o) => o.enabled);

  if (enabledOutcomes.length === 0) {
    // Guarded against at run-creation time (createRun requires >=1 enabled
    // check), but treat defensively as ERROR rather than a false PASSED.
    return "ERROR";
  }

  if (enabledOutcomes.some((o) => o.status === "ERROR" || o.status === null)) {
    return "ERROR";
  }

  if (enabledOutcomes.some((o) => o.status && FAILING_STATUSES.has(o.status))) {
    return "FAILED";
  }

  if (enabledOutcomes.some((o) => o.status && INCOMPLETE_STATUSES.has(o.status))) {
    return "INCOMPLETE";
  }

  if (enabledOutcomes.every((o) => o.status && PASSING_STATUSES.has(o.status))) {
    return "PASSED";
  }

  // Any status not accounted for above (unexpected value) -- fail closed.
  return "ERROR";
}

export function aggregateRunStatus(
  partyStatuses: CommunityScreeningPartyStatus[]
): CommunityScreeningRunStatus {
  if (partyStatuses.length === 0) return "FAILED";

  const stillPending = partyStatuses.some((s) => s === "PENDING" || s === "PROCESSING");
  if (stillPending) return "RUNNING";

  const hasError = partyStatuses.some((s) => s === "ERROR");
  const allError = partyStatuses.every((s) => s === "ERROR");

  if (allError) return "FAILED";
  if (hasError) return "PARTIAL";
  return "COMPLETED";
}

// Most-severe-wins, matching the precedence documented at the top of this
// file (ERROR > FAILED > INCOMPLETE > NOT_EVALUATED > PROCESSING > PENDING >
// PASSED). Index 0 is most severe.
const LEGACY_STATUS_PRECEDENCE: CommunityScreeningPartyStatus[] = [
  "ERROR",
  "FAILED",
  "INCOMPLETE",
  "NOT_EVALUATED",
  "PROCESSING",
  "PENDING",
  "PASSED",
];

/**
 * Collapses occurrence-level results down to one status per Party ID, for
 * legacy/compat consumers that only understand a Party-ID-keyed map (never
 * used as the internal uniqueness key -- see CommunityScreeningPartyResult's
 * occurrence key, `rowNumber`, in schema.prisma). Most-severe-status wins
 * regardless of arrival order, so a later PASSED occurrence can never
 * overwrite an earlier FAILED/ERROR/INCOMPLETE occurrence for the same
 * Party ID. Rows with no partyId are excluded -- there is nothing to key
 * them by in a Party-ID map.
 */
export function deriveLegacyPartyStatusMap(
  occurrences: ReadonlyArray<{ partyId: string | null; status: CommunityScreeningPartyStatus }>
): Record<string, CommunityScreeningPartyStatus> {
  const map: Record<string, CommunityScreeningPartyStatus> = {};

  for (const occurrence of occurrences) {
    if (!occurrence.partyId) continue;

    const existing = map[occurrence.partyId];
    if (!existing) {
      map[occurrence.partyId] = occurrence.status;
      continue;
    }

    const existingRank = LEGACY_STATUS_PRECEDENCE.indexOf(existing);
    const nextRank = LEGACY_STATUS_PRECEDENCE.indexOf(occurrence.status);
    if (nextRank !== -1 && (existingRank === -1 || nextRank < existingRank)) {
      map[occurrence.partyId] = occurrence.status;
    }
  }

  return map;
}
