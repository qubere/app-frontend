import { describe, it, expect, vi, beforeEach } from "vitest";

// Restricted / Denied-Party Screening: candidateIndexService.ts's
// selectCandidateEntityIdsFromIndex. Mocks @/lib/db entirely (same pattern
// as restricted-party-repository-reference-list.test.ts) -- these tests
// never touch a real database.

const screeningSearchTokenGroupBy = vi.fn();
const screeningEntityCount = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    screeningSearchToken: { groupBy: screeningSearchTokenGroupBy },
    screeningEntity: { count: screeningEntityCount },
  },
}));

const {
  selectCandidateEntityIdsFromIndex,
  computeIndexLookupKeys,
  MAX_CANDIDATE_ENTITY_IDS,
  isIndexCoverageAcceptable,
  __resetIndexCoverageCacheForTests,
} = await import("@/modules/agents/compliance/restrictedParty/candidateIndexService");

beforeEach(() => {
  vi.clearAllMocks();
  __resetIndexCoverageCacheForTests();
});

describe("computeIndexLookupKeys", () => {
  it("derives the full normalized name plus per-token keys, and phonetic keys", () => {
    // "Company" is a LEGAL_FORM_WORD stripped by normalizeForMatching, so the
    // whole-name key is "ACME WIDGETS", not the raw uppercased string -- this
    // must mirror candidateGeneration.ts's own normalizeForMatching() output
    // exactly for recall parity.
    const keys = computeIndexLookupKeys("Acme Widgets Company");
    expect(keys.normalizedKeys).toContain("ACME WIDGETS");
    expect(keys.normalizedKeys).toContain("ACME");
    expect(keys.normalizedKeys).toContain("WIDGETS");
    expect(keys.metaphoneKey).toBeTruthy();
    expect(keys.doubleMetaphoneKeys.length).toBeGreaterThan(0);
  });

  it("returns empty keys for a blank name", () => {
    const keys = computeIndexLookupKeys("   ");
    expect(keys.normalizedKeys).toEqual([]);
    expect(keys.metaphoneKey).toBeNull();
    expect(keys.doubleMetaphoneKeys).toEqual([]);
  });
});

describe("selectCandidateEntityIdsFromIndex", () => {
  it("queries screeningSearchToken.groupBy with an OR across normalized/metaphone/double-metaphone keys, each scoped to NAME/ALIAS", async () => {
    screeningSearchTokenGroupBy.mockResolvedValue([{ screeningEntityId: "e1", _count: { _all: 3 }, _sum: { tokenWeight: 2.25 } }]);

    const result = await selectCandidateEntityIdsFromIndex("Acme Trading Co");

    expect(screeningSearchTokenGroupBy).toHaveBeenCalledTimes(1);
    const call = screeningSearchTokenGroupBy.mock.calls[0][0];
    expect(call.by).toEqual(["screeningEntityId"]);
    expect(Array.isArray(call.where.OR)).toBe(true);
    expect(call.where.OR.length).toBeGreaterThan(0);
    expect(call.where.OR.every((clause: any) => clause.fieldType?.in ? clause.fieldType.in.includes("NAME") && clause.fieldType.in.includes("ALIAS") : clause.fieldType === "ADDRESS")).toBe(true);
    expect(call._sum).toEqual({ tokenWeight: true });

    expect(result.candidateEntityIds).toEqual(new Set(["e1"]));
    expect(result.diagnostics.truncated).toBe(false);
    expect(result.diagnostics.topCandidateScore).toBe(2.25);
  });

  it("additively ORs in an ADDRESS-typed branch when a target address is supplied, without narrowing the NAME/ALIAS branches", async () => {
    screeningSearchTokenGroupBy.mockResolvedValue([{ screeningEntityId: "e1", _count: { _all: 1 }, _sum: { tokenWeight: 0.15 } }]);

    await selectCandidateEntityIdsFromIndex("Acme Trading Co", "123 Main Street, Springfield");

    const call = screeningSearchTokenGroupBy.mock.calls[0][0];
    const addressClause = call.where.OR.find((clause: any) => clause.fieldType === "ADDRESS");
    expect(addressClause).toBeDefined();
    expect(addressClause.normalizedToken.in).toContain("MAIN");
    expect(addressClause.normalizedToken.in).toContain("SPRINGFIELD");
    // STREET is address noise, stripped by normalizeAddressForMatching.
    expect(addressClause.normalizedToken.in).not.toContain("STREET");
  });

  it("omits the ADDRESS branch entirely when no target address is supplied", async () => {
    screeningSearchTokenGroupBy.mockResolvedValue([]);

    await selectCandidateEntityIdsFromIndex("Acme Trading Co");

    const call = screeningSearchTokenGroupBy.mock.calls[0][0];
    expect(call.where.OR.some((clause: any) => clause.fieldType === "ADDRESS")).toBe(false);
  });

  it("prunes an oversized result by summed tokenWeight (candidateScore), not raw hit-count", async () => {
    screeningSearchTokenGroupBy.mockResolvedValue([
      { screeningEntityId: "low-count-high-weight", _count: { _all: 1 }, _sum: { tokenWeight: 10 } },
      { screeningEntityId: "high-count-low-weight", _count: { _all: 50 }, _sum: { tokenWeight: 0.05 } },
    ]);

    const result = await selectCandidateEntityIdsFromIndex("Acme Trading Co");

    expect(result.candidateEntityIds).toEqual(new Set(["low-count-high-weight", "high-count-low-weight"]));
    expect(result.diagnostics.topCandidateScore).toBe(10);
  });

  it("treats a missing _sum (e.g. a query returning no matched rows for that group) as a zero candidateScore rather than throwing", async () => {
    screeningSearchTokenGroupBy.mockResolvedValue([{ screeningEntityId: "e1", _count: { _all: 1 }, _sum: {} }]);

    const result = await selectCandidateEntityIdsFromIndex("Acme Trading Co");

    expect(result.candidateEntityIds).toEqual(new Set(["e1"]));
    expect(result.diagnostics.topCandidateScore).toBe(0);
  });

  it("falls back safely when screeningSearchToken.groupBy rejects", async () => {
    screeningSearchTokenGroupBy.mockRejectedValueOnce(new Error("db unavailable"));

    await expect(selectCandidateEntityIdsFromIndex("Acme Trading Co")).rejects.toThrow("db unavailable");
  });

  it("short-circuits without querying the DB when the target name normalizes to empty", async () => {
    const result = await selectCandidateEntityIdsFromIndex("   ");
    expect(screeningSearchTokenGroupBy).not.toHaveBeenCalled();
    expect(result.candidateEntityIds.size).toBe(0);
  });

  it("prunes an oversized result to the highest-candidateScore entities, never to empty", async () => {
    const grouped = Array.from({ length: MAX_CANDIDATE_ENTITY_IDS + 10 }, (_, i) => ({
      screeningEntityId: `e${i}`,
      _count: { _all: i },
      _sum: { tokenWeight: i },
    }));
    screeningSearchTokenGroupBy.mockResolvedValue(grouped);

    const result = await selectCandidateEntityIdsFromIndex("Acme Trading Co");

    expect(result.diagnostics.truncated).toBe(true);
    expect(result.candidateEntityIds.size).toBe(MAX_CANDIDATE_ENTITY_IDS);
    // Highest candidateScore (summed tokenWeight) rows are kept -- the
    // last-generated (highest-weight) id must survive.
    expect(result.candidateEntityIds.has(`e${grouped.length - 1}`)).toBe(true);
    expect(result.diagnostics.topCandidateScore).toBe(grouped.length - 1);
  });
});

