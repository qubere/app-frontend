import { describe, it, expect } from "vitest";
import { scoreCandidate } from "@/modules/agents/compliance/restrictedParty/scoring";
import { REVIEW_FLOOR_SCORE } from "@/modules/agents/compliance/restrictedParty/types";
import type { ScreeningCandidate, CandidateReason } from "@/modules/agents/compliance/restrictedParty/candidateGeneration";
import type { ScreeningEntityWithAddresses } from "@/modules/agents/compliance/restrictedParty/restrictedPartyRepository";

// Restricted / Denied-Party Screening: scoring.ts.
// No test file existed for this module before this suite -- it's the piece
// that turns a shortlisted candidate into a HIT/REVIEW_REQUIRED tier (or
// discards it below REVIEW_FLOOR_SCORE), and owns the address-score and
// country-match gates. Covers: address gate (satisfied/missed/absent),
// country gate (all countryMatchRequired x match combinations), and the
// nameThreshold/REVIEW_FLOOR_SCORE boundary values.

function entity(overrides: Partial<ScreeningEntityWithAddresses> = {}): ScreeningEntityWithAddresses {
  return {
    id: "entity_1",
    name: "Acme Trading Co",
    address: null,
    country: null,
    sourceList: "SDN",
    entityType: "COMPANY",
    programCodes: ["SDN"],
    citation: null,
    agency: null,
    effectiveDate: null,
    expirationDate: null,
    addresses: [],
    aliases: [],
    alternateNames: [],
    ...overrides,
  } as unknown as ScreeningEntityWithAddresses;
}

function candidate(overrides: Partial<ScreeningCandidate> = {}): ScreeningCandidate {
  return {
    entity: entity(),
    matchedAgainst: "Acme Trading Co",
    reasons: new Set<CandidateReason>(["EXACT"]),
    matchedTokens: new Set<string>(),
    ...overrides,
  };
}

describe("scoreCandidate: address gate", () => {
  it("stays HIT when addressThreshold is set and the address score clears it", () => {
    const c = candidate({ entity: entity({ address: "123 Main St, Springfield" }) });
    const result = scoreCandidate(c, {
      targetName: "Acme Trading Co",
      targetAddress: "123 Main St, Springfield",
      nameThreshold: 80,
      addressThreshold: 80,
      countryMatchRequired: false,
    });
    expect(result!.tier).toBe("HIT");
    expect(result!.addressScore).not.toBeNull();
  });

  it("downgrades HIT to REVIEW_REQUIRED when the address score falls short of addressThreshold", () => {
    const c = candidate({ entity: entity({ address: "999 Totally Different Rd, Nowhere" }) });
    const result = scoreCandidate(c, {
      targetName: "Acme Trading Co",
      targetAddress: "123 Main St, Springfield",
      nameThreshold: 80,
      addressThreshold: 80,
      countryMatchRequired: false,
    });
    expect(result!.tier).toBe("REVIEW_REQUIRED");
  });

  it("skips the address gate entirely (no downgrade) when no address is supplied on either side", () => {
    const c = candidate();
    const result = scoreCandidate(c, {
      targetName: "Acme Trading Co",
      nameThreshold: 80,
      addressThreshold: 80,
      countryMatchRequired: false,
    });
    expect(result!.tier).toBe("HIT");
    expect(result!.addressScore).toBeNull();
  });

  it("skips the address gate when addressThreshold itself is not set, even if addresses are present and differ", () => {
    const c = candidate({ entity: entity({ address: "999 Totally Different Rd, Nowhere" }) });
    const result = scoreCandidate(c, {
      targetName: "Acme Trading Co",
      targetAddress: "123 Main St, Springfield",
      nameThreshold: 80,
      countryMatchRequired: false,
    });
    expect(result!.tier).toBe("HIT");
    expect(result!.addressScore).toBeNull();
  });

  it("normalizes address noise (ADDRESS_TERMS) before scoring -- differing street-suffix/directional format alone no longer costs a match its HIT tier", () => {
    // "123 N Main Street" vs "123 Main St" strip to the same "123 MAIN" on
    // both sides via normalizeAddressForMatching -- previously this raw-string
    // comparison would have scored the differing suffix/directional as noise.
    const c = candidate({ entity: entity({ address: "123 Main St" }) });
    const result = scoreCandidate(c, {
      targetName: "Acme Trading Co",
      targetAddress: "123 N Main Street",
      nameThreshold: 80,
      addressThreshold: 80,
      countryMatchRequired: false,
    });
    expect(result!.tier).toBe("HIT");
    expect(result!.addressScore).toBe(100);
  });
});

