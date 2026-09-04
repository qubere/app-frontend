// Restricted / Denied-Party Screening -- normalization.
//
// Deterministic, pure functions -- no DB, no I/O. Uppercases, strips
// punctuation, and removes noise words (legal-entity suffixes and common
// connectors) that would otherwise dilute name-matching signal. Mirrors the
// legacy `COMMON_WORDS` reference table from PartyScreening_Tables.sql as a
// hardcoded const, matching this repo's ADD_CVD_ALERTS/FDA_CHAPTERS
// hardcoded-reference-list convention -- no new schema for this.

/**
 * True legal-entity suffixes (jurisdiction registration forms). Distinct from
 * WEAK_BUSINESS_TERMS because a future scoring pass may treat them
 * differently (e.g. still binary-stripped vs down-weighted).
 *
 * Cross-checked against the legacy Oracle `COMMON_WORDS` reference table
 * (CW_TYPE="WORD", CW_SUB_TYPE="ALL", read from the source CSV at
 * C:\C-Drive\AI-Cust\RPS\common_words.csv, 135 data rows total: 35 ALL / 10
 * ADDRESS / 3 NAME / 87 REDFLAG). `LTDA` (Portuguese/Spanish "Limitada") was
 * present there and missing here -- added below.
 */
export const LEGAL_FORM_WORDS: readonly string[] = [
  "CO",
  "COMPANY",
  "CORP",
  "CORPORATION",
  "INC",
  "INCORPORATED",
  "LTD",
  "LTDA",
  "LIMITED",
  "LLC",
  "LLP",
  "LP",
  "GMBH",
  "SA",
  "SAS",
  "SRL",
  "SARL",
  "BV",
  "NV",
  "AG",
  "PLC",
  "PVT",
  "PTY",
  "KG",
  "OY",
  "AB",
  "AS",
  "SPA",
];

/**
 * Weak/non-distinctive business connector words. Still binary-stripped today
 * like LEGAL_FORM_WORDS -- down-weighting (vs. full removal) is a deferred
 * scoring-behavior change, not implemented here.
 *
 * Extended with legacy `COMMON_WORDS` CW_SUB_TYPE="ALL" terms not already
 * covered: AERO, AIRLINES, CENTER, CENTRE, EAST/WEST/NORTH/SOUTH, INT,
 * INTERNACIONAL, NO ("Number" abbreviation), NUMBER, APARTADO/CALLE (Spanish
 * "P.O. Box"/"Street" -- legacy classified these ALL rather than ADDRESS, so
 * they were historically stripped from name matching too; kept here rather
 * than in ADDRESS_TERMS to preserve that documented legacy scope).
 */
export const WEAK_BUSINESS_TERMS: readonly string[] = [
  "THE",
  "AND",
  "OF",
  "FOR",
  "GROUP",
  "HOLDINGS",
  "HOLDING",
  "INTERNATIONAL",
  "INTL",
  "INT",
  "INTERNACIONAL",
  "TRADING",
  "ENTERPRISES",
  "ENTERPRISE",
  "IMPORT",
  "IMPORTS",
  "EXPORT",
  "EXPORTS",
  "AERO",
  "AIRLINES",
  "CENTER",
  "CENTRE",
  "EAST",
  "WEST",
  "NORTH",
  "SOUTH",
  "NO",
  "NUMBER",
  "APARTADO",
  "CALLE",
];

/**
 * Name particles (articles/prepositions from non-English legal names, e.g.
 * "Compania DEL Pacifico", "Grupo DE Ahorro") -- surface >1 char so they
 * survive tokenize()'s length filter but carry no distinguishing signal on
 * their own. Kept as a separate export (vs. folded into WEAK_BUSINESS_TERMS)
 * per the legacy data's own distinct classification, though today they're
 * stripped identically via COMMON_WORDS/stripCommonWords. Legacy single-letter
 * NAME-subtype words (K, M, T) need no equivalent here: tokenize() already
 * drops every length-1 token structurally, so that legacy rule is already
 * satisfied as an incidental side effect, not a deliberate match.
 */
export const NAME_PARTICLES: readonly string[] = ["DEL", "AL", "DE"];

/** Union of LEGAL_FORM_WORDS, WEAK_BUSINESS_TERMS, and NAME_PARTICLES -- kept for backward-compat callers and so stripCommonWords' behavior covers all three categories. */
export const COMMON_WORDS: readonly string[] = [...LEGAL_FORM_WORDS, ...WEAK_BUSINESS_TERMS, ...NAME_PARTICLES];

