// Restricted / Denied-Party Screening -- indexed candidate retrieval.
//
// Narrows the corpus of ScreeningEntity ids worth scanning for a screened
// name, using the precomputed ScreeningSearchToken table (see
// searchTokenGeneration.ts) instead of a full linear scan. This is purely a
// recall-safe narrowing filter: the returned id set is handed to
// candidateGeneration.ts's existing generateCandidates(), which still does
// its own exact/raw-word/phonetic/alternate-word pass and decides the actual
// CandidateReason -- nothing about scoring or audit evidence changes here.
//
// computeIndexLookupKeys is pure and reuses the exact same normalize/
// tokenize/phonetic calls searchTokenGeneration.ts uses at ingestion time --
// that parity is what guarantees this index is at least as inclusive as
// candidateGeneration.ts's own scan (recall parity, never under-selection).
import { db } from "@/lib/db";
import { normalizeForMatching, normalizeAddressForMatching, tokenize } from "./normalize";
import { doubleMetaphone } from "./phoneticMatch";
import { metaphone2 } from "./metaphone2";

export interface IndexLookupKeys {
  /** Full normalized name plus every meaningful token -- matches normalizedToken on both whole-name and per-token ScreeningSearchToken rows. */
  normalizedKeys: string[];
  metaphoneKey: string | null;
  doubleMetaphoneKeys: string[];
  /** Meaningful address words, present only when a target address was supplied -- additive-only signal, ORed in against ADDRESS-typed rows, never narrowing the NAME/ALIAS result. */
  addressKeys: string[];
}

/** Pure -- no DB. Exported for direct use by the recall-regression test, which builds an in-memory equivalent of the indexed query. */
export function computeIndexLookupKeys(targetRawName: string, targetRawAddress?: string | null): IndexLookupKeys {
  const normalizedFull = normalizeForMatching(targetRawName);
  const tokens = tokenize(normalizedFull);
  const normalizedKeys = Array.from(new Set([normalizedFull, ...tokens].filter(Boolean)));

  const metaphoneKey = normalizedFull ? metaphone2(normalizedFull) || null : null;
  const [dmPrimary, dmAlternate] = normalizedFull ? doubleMetaphone(normalizedFull) : ["", ""];
  const doubleMetaphoneKeys = Array.from(new Set([dmPrimary, dmAlternate].filter(Boolean)));

  const addressKeys = targetRawAddress ? Array.from(new Set(tokenize(normalizeAddressForMatching(targetRawAddress)))) : [];

  return { normalizedKeys, metaphoneKey, doubleMetaphoneKeys, addressKeys };
}

/** Hard cap on the candidate set an indexed lookup can hand to the detailed matcher. An oversized result is pruned to the highest-hit-count entities, never discarded to empty -- an abnormally large candidate set must never produce a false CLEAR. */
export const MAX_CANDIDATE_ENTITY_IDS = 5000;

export interface IndexedCandidateDiagnostics {
  inputTokenCount: number;
  candidateEntityCount: number;
  truncated: boolean;
  queryDurationMs: number;
  /** Highest summed tokenWeight (candidateScore) among the returned entities -- diagnostic only, not used to filter the returned set. */
  topCandidateScore: number;
}

export interface IndexedCandidateResult {
  candidateEntityIds: Set<string>;
  diagnostics: IndexedCandidateDiagnostics;
}

