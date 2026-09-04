// Restricted / Denied-Party Screening -- scoring.
//
// Wraps scoreDpsMatch (src/lib/screening/fuzzyMatch.ts, the codebase's one
// deterministic fuzzy scorer, already reused unmodified by
// forcedLaborScreening.ts/endUserScreening.ts) with stop-word-stripped
// inputs, an optional separate address-score gate, and an optional
// country-match gate. Never produces a candidate below REVIEW_FLOOR_SCORE --
// that is discarded as noise, not surfaced as a low-confidence match.
import { scoreDpsMatch } from "@/lib/screening/fuzzyMatch";
import { extractLegalFormWords, normalizeAddressForMatching, normalizeForMatching, tokenize } from "./normalize";
import { REVIEW_FLOOR_SCORE } from "./types";
import type { RestrictedPartyMatchCandidate, RestrictedPartyMatchMethod } from "./types";
import type { CandidateReason, ScreeningCandidate } from "./candidateGeneration";

/**
 * Whether a below-floor candidate should still be rescued up to
 * REVIEW_FLOOR_SCORE instead of discarded. scoreDpsMatch's word-count formula
 * caps a single shared word at exactly 30 -- always below the 50-point floor
 * -- even though candidate generation already shortlisted it on real
 * evidence (a shared significant word, or a whole-name phonetic collision).
 * RAW_WORD/ALTERNATE_WHOLE_WORD candidates carry that evidence directly, so
 * they're always rescued. A phonetic-only candidate is rescued only when
 * there's corroborating token overlap, or when both names are so short
 * (<=2 meaningful tokens) that a whole-name phonetic collision is itself
 * strong evidence.
 */
function shouldRescueBelowFloor(reasons: Set<CandidateReason>, targetNormalized: string, entityNormalized: string): boolean {
  if (reasons.has("RAW_WORD") || reasons.has("ALTERNATE_WHOLE_WORD")) return true;
  if (reasons.has("DOUBLE_METAPHONE") || reasons.has("METAPHONE2")) {
    const targetTokens = tokenize(targetNormalized);
    const entityTokens = tokenize(entityNormalized);
    const entityTokenSet = new Set(entityTokens);
    const sharedTokenCount = targetTokens.filter((t) => entityTokenSet.has(t)).length;
    if (sharedTokenCount > 0) return true;
    return targetTokens.length <= 2 && entityTokens.length <= 2;
  }
  return false;
}

function methodFromReasons(reasons: Set<CandidateReason>): RestrictedPartyMatchMethod {
  if (reasons.has("EXACT")) return "EXACT";

  const nonExact: RestrictedPartyMatchMethod[] = [];
  if (reasons.has("RAW_WORD")) nonExact.push("RAW_WORD");
  if (reasons.has("DOUBLE_METAPHONE")) nonExact.push("DOUBLE_METAPHONE");
  if (reasons.has("METAPHONE2")) nonExact.push("METAPHONE");
  if (reasons.has("ALTERNATE_WHOLE_WORD")) nonExact.push("ALTERNATE_WHOLE_WORD");

  if (nonExact.length > 1) return "COMBINED";
  return nonExact[0] ?? "DOUBLE_METAPHONE";
}

export interface ScoreMatchOptions {
  targetName: string;
  targetAddress?: string | null;
  targetCountry?: string | null;
  nameThreshold: number;
  addressThreshold?: number | null;
  countryMatchRequired: boolean;
}

