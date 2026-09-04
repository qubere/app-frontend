import { describe, it, expect } from "vitest";
import { generateCandidates } from "@/modules/agents/compliance/restrictedParty/candidateGeneration";
import type { ScreeningEntityWithAddresses } from "@/modules/agents/compliance/restrictedParty/restrictedPartyRepository";

// Restricted / Denied-Party Screening: short-token characterization.
// candidateGeneration.ts's RAW_WORD phase originally required `t.length > 3`
// -- a deliberate floor to avoid noisy word-overlap candidates from common
// short tokens, but it also meant a real short distinguishing name/token (a
// surname, an initialism) NEVER contributed a RAW_WORD candidate on its own.
// Gap-3 fix: the floor was relaxed to `t.length > 2`, closing the gap for
// 3-character tokens (ALI, IBM, ABB) while deliberately leaving 2-character
// tokens (LI, WU, NG, 3M) as a documented, still-open gap (higher noise
// risk from very short tokens). This suite characterizes, for each of the 7
// mandated short tokens, both the case where common-word stripping happens
// to collapse the whole name down to just that token (an accidental EXACT
// rescue) and the PERSON-flavored case, which now differs by token length.

const SHORT_TOKENS = ["ALI", "LI", "WU", "NG", "IBM", "ABB", "3M"];
const RAW_WORD_ELIGIBLE = new Set(["ALI", "IBM", "ABB"]);

function entity(name: string): ScreeningEntityWithAddresses {
  return {
    id: "entity_1",
    name,
    alternateNames: [],
    addresses: [],
    aliases: [],
    address: null,
    country: null,
    sourceList: "SDN",
    entityType: "COMPANY",
    programCodes: ["SDN"],
    citation: null,
    agency: null,
    effectiveDate: null,
    expirationDate: null,
  } as unknown as ScreeningEntityWithAddresses;
}

describe.each(SHORT_TOKENS)("short-token characterization: %s", (token) => {
  const rawWordEligible = RAW_WORD_ELIGIBLE.has(token);

  it(`length-${rawWordEligible ? ">" : "<="}-2 gate: ${rawWordEligible ? "now qualifies" : "still excluded"} for RAW_WORD word-overlap on its own`, () => {
    expect(token.length > 2).toBe(rawWordEligible);
  });

  it("ORGANIZATION-flavored: surrounded only by legal-form/weak-business-term suffixes, both sides collapse to an accidental EXACT match on the token alone", () => {
    const target = `${token} Corporation International`;
    const reference = `${token} Holdings International`;
    const result = generateCandidates(target, [entity(reference)], { nameThreshold: 80 });
    expect(result.exactMatchFound).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].reasons.has("EXACT")).toBe(true);
    // Not rescued BY the short-token overlap rule -- rescued incidentally by
    // common-word stripping reducing both names to the same bare token.
    expect(result.candidates[0].reasons.has("RAW_WORD")).toBe(false);
  });

  if (rawWordEligible) {
    it("PERSON-flavored: surrounded by ordinary (non-common-word) surname/qualifier words that differ -- FIXED (Gap 3): now shortlisted via RAW_WORD on the shared 3-character token", () => {
      const target = `${token} Trading Partners`;
      const reference = `${token} Global Holdings`;
      const result = generateCandidates(target, [entity(reference)], { nameThreshold: 80 });
      expect(result.exactMatchFound).toBe(false);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].reasons.has("RAW_WORD")).toBe(true);
      expect([...result.candidates[0].matchedTokens]).toEqual([token]);
    });
  } else {
    it("PERSON-flavored: surrounded by ordinary (non-common-word) surname/qualifier words that differ, no candidate is generated at all -- a genuine, still-open silent gap for 2-character tokens, not rescued by phonetics either", () => {
      const target = `${token} Trading Partners`;
      const reference = `${token} Global Holdings`;
      const result = generateCandidates(target, [entity(reference)], { nameThreshold: 80 });
      expect(result.exactMatchFound).toBe(false);
      // GAP (deliberately left open): the shared 2-character token never
      // contributes a RAW_WORD candidate (length <= 2, unrelaxed), and the
      // differing surrounding words ("Partners" vs "Global") mean the
      // whole-string phonetic comparison doesn't collide either -- this
      // name pair is never even shortlisted.
      expect(result.candidates).toHaveLength(0);
    });
  }
});
