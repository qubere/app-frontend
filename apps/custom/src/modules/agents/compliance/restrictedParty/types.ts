// Restricted / Denied-Party Screening -- shared types.
//
// Screens a name (and, independently, a contact name) against ScreeningEntity
// rows sourced from OFAC SDN, BIS DPL, and the other denial-order lists not
// already owned by endUser/forcedLabor/militaryEndUse (sourceList IN "SDN",
// "CONSOLIDATED_NON_SDN", "DPL", "ISN", "SSI", "FSE", "PLC", "NS_MBS"), plus
// an independent red-flag word scan against ComplianceKeywordRule rows
// (category "RESTRICTED_PARTY_RED_FLAG"). No reference data loaded must
// resolve to SKIPPED, never CLEAR. A party-name pass and a contact-name pass
// never share candidate accumulation -- each is its own independent result.

export type RestrictedPartyScreeningStatus = "CLEAR" | "HIT" | "REVIEW_REQUIRED" | "PARTIAL" | "SKIPPED" | "ERROR";

export type RestrictedPartyPassType = "PARTY_NAME" | "CONTACT_NAME";

export type RestrictedPartyMatchMethod =
  | "EXACT"
  | "RAW_WORD"
  | "METAPHONE"
  | "DOUBLE_METAPHONE"
  | "ALTERNATE_WHOLE_WORD"
  | "COMBINED";

export type RestrictedPartyPhoneticAlgorithm = "DOUBLE_METAPHONE" | "METAPHONE2";

export type RestrictedPartyScreeningSource = "PARTY_MASTER" | "SHIPMENT" | "LINE" | "PUBLIC_API" | "COPILOT" | "MANUAL";

/** The identity actually being screened -- richer than EmbargoParty (which lacks address/contact). */
export interface RestrictedPartyIdentity {
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  contactName?: string | null;
}

export interface RestrictedPartyScreeningOptions {
  /** Minimum fuzzy-match score (0-100) for a candidate to count as a HIT-tier match. Below this but >= the fixed review floor is REVIEW_REQUIRED-tier. Default DEFAULT_NAME_THRESHOLD. */
  nameThreshold?: number;
  /** When set, a separate score gate on the candidate's address; a name match whose address falls short is downgraded a tier, never discarded. */
  addressThreshold?: number;
  /** When true, a match whose country doesn't align with the screened country is downgraded a tier (evidence retained, never discarded). */
  countryMatchRequired?: boolean;
  /** When false, the red-flag word scan is skipped entirely for this screening. Default true. */
  redFlagCheckEnabled?: boolean;
  /** When true, the phonetic candidate-generation reason is skipped entirely; EXACT/RAW_WORD/ALTERNATE_WHOLE_WORD are unaffected. Default false. */
  excludeMetaphone?: boolean;
  /** Which phonetic algorithm generates the phonetic candidate reason, when not excluded. Default DOUBLE_METAPHONE. */
  phoneticAlgorithm?: RestrictedPartyPhoneticAlgorithm;
  /**
   * When an exact match is found: false (default) keeps only the exact
   * evidence and stops further fuzzy/phonetic/alternate expansion for that
   * candidate name; true keeps the exact evidence AND continues expansion so
   * additional non-exact candidates can still surface alongside it.
   */
  continueOnExactMatch?: boolean;
  /**
   * Enables the legacy alternate whole-word screening path (spec: sbsAltScreeningInd).
   * Only takes effect when the pass-specific eligibility rule in candidateGeneration.ts
   * also holds (multi-word raw name, exactly one meaningful token after common-word
   * stripping, effective nameThreshold > 50). Default false.
   */
  alternateScreeningEnabled?: boolean;
}

export interface RestrictedPartyScreeningInput extends RestrictedPartyScreeningOptions {
  accountId: string;
  source: RestrictedPartyScreeningSource;
  shipmentId?: string | null;
  lineItemId?: string | null;
  partyId?: string | null;
  externalReference?: string | null;
  identity: RestrictedPartyIdentity;
  /** Groups every pass produced by one logical invocation. Generated if omitted. */
  correlationId?: string;
  screeningDate?: Date;
}

export interface RestrictedPartyMatchCandidate {
  sequence: number;
  screeningEntityId: string;
  matchedName: string;
  matchedAddress: string | null;
  nameScore: number;
  addressScore: number | null;
  matchMethod: RestrictedPartyMatchMethod;
  countryMatch: boolean | null;
  sourceList: string;
  entityType: string;
  programCodes: string[];
  citation: string | null;
  agency: string | null;
  effectiveDate: Date | null;
  expirationDate: Date | null;
  tier: "HIT" | "REVIEW_REQUIRED";
  suppressedByApprovedParty: boolean;
  suppressingDispositionId: string | null;
  /** Audit-evidence detail -- see RestrictedPartyMatch.normalizedMatchedName/matchedTokens in schema.prisma. */
  normalizedMatchedName: string;
  matchedTokens: string[];
}

export interface RestrictedPartyRedFlagHitCandidate {
  keywordRuleId: string | null;
  matchedWord: string;
}

export interface RestrictedPartyPassOutcome {
  passType: RestrictedPartyPassType;
  screenedName: string;
  /** normalizeForMatching() output of screenedName -- audit-evidence snapshot, see RestrictedPartyScreeningResult.normalizedScreenedName in schema.prisma. */
  normalizedScreenedName: string;
  /** getLatestReferenceDataPublishedAt() watermark at screening time, or null when no reference data has published yet. */
  referenceDataAsOf: Date | null;
  screenedAddress: string | null;
  screenedCity: string | null;
  screenedCountry: string | null;
  nameThreshold: number;
  addressThreshold: number | null;
  countryMatchRequired: boolean;
  redFlagCheckEnabled: boolean;
  excludeMetaphone: boolean;
  phoneticAlgorithm: RestrictedPartyPhoneticAlgorithm;
  continueOnExactMatch: boolean;
  exactMatchFound: boolean;
  alternateScreeningEnabled: boolean;
  alternateScreeningRan: boolean;
  alternateScreeningReason: string | null;
  /** True when the scored candidate set exceeded MAX_PERSISTED_MATCHES and was truncated to the top-scoring matches -- a caller/reviewer must be able to tell this apart from a genuinely small result. */
  matchesTruncated: boolean;
  status: RestrictedPartyScreeningStatus;
  matches: RestrictedPartyMatchCandidate[];
  redFlagHits: RestrictedPartyRedFlagHitCandidate[];
  errorCode: string | null;
  errorMessage: string | null;
  screeningInputHash: string;
  screeningDurationMs: number;
}

export interface RestrictedPartyScreeningRunResult {
  correlationId: string;
  passes: RestrictedPartyPassOutcome[];
}

export const DEFAULT_NAME_THRESHOLD = 80;
/** Fixed floor below which a candidate is not worth surfacing at all, regardless of nameThreshold. */
export const REVIEW_FLOOR_SCORE = 50;
/** Deterministic matcher/ruleset version stamped onto every persisted result and match -- bump when normalize.ts/candidateGeneration.ts/scoring.ts behavior changes, so a historical result stays attributable to the logic that actually produced it. */
export const RPS_MATCHER_VERSION = "rps-matcher-v1";
/** Hard cap on scored matches persisted per pass -- with reference sets now spanning OFAC+BIS+Dow Jones (tens of thousands of rows), an unbounded result set is a real risk, not a theoretical one. Truncation is always flagged via matchesTruncated, never silent. */
export const MAX_PERSISTED_MATCHES = 100;
