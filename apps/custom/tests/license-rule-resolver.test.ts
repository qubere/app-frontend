import { describe, it, expect } from "vitest";
import { resolveLicenseDetermination, type AccountLicenseGates } from "@/modules/licenses/ruleResolver";
import type { LicenseControlRuleCandidate, LicenseDeterminationRequestInput } from "@/modules/licenses/types";

const ALL_ENABLED: AccountLicenseGates = {
  licenseDeterminationEnabled: true,
  importControlDeterminationEnabled: true,
  genericExportLicenseDeterminationEnabled: true,
};

function baseInput(overrides: Partial<LicenseDeterminationRequestInput> = {}): LicenseDeterminationRequestInput {
  return {
    accountId: "acct_1",
    operationType: "EXPORT",
    classification: { type: "ECCN", value: "5A002.A.1" },
    destinationCountry: "CA",
    ...overrides,
  };
}

describe("resolveLicenseDetermination", () => {
  it("returns BLOCKED when license determination is disabled for the account", () => {
    const result = resolveLicenseDetermination(baseInput(), { ...ALL_ENABLED, licenseDeterminationEnabled: false });
    expect(result.status).toBe("BLOCKED");
    expect(result.baseDecision).toBe(result.status);
    expect(result.finalDecision).toBe(result.status);
  });

  it("returns BLOCKED for IMPORT when import control determination is disabled", () => {
    const result = resolveLicenseDetermination(baseInput({ operationType: "IMPORT", originCountry: "CA" }), {
      ...ALL_ENABLED,
      importControlDeterminationEnabled: false,
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("returns INVALID_CLASSIFICATION for a malformed classification value", () => {
    const result = resolveLicenseDetermination(baseInput({ classification: { type: "ECCN", value: "NOT-VALID" } }), ALL_ENABLED);
    expect(result.status).toBe("INVALID_CLASSIFICATION");
    expect(result.missingInputs).toContain("classification");
  });

  it("returns INCOMPLETE when destinationCountry is missing for EXPORT", () => {
    const result = resolveLicenseDetermination(baseInput({ destinationCountry: undefined }), ALL_ENABLED);
    expect(result.status).toBe("INCOMPLETE");
    expect(result.missingInputs).toContain("destinationCountry");
  });

  it("returns INCOMPLETE when originCountry is missing for IMPORT", () => {
    const result = resolveLicenseDetermination(baseInput({ operationType: "IMPORT", destinationCountry: undefined }), ALL_ENABLED);
    expect(result.status).toBe("INCOMPLETE");
    expect(result.missingInputs).toContain("originCountry");
  });

  it("returns REVIEW_REQUIRED when a sensitive end-use flag is TRUE, regardless of rule data", () => {
    const result = resolveLicenseDetermination(baseInput({ conditions: { militaryEndUser: "TRUE" } }), ALL_ENABLED);
    expect(result.status).toBe("REVIEW_REQUIRED");
  });

  it("returns INCOMPLETE when a sensitive end-use flag is UNKNOWN (never assumed false)", () => {
    const result = resolveLicenseDetermination(baseInput({ conditions: { governmentEndUser: "UNKNOWN" } }), ALL_ENABLED);
    expect(result.status).toBe("INCOMPLETE");
    expect(result.missingInputs).toContain("governmentEndUser");
  });

  it("returns INCOMPLETE for an encryption item with unknown self-classification", () => {
    const result = resolveLicenseDetermination(
      baseInput({
        conditions: {
          governmentEndUser: "FALSE",
          militaryEndUser: "FALSE",
          nuclearEndUse: "FALSE",
          missileTechnologyEndUse: "FALSE",
          chemicalBiologicalEndUse: "FALSE",
          militaryEndUseCountry: "FALSE",
          encryptionItem: "TRUE",
          encryptionSelfClassified: "UNKNOWN",
        },
      }),
      ALL_ENABLED
    );
    expect(result.status).toBe("INCOMPLETE");
    expect(result.missingInputs).toContain("encryptionConditions");
  });

  it("fails safe to RULE_DATA_UNAVAILABLE when every required input is present but no rule dataset exists", () => {
    const result = resolveLicenseDetermination(
      baseInput({
        conditions: {
          governmentEndUser: "FALSE",
          militaryEndUser: "FALSE",
          nuclearEndUse: "FALSE",
          missileTechnologyEndUse: "FALSE",
          chemicalBiologicalEndUse: "FALSE",
          militaryEndUseCountry: "FALSE",
        },
      }),
      ALL_ENABLED
    );
    expect(result.status).toBe("RULE_DATA_UNAVAILABLE");
    expect(result.status).not.toBe("LICENSE_REQUIRED");
    expect(result.status).not.toBe("NO_LICENSE_REQUIRED");
  });

  it("uses a matching jurisdiction rule's decision when one is supplied", () => {
    const rules: LicenseControlRuleCandidate[] = [
      {
        operationType: "EXPORT",
        classificationType: "ECCN",
        classificationValue: "5A002.A.1",
        country: "CA",
        decision: "LICENSE_REQUIRED",
        authority: "EAR",
        citation: "15 CFR 742.15",
        ruleVersion: "test-fixture-v1",
      },
    ];
    const result = resolveLicenseDetermination(
      baseInput({
        conditions: {
          governmentEndUser: "FALSE",
          militaryEndUser: "FALSE",
          nuclearEndUse: "FALSE",
          missileTechnologyEndUse: "FALSE",
          chemicalBiologicalEndUse: "FALSE",
          militaryEndUseCountry: "FALSE",
        },
      }),
      ALL_ENABLED,
      rules
    );
    expect(result.status).toBe("LICENSE_REQUIRED");
    expect(result.ruleSource).toBe("MATCHED_RULE");
    expect(result.ruleVersion).toBe("test-fixture-v1");
  });

  it("falls back to RULE_DATA_UNAVAILABLE when no supplied rule matches", () => {
    const rules: LicenseControlRuleCandidate[] = [
      {
        operationType: "EXPORT",
        classificationType: "ECCN",
        classificationValue: "5A002.A.1",
        country: "DE",
        decision: "LICENSE_REQUIRED",
        ruleVersion: "test-fixture-v1",
      },
    ];
    const result = resolveLicenseDetermination(
      baseInput({
        conditions: {
          governmentEndUser: "FALSE",
          militaryEndUser: "FALSE",
          nuclearEndUse: "FALSE",
          missileTechnologyEndUse: "FALSE",
          chemicalBiologicalEndUse: "FALSE",
          militaryEndUseCountry: "FALSE",
        },
      }),
      ALL_ENABLED,
      rules
    );
    expect(result.status).toBe("RULE_DATA_UNAVAILABLE");
    expect(result.ruleSource).toBe("GENERIC");
  });
});
