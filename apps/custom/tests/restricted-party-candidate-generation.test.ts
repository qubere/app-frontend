import { describe, it, expect } from "vitest";
import { generateCandidates } from "@/modules/agents/compliance/restrictedParty/candidateGeneration";
import type { ScreeningEntityWithAddresses } from "@/modules/agents/compliance/restrictedParty/restrictedPartyRepository";

// Restricted / Denied-Party Screening: candidateGeneration.ts.
// Covers: exact matching always runs as its own phase, continueOnExactMatch
// gating the fuzzy/phonetic/alternate expansion phase, phoneticAlgorithm
// selection + excludeMetaphone, and the alternate whole-word screening
// eligibility rule (multi-word raw name, exactly one meaningful token after
// common-word stripping, effective nameThreshold > 50).

function entity(id: string, name: string, alternateNames: string[] = []): ScreeningEntityWithAddresses {
  return { id, name, alternateNames, addresses: [] } as unknown as ScreeningEntityWithAddresses;
}

describe("generateCandidates: exact phase", () => {
  it("always finds an exact match regardless of other options", () => {
    const result = generateCandidates("Acme Trading Co", [entity("e1", "Acme Trading Co")]);
    expect(result.exactMatchFound).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].reasons.has("EXACT")).toBe(true);
  });

  it("reports no exact match when nothing matches exactly", () => {
    const result = generateCandidates("Acme Trading Co", [entity("e1", "Totally Unrelated Corp")]);
    expect(result.exactMatchFound).toBe(false);
  });
});

describe("generateCandidates: continueOnExactMatch", () => {
  const target = "Acme Consolidated Traders";
  const referenceList = [
    entity("e_exact", "Acme Consolidated Traders"),
    entity("e_fuzzy", "Consolidated Acme Metals"),
  ];

  it("stops fuzzy/phonetic/alternate expansion once an exact match is found (default false)", () => {
    const result = generateCandidates(target, referenceList);
    expect(result.exactMatchFound).toBe(true);
    expect(result.candidates.map((c) => c.entity.id)).toEqual(["e_exact"]);
  });

  it("keeps the exact evidence AND continues expansion when true", () => {
    const result = generateCandidates(target, referenceList, { continueOnExactMatch: true });
    const ids = result.candidates.map((c) => c.entity.id).sort();
    expect(ids).toEqual(["e_exact", "e_fuzzy"]);
    const fuzzy = result.candidates.find((c) => c.entity.id === "e_fuzzy")!;
    expect(fuzzy.reasons.has("RAW_WORD")).toBe(true);
  });

  it("still runs the expansion phase when no exact match was found, regardless of the flag", () => {
    // "Distribution" (unlike "Trading") isn't in COMMON_WORDS, so this doesn't
    // collapse into an accidental exact match via common-word stripping --
    // it stays a genuine RAW_WORD-only fuzzy candidate.
    const result = generateCandidates("Consolidated Acme Metals Distribution", [entity("e_fuzzy", "Consolidated Acme Metals")]);
    expect(result.exactMatchFound).toBe(false);
    expect(result.candidates).toHaveLength(1);
  });
});