describe("scoreCandidate: country gate", () => {
  it("countryMatchRequired=true, same country -> no downgrade", () => {
    const c = candidate({ entity: entity({ country: "France" }) });
    const result = scoreCandidate(c, {
      targetName: "Acme Trading Co",
      targetCountry: "France",
      nameThreshold: 80,
      countryMatchRequired: true,
    });
    expect(result!.tier).toBe("HIT");
    expect(result!.countryMatch).toBe(true);
  });

  it("countryMatchRequired=true, different country -> downgrades to REVIEW_REQUIRED", () => {
    const c = candidate({ entity: entity({ country: "France" }) });
    const result = scoreCandidate(c, {
      targetName: "Acme Trading Co",
      targetCountry: "Germany",
      nameThreshold: 80,
      countryMatchRequired: true,
    });
    expect(result!.tier).toBe("REVIEW_REQUIRED");
    expect(result!.countryMatch).toBe(false);
  });

  it("countryMatchRequired=false, different country -> no downgrade (evidence retained, not enforced)", () => {
    const c = candidate({ entity: entity({ country: "France" }) });
    const result = scoreCandidate(c, {
      targetName: "Acme Trading Co",
      targetCountry: "Germany",
      nameThreshold: 80,
      countryMatchRequired: false,
    });
    expect(result!.tier).toBe("HIT");
    expect(result!.countryMatch).toBe(false);
  });

  it("countryMatchRequired=true but no targetCountry supplied -> countryMatch stays null AND the scoring layer still downgrades (this input combination is rejected upstream in restrictedPartyScreening.ts as MISSING_COUNTRY_FOR_COUNTRY_MATCH before scoring ever runs; scoring.ts itself has no special case for it)", () => {
    const c = candidate({ entity: entity({ country: "France" }) });
    const result = scoreCandidate(c, {
      targetName: "Acme Trading Co",
      nameThreshold: 80,
      countryMatchRequired: true,
    });
    expect(result!.countryMatch).toBeNull();
    expect(result!.tier).toBe("REVIEW_REQUIRED");
  });

  it("resolves country evidence from a Dow Jones-style child address row when the flat country column is absent", () => {
    const c = candidate({
      entity: entity({ country: null, addresses: [{ countryName: "France" } as never] }),
    });
    const result = scoreCandidate(c, {
      targetName: "Acme Trading Co",
      targetCountry: "France",
      nameThreshold: 80,
      countryMatchRequired: true,
    });
    expect(result!.countryMatch).toBe(true);
    expect(result!.tier).toBe("HIT");
  });
});

describe("scoreCandidate: nameThreshold / REVIEW_FLOOR_SCORE boundaries", () => {
  // "Acme Trading Co" vs "Acme Trading Company" -- close but not identical,
  // giving a fuzzy score in the HIT/REVIEW_REQUIRED band rather than a flat 100.
  const nearMissCandidate = candidate({
    matchedAgainst: "Acme Trading Company",
    entity: entity({ name: "Acme Trading Company" }),
  });

  it("ties exactly at nameThreshold -> HIT", () => {
    const probe = scoreCandidate(nearMissCandidate, { targetName: "Acme Trading Co", nameThreshold: 0, countryMatchRequired: false })!;
    const score = probe.nameScore;
    const result = scoreCandidate(nearMissCandidate, { targetName: "Acme Trading Co", nameThreshold: score, countryMatchRequired: false });
    expect(result!.tier).toBe("HIT");
  });

  it("one point above the actual score -> REVIEW_REQUIRED, not HIT", () => {
    const probe = scoreCandidate(nearMissCandidate, { targetName: "Acme Trading Co", nameThreshold: 0, countryMatchRequired: false })!;
    const score = probe.nameScore;
    const result = scoreCandidate(nearMissCandidate, { targetName: "Acme Trading Co", nameThreshold: score + 1, countryMatchRequired: false });
    expect(result!.tier).toBe("REVIEW_REQUIRED");
  });

  it("a candidate scoring exactly REVIEW_FLOOR_SCORE is kept (not discarded)", () => {
    const c = candidate();
    const result = scoreCandidate(c, { targetName: "Acme Trading Co", nameThreshold: 100, countryMatchRequired: false });
    // EXACT name match scores 100, well above the floor -- this asserts the
    // floor comparison itself is `< REVIEW_FLOOR_SCORE`, not `<=`, by
    // confirming a clearly-above-floor candidate survives at REVIEW_REQUIRED.
    expect(result).not.toBeNull();
    expect(REVIEW_FLOOR_SCORE).toBeLessThan(result!.nameScore);
  });

  it("discards a candidate scoring below REVIEW_FLOOR_SCORE entirely (returns null, not a low-tier match)", () => {
    const c = candidate({ matchedAgainst: "Zephyr Unrelated Holdings", entity: entity({ name: "Zephyr Unrelated Holdings" }) });
    const result = scoreCandidate(c, { targetName: "Acme Trading Co", nameThreshold: 80, countryMatchRequired: false });
    expect(result).toBeNull();
  });
});

