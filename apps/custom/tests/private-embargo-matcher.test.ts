import { describe, it, expect, vi, beforeEach } from "vitest";

// Private Embargo Screening: privateEmbargoMatcher.ts
// Must return SKIPPED (never CLEAR) on no match, and HIT with PRIVATE_EMBARGO
// evidence on a match, per doEmbargoCheck.ts's dispatch contract.

const resolvePrivateEmbargoRule = vi.fn();

vi.mock("@/modules/agents/compliance/embargo/embargoRepository", () => ({ resolvePrivateEmbargoRule }));

const { privateEmbargoMatcher } = await import("@/modules/agents/compliance/embargo/privateEmbargoMatcher");

function baseCtx(overrides: Record<string, unknown> = {}) {
  return {
    accountId: "acct_1",
    shipmentId: "ship_1",
    screeningLevel: "TRANSACTION",
    complianceCountry: "CN",
    targetCountry: "IR",
    type: "D",
    screeningDate: new Date("2026-01-01"),
    accountConfig: {
      embargoScreeningEnabled: true,
      privateEmbargoEnabled: true,
      serverScreeningEnabled: true,
      genericExportLdEnabled: false,
      audited: false,
      emailAlertEnabled: false,
      generalAuditLogEnabled: false,
    },
    ...overrides,
  } as Parameters<typeof privateEmbargoMatcher>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("privateEmbargoMatcher", () => {
  it("returns SKIPPED (not CLEAR) when no private rule matches", async () => {
    resolvePrivateEmbargoRule.mockResolvedValue(null);
    const ctx = baseCtx();
    const result = await privateEmbargoMatcher(ctx);
    expect(result.result).toBe("SKIPPED");
    expect(result.result).not.toBe("CLEAR");
    expect(result.matcher).toBe("PRIVATE");
    expect(result.reason).toBe("NO_PRIVATE_RULE_MATCH");
  });

  it("calls resolvePrivateEmbargoRule with the account/country/date from context", async () => {
    resolvePrivateEmbargoRule.mockResolvedValue(null);
    const ctx = baseCtx();
    await privateEmbargoMatcher(ctx);
    expect(resolvePrivateEmbargoRule).toHaveBeenCalledWith("acct_1", "CN", "IR", ctx.screeningDate);
  });

  it("returns HIT with PRIVATE_EMBARGO classification and rule evidence when a rule matches", async () => {
    resolvePrivateEmbargoRule.mockResolvedValue({
      id: "rule_1",
      accountId: "acct_1",
      fromCountryCode: "CN",
      appliesToAllFromCountries: false,
      toCountryCode: "IR",
      embargoed: true,
      effectiveDate: new Date("2026-01-01"),
      expirationDate: null,
      reason: "Account risk policy",
      reference: "POLICY-42",
      status: "ACTIVE",
    });
    const ctx = baseCtx();
    const result = await privateEmbargoMatcher(ctx);
    expect(result.result).toBe("HIT");
    expect(result.matcher).toBe("PRIVATE");
    expect(result.ruleId).toBe("rule_1");
    expect(result.evidence).toMatchObject({
      classification: "PRIVATE_EMBARGO",
      wildcardFromCountry: false,
      fromCountry: "CN",
      toCountry: "IR",
    });
    expect(result.reason).toContain("not a government sanction");
  });

  it("reports fromCountry as null when the matched rule is a wildcard", async () => {
    resolvePrivateEmbargoRule.mockResolvedValue({
      id: "rule_2",
      accountId: "acct_1",
      fromCountryCode: null,
      appliesToAllFromCountries: true,
      toCountryCode: "IR",
      embargoed: true,
      effectiveDate: new Date("2026-01-01"),
      expirationDate: null,
      reason: null,
      reference: null,
      status: "ACTIVE",
    });
    const result = await privateEmbargoMatcher(baseCtx());
    expect(result.evidence).toMatchObject({ wildcardFromCountry: true, fromCountry: null });
  });
});