describe("generateCandidates: phoneticAlgorithm + excludeMetaphone", () => {
  // "Kathryn Smyth" vs "Catherine Smith" -- classic Double Metaphone AND classic
  // single-code Metaphone equivalents (per restricted-party-phonetic.test.ts),
  // but no shared raw word and no exact match.
  const target = "Kathryn Smyth";
  const referenceList = [entity("e_phonetic", "Catherine Smith")];

  it("finds a Double Metaphone candidate by default", () => {
    const result = generateCandidates(target, referenceList);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].reasons.has("DOUBLE_METAPHONE")).toBe(true);
  });

  it("finds a Metaphone2 candidate when phoneticAlgorithm is METAPHONE2", () => {
    const result = generateCandidates(target, referenceList, { phoneticAlgorithm: "METAPHONE2" });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].reasons.has("METAPHONE2")).toBe(true);
    expect(result.candidates[0].reasons.has("DOUBLE_METAPHONE")).toBe(false);
  });

  it("excludes the phonetic reason entirely when excludeMetaphone is true, without disabling exact/raw-word", () => {
    const result = generateCandidates(target, referenceList, { excludeMetaphone: true });
    expect(result.candidates).toHaveLength(0);
  });

  it("excludeMetaphone never disables the exact phase", () => {
    const result = generateCandidates("Acme Trading Co", [entity("e1", "Acme Trading Co")], { excludeMetaphone: true });
    expect(result.exactMatchFound).toBe(true);
    expect(result.candidates[0].reasons.has("EXACT")).toBe(true);
  });
});

describe("generateCandidates: alternate whole-word screening", () => {
  // "ABC Trading Co" strips to the single 3-char token "ABC" -- too short for
  // RAW_WORD (which requires token length > 3), so a candidate produced only
  // via the alternate path proves it is a genuinely additional signal, not a
  // RAW_WORD duplicate.
  const target = "ABC Trading Co";
  const referenceList = [entity("e_alt", "ABC Global Metals")];

  it("is not eligible when alternate screening is disabled", () => {
    const result = generateCandidates(target, referenceList, { nameThreshold: 80 });
    expect(result.alternateScreeningRan).toBe(false);
    expect(result.alternateScreeningReason).toMatch(/disabled/);
    expect(result.candidates).toHaveLength(0);
  });

  it("is not eligible when the raw screened name is a single word", () => {
    const result = generateCandidates("ABC", referenceList, {
      alternateScreeningEnabled: true,
      nameThreshold: 80,
    });
    expect(result.alternateScreeningRan).toBe(false);
    expect(result.alternateScreeningReason).toMatch(/not multi-word/);
  });

  it("is not eligible when more than one meaningful token remains after common-word stripping", () => {
    const result = generateCandidates("Global ABC Trading Co", referenceList, {
      alternateScreeningEnabled: true,
      nameThreshold: 80,
    });
    expect(result.alternateScreeningRan).toBe(false);
    expect(result.alternateScreeningReason).toMatch(/2 meaningful tokens/);
  });

  it("is not eligible when the effective nameThreshold is not greater than 50", () => {
    const result = generateCandidates(target, referenceList, {
      alternateScreeningEnabled: true,
      nameThreshold: 50,
    });
    expect(result.alternateScreeningRan).toBe(false);
    expect(result.alternateScreeningReason).toMatch(/nameThreshold is not greater than 50/);
  });

  it("is eligible but skipped when an exact match was already found and continueOnExactMatch is false", () => {
    // "ABC Enterprises" strips to the same single token "ABC" as `target`
    // ("ABC Trading Co" -> strips "Trading"/"Co"), so it's an EXACT match via
    // common-word-stripped comparison while still leaving `target` eligible
    // for alternate screening (multi-word, strips to exactly one token).
    const result = generateCandidates(target, [entity("e_exact", "ABC Enterprises")], {
      alternateScreeningEnabled: true,
      nameThreshold: 80,
    });
    expect(result.exactMatchFound).toBe(true);
    expect(result.alternateScreeningRan).toBe(false);
    expect(result.alternateScreeningReason).toMatch(/eligible but skipped/);
  });

  it("runs and finds a whole-word candidate that RAW_WORD's length filter would have missed", () => {
    const result = generateCandidates(target, referenceList, {
      alternateScreeningEnabled: true,
      nameThreshold: 80,
    });
    expect(result.alternateScreeningRan).toBe(true);
    expect(result.alternateScreeningReason).toBe("ran");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].reasons.has("ALTERNATE_WHOLE_WORD")).toBe(true);
    expect(result.candidates[0].reasons.has("RAW_WORD")).toBe(false);
  });
});
