// Restricted / Denied-Party Screening -- reverse impact analysis (RDPS).
//
// Forward RPS asks "does this Party's name match anything on the reference
// list?" RDPS asks the opposite question: "given a reference-data entity
// that just changed, which existing Parties might now match it?" This module
// answers that question using the SAME normalization/token/phonetic
// primitives candidateGeneration.ts already uses for forward shortlisting --
// it never reimplements matching, and it never uses country to narrow
// candidates (looser than the forward matcher's own gate). Over-selecting is
// the deliberate design: an extra wasted rescreen is acceptable, a missed
// one is not -- see rdpsRecallValidator.ts for the safety net that checks
// this module never under-selects relative to the forward matcher.
import { db } from "@/lib/db";
import { candidateNames, type CandidateReason } from "./candidateGeneration";
import { normalizeForMatching, tokenize } from "./normalize";
import { doubleMetaphone } from "./phoneticMatch";
import { metaphone2 } from "./metaphone2";
import type { ScreeningEntityWithAddresses } from "./restrictedPartyRepository";

/** RAW_WORD token floor -- matches candidateGeneration.ts's documented `> 2` floor exactly, so the reverse index shortlists no more loosely than the forward matcher does on token length. */
const RAW_WORD_TOKEN_FLOOR = 2;

export interface PartyIdentityIndexEntry {
  partyId: string;
  accountId: string;
  normalizedName: string;
  tokens: Set<string>;
  doubleMetaphonePrimary: string;
  doubleMetaphoneSecondary: string;
  metaphone2Code: string;
}

export type PartyIdentityIndex = PartyIdentityIndexEntry[];

/**
 * Builds an in-memory reverse index over every active Party's current
 * primary-then-most-recent name -- the same selection loadCurrentIdentity
 * uses for the name fact, batched across the whole population instead of
 * one Party at a time. Deliberately built fresh on every call, never
 * persisted/cached across dispatcher ticks: a stale index is a silent-recall
 * risk (a Party renamed since the index was built could be missed).
 */
export async function buildPartyIdentityIndex(): Promise<PartyIdentityIndex> {
  const parties = await db.party.findMany({
    where: { deletedAt: null },
    select: { id: true, accountId: true },
  });
  if (parties.length === 0) return [];

  const accountByPartyId = new Map(parties.map((p) => [p.id, p.accountId]));
  const partyIds = parties.map((p) => p.id);

  // Globally sorted by isPrimary desc, updatedAt desc: every party's primary
  // row (if any) sorts ahead of every party's non-primary rows, so taking the
  // first row seen per partyId below reproduces the same primary-then-
  // most-recent pick loadCurrentIdentity makes per-party.
  const names = await db.partyName.findMany({
    where: { partyId: { in: partyIds }, status: "ACTIVE" },
    orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    select: { partyId: true, rawName: true },
  });

  const chosenNameByPartyId = new Map<string, string>();
  for (const n of names) {
    if (!chosenNameByPartyId.has(n.partyId)) chosenNameByPartyId.set(n.partyId, n.rawName);
  }

  const index: PartyIdentityIndexEntry[] = [];
  for (const [partyId, rawName] of chosenNameByPartyId) {
    const accountId = accountByPartyId.get(partyId);
    if (!accountId || !rawName?.trim()) continue;

    const normalizedName = normalizeForMatching(rawName);
    const tokens = new Set(tokenize(normalizedName).filter((t) => t.length > RAW_WORD_TOKEN_FLOOR));
    const [doubleMetaphonePrimary, doubleMetaphoneSecondary] = doubleMetaphone(normalizedName);
    const metaphone2Code = metaphone2(normalizedName);

    index.push({ partyId, accountId, normalizedName, tokens, doubleMetaphonePrimary, doubleMetaphoneSecondary, metaphone2Code });
  }
  return index;
}

export interface EntityImpactMatch {
  partyId: string;
  accountId: string;
  reasons: CandidateReason[];
}

function dmCodesOverlap(aPrimary: string, aSecondary: string, bPrimary: string, bSecondary: string): boolean {
  if (!aPrimary && !aSecondary) return false;
  return aPrimary === bPrimary || aPrimary === bSecondary || (aSecondary !== "" && (aSecondary === bPrimary || aSecondary === bSecondary));
}

/**
 * Which indexed Parties this changed reference entity impacts, and why.
 * Checks EXACT normalized match, RAW_WORD token overlap, and BOTH
 * DOUBLE_METAPHONE and METAPHONE2 -- RDPS doesn't know each account's
 * configured phoneticAlgorithm at candidate-selection time, so it must check
 * both to stay recall-safe. Never returns duplicates per party; a party
 * matched by more than one of the entity's names/aliases accumulates every
 * distinct reason it was found by.
 */
export function findImpactedParties(entity: ScreeningEntityWithAddresses, index: PartyIdentityIndex): EntityImpactMatch[] {
  const matches = new Map<string, { accountId: string; reasons: Set<CandidateReason> }>();
  const addReason = (partyEntry: PartyIdentityIndexEntry, reason: CandidateReason) => {
    const existing = matches.get(partyEntry.partyId);
    if (existing) existing.reasons.add(reason);
    else matches.set(partyEntry.partyId, { accountId: partyEntry.accountId, reasons: new Set([reason]) });
  };

  for (const rawName of candidateNames(entity)) {
    if (!rawName?.trim()) continue;

    const entityNormalized = normalizeForMatching(rawName);
    if (!entityNormalized) continue;

    const entityTokens = tokenize(entityNormalized).filter((t) => t.length > RAW_WORD_TOKEN_FLOOR);
    const [entityDmPrimary, entityDmSecondary] = doubleMetaphone(entityNormalized);
    const entityM2 = metaphone2(entityNormalized);

    for (const partyEntry of index) {
      if (entityNormalized === partyEntry.normalizedName) {
        addReason(partyEntry, "EXACT");
      }

      if (entityTokens.some((t) => partyEntry.tokens.has(t))) {
        addReason(partyEntry, "RAW_WORD");
      }

      if (dmCodesOverlap(entityDmPrimary, entityDmSecondary, partyEntry.doubleMetaphonePrimary, partyEntry.doubleMetaphoneSecondary)) {
        addReason(partyEntry, "DOUBLE_METAPHONE");
      }

      if (entityM2 && entityM2 === partyEntry.metaphone2Code) {
        addReason(partyEntry, "METAPHONE2");
      }
    }
  }

  return Array.from(matches.entries()).map(([partyId, { accountId, reasons }]) => ({
    partyId,
    accountId,
    reasons: Array.from(reasons),
  }));
}
