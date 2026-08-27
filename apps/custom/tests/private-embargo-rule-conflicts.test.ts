import { describe, it, expect, vi, beforeEach } from "vitest";

// Private Embargo Screening: privateEmbargoRuleRepository.findOverlappingActivePrivateEmbargoRule
// Date-overlap-aware duplicate/conflict protection (section 11) -- no unsafe
// unique constraint, open-ended (null expirationDate) ranges handled.

const dbMock = {
  privateEmbargoRule: { findMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { findOverlappingActivePrivateEmbargoRule } = await import(
  "@/modules/agents/compliance/embargo/privateEmbargoRuleRepository"
);

function existingRule(overrides: Record<string, unknown> = {}) {
  return {
    id: "existing_1",
    accountId: "acct_1",
    fromCountryCode: "CN",
    appliesToAllFromCountries: false,
    toCountryCode: "IR",
    embargoed: true,
    effectiveDate: new Date("2026-01-01"),
    expirationDate: null,
    reason: null,
    reference: null,
    status: "ACTIVE",
    ...overrides,
  };
}

function candidateInput(overrides: Record<string, unknown> = {}) {
  return {
    fromCountryCode: "CN",
    appliesToAllFromCountries: false,
    toCountryCode: "IR",
    embargoed: true,
    effectiveDate: new Date("2026-06-01"),
    expirationDate: null,
    reason: null,
    reference: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findOverlappingActivePrivateEmbargoRule", () => {
  it("detects overlap between two open-ended ranges for the same account/pair", async () => {
    dbMock.privateEmbargoRule.findMany.mockResolvedValue([existingRule()]);
    const conflict = await findOverlappingActivePrivateEmbargoRule("acct_1", candidateInput());
    expect(conflict?.id).toBe("existing_1");
  });

  it("returns null when the candidate's effective range starts after the existing rule expires", async () => {
    dbMock.privateEmbargoRule.findMany.mockResolvedValue([
      existingRule({ expirationDate: new Date("2026-03-01") }),
    ]);
    const conflict = await findOverlappingActivePrivateEmbargoRule(
      "acct_1",
      candidateInput({ effectiveDate: new Date("2026-06-01") })
    );
    expect(conflict).toBeNull();
  });

  it("detects overlap when the candidate's range ends after the existing rule starts but before it ends", async () => {
    dbMock.privateEmbargoRule.findMany.mockResolvedValue([
      existingRule({ effectiveDate: new Date("2026-06-01"), expirationDate: new Date("2026-12-31") }),
    ]);
    const conflict = await findOverlappingActivePrivateEmbargoRule(
      "acct_1",
      candidateInput({ effectiveDate: new Date("2026-01-01"), expirationDate: new Date("2026-07-01") })
    );
    expect(conflict?.id).toBe("existing_1");
  });

  it("excludes the rule identified by excludeRuleId (self-update case)", async () => {
    dbMock.privateEmbargoRule.findMany.mockResolvedValue([]);
    await findOverlappingActivePrivateEmbargoRule("acct_1", candidateInput(), "existing_1");
    expect(dbMock.privateEmbargoRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "existing_1" } }),
      })
    );
  });

  it("scopes candidates to ACTIVE status and the same account (tenant isolation)", async () => {
    dbMock.privateEmbargoRule.findMany.mockResolvedValue([]);
    await findOverlappingActivePrivateEmbargoRule("acct_1", candidateInput());
    expect(dbMock.privateEmbargoRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acct_1", status: "ACTIVE" }),
      })
    );
  });
});
