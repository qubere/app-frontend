// Bulk Compliance Screening -- aggregation. Fail-safe by construction
// (prompt section 23): a technical failure or an unrecognized status can
// never collapse into PASSED, and a record with nothing enabled/executed
// stays NOT_EVALUATED rather than a false PASSED.
import type { BatchRecordComplianceStatus, ComplianceBatchComplianceStatus } from "@prisma/client";

export interface ServiceOutcome {
  enabled: boolean;
  status: string | null;
}

const FAILED_STATUSES = new Set(["HIT", "LICENSE_REQUIRED", "BLOCKED"]);
const REVIEW_STATUSES = new Set(["REVIEW_REQUIRED"]);
const INCOMPLETE_STATUSES = new Set([
  "INCOMPLETE",
  "PARTIAL",
  "INVALID_CLASSIFICATION",
  "UNSUPPORTED_JURISDICTION",
  "RULE_DATA_UNAVAILABLE",
]);
const CLEAR_STATUSES = new Set([
  "CLEAR",
  "NO_LICENSE_REQUIRED",
  "LICENSE_EXCEPTION_APPLIES",
  "PRE_APPROVED_REUSE",
  "CLASSIFIED",
]);

export function aggregateRecordComplianceStatus(outcomes: ServiceOutcome[]): BatchRecordComplianceStatus {
  const executed = outcomes.filter((o) => o.enabled);
  if (executed.length === 0) return "NOT_EVALUATED";

  const statuses = executed.map((o) => o.status ?? "ERROR");
  if (statuses.some((s) => FAILED_STATUSES.has(s))) return "FAILED";
  if (statuses.some((s) => REVIEW_STATUSES.has(s))) return "REVIEW_REQUIRED";
  if (statuses.some((s) => INCOMPLETE_STATUSES.has(s))) return "INCOMPLETE";
  if (statuses.every((s) => CLEAR_STATUSES.has(s))) return "PASSED";
  // Any other/unrecognized status (e.g. a business ERROR/SKIPPED from a
  // canonical service) is fail-closed to ERROR, never PASSED.
  return "ERROR";
}

export function aggregateBatchComplianceStatus(
  recordStatuses: BatchRecordComplianceStatus[]
): ComplianceBatchComplianceStatus {
  if (recordStatuses.length === 0) return "NOT_EVALUATED";
  const evaluated = recordStatuses.filter((s) => s !== "NOT_EVALUATED");
  if (evaluated.length === 0) return "NOT_EVALUATED";
  if (evaluated.some((s) => s === "ERROR")) return "COMPLETED_WITH_ERRORS";
  if (evaluated.some((s) => s === "FAILED" || s === "REVIEW_REQUIRED" || s === "INCOMPLETE")) {
    return "COMPLETED_WITH_FINDINGS";
  }
  return "PASSED";
}
