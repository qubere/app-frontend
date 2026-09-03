import { describe, it, expect, vi, beforeEach } from "vitest";

// Restricted / Denied-Party Screening: restrictedPartyRepository.ts's
// getRestrictedPartyReferenceList. Covers: the fetch attaches both
// addresses (pre-existing) and aliases (newly wired in) so
// candidateGeneration.ts's alias-aware candidateNames() has data to read --
// a regression here would silently degrade back to name/alternateNames-only
// candidate generation with no test failure elsewhere.
//
// Entities, addresses, and aliases are fetched as three separate queries
// (not a relational `include`) -- a single findMany+include off a ~67k-row
// reference list either exceeds Postgres's 32767-bind-parameter limit or
// forces a join that Cartesian-multiplies each entity's addresses by its
// aliases. See restrictedPartyRepository.ts's getRestrictedPartyReferenceList
// comment for the measured impact.
//
// The full fetch is also cached in-process, revalidated against the
// publishedAt watermark (screeningEntity.findFirst) -- a real screening
// request can't afford to redo the 60-150s fetch every call, only when the
// watchlist has actually been republished.

const screeningEntityFindMany = vi.fn();
const screeningEntityFindFirst = vi.fn();
const screeningEntityAddressFindMany = vi.fn();
const screeningEntityAliasFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    screeningEntity: { findMany: screeningEntityFindMany, findFirst: screeningEntityFindFirst },
    screeningEntityAddress: { findMany: screeningEntityAddressFindMany },
    screeningEntityAlias: { findMany: screeningEntityAliasFindMany },
  },
}));

const { getRestrictedPartyReferenceList, __resetReferenceListCacheForTests } = await import(
  "@/modules/agents/compliance/restrictedParty/restrictedPartyRepository"
);

beforeEach(() => {
  vi.clearAllMocks();
  __resetReferenceListCacheForTests();
  screeningEntityFindFirst.mockResolvedValue({ publishedAt: new Date("2026-01-01T00:00:00Z") });
});

describe("getRestrictedPartyReferenceList", () => {
  it("attaches each entity's own addresses and aliases, not another entity's", async () => {
    screeningEntityFindMany.mockResolvedValue([
      { id: "e1", name: "Acme Trading" },
      { id: "e2", name: "Beta Corp" },
    ]);
    screeningEntityAddressFindMany.mockResolvedValue([
      { id: "addr1", screeningEntityId: "e1", addressLine: "1 Main St" },
    ]);
    screeningEntityAliasFindMany.mockResolvedValue([
      { id: "alias1", screeningEntityId: "e2", name: "Beta Co" },
    ]);

    const result = await getRestrictedPartyReferenceList();

    expect(result).toEqual([
      { id: "e1", name: "Acme Trading", addresses: [{ id: "addr1", screeningEntityId: "e1", addressLine: "1 Main St" }], aliases: [] },
      { id: "e2", name: "Beta Corp", addresses: [], aliases: [{ id: "alias1", screeningEntityId: "e2", name: "Beta Co" }] },
    ]);
  });

  it("queries addresses/aliases by the fetched entity ids, never a relational include", async () => {
    screeningEntityFindMany.mockResolvedValue([{ id: "e1", name: "Acme Trading" }]);
    screeningEntityAddressFindMany.mockResolvedValue([]);
    screeningEntityAliasFindMany.mockResolvedValue([]);

    await getRestrictedPartyReferenceList();

    expect(screeningEntityFindMany).toHaveBeenCalledWith(expect.not.objectContaining({ include: expect.anything() }));
    expect(screeningEntityAddressFindMany).toHaveBeenCalledWith({ where: { screeningEntityId: { in: ["e1"] } } });
    expect(screeningEntityAliasFindMany).toHaveBeenCalledWith({ where: { screeningEntityId: { in: ["e1"] } } });
  });

  it("returns empty addresses/aliases arrays when there are no entities", async () => {
    screeningEntityFindMany.mockResolvedValue([]);
    screeningEntityAddressFindMany.mockResolvedValue([]);
    screeningEntityAliasFindMany.mockResolvedValue([]);

    const result = await getRestrictedPartyReferenceList();

    expect(result).toEqual([]);
  });

  it("serves the cached list on a repeat call when the publishedAt watermark hasn't moved", async () => {
    screeningEntityFindMany.mockResolvedValue([{ id: "e1", name: "Acme Trading" }]);
    screeningEntityAddressFindMany.mockResolvedValue([]);
    screeningEntityAliasFindMany.mockResolvedValue([]);

    const first = await getRestrictedPartyReferenceList();
    const second = await getRestrictedPartyReferenceList();

    expect(second).toEqual(first);
    expect(screeningEntityFindMany).toHaveBeenCalledTimes(1);
    expect(screeningEntityFindFirst).toHaveBeenCalledTimes(2);
  });

  it("refetches once the publishedAt watermark advances", async () => {
    screeningEntityFindMany
      .mockResolvedValueOnce([{ id: "e1", name: "Acme Trading" }])
      .mockResolvedValueOnce([{ id: "e1", name: "Acme Trading (updated)" }]);
    screeningEntityAddressFindMany.mockResolvedValue([]);
    screeningEntityAliasFindMany.mockResolvedValue([]);

    const first = await getRestrictedPartyReferenceList();
    screeningEntityFindFirst.mockResolvedValue({ publishedAt: new Date("2026-02-01T00:00:00Z") });
    const second = await getRestrictedPartyReferenceList();

    expect(first[0].name).toBe("Acme Trading");
    expect(second[0].name).toBe("Acme Trading (updated)");
    expect(screeningEntityFindMany).toHaveBeenCalledTimes(2);
  });

  it("falls back to a stale cache when the watermark lookup fails", async () => {
    screeningEntityFindMany.mockResolvedValue([{ id: "e1", name: "Acme Trading" }]);
    screeningEntityAddressFindMany.mockResolvedValue([]);
    screeningEntityAliasFindMany.mockResolvedValue([]);

    const first = await getRestrictedPartyReferenceList();
    screeningEntityFindFirst.mockRejectedValueOnce(new Error("connection lost"));
    const second = await getRestrictedPartyReferenceList();

    expect(second).toEqual(first);
    expect(screeningEntityFindMany).toHaveBeenCalledTimes(1);
  });

  it("collapses concurrent cache-miss callers onto a single fetch", async () => {
    let resolveFindMany!: (value: unknown[]) => void;
    screeningEntityFindMany.mockReturnValue(
      new Promise((resolve) => {
        resolveFindMany = resolve;
      })
    );
    screeningEntityAddressFindMany.mockResolvedValue([]);
    screeningEntityAliasFindMany.mockResolvedValue([]);

    const callA = getRestrictedPartyReferenceList();
    const callB = getRestrictedPartyReferenceList();
    resolveFindMany([{ id: "e1", name: "Acme Trading" }]);

    const [resultA, resultB] = await Promise.all([callA, callB]);

    expect(resultA).toEqual(resultB);
    expect(screeningEntityFindMany).toHaveBeenCalledTimes(1);
  });
});
