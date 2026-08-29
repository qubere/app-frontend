import { describe, it, expect } from "vitest";
import { applyLicenseExceptionClaim } from "@/modules/licenses/exceptionEvaluator";
import type { LicenseDeterminationOutcome } from "@/modules/licenses/types";

function outcome(status: LicenseDeterminationOutcome["status"]): LicenseDeterminationOutcome {
  return { status, baseDecision: status, finalDecision: status, reason: "test" };
}

describe("applyLicenseExceptionClaim", () => {
  it("returns the base outcome unchanged when no claim is provided", () => {
    const base = outcome("RULE_DATA_UNAVAILABLE");
    const result = applyLicenseExceptionClaim(base, undefined);
    expect(result.applied).toBe(false);
    expect(result.outcome).toEqual(base);
  });

  it("rejects a claim missing a reason", () => {
    const base = outcome("RULE_DATA_UNAVAILABLE");
    const result = applyLicenseExceptionClaim(base, { exceptionCode: "GBS", reason: "  " });
    expect(result.applied).toBe(false);
    expect(result.rejectionReason).toBeTruthy();
  });

  it("never applies over a hard safety status", () => {
    for (const status of ["INVALID_CLASSIFICATION", "INCOMPLETE", "BLOCKED", "REVIEW_REQUIRED", "ERROR"] as const) {
      const base = outcome(status);
      const result = applyLicenseExceptionClaim(base, { exceptionCode: "GBS", reason: "asserted eligibility" });
      expect(result.applied).toBe(false);
      expect(result.outcome.finalDecision).toBe(status);
    }
  });

  it("applies a well-formed claim to finalDecision without touching baseDecision", () => {
    const base = outcome("RULE_DATA_UNAVAILABLE");
    const result = applyLicenseExceptionClaim(base, { exceptionCode: "GBS", reason: "asserted eligibility" });
    expect(result.applied).toBe(true);
    expect(result.outcome.baseDecision).toBe("RULE_DATA_UNAVAILABLE");
    expect(result.outcome.finalDecision).toBe("LICENSE_EXCEPTION_APPLIES");
    expect(result.outcome.exceptionCode).toBe("GBS");
  });
});
