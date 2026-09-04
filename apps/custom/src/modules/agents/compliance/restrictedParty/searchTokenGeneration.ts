// Restricted / Denied-Party Screening -- indexed search-token generation.
//
// Pure functions -- no DB. Produces the ScreeningSearchToken rows an entity
// should have, from the SAME normalize/tokenize/phonetic functions
// candidateGeneration.ts already trusts at query time -- ingestion-time and
// query-time representations must never drift apart.
//
// Two row shapes per candidate name (see candidateNames()):
//   - one "whole-name" row: normalizedToken = the full normalized name,
//     metaphone/doubleMetaphone* computed over that whole string. Mirrors
//     candidateGeneration.ts's EXACT phase and its whole-string
//     DOUBLE_METAPHONE/METAPHONE2 checks exactly.
//   - one "per-token" row per meaningful word: normalizedToken = the single
//     word. Mirrors the RAW_WORD/ALTERNATE_WHOLE_WORD checks, which already
//     operate on the same tokenized vocabulary.
// Over-matching between the two shapes at query time is harmless -- this
// table only narrows the corpus before the existing matcher re-derives its
// own candidate reasons, it never decides a match on its own.
//
// tokenWeight (see tokenWeightFor below): the whole-name row and an ordinary
// per-token row both get weight 1; a legal-form word (CO/INC/LTD/...) or a
// weak business connector (TRADING/GROUP/HOLDINGS/...) gets a low weight
// instead of being omitted, so candidateIndexService.ts's candidateScore can
// down-rank (not discard) a candidate that only matches on that kind of
// word.
//
// A third, ADDRESS-typed row shape (built from ScreeningEntityAddress rows,
// or the flat address/city/country columns when there are none) indexes
// meaningful address words at a low tokenWeight -- purely additive supporting
// evidence for candidateIndexService.ts's lookup, never a signal that can
// narrow the NAME/ALIAS-based candidate set.
import { candidateNames } from "./candidateGeneration";
import {
  normalizeForMatching,
  normalizeName,
  normalizeAddressForMatching,
  tokenize,
  LEGAL_FORM_WORDS,
  WEAK_BUSINESS_TERMS,
} from "./normalize";
import { doubleMetaphone } from "./phoneticMatch";
import { metaphone2 } from "./metaphone2";

const LEGAL_FORM_WORDS_SET = new Set(LEGAL_FORM_WORDS);
const WEAK_BUSINESS_TERMS_SET = new Set(WEAK_BUSINESS_TERMS);

/** Whole-name row weight: always the strongest signal (EXACT/whole-string phonetic parity). */
const WHOLE_NAME_TOKEN_WEIGHT = 1;
/** Per-token weight for a legal-entity-form word (CO/INC/LTD/...) -- present in nearly every entity's name, almost no distinguishing signal on its own. */
const LEGAL_FORM_TOKEN_WEIGHT = 0.05;
/** Per-token weight for a weak/non-distinctive business connector (TRADING/GROUP/HOLDINGS/...) -- more distinguishing than a legal form, but still weak relative to a genuinely unique word. */
const WEAK_BUSINESS_TOKEN_WEIGHT = 0.25;
/** Per-token weight for an ordinary, meaningful word. */
const DEFAULT_TOKEN_WEIGHT = 1;
/** Weight for every ADDRESS-typed token -- always supporting evidence, never a primary signal, so it can only ever add to (never dominate) a candidateScore. */
const ADDRESS_TOKEN_WEIGHT = 0.15;

/** Per §9's weighting scheme: legal-form/weak-business connector words are down-weighted (not stripped -- stripCommonWords already removes them from the matcher's own comparison string) so they contribute less to candidateScore-based pruning without losing recall. */
function tokenWeightFor(token: string): number {
  if (LEGAL_FORM_WORDS_SET.has(token)) return LEGAL_FORM_TOKEN_WEIGHT;
  if (WEAK_BUSINESS_TERMS_SET.has(token)) return WEAK_BUSINESS_TOKEN_WEIGHT;
  return DEFAULT_TOKEN_WEIGHT;
}

export interface SearchTokenAddressInput {
  addressLine?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  countryName?: string | null;
}

export interface SearchTokenInput {
  id: string;
  name: string;
  alternateNames: string[];
  aliases: { name: string }[];
  /** Flat address fields (back-compat -- see ScreeningEntity.address/city/country). Only used when `addresses` is empty/omitted. */
  address?: string | null;
  city?: string | null;
  country?: string | null;
  /** ScreeningEntityAddress child rows, when the source provides more than one address. Takes precedence over the flat address/city/country fields. */
  addresses?: SearchTokenAddressInput[];
}

