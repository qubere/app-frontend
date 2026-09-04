import { describe, it, expect } from "vitest";
import { generateCandidates } from "@/modules/agents/compliance/restrictedParty/candidateGeneration";
import { buildSearchTokenRows, type SearchTokenRow } from "@/modules/agents/compliance/restrictedParty/searchTokenGeneration";
import { computeIndexLookupKeys } from "@/modules/agents/compliance/restrictedParty/candidateIndexService";
import type { ScreeningEntityWithAddresses } from "@/modules/agents/compliance/restrictedParty/restrictedPartyRepository";

// Restricted / Denied-Party Screening -- the core recall-regression guard
// (spec: candidate generation must never under-select a positive the
// existing detailed matcher would have found). For each fixture, this test
// builds ScreeningSearchToken rows exactly the way ingestion would
// (buildSearchTokenRows), then reproduces the indexed groupBy-by-equality
// lookup in memory using the same key-derivation function the real query
// uses (computeIndexLookupKeys), and asserts the resulting candidate id set
// is always a superset of what generateCandidates() itself would shortlist
// against the full reference list. Over-selection is fine; under-selection
// here would mean CANDIDATE_PRIMARY mode is unsafe to enable.

function entity(id: string, name: string, alternateNames: string[] = [], aliasNames: string[] = []): ScreeningEntityWithAddresses {
  return {
    id,
    name,
    alternateNames,
    addresses: [],
    aliases: aliasNames.map((n, i) => ({ id: `${id}-alias-${i}`, screeningEntityId: id, name: n })),
  } as unknown as ScreeningEntityWithAddresses;
}

const REFERENCE_LIST: ScreeningEntityWithAddresses[] = [
  entity("e1", "Acme Trading Company", ["Acme Trading Co"], ["Acme Co"]),
  entity("e2", "Vladimir Petrov"),
  entity("e3", "Katherine Smyth", [], ["Catherine Smith"]),
  entity("e4", "Global Logistics Holdings"),
  entity("e5", "Nordvik Shipping Ltd"),
  entity("e6", "Unrelated Widgets Inc"),
];

/** In-memory equivalent of selectCandidateEntityIdsFromIndex's DB query, built from the same ScreeningSearchToken rows ingestion would produce and the same key-derivation as query time. */
function indexedCandidateIds(targetRawName: string, allRows: SearchTokenRow[]): Set<string> {
  const keys = computeIndexLookupKeys(targetRawName);
  const normalizedSet = new Set(keys.normalizedKeys);
  const dmSet = new Set(keys.doubleMetaphoneKeys);

  const ids = new Set<string>();
  for (const row of allRows) {
    const hit =
      normalizedSet.has(row.normalizedToken) ||
      (keys.metaphoneKey && row.metaphone === keys.metaphoneKey) ||
      (row.doubleMetaphonePrimary && dmSet.has(row.doubleMetaphonePrimary)) ||
      (row.doubleMetaphoneAlternate && dmSet.has(row.doubleMetaphoneAlternate));
    if (hit) ids.add(row.screeningEntityId);
  }
  return ids;
}

const ALL_ROWS: SearchTokenRow[] = REFERENCE_LIST.flatMap((e) =>
  buildSearchTokenRows({
    id: e.id,
    name: e.name,
    alternateNames: e.alternateNames,
    aliases: e.aliases.map((a) => ({ name: a.name })),
  })
);

const FIXTURES: { label: string; screenedName: string }[] = [
  { label: "exact match on primary name", screenedName: "Acme Trading Company" },
  { label: "exact match on alternate name", screenedName: "Acme Trading Co" },
  { label: "exact match on alias", screenedName: "Acme Co" },
  { label: "spelling variation matching an alias (Katherine/Catherine Smyth/Smith)", screenedName: "Catherine Smith" },
  { label: "phonetic variation of a multi-word person name", screenedName: "Vladimir Petroff" },
  { label: "common single shared token across an org name", screenedName: "Global Shipping" },
  { label: "multi-word org name with partial overlap", screenedName: "Nordvik Shipping" },
  { label: "no match at all", screenedName: "Totally Fictitious Nonexistent Party" },
];

describe("indexed candidate recall parity with generateCandidates", () => {
  for (const fixture of FIXTURES) {
    it(`is a superset of generateCandidates() candidates: ${fixture.label}`, () => {
      const legacy = generateCandidates(fixture.screenedName, REFERENCE_LIST, {
        nameThreshold: 70,
        alternateScreeningEnabled: true,
      });
      const legacyIds = new Set(legacy.candidates.map((c) => c.entity.id));

      const indexedIds = indexedCandidateIds(fixture.screenedName, ALL_ROWS);

      for (const id of legacyIds) {
        expect(indexedIds.has(id)).toBe(true);
      }
    });
  }

  it("never under-selects across the full fixture battery combined", () => {
    for (const fixture of FIXTURES) {
      const legacy = generateCandidates(fixture.screenedName, REFERENCE_LIST, {
        nameThreshold: 70,
        alternateScreeningEnabled: true,
      });
      const indexedIds = indexedCandidateIds(fixture.screenedName, ALL_ROWS);
      const missed = legacy.candidates.filter((c) => !indexedIds.has(c.entity.id));
      expect(missed).toEqual([]);
    }
  });
});
