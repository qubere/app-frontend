// License exception evaluation (prompt section 18). No license-exception
// rule dataset is ingested in this repo, so this module cannot determine
// eligibility for a named exception (e.g. GBS/CIV/TSR) on its own. It only
// evaluates an EXPLICIT, caller-asserted exception claim for structural
// completeness (a code and a reason must both be present) and applies it to
// `finalDecision` only -- `baseDecision` is never overwritten, and a claim is
// never applied over a hard safety status (INVALID_CLASSIFICATION,
// INCOMPLETE, BLOCKED, REVIEW_REQUIRED, ERROR): those must always reach a
// human before any exception can be considered.
import type { LicenseDeterminationOutcome } from "./types";
import type { LicenseDeterminationStatus as PrismaLicenseDeterminationStatus } from "@prisma/client";

export interface LicenseExceptionClaim {
  exceptionCode: string;
  reason: string;
}

const HARD_SAFETY_STATUSES: PrismaLicenseDeterminationStatus[] = [
  "INVALID_CLASSIFICATION",
  "INCOMPLETE",
  "BLOCKED",
  "REVIEW_REQUIRED",
  "ERROR",
];

export interface ExceptionEvaluationResult {
  outcome: LicenseDeterminationOutcome;
  applied: boolean;
  rejectionReason?: string;
}

export function applyLicenseExceptionClaim(
  base: LicenseDeterminationOutcome,
  claim: LicenseExceptionClaim | undefined
): ExceptionEvaluationResult {
  if (!claim) {
    return { outcome: base, applied: false };
  }
  if (!claim.exceptionCode?.trim() || !claim.reason?.trim()) {
    return {
      outcome: base,
      applied: false,
      rejectionReason: "License exception claim requires both an exceptionCode and a reason.",
    };
  }
  if (HARD_SAFETY_STATUSES.includes(base.status as PrismaLicenseDeterminationStatus)) {
    return {
      outcome: base,
      applied: false,
      rejectionReason: `A license exception cannot be applied while the determination status is ${base.status}; resolve the underlying issue first.`,
    };
  }

  return {
    applied: true,
    outcome: {
      ...base,
      // baseDecision is intentionally left untouched.
      finalDecision: "LICENSE_EXCEPTION_APPLIES" as PrismaLicenseDeterminationStatus,
      exceptionCode: claim.exceptionCode.trim(),
      exceptionDescription: claim.reason.trim(),
    },
  };
}
