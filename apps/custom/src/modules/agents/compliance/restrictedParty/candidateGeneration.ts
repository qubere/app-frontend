// Restricted / Denied-Party Screening -- candidate generation.
//
// Pure functions -- no DB. Given a normalized screened name and a pre-fetched
// reference list, shortlists ScreeningEntity rows worth scoring: an exact
// normalized-name match, a shared significant raw word, a phonetic (Double
// Metaphone / Metaphone2) collision, or -- when eligible -- an alternate
// whole-word match. Scoring itself (scoring.ts) decides whether a shortlisted
// candidate clears any threshold -- this stage only decides what is worth
// scoring at all, so it must never be the source of a false CLEAR.
//
// Exact matching always runs as its own first phase. `continueOnExactMatch`
// then decides whether the fuzzy/phonetic/alternate phase runs at all once an
// exact match has been found: false (default) stops there and keeps only the
// exact evidence; true keeps the exact evidence AND still runs the expansion
// phase so additional non-exact candidates can surface alongside it.
import { normalizeForMatching, normalizeName, stripCommonWords, tokenize } from "./normalize";
import { doubleMetaphoneMatches } from "./phoneticMatch";
import { metaphone2Matches } from "./metaphone2";
import { DEFAULT_NAME_THRESHOLD } from "./types";
import type { RestrictedPartyPhoneticAlgorithm } from "./types";
import type { ScreeningEntityWithAddresses } from "./restrictedPartyRepository";

export type CandidateReason = "EXACT" | "RAW_WORD" | "DOUBLE_METAPHONE" | "METAPHONE2" | "ALTERNATE_WHOLE_WORD";

export interface ScreeningCandidate {
  entity: ScreeningEntityWithAddresses;
  matchedAgainst: string; // the entity name/alternateName that triggered the shortlist
  reasons: Set<CandidateReason>;
}

export interface GenerateCandidatesOptions {
  /** Effective (already-resolved) name threshold -- only used to gate alternate whole-word eligibility (must be > 50). */
  nameThreshold?: number;
  excludeMetaphone?: boolean;
  phoneticAlgorithm?: RestrictedPartyPhoneticAlgorithm;
  continueOnExactMatch?: boolean;
  alternateScreeningEnabled?: boolean;
}

export interface GenerateCandidatesResult {
  candidates: ScreeningCandidate[];
  exactMatchFound: boolean;
  alternateScreeningRan: boolean;
  alternateScreeningReason: string;
}

function candidateNames(entity: ScreeningEntityWithAddresses): string[] {
  return [entity.name, ...entity.alternateNames];
}

/** Shortlists reference entities worth scoring against `targetRawName`. Never returns duplicates per entity. */
export function generateCandidates(
  targetRawName: string,
  referenceList: ScreeningEntityWithAddresses[],
  options: GenerateCandidatesOptions = {},
): GenerateCandidatesResult {
  const {
    nameThreshold = DEFAULT_NAME_THRESHOLD,
    excludeMetaphone = false,
    phoneticAlgorithm = "DOUBLE_METAPHONE",
    continueOnExactMatch = false,
    alternateScreeningEnabled = false,
  } = options;

  const targetNormalized = normalizeForMatching(targetRawName);
  const targetTokens = new Set(tokenize(targetNormalized));

  const byEntityId = new Map<string, ScreeningCandidate>();
  const addReason = (entity: ScreeningEntityWithAddresses, matchedAgainst: string, reason: CandidateReason) => {
    const existing = byEntityId.get(entity.id);
    if (existing) {
      existing.reasons.add(reason);
    } else {
      byEntityId.set(entity.id, { entity, matchedAgainst, reasons: new Set([reason]) });
    }
  };

  // Phase 1: exact matching -- always runs, independent of every other option.
  let exactMatchFound = false;
  if (targetNormalized.length > 0) {
    for (const entity of referenceList) {
      for (const rawName of candidateNames(entity)) {
        if (!rawName || !rawName.trim()) continue;
        if (normalizeForMatching(rawName) === targetNormalized) {
          addReason(entity, rawName, "EXACT");
          exactMatchFound = true;
        }
      }
    }
  }

  const shouldExpand = !exactMatchFound || continueOnExactMatch;

  // Alternate whole-word eligibility (spec: legacy sbsAltScreeningInd) -- computed
  // regardless of shouldExpand so the reason is always accurate and persistable.
  const rawTokenCount = tokenize(normalizeName(targetRawName)).length;
  const strippedTokens = tokenize(stripCommonWords(normalizeName(targetRawName)));
  let alternateScreeningReason: string;
  if (!alternateScreeningEnabled) {
    alternateScreeningReason = "not eligible: alternate screening is disabled";
  } else if (rawTokenCount <= 1) {
    alternateScreeningReason = "not eligible: screened name is not multi-word";
  } else if (strippedTokens.length !== 1) {
    alternateScreeningReason = `not eligible: ${strippedTokens.length} meaningful tokens remain after common-word stripping (requires exactly 1)`;
  } else if (!(nameThreshold > 50)) {
    alternateScreeningReason = "not eligible: effective nameThreshold is not greater than 50";
  } else if (!shouldExpand) {
    alternateScreeningReason = "eligible but skipped: exact match already found and continueOnExactMatch is false";
  } else {
    alternateScreeningReason = "ran";
  }
  const alternateScreeningRan = alternateScreeningReason === "ran";
  const alternateToken = alternateScreeningRan ? strippedTokens[0] : null;

  if (shouldExpand) {
    for (const entity of referenceList) {
      for (const rawName of candidateNames(entity)) {
        if (!rawName || !rawName.trim()) continue;
        const entityNormalized = normalizeForMatching(rawName);
        const entityTokens = tokenize(entityNormalized);

        if (entityTokens.some((t) => t.length > 3 && targetTokens.has(t))) {
          addReason(entity, rawName, "RAW_WORD");
        }

        if (!excludeMetaphone) {
          const phoneticHit =
            phoneticAlgorithm === "METAPHONE2"
              ? metaphone2Matches(targetNormalized, entityNormalized)
              : doubleMetaphoneMatches(targetNormalized, entityNormalized);
          if (phoneticHit) {
            addReason(entity, rawName, phoneticAlgorithm === "METAPHONE2" ? "METAPHONE2" : "DOUBLE_METAPHONE");
          }
        }

        if (alternateToken && entityTokens.includes(alternateToken)) {
          addReason(entity, rawName, "ALTERNATE_WHOLE_WORD");
        }
      }
    }
  }

  return {
    candidates: Array.from(byEntityId.values()),
    exactMatchFound,
    alternateScreeningRan,
    alternateScreeningReason,
  };
}
