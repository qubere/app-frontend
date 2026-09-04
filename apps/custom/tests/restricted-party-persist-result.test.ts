import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RestrictedPartyPassOutcome } from "@/modules/agents/compliance/restrictedParty/types";

// Restricted / Denied-Party Screening: persistResult.ts's persistScreeningRun.
// Covers: the four audit-evidence fields (normalizedScreenedName,
// matcherVersion, referenceDataAsOf on the result row; normalizedMatchedName,
// matchedTokens on each match row) are actually threaded through into the
// Prisma create() call, not just carried on the in-memory pass outcome.

const restrictedPartyScreeningResultCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        restrictedPartyScreeningResult: { create: restrictedPartyScreeningResultCreate },
      }),
  },
}));

const { persistScreeningRun } = await import(
  "@/modules/agents/compliance/restrictedParty/persistResult"
);
const { RPS_MATCHER_VERSION } = await import(
  "@/modules/agents/compliance/restrictedParty/types"
);

beforeEach(() => {
  vi.clearAllMocks();
  restrictedPartyScreeningResultCreate.mockResolvedValue({ id: "result_1", matches: [], redFlagHits: [] });
});

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    accountId: "acct_1",
    source: "PUBLIC_API",
    identity: { name: "Acme Trading Co" },
    ...overrides,
  } as Parameters<typeof persistScreeningRun>[0];
}

function passOutcome(overrides: Record<string, unknown> = {}) {
  return {
    passType: "PARTY_NAME",
    screenedName: "Acme Trading Co",
    normalizedScreenedName: "ACME",
    referenceDataAsOf: new Date("2026-01-15T00:00:00Z"),
    screenedAddress: null,
    screenedCity: null,
    screenedCountry: null,
    nameThreshold: 80,
    addressThreshold: null,
    countryMatchRequired: false,
    redFlagCheckEnabled: true,
    excludeMetaphone: false,
    phoneticAlgorithm: "DOUBLE_METAPHONE",
    continueOnExactMatch: false,
    exactMatchFound: true,
    alternateScreeningEnabled: false,
    alternateScreeningRan: false,
    alternateScreeningReason: "not eligible: alternate screening is disabled",
    matchesTruncated: false,
    status: "HIT",
    matches: [
      {
        sequence: 1,
        screeningEntityId: "entity_1",
        matchedName: "Acme Trading Co",
        matchedAddress: null,
        nameScore: 100,
        addressScore: null,
        matchMethod: "EXACT",
        countryMatch: null,
        sourceList: "SDN",
        entityType: "COMPANY",
        programCodes: ["SDN"],
        citation: null,
        agency: null,
        effectiveDate: null,
        expirationDate: null,
        tier: "HIT",
        suppressedByApprovedParty: false,
        suppressingDispositionId: null,
        normalizedMatchedName: "ACME",
        matchedTokens: ["ACME"],
      },
    ],
    redFlagHits: [],
    errorCode: null,
    errorMessage: null,
    screeningInputHash: "hash_1",
    screeningDurationMs: 1,
    ...overrides,
  } as unknown as RestrictedPartyPassOutcome;
}

describe("persistScreeningRun: audit-evidence fields", () => {
  it("writes normalizedScreenedName, matcherVersion, and referenceDataAsOf onto the result row", async () => {
    const asOf = new Date("2026-01-15T00:00:00Z");
    await persistScreeningRun(baseInput(), { correlationId: "corr_1", passes: [passOutcome({ referenceDataAsOf: asOf })] });

    expect(restrictedPartyScreeningResultCreate).toHaveBeenCalledTimes(1);
    const data = restrictedPartyScreeningResultCreate.mock.calls[0][0].data;
    expect(data.normalizedScreenedName).toBe("ACME");
    expect(data.matcherVersion).toBe(RPS_MATCHER_VERSION);
    expect(data.referenceDataAsOf).toBe(asOf);
  });

  it("writes normalizedMatchedName and matchedTokens onto each nested match row", async () => {
    await persistScreeningRun(baseInput(), { correlationId: "corr_1", passes: [passOutcome()] });

    const data = restrictedPartyScreeningResultCreate.mock.calls[0][0].data;
    const matchCreate = data.matches.create[0];
    expect(matchCreate.normalizedMatchedName).toBe("ACME");
    expect(matchCreate.matchedTokens).toEqual(["ACME"]);
  });

  it("passes a null referenceDataAsOf through unchanged when the watermark lookup failed upstream", async () => {
    await persistScreeningRun(baseInput(), { correlationId: "corr_1", passes: [passOutcome({ referenceDataAsOf: null })] });

    const data = restrictedPartyScreeningResultCreate.mock.calls[0][0].data;
    expect(data.referenceDataAsOf).toBeNull();
  });
});
