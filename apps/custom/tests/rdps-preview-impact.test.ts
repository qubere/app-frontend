import { describe, it, expect, vi, beforeEach } from "vitest";

// RDPS: previewReferenceChangeImpact (strictly read-only Preview Impact) and
// listImpactsForChange (per-change-set Impacted Parties drill-down).

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    referenceDataChangeSet: { findUnique: vi.fn() },
    party: { findMany: vi.fn() },
    rdpsRun: { create: vi.fn() },
    rdpsPartyOutcome: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const buildPartyIdentityIndex = vi.fn();
const findImpactedParties = vi.fn();
vi.mock("@/modules/agents/compliance/restrictedParty/impactAnalysis", () => ({
  buildPartyIdentityIndex: (...args: unknown[]) => buildPartyIdentityIndex(...args),
  findImpactedParties: (...args: unknown[]) => findImpactedParties(...args),
}));

const { previewReferenceChangeImpact, ReferenceChangeNotFoundError, listImpactsForChange } = await import(
  "@/modules/compliance/rdps/rdpsQueryService"
);

beforeEach(() => {
  vi.clearAllMocks();
  buildPartyIdentityIndex.mockResolvedValue({});
});

describe("previewReferenceChangeImpact: strictly read-only", () => {
  it("throws ReferenceChangeNotFoundError for an unknown change-set id", async () => {
    dbMock.referenceDataChangeSet.findUnique.mockResolvedValue(null);

    await expect(previewReferenceChangeImpact("acct_1", "chg_missing")).rejects.toBeInstanceOf(ReferenceChangeNotFoundError);
  });

  it("filters matches down to the caller's own accountId", async () => {
    dbMock.referenceDataChangeSet.findUnique.mockResolvedValue({
      id: "chg_1",
      screeningEntity: { id: "se_1", addresses: [], aliases: [] },
    });
    findImpactedParties.mockReturnValue([
      { partyId: "party_own", accountId: "acct_1", reasons: new Set(["EXACT"]) },
      { partyId: "party_other", accountId: "acct_2", reasons: new Set(["EXACT"]) },
    ]);
    dbMock.party.findMany.mockResolvedValue([
      { id: "party_own", names: [{ rawName: "Acme Trading Co" }], screeningSummary: { screeningStatus: "CLEAR", lastScreenedAt: null } },
    ]);

    const candidates = await previewReferenceChangeImpact("acct_1", "chg_1");

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ partyId: "party_own", accountId: "acct_1", partyDisplayName: "Acme Trading Co" });
    expect(dbMock.party.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["party_own"] } } }));
  });

  it("returns [] without ever touching Party.findMany when no candidates match this tenant", async () => {
    dbMock.referenceDataChangeSet.findUnique.mockResolvedValue({
      id: "chg_1",
      screeningEntity: { id: "se_1", addresses: [], aliases: [] },
    });
    findImpactedParties.mockReturnValue([{ partyId: "party_other", accountId: "acct_2", reasons: new Set(["EXACT"]) }]);

    const candidates = await previewReferenceChangeImpact("acct_1", "chg_1");

    expect(candidates).toEqual([]);
    expect(dbMock.party.findMany).not.toHaveBeenCalled();
  });

  it("never creates an RdpsRun or RdpsPartyOutcome row -- Preview Impact never mutates", async () => {
    dbMock.referenceDataChangeSet.findUnique.mockResolvedValue({
      id: "chg_1",
      screeningEntity: { id: "se_1", addresses: [], aliases: [] },
    });
    findImpactedParties.mockReturnValue([{ partyId: "party_own", accountId: "acct_1", reasons: new Set(["EXACT"]) }]);
    dbMock.party.findMany.mockResolvedValue([{ id: "party_own", names: [], screeningSummary: null }]);

    await previewReferenceChangeImpact("acct_1", "chg_1");

    expect(dbMock.rdpsRun.create).not.toHaveBeenCalled();
    expect(dbMock.rdpsPartyOutcome.create).not.toHaveBeenCalled();
  });
});

describe("listImpactsForChange: per-change-set Impacted Parties", () => {
  it("filters by accountId and triggeringChangeSetIds containing the given change-set id", async () => {
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([]);
    dbMock.rdpsPartyOutcome.count.mockResolvedValue(0);

    await listImpactsForChange("acct_1", "chg_1", {});

    expect(dbMock.rdpsPartyOutcome.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acct_1", triggeringChangeSetIds: { has: "chg_1" } },
      })
    );
  });

  it("attaches a partyDisplayName derived from the party's active name", async () => {
    dbMock.rdpsPartyOutcome.findMany.mockResolvedValue([
      { id: "outcome_1", transitionType: "NEW_HIT", party: { names: [{ rawName: "Acme Trading Co" }] } },
    ]);
    dbMock.rdpsPartyOutcome.count.mockResolvedValue(1);

    const { impacts } = await listImpactsForChange("acct_1", "chg_1", {});

    expect(impacts[0]).toMatchObject({ partyDisplayName: "Acme Trading Co", transitionType: "NEW_HIT" });
  });
});