export type SearchTokenFieldType = "NAME" | "ALIAS" | "ADDRESS";

export interface SearchTokenRow {
  screeningEntityId: string;
  fieldType: SearchTokenFieldType;
  originalToken: string;
  normalizedToken: string;
  metaphone: string | null;
  doubleMetaphonePrimary: string | null;
  doubleMetaphoneAlternate: string | null;
  tokenWeight: number;
}

/** Builds every ScreeningSearchToken row for one entity. Never returns duplicate (normalizedToken, fieldType, originalToken) triples for the same entity -- candidateNames() already dedupes name strings case-insensitively. */
export function buildSearchTokenRows(entity: SearchTokenInput): SearchTokenRow[] {
  const names = candidateNames(entity);
  const rows: SearchTokenRow[] = [];

  names.forEach((rawName, index) => {
    // candidateNames() puts entity.name first -- everything after it is an
    // alternateName/alias. That ordering is the only signal available here
    // for NAME vs ALIAS, and it matches candidateGeneration.ts's own
    // treatment of entity.name as the primary name.
    const fieldType: SearchTokenFieldType = index === 0 ? "NAME" : "ALIAS";

    const normalizedFull = normalizeForMatching(rawName);
    if (!normalizedFull) return;

    const [wholeDmPrimary, wholeDmAlternate] = doubleMetaphone(normalizedFull);
    rows.push({
      screeningEntityId: entity.id,
      fieldType,
      originalToken: rawName,
      normalizedToken: normalizedFull,
      metaphone: metaphone2(normalizedFull) || null,
      doubleMetaphonePrimary: wholeDmPrimary || null,
      doubleMetaphoneAlternate: wholeDmAlternate || null,
      tokenWeight: WHOLE_NAME_TOKEN_WEIGHT,
    });

    // Tokenize the RAW (pre-strip) normalized name, not normalizedFull --
    // stripCommonWords already removes legal-form/weak-business words from
    // the matcher's own comparison string, so those words never survive into
    // normalizedFull's tokens. Indexing them anyway (at a low tokenWeight)
    // is strictly additive versus the previously-emitted stripped-token set,
    // so it can only widen recall, never narrow it -- and it's what makes
    // candidateScore-based pruning (candidateIndexService.ts) meaningful:
    // without this, a legal-form/weak-business word could never contribute
    // any weight at all, binary-stripped exactly like the matcher's own
    // comparison string.
    for (const token of tokenize(normalizeName(rawName))) {
      const [tokenDmPrimary, tokenDmAlternate] = doubleMetaphone(token);
      rows.push({
        screeningEntityId: entity.id,
        fieldType,
        originalToken: rawName,
        normalizedToken: token,
        metaphone: metaphone2(token) || null,
        doubleMetaphonePrimary: tokenDmPrimary || null,
        doubleMetaphoneAlternate: tokenDmAlternate || null,
        tokenWeight: tokenWeightFor(token),
      });
    }
  });

  const addressSources: SearchTokenAddressInput[] =
    entity.addresses && entity.addresses.length > 0
      ? entity.addresses
      : entity.address || entity.city || entity.country
        ? [{ addressLine: entity.address, city: entity.city, countryName: entity.country }]
        : [];

  const seenAddressTokens = new Set<string>();
  for (const addr of addressSources) {
    const combined = [addr.addressLine, addr.city, addr.stateOrProvince, addr.countryName].filter(Boolean).join(" ");
    if (!combined.trim()) continue;

    const normalizedAddress = normalizeAddressForMatching(combined);
    for (const token of tokenize(normalizedAddress)) {
      const dedupeKey = `${token}`;
      if (seenAddressTokens.has(dedupeKey)) continue;
      seenAddressTokens.add(dedupeKey);

      const [tokenDmPrimary, tokenDmAlternate] = doubleMetaphone(token);
      rows.push({
        screeningEntityId: entity.id,
        fieldType: "ADDRESS",
        originalToken: combined,
        normalizedToken: token,
        metaphone: metaphone2(token) || null,
        doubleMetaphonePrimary: tokenDmPrimary || null,
        doubleMetaphoneAlternate: tokenDmAlternate || null,
        tokenWeight: ADDRESS_TOKEN_WEIGHT,
      });
    }
  }

  return rows;
}