/** Indexed equality lookup against ScreeningSearchToken (hits (normalizedToken,fieldType)/(metaphone,fieldType)/(doubleMetaphonePrimary,fieldType)/(doubleMetaphoneAlternate,fieldType), plus an additive ADDRESS-typed branch when targetRawAddress is given). Throws on a DB/query failure -- callers must fall back to a full scan, never to an empty/false-CLEAR result. */
export async function selectCandidateEntityIdsFromIndex(targetRawName: string, targetRawAddress?: string | null): Promise<IndexedCandidateResult> {
  const started = Date.now();
  const keys = computeIndexLookupKeys(targetRawName, targetRawAddress);

  // Each branch embeds its own fieldType so the ADDRESS branch below can be
  // ORed in without loosening the NAME/ALIAS branches -- address hits can
  // only add entity ids to the result, never substitute for a name match.
  const orClauses: Array<Record<string, unknown>> = [];
  if (keys.normalizedKeys.length > 0) {
    orClauses.push({ fieldType: { in: ["NAME", "ALIAS"] }, normalizedToken: { in: keys.normalizedKeys } });
  }
  if (keys.metaphoneKey) {
    orClauses.push({ fieldType: { in: ["NAME", "ALIAS"] }, metaphone: keys.metaphoneKey });
  }
  if (keys.doubleMetaphoneKeys.length > 0) {
    orClauses.push({ fieldType: { in: ["NAME", "ALIAS"] }, doubleMetaphonePrimary: { in: keys.doubleMetaphoneKeys } });
    orClauses.push({ fieldType: { in: ["NAME", "ALIAS"] }, doubleMetaphoneAlternate: { in: keys.doubleMetaphoneKeys } });
  }
  if (keys.addressKeys.length > 0) {
    orClauses.push({ fieldType: "ADDRESS", normalizedToken: { in: keys.addressKeys } });
  }

  if (orClauses.length === 0) {
    return {
      candidateEntityIds: new Set(),
      diagnostics: { inputTokenCount: 0, candidateEntityCount: 0, truncated: false, queryDurationMs: Date.now() - started, topCandidateScore: 0 },
    };
  }

  const grouped = await db.screeningSearchToken.groupBy({
    by: ["screeningEntityId"],
    where: { OR: orClauses },
    _count: { _all: true },
    _sum: { tokenWeight: true },
  });

  // candidateScore = summed tokenWeight of every matched row for that entity
  // -- an entity that only matches on a legal-form/weak-business word (low
  // weight) ranks below one that matches on a meaningful word or the
  // whole-name row (weight 1). Only used to decide which entities survive
  // MAX_CANDIDATE_ENTITY_IDS pruning -- an oversized result is pruned to the
  // highest-scoring entities, never discarded to empty.
  const scored = grouped.map((row) => ({
    screeningEntityId: row.screeningEntityId,
    candidateScore: row._sum?.tokenWeight ?? 0,
  }));

  const truncated = scored.length > MAX_CANDIDATE_ENTITY_IDS;
  const ranked = truncated
    ? [...scored].sort((a, b) => b.candidateScore - a.candidateScore).slice(0, MAX_CANDIDATE_ENTITY_IDS)
    : scored;

  const topCandidateScore = ranked.reduce((max, row) => Math.max(max, row.candidateScore), 0);

  return {
    candidateEntityIds: new Set(ranked.map((row) => row.screeningEntityId)),
    diagnostics: {
      inputTokenCount: keys.normalizedKeys.length,
      candidateEntityCount: ranked.length,
      truncated,
      queryDurationMs: Date.now() - started,
      topCandidateScore,
    },
  };
}

/** Consumption-side readiness gate (spec sections 19/20/22): rather than gating publication at each of the ~12 ingestion services (no centralized publish function exists), the index is only trusted here, right before it's consumed, if coverage of PUBLISHED entities is not materially incomplete. */
const COVERAGE_MATERIAL_GAP_THRESHOLD = 0.01;
/** How long a coverage verdict is trusted before re-checking -- coverage only changes on ingestion/backfill runs (infrequent), so this avoids a DB round-trip on every screening call. */
const COVERAGE_CACHE_TTL_MS = 5 * 60 * 1000;

let coverageCache: { acceptable: boolean; checkedAt: number } | null = null;

/** True when the fraction of PUBLISHED ScreeningEntity rows with no indexed NAME token is at or below COVERAGE_MATERIAL_GAP_THRESHOLD. Cached in-process for COVERAGE_CACHE_TTL_MS. On a lookup failure, serves the last known verdict (defaulting to acceptable) rather than blocking screening -- this is a gate on trusting the index, not a new way for screening itself to fail. */
export async function isIndexCoverageAcceptable(): Promise<boolean> {
  if (coverageCache && Date.now() - coverageCache.checkedAt < COVERAGE_CACHE_TTL_MS) {
    return coverageCache.acceptable;
  }
  try {
    const totalPublished = await db.screeningEntity.count({ where: { publicationStatus: "PUBLISHED" } });
    if (totalPublished === 0) {
      coverageCache = { acceptable: true, checkedAt: Date.now() };
      return true;
    }
    const indexedPublished = await db.screeningEntity.count({
      where: { publicationStatus: "PUBLISHED", searchTokens: { some: { fieldType: "NAME" } } },
    });
    const gapFraction = (totalPublished - indexedPublished) / totalPublished;
    const acceptable = gapFraction <= COVERAGE_MATERIAL_GAP_THRESHOLD;
    coverageCache = { acceptable, checkedAt: Date.now() };
    return acceptable;
  } catch {
    return coverageCache?.acceptable ?? true;
  }
}

/** For tests only -- production invalidation is automatic via COVERAGE_CACHE_TTL_MS. */
export function __resetIndexCoverageCacheForTests(): void {
  coverageCache = null;
}
