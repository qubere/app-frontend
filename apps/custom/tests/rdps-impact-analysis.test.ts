import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS: impactAnalysis.ts (reverse candidate index). Verifies EXACT
// normalized-name matches, RAW_WORD token-overlap matches (same `> 2` floor
// as the forward matcher), that BOTH DOUBLE_METAPHONE and METAPHONE2 are
// checked independently (a party caught only by one algorithm is still
// found), and that country is never used to exclude a candidate -- the
// reverse index has no notion of country at all, so a changed entity in a
// different country than a party still gets flagged on a name match.

const { dmCodes, m2Codes } = vi.hoisted(() => ({
  dmCodes: {} as Record<string, [string, string]>,
  m2Codes: {} as Record<string, string>,
}));

vi.mock("@/modules/agents/compliance/restrictedParty/phoneticMatch", () => ({
  doubleMetaphone: (input: string) => dmCodes[input] ?? ["NOMATCH_DM", ""],
}));
vi.mock("@/modules/agents/compliance/restrictedParty/metaphone2", () => ({
  metaphone2: (input: string) => m2Codes[input] ?? "NOMATCH_M2",
}));

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    party: { findMany: vi.fn() },
    partyName: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const { buildPartyIdentityIndex, findImpactedParties } = await import(
  "@/modules/agents/compliance/restrictedParty/impactAnalysis"
);
const { normalizeForMatching } = await import("@/modules/agents/compliance/restrictedParty/normalize");

function entity(overrides: Record<string, unknown> = {}) {
  return {
    id: "entity_1",
    name: "Globex Dynamics",
    alternateNames: [],
    aliases: [],
    addresses: [],
    country: null,
    ...overrides,
  } as any;
}

function indexEntry(rawName: string, overrides: Record<string, unknown> = {}) {
  const normalizedName = normalizeForMatching(rawName);
  return {
    partyId: "party_1",
    accountId: "acct_1",
    normalizedName,
    tokens: new Set(normalizedName.split(" ").filter((t) => t.length > 2)),
    doubleMetaphonePrimary: "",
    doubleMetaphoneSecondary: "",
    metaphone2Code: "",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(dmCodes)) delete dmCodes[key];
  for (const key of Object.keys(m2Codes)) delete m2Codes[key];
});

describe("findImpactedParties: EXACT match", () => {
  it("flags a party whose normalized name exactly matches the entity's normalized name", () => {
    const party = indexEntry("Globex Dynamics");
    const matches = findImpactedParties(entity({ name: "Globex Dynamics" }), [party]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.partyId).toBe("party_1");
    expect(matches[0]?.reasons).toContain("EXACT");
  });

  it("does not flag a party with an unrelated normalized name", () => {
    const party = indexEntry("Zephyr Nightingale");
    const matches = findImpactedParties(entity({ name: "Globex Dynamics" }), [party]);

    expect(matches).toHaveLength(0);
  });
});

describe("findImpactedParties: RAW_WORD token overlap", () => {
  it("flags a party sharing a significant (>2 char) token with the entity, even without an exact match", () => {
    const party = indexEntry("Meridian Exports Co"); // normalizes to "MERIDIAN" after stripping EXPORTS/CO
    const matches = findImpactedParties(entity({ name: "Blackwood Meridian Consulting" }), [party]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.reasons).toContain("RAW_WORD");
    expect(matches[0]?.reasons).not.toContain("EXACT");
  });

  it("does not raise RAW_WORD for a token at or below the 2-character floor", () => {
    // "Li" survives tokenize() (length > 1) but must not survive the reverse
    // index's own `> 2` RAW_WORD floor (RAW_WORD_TOKEN_FLOOR), matching
    // candidateGeneration.ts's documented `> 2` floor exactly.
    const party = indexEntry("Li Imports"); // IMPORTS is a weak term -> normalizes to "LI"; tokens set is empty (LI has length 2)
    const matches = findImpactedParties(entity({ name: "Li Consulting Group" }), [party]);

    expect(matches.find((m) => m.reasons.includes("RAW_WORD"))).toBeUndefined();
  });
});

