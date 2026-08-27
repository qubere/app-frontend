import { describe, it, expect } from "vitest";
import { generateCandidates } from "@/modules/agents/compliance/restrictedParty/candidateGeneration";
import { scoreCandidate } from "@/modules/agents/compliance/restrictedParty/scoring";
import { DEFAULT_NAME_THRESHOLD } from "@/modules/agents/compliance/restrictedParty/types";
import type { ScreeningEntityWithAddresses } from "@/modules/agents/compliance/restrictedParty/restrictedPartyRepository";

// Restricted / Denied-Party Screening: the 5 mandated synthetic name pairs,
// run end-to-end through generateCandidates + scoring.ts together. These
// assert the ACTUAL current outcome for each pair, verified by instrumented
// probing rather than assumed -- several are NOT the "should obviously be a
// HIT" outcome a reader might expect, and that gap is exactly what this
// characterization suite exists to surface and pin down, so a future matcher
// change has to consciously touch these assertions rather than silently
// drift the behavior.
//
// Updated after the 3 scoring-gap fixes (below-floor rescue, legal-form
// mismatch downgrade, short-token RAW_WORD floor relaxed to >2): the 3
// previously-silently-discarded pairs now surface as REVIEW_REQUIRED instead
// of being dropped, and the 2 previously-false-EXACT-HIT collapses now
// downgrade to REVIEW_REQUIRED instead of HIT.

function entity(name: string, overrides: Partial<ScreeningEntityWithAddresses> = {}): ScreeningEntityWithAddresses {
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
    ...overrides,
  } as unknown as ScreeningEntityWithAddresses;
}

function runPair(targetName: string, referenceName: string, options: { nameThreshold?: number } = {}) {
  const nameThreshold = options.nameThreshold ?? DEFAULT_NAME_THRESHOLD;
  const referenceList = [entity(referenceName)];
  const generated = generateCandidates(targetName, referenceList, { nameThreshold });
  expect(generated.candidates.length).toBeLessThanOrEqual(1);
  const candidate = generated.candidates[0];
  if (!candidate) return { generated, scored: null };
  const scored = scoreCandidate(candidate, { targetName, nameThreshold, countryMatchRequired: false });
  return { generated, scored };
}

describe("matching quality: 5 mandated synthetic pairs", () => {
  it("ABC International Trading Company Ltd vs ABQ International Trading Company Limited -- caught by candidate generation (phonetic), rescued to REVIEW_FLOOR_SCORE instead of discarded", () => {
    const { generated, scored } = runPair(
      "ABC International Trading Company Ltd",
      "ABQ International Trading Company Limited"
    );
    expect(generated.exactMatchFound).toBe(false);
    expect(generated.candidates).toHaveLength(1);
    expect(generated.candidates[0].reasons.has("DOUBLE_METAPHONE")).toBe(true);
    // FIXED (Gap 1): a real near-duplicate (single letter differs in the
    // distinctive token, ABC vs ABQ) is now rescued to REVIEW_FLOOR_SCORE
    // and surfaced for review instead of silently dropped -- the phonetic
    // collision is corroborated by both normalized names reducing to a
    // single token each (<=2 tokens on both sides).
    expect(scored).not.toBeNull();
    expect(scored!.nameScore).toBe(50);
    expect(scored!.tier).toBe("REVIEW_REQUIRED");
  });

  it("ABC Trading Company vs ABC Trading Corporation -- COMPANY/CORPORATION both strip to nothing, collapsing to an exact match, but downgraded on legal-form mismatch", () => {
    const { generated, scored } = runPair("ABC Trading Company", "ABC Trading Corporation");
    expect(generated.exactMatchFound).toBe(true);
    expect(scored).not.toBeNull();
    expect(scored!.matchMethod).toBe("EXACT");
    // FIXED (Gap 2): the normalized-form collapse to "ABC" still surfaces
    // the match, but COMPANY and CORPORATION are genuinely different raw
    // legal-form words, so tier is downgraded from HIT to REVIEW_REQUIRED
    // instead of presenting it as full-confidence.
    expect(scored!.tier).toBe("REVIEW_REQUIRED");
  });

  it("Acme GmbH vs Acme AG -- both legal-form suffixes strip to nothing, so two differently-suffixed entities collapse to an exact match, but downgraded on legal-form mismatch", () => {
    const { generated, scored } = runPair("Acme GmbH", "Acme AG");
    expect(generated.exactMatchFound).toBe(true);
    expect(scored).not.toBeNull();
    // FIXED (Gap 2): GmbH and AG are legally distinct entity forms in
    // Germany. normalize.ts's binary stripping still collapses both to
    // "ACME" for the purpose of finding the match, but extractLegalFormWords
    // catches the raw-form mismatch and downgrades tier so it isn't
    // presented as a full-confidence exact hit.
    expect(scored!.matchMethod).toBe("EXACT");
    expect(scored!.tier).toBe("REVIEW_REQUIRED");
  });

  it("John A Smith vs Jon Smith -- shared token SMITH shortlists it via RAW_WORD + phonetic, rescued to REVIEW_FLOOR_SCORE instead of discarded", () => {
    const { generated, scored } = runPair("John A Smith", "Jon Smith");
    expect(generated.exactMatchFound).toBe(false);
    expect(generated.candidates).toHaveLength(1);
    expect(generated.candidates[0].reasons.has("RAW_WORD")).toBe(true);
    expect([...generated.candidates[0].matchedTokens]).toEqual(["SMITH"]);
    // FIXED (Gap 1): a RAW_WORD reason is always rescued to
    // REVIEW_FLOOR_SCORE -- the shared surname is direct shortlisting
    // evidence, even though the given name also differs (John/A vs Jon).
    expect(scored).not.toBeNull();
    expect(scored!.nameScore).toBe(50);
    expect(scored!.tier).toBe("REVIEW_REQUIRED");
  });

  it("Mohamed Ali vs Muhammad Ali -- ALI now qualifies for RAW_WORD (length > 2), rescued to REVIEW_FLOOR_SCORE instead of discarded", () => {
    const { generated, scored } = runPair("Mohamed Ali", "Muhammad Ali");
    expect(generated.exactMatchFound).toBe(false);
    expect(generated.candidates).toHaveLength(1);
    expect(generated.candidates[0].reasons.has("DOUBLE_METAPHONE")).toBe(true);
    // FIXED (Gap 3): the RAW_WORD floor relaxed from length > 3 to > 2 means
    // the shared 3-character token ALI now also contributes a RAW_WORD
    // reason, which Gap 1's rescue rule always rescues to the floor.
    expect(generated.candidates[0].reasons.has("RAW_WORD")).toBe(true);
    expect(scored).not.toBeNull();
    expect(scored!.nameScore).toBe(50);
    expect(scored!.tier).toBe("REVIEW_REQUIRED");
  });
});