describe("isIndexCoverageAcceptable", () => {
  it("is acceptable when there are no PUBLISHED entities at all", async () => {
    screeningEntityCount.mockResolvedValueOnce(0);
    expect(await isIndexCoverageAcceptable()).toBe(true);
    expect(screeningEntityCount).toHaveBeenCalledTimes(1);
  });

  it("is acceptable exactly at the 1% material-gap threshold, unacceptable just over it", async () => {
    // 99/100 indexed -> exactly 1% gap -- at the threshold, still acceptable.
    screeningEntityCount.mockResolvedValueOnce(100).mockResolvedValueOnce(99);
    expect(await isIndexCoverageAcceptable()).toBe(true);

    __resetIndexCoverageCacheForTests();
    // 98/100 indexed -> 2% gap -- over the threshold, unacceptable.
    screeningEntityCount.mockResolvedValueOnce(100).mockResolvedValueOnce(98);
    expect(await isIndexCoverageAcceptable()).toBe(false);
  });

  it("caches the verdict and does not re-query until the TTL elapses", async () => {
    screeningEntityCount.mockResolvedValueOnce(100).mockResolvedValueOnce(100);
    expect(await isIndexCoverageAcceptable()).toBe(true);
    expect(screeningEntityCount).toHaveBeenCalledTimes(2);

    // Second call within the TTL window reuses the cached verdict.
    expect(await isIndexCoverageAcceptable()).toBe(true);
    expect(screeningEntityCount).toHaveBeenCalledTimes(2);
  });

  it("falls back to the last known-good verdict (defaulting to acceptable) when the count query rejects", async () => {
    screeningEntityCount.mockRejectedValueOnce(new Error("db unavailable"));
    // No prior cached verdict -- defaults to acceptable rather than blocking screening.
    expect(await isIndexCoverageAcceptable()).toBe(true);
  });

  it("serves the last known-good verdict on failure once the TTL has elapsed and a re-check fails", async () => {
    vi.useFakeTimers();
    try {
      screeningEntityCount.mockResolvedValueOnce(100).mockResolvedValueOnce(50);
      expect(await isIndexCoverageAcceptable()).toBe(false);

      // Advance past the 5-minute TTL so the next call re-queries instead of
      // reusing the cached verdict -- that re-query then fails, and the
      // last known verdict (false) must survive rather than defaulting to true.
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      screeningEntityCount.mockRejectedValueOnce(new Error("db unavailable"));
      expect(await isIndexCoverageAcceptable()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