/**
 * Legacy Oracle `COMMON_WORDS` CW_SUB_TYPE="ADDRESS" terms (E, N, ST, W, C, O,
 * P, BOX, STREET, ROAD). Deliberately NOT merged into COMMON_WORDS/
 * stripCommonWords -- address vocabulary must stay independent from
 * organization-name normalization (a real street "ST" or directional "N"
 * carries no equivalent meaning in a party name). No address-normalization
 * pipeline exists yet; scoring.ts's address gate still scores raw
 * (un-stripped) address strings via scoreDpsMatch. Exported here, ready to
 * back an opt-in normalizeAddressForMatching() when that gate is revisited --
 * wiring it into the live path is a scoring-behavior change that needs its
 * own regression pass, not done here.
 */
export const ADDRESS_TERMS: readonly string[] = ["E", "N", "ST", "W", "C", "O", "P", "BOX", "STREET", "ROAD"];

const ADDRESS_TERMS_SET = new Set(ADDRESS_TERMS);

const COMMON_WORDS_SET = new Set(COMMON_WORDS);
const LEGAL_FORM_WORDS_SET = new Set(LEGAL_FORM_WORDS);

/** Uppercase, trim, collapse whitespace, strip punctuation. Used for both exact-match comparison and as the input to tokenization. */
export function normalizeName(raw: string): string {
  return raw
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits a normalized name into words, dropping single-character tokens (initials carry no matching signal alone). */
export function tokenize(normalized: string): string[] {
  return normalized.split(" ").filter((w) => w.length > 1);
}

/** Tokenizes and strips COMMON_WORDS noise, then rejoins -- the form scoring/candidate-generation actually compares. */
export function stripCommonWords(normalized: string): string {
  return tokenize(normalized)
    .filter((w) => !COMMON_WORDS_SET.has(w))
    .join(" ");
}

export interface NormalizeForMatchingOptions {
  /** When "INDIVIDUAL", skips legal-form/weak-business-term stripping -- person names shouldn't have organization suffixes stripped. Any other value (or omitted) preserves today's default behavior. Not yet wired into scoring.ts/candidateGeneration.ts -- see restrictedParty/normalize.ts callers. */
  entityType?: string;
}

/** Full normalization pipeline: normalize -> strip common words. Falls back to the merely-normalized form if stripping empties it out (e.g. a name that is entirely a legal suffix). */
export function normalizeForMatching(raw: string, options?: NormalizeForMatchingOptions): string {
  const normalized = normalizeName(raw);
  if (options?.entityType === "INDIVIDUAL") {
    return normalized;
  }
  const stripped = stripCommonWords(normalized);
  return stripped.length > 0 ? stripped : normalized;
}

/** Abbreviation <-> spelled-out pairs that name the SAME legal form -- canonicalized to one spelling so e.g. "Acme Trading Co" vs "Acme Trading Company" isn't mistaken for a legal-form mismatch by extractLegalFormWords. Distinct real legal forms (COMPANY vs CORPORATION, GMBH vs AG) are intentionally left uncanonicalized. */
const LEGAL_FORM_SYNONYMS: Readonly<Record<string, string>> = {
  CO: "COMPANY",
  CORP: "CORPORATION",
  INC: "INCORPORATED",
  LTD: "LIMITED",
};

/**
 * The subset of `raw`'s tokens that are true legal-entity-form suffixes
 * (LEGAL_FORM_WORDS), canonicalized via LEGAL_FORM_SYNONYMS -- used to detect
 * when two names that normalize identically (because both suffixes get
 * stripped as noise) are actually naming two legally distinct entities, e.g.
 * "Acme GmbH" vs "Acme AG". Deliberately excludes WEAK_BUSINESS_TERMS: a
 * differing weak connector ("Trading" vs "Holdings") isn't evidence of a
 * different legal entity the way a differing registration form is.
 */
export function extractLegalFormWords(raw: string): Set<string> {
  const words = tokenize(normalizeName(raw)).filter((w) => LEGAL_FORM_WORDS_SET.has(w));
  return new Set(words.map((w) => LEGAL_FORM_SYNONYMS[w] ?? w));
}

/**
 * Address-specific normalization: strips ADDRESS_TERMS noise (directionals,
 * "STREET"/"ROAD"/"BOX", single-letter connectors) instead of
 * LEGAL_FORM_WORDS/WEAK_BUSINESS_TERMS/NAME_PARTICLES -- kept independent per
 * the legacy schema's own ADDRESS/ALL subtype split (organization-name noise
 * and address noise are not the same vocabulary). Opt-in and NOT called from
 * scoring.ts's address gate yet -- that gate currently scores raw address
 * strings via scoreDpsMatch directly, and wiring this in would be a live
 * scoring-behavior change needing its own regression pass.
 */
export function normalizeAddressForMatching(raw: string): string {
  const normalized = normalizeName(raw);
  const stripped = tokenize(normalized)
    .filter((w) => !ADDRESS_TERMS_SET.has(w))
    .join(" ");
  return stripped.length > 0 ? stripped : normalized;
}
