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
  /** The specific token(s) that triggered a RAW_WORD/ALTERNATE_WHOLE_WORD reason -- audit-evidence detail. Empty for candidates found only via EXACT/phonetic, where no single token is "the" trigger. */
  matchedTokens: Set<string>;
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

/** The subset of entity fields candidateNames() actually reads -- lets callers that only have a name/alternateNames/aliases projection (e.g. searchTokenGeneration.ts, working off an ingestion-time select) reuse it without assembling a full ScreeningEntityWithAddresses. */
export interface CandidateNameSource {
  name: string;
  alternateNames: string[];
  aliases?: { name: string }[];
}

/** All name strings worth checking a target against for this entity: primary name, alternateNames, and ScreeningEntityAlias rows (Dow Jones AKA/FKA/spelling-variation records) -- de-duplicated case-insensitively since Dow Jones ingestion writes some alias strings into both alternateNames and ScreeningEntityAlias. Purely additive vs. the pre-alias candidate set: it can only add candidates, never remove one. Exported for reuse by impactAnalysis.ts's reverse candidate index -- never reimplemented there. */
export function candidateNames(entity: CandidateNameSource): string[] {
  const names = [entity.name, ...entity.alternateNames, ...(entity.aliases ?? []).map((a) => a.name)];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    if (!name) continue;
    const key = name.trim().toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
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
  const addReason = (
    entity: ScreeningEntityWithAddresses,
    matchedAgainst: string,
    reason: CandidateReason,
    token?: string,
  ) => {
    const existing = byEntityId.get(entity.id);
    if (existing) {
      existing.reasons.add(reason);
      if (token) existing.matchedTokens.add(token);
    } else {
      byEntityId.set(entity.id, {
        entity,
        matchedAgainst,
        reasons: new Set([reason]),
        matchedTokens: new Set(token ? [token] : []),
      });
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

        // Floor is `> 2` (not `> 3`): 3-char tokens like ALI/IBM/ABB carry real
        // matching signal and were being silently excluded from shortlisting
        // entirely. Still excludes 2-char tokens (LI/WU/NG/3M) -- the noise
        // risk from those is high enough to leave that narrower gap open and
        // documented rather than closed here.
        const sharedRawWord = entityTokens.find((t) => t.length > 2 && targetTokens.has(t));
        if (sharedRawWord) {
          addReason(entity, rawName, "RAW_WORD", sharedRawWord);
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
          addReason(entity, rawName, "ALTERNATE_WHOLE_WORD", alternateToken);
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
