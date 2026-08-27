import { describe, it, expect, vi, beforeEach } from "vitest";

// Private Embargo Screening: embargoRepository.resolvePrivateEmbargoRule
// precedence (exact from-country match beats wildcard) and tenant isolation
// (accountId always scopes the query).

const dbMock = {
  privateEmbargoRule: { findMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { resolvePrivateEmbargoRule } = await import("@/modules/agents/compliance/embargo/embargoRepository");

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule_1",
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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolvePrivateEmbargoRule", () => {
  it("scopes the query to the given accountId (tenant isolation)", async () => {
    dbMock.privateEmbargoRule.findMany.mockResolvedValue([]);
    await resolvePrivateEmbargoRule("acct_1", "CN", "IR", new Date("2026-01-01"));
    expect(dbMock.privateEmbargoRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acct_1" }) })
    );
  });

  it("returns null when no candidate rules exist", async () => {
    dbMock.privateEmbargoRule.findMany.mockResolvedValue([]);
    const result = await resolvePrivateEmbargoRule("acct_1", "CN", "IR", new Date("2026-01-01"));
    expect(result).toBeNull();
  });

  it("prefers an exact from-country match over a wildcard rule", async () => {
    const wildcard = rule({ id: "rule_wildcard", appliesToAllFromCountries: true, fromCountryCode: null });
    const exact = rule({ id: "rule_exact", appliesToAllFromCountries: false, fromCountryCode: "CN" });
    dbMock.privateEmbargoRule.findMany.mockResolvedValue([wildcard, exact]);
    const result = await resolvePrivateEmbargoRule("acct_1", "CN", "IR", new Date("2026-01-01"));
    expect(result?.id).toBe("rule_exact");
  });

  it("falls back to the wildcard rule when no exact match is present", async () => {
    const wildcard = rule({ id: "rule_wildcard", appliesToAllFromCountries: true, fromCountryCode: null });
    dbMock.privateEmbargoRule.findMany.mockResolvedValue([wildcard]);
    const result = await resolvePrivateEmbargoRule("acct_1", "CN", "IR", new Date("2026-01-01"));
    expect(result?.id).toBe("rule_wildcard");
  });

  it("returns null when fromCountry or toCountry is blank", async () => {
    const result = await resolvePrivateEmbargoRule("acct_1", "", "IR", new Date("2026-01-01"));
    expect(result).toBeNull();
    expect(dbMock.privateEmbargoRule.findMany).not.toHaveBeenCalled();
  });
});