describe("findImpactedParties: both phonetic algorithms are checked independently", () => {
  it("flags a party caught only by DOUBLE_METAPHONE, not METAPHONE2", () => {
    // Only the ENTITY side's codes are computed by doubleMetaphone/metaphone2
    // inside findImpactedParties -- the party side's codes come precomputed
    // from the index (as buildPartyIdentityIndex would have stored them), so
    // the fixture sets them directly on the index entry.
    const entityNormalized = normalizeForMatching("Zyxwerq Enterprises"); // ENTERPRISES is stripped -> "ZYXWERQ"
    dmCodes[entityNormalized] = ["SAME_DM", ""];
    m2Codes[entityNormalized] = "ENTITY_M2";

    const party = indexEntry("Zyxwercque Holdings", {
      doubleMetaphonePrimary: "SAME_DM",
      doubleMetaphoneSecondary: "",
      metaphone2Code: "DIFFERENT_M2",
    });
    const matches = findImpactedParties(entity({ name: "Zyxwerq Enterprises" }), [party]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.reasons).toContain("DOUBLE_METAPHONE");
    expect(matches[0]?.reasons).not.toContain("METAPHONE2");
  });

  it("flags a party caught only by METAPHONE2, not DOUBLE_METAPHONE", () => {
    const entityNormalized = normalizeForMatching("Quorvexal Trading"); // TRADING is stripped -> "QUORVEXAL"
    dmCodes[entityNormalized] = ["ENTITY_DM", ""];
    m2Codes[entityNormalized] = "SAME_M2";

    const party = indexEntry("Kworvexahl Holdings", {
      doubleMetaphonePrimary: "DIFFERENT_DM",
      doubleMetaphoneSecondary: "",
      metaphone2Code: "SAME_M2",
    });
    const matches = findImpactedParties(entity({ name: "Quorvexal Trading" }), [party]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.reasons).toContain("METAPHONE2");
    expect(matches[0]?.reasons).not.toContain("DOUBLE_METAPHONE");
  });

  it("accumulates both DOUBLE_METAPHONE and METAPHONE2 as distinct reasons when both algorithms agree", () => {
    const entityNormalized = normalizeForMatching("Vantrix Solutions");
    dmCodes[entityNormalized] = ["BOTH_DM", ""];
    m2Codes[entityNormalized] = "BOTH_M2";

    const party = indexEntry("Vantrixx Consulting", {
      doubleMetaphonePrimary: "BOTH_DM",
      doubleMetaphoneSecondary: "",
      metaphone2Code: "BOTH_M2",
    });
    const matches = findImpactedParties(entity({ name: "Vantrix Solutions" }), [party]);

    expect(matches[0]?.reasons).toEqual(expect.arrayContaining(["DOUBLE_METAPHONE", "METAPHONE2"]));
  });
});

describe("findImpactedParties: country is never used to exclude a candidate", () => {
  it("still flags a name match even though the changed entity's country differs from the party's account/jurisdiction", () => {
    // The reverse index (PartyIdentityIndexEntry) carries no country field at
    // all, and findImpactedParties never reads entity.country -- name
    // matching alone drives selection. A changed entity flagged as "CN" must
    // still surface a name match for a party from a completely different
    // context.
    const party = indexEntry("Globex Dynamics", { accountId: "acct_us_tenant" });
    const matches = findImpactedParties(entity({ name: "Globex Dynamics", country: "CN" }), [party]);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.reasons).toContain("EXACT");
  });

  it("does not exclude a candidate even when the entity object carries no country data at all", () => {
    const party = indexEntry("Globex Dynamics");
    const matches = findImpactedParties(entity({ name: "Globex Dynamics", country: undefined }), [party]);

    expect(matches).toHaveLength(1);
  });
});

describe("findImpactedParties: no duplicate reasons per party, accumulates across multiple entity names", () => {
  it("accumulates every distinct reason a party was found by across the entity's name + alternateNames without duplicating the party in the result", () => {
    const party = indexEntry("Globex Dynamics");
    const matches = findImpactedParties(
      entity({ name: "Globex Dynamics", alternateNames: ["Globex Dynamics Holdings"] }),
      [party]
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.reasons).toContain("EXACT");
  });
});

describe("buildPartyIdentityIndex", () => {
  it("returns an empty index when there are no active parties", async () => {
    dbMock.party.findMany.mockResolvedValue([]);
    const index = await buildPartyIdentityIndex();
    expect(index).toEqual([]);
    expect(dbMock.partyName.findMany).not.toHaveBeenCalled();
  });

  it("picks each party's primary-then-most-recent ACTIVE name, matching loadCurrentIdentity's own selection", async () => {
    dbMock.party.findMany.mockResolvedValue([{ id: "party_1", accountId: "acct_1" }]);
    dbMock.partyName.findMany.mockResolvedValue([
      { partyId: "party_1", rawName: "Primary Name Co" },
      { partyId: "party_1", rawName: "Old Alias Name" },
    ]);

    const index = await buildPartyIdentityIndex();

    expect(index).toHaveLength(1);
    expect(index[0]?.normalizedName).toBe(normalizeForMatching("Primary Name Co"));
  });

  it("excludes a party with a blank/whitespace-only chosen name", async () => {
    dbMock.party.findMany.mockResolvedValue([{ id: "party_1", accountId: "acct_1" }]);
    dbMock.partyName.findMany.mockResolvedValue([{ partyId: "party_1", rawName: "   " }]);

    const index = await buildPartyIdentityIndex();
    expect(index).toHaveLength(0);
  });

  it("filters index tokens to the same > 2 character floor RAW_WORD matching uses", async () => {
    dbMock.party.findMany.mockResolvedValue([{ id: "party_1", accountId: "acct_1" }]);
    dbMock.partyName.findMany.mockResolvedValue([{ partyId: "party_1", rawName: "Li Meridian" }]);

    const index = await buildPartyIdentityIndex();

    expect(index[0]?.tokens.has("MERIDIAN")).toBe(true);
    expect(index[0]?.tokens.has("LI")).toBe(false);
  });
});
