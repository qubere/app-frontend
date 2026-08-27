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

  if (enabledOutcomes.every((o) => o.status === "CLEAR")) {
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