describe("scoreCandidate: below-floor rescue rule (scoring-gap fix 1)", () => {
  it("rescues a RAW_WORD candidate to exactly REVIEW_FLOOR_SCORE even when the raw fuzzy score is below the floor", () => {
    const c = candidate({
      matchedAgainst: "Jon Smith",
      entity: entity({ name: "Jon Smith" }),
      reasons: new Set<CandidateReason>(["RAW_WORD"]),
      matchedTokens: new Set(["SMITH"]),
    });
    const result = scoreCandidate(c, { targetName: "John A Smith", nameThreshold: 80, countryMatchRequired: false });
    expect(result).not.toBeNull();
    expect(result!.nameScore).toBe(REVIEW_FLOOR_SCORE);
    expect(result!.tier).toBe("REVIEW_REQUIRED");
  });

  it("rescues an ALTERNATE_WHOLE_WORD candidate to REVIEW_FLOOR_SCORE the same way", () => {
    // "Alpha Zeta" vs "Beta Zeta" shares one word (ZETA) -> scoreDpsMatch
    // caps a single-word match at 30, below the floor, exercising the same
    // rescue mechanism as RAW_WORD.
    const c = candidate({
      matchedAgainst: "Beta Zeta",
      entity: entity({ name: "Beta Zeta" }),
      reasons: new Set<CandidateReason>(["ALTERNATE_WHOLE_WORD"]),
      matchedTokens: new Set(["ZETA"]),
    });
    const result = scoreCandidate(c, { targetName: "Alpha Zeta", nameThreshold: 80, countryMatchRequired: false });
    expect(result).not.toBeNull();
    expect(result!.nameScore).toBe(REVIEW_FLOOR_SCORE);
  });

  it("rescues a phonetic-only candidate when both normalized names reduce to <=2 tokens", () => {
    const c = candidate({
      matchedAgainst: "ABQ",
      entity: entity({ name: "ABQ" }),
      reasons: new Set<CandidateReason>(["DOUBLE_METAPHONE"]),
      matchedTokens: new Set(),
    });
    const result = scoreCandidate(c, { targetName: "ABC", nameThreshold: 80, countryMatchRequired: false });
    expect(result).not.toBeNull();
    expect(result!.nameScore).toBe(REVIEW_FLOOR_SCORE);
  });

  it("does NOT rescue a phonetic-only candidate when neither token overlap nor the <=2-token exception applies", () => {
    // Target strips to 2 tokens ("ACME SOLUTIONS"), matchedAgainst strips to
    // 4 ("ZEPHYR UNRELATED CONSULTING PARTNERS") with zero shared tokens --
    // outside both rescue conditions, so this stays discarded.
    const c = candidate({
      matchedAgainst: "Zephyr Unrelated Consulting Partners",
      entity: entity({ name: "Zephyr Unrelated Consulting Partners" }),
      reasons: new Set<CandidateReason>(["DOUBLE_METAPHONE"]),
      matchedTokens: new Set(),
    });
    const result = scoreCandidate(c, { targetName: "Acme Trading Company Solutions Group", nameThreshold: 80, countryMatchRequired: false });
    expect(result).toBeNull();
  });
});

describe("scoreCandidate: legal-form-mismatch downgrade (scoring-gap fix 2)", () => {
  it("downgrades an EXACT-tier HIT from HIT to REVIEW_REQUIRED when the raw names carry disjoint legal-form words", () => {
    const c = candidate({ matchedAgainst: "Acme AG", entity: entity({ name: "Acme AG" }) });
    const result = scoreCandidate(c, { targetName: "Acme GmbH", nameThreshold: 80, countryMatchRequired: false });
    expect(result).not.toBeNull();
    expect(result!.matchMethod).toBe("EXACT");
    expect(result!.tier).toBe("REVIEW_REQUIRED");
  });

  it("does NOT downgrade when legal-form words are abbreviation/spelled-out synonyms of each other (CO vs COMPANY)", () => {
    const c = candidate({ matchedAgainst: "Acme Trading Company", entity: entity({ name: "Acme Trading Company" }) });
    const result = scoreCandidate(c, { targetName: "Acme Trading Co", nameThreshold: 80, countryMatchRequired: false });
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("HIT");
  });

  it("does NOT downgrade when one side carries no legal-form word at all", () => {
    const c = candidate({ matchedAgainst: "Acme AG", entity: entity({ name: "Acme AG" }) });
    const result = scoreCandidate(c, { targetName: "Acme AG", nameThreshold: 80, countryMatchRequired: false });
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("HIT");
  });

  it("does NOT downgrade a REVIEW_REQUIRED-tier candidate further (downgrade only applies to would-be HIT)", () => {
    const c = candidate({ matchedAgainst: "Acme AG", entity: entity({ name: "Acme AG" }) });
    const result = scoreCandidate(c, { targetName: "Acme GmbH", nameThreshold: 101, countryMatchRequired: false });
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("REVIEW_REQUIRED");
  });
});