/** Scores one shortlisted candidate; returns null when it falls below REVIEW_FLOOR_SCORE (not worth surfacing). Sequence is assigned by the caller once the final ordered list is known. */
export function scoreCandidate(
  candidate: ScreeningCandidate,
  options: ScoreMatchOptions
): Omit<RestrictedPartyMatchCandidate, "sequence" | "suppressedByApprovedParty" | "suppressingDispositionId"> | null {
  const targetNormalized = normalizeForMatching(options.targetName);
  const entityNormalized = normalizeForMatching(candidate.matchedAgainst);
  let nameScore = scoreDpsMatch(targetNormalized, entityNormalized);
  if (nameScore < REVIEW_FLOOR_SCORE) {
    if (!shouldRescueBelowFloor(candidate.reasons, targetNormalized, entityNormalized)) return null;
    nameScore = REVIEW_FLOOR_SCORE;
  }

  let tier: "HIT" | "REVIEW_REQUIRED" = nameScore >= options.nameThreshold ? "HIT" : "REVIEW_REQUIRED";

  // Legal-form-mismatch downgrade: normalizeForMatching strips legal-entity
  // suffixes as noise, so "Acme GmbH" and "Acme AG" collapse to the same
  // normalized form and look like an EXACT match even though GmbH/AG are
  // legally distinct registration types. Extracting the raw (pre-strip)
  // legal-form words lets us catch that specific false-collapse and
  // downgrade confidence without losing the match (it still surfaces for
  // review) or touching the shared normalization used elsewhere.
  if (tier === "HIT") {
    const targetLegalForms = extractLegalFormWords(options.targetName);
    const entityLegalForms = extractLegalFormWords(candidate.matchedAgainst);
    if (targetLegalForms.size > 0 && entityLegalForms.size > 0) {
      const overlaps = [...targetLegalForms].some((w) => entityLegalForms.has(w));
      if (!overlaps) tier = "REVIEW_REQUIRED";
    }
  }

  // Address noise (directionals, "ST"/"STREET"/"ROAD"/"BOX") is stripped via
  // the address-specific vocabulary (ADDRESS_TERMS in normalize.ts) before
  // scoring -- kept independent from organization-name normalization since
  // address and name noise words are not the same vocabulary. A real street
  // named "Main" still compares as "MAIN" on both sides; "123 N Main Street"
  // vs "123 Main St" no longer takes a needless score hit purely from
  // differing address-format noise.
  let addressScore: number | null = null;
  if (options.addressThreshold != null && options.targetAddress && candidate.entity.address) {
    addressScore = scoreDpsMatch(
      normalizeAddressForMatching(options.targetAddress),
      normalizeAddressForMatching(candidate.entity.address)
    );
    if (tier === "HIT" && addressScore < options.addressThreshold) tier = "REVIEW_REQUIRED";
  }

  // Country evidence: the flat ScreeningEntity.country column (populated for
  // every source, including OFAC/BIS which carry only one address), OR --
  // when a Dow Jones entity carries several addresses in the child table --
  // any one of them naming the screened country. A multi-address entity
  // whose non-primary address matches shouldn't be treated as a country
  // mismatch just because its single flattened column doesn't.
  let countryMatch: boolean | null = null;
  if (options.targetCountry) {
    const targetCountryNormalized = normalizeForMatching(options.targetCountry);
    const candidateCountries = [
      candidate.entity.country,
      ...candidate.entity.addresses.map((a) => a.countryName),
    ].filter((c): c is string => !!c);
    if (candidateCountries.length > 0) {
      countryMatch = candidateCountries.some((c) => normalizeForMatching(c) === targetCountryNormalized);
    }
  }
  if (options.countryMatchRequired && tier === "HIT" && countryMatch !== true) {
    tier = "REVIEW_REQUIRED";
  }

  return {
    screeningEntityId: candidate.entity.id,
    matchedName: candidate.entity.name,
    matchedAddress: candidate.entity.address,
    nameScore,
    addressScore,
    matchMethod: methodFromReasons(candidate.reasons),
    countryMatch,
    sourceList: candidate.entity.sourceList,
    entityType: candidate.entity.entityType,
    programCodes: candidate.entity.programCodes,
    citation: candidate.entity.citation,
    agency: candidate.entity.agency,
    effectiveDate: candidate.entity.effectiveDate,
    expirationDate: candidate.entity.expirationDate,
    tier,
    normalizedMatchedName: normalizeForMatching(candidate.matchedAgainst),
    matchedTokens: Array.from(candidate.matchedTokens),
  };
}
