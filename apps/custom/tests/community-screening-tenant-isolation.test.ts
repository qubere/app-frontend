import { describe, it, expect, vi, beforeEach } from "vitest";

// Community Screening: tenant isolation. getRun/getRunResults/rescreenRun
// must always scope their run lookup by accountId, so a run belonging to a
// different tenant is never returned -- and PARTY_MASTER resolution must
// only ever load identities via the calling account, never a value the
// caller could smuggle in through the input.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    communityScreeningRun: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    communityScreeningPartyResult: {
      count: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/modules/compliance/communityScreening/evaluator", () => ({
  evaluateParty: vi.fn(),
}));

const { CommunityScreeningService } = await import("@/modules/compliance/communityScreening/service");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CommunityScreeningService.getRun", () => {
  it("scopes the lookup by id and the caller's accountId", async () => {
    dbMock.communityScreeningRun.findFirst.mockResolvedValue({ id: "run_1", accountId: "acct_1" });

    await CommunityScreeningService.getRun("acct_1", "run_1");

    expect(dbMock.communityScreeningRun.findFirst).toHaveBeenCalledWith({
      where: { id: "run_1", accountId: "acct_1" },
    });
  });

  it("returns null rather than throwing when the run belongs to a different tenant (simulated by a null mock)", async () => {
    dbMock.communityScreeningRun.findFirst.mockResolvedValue(null);

    const result = await CommunityScreeningService.getRun("acct_2", "run_1");

    expect(result).toBeNull();
  });
});

describe("CommunityScreeningService.getRunResults", () => {
  it("scopes the run lookup by id and accountId before returning any results", async () => {
    dbMock.communityScreeningRun.findFirst.mockResolvedValue({ id: "run_1", accountId: "acct_1" });
    dbMock.communityScreeningPartyResult.count.mockResolvedValue(0);
    dbMock.communityScreeningPartyResult.findMany.mockResolvedValue([]);

    await CommunityScreeningService.getRunResults("acct_1", "run_1");

    expect(dbMock.communityScreeningRun.findFirst).toHaveBeenCalledWith({
      where: { id: "run_1", accountId: "acct_1" },
    });
  });

  it("returns null without querying party results when the run is cross-tenant/not-found", async () => {
    dbMock.communityScreeningRun.findFirst.mockResolvedValue(null);

    const result = await CommunityScreeningService.getRunResults("acct_2", "run_1");

    expect(result).toBeNull();
    expect(dbMock.communityScreeningPartyResult.findMany).not.toHaveBeenCalled();
  });
});

describe("CommunityScreeningService.rescreenRun", () => {
  it("scopes the run lookup by id and accountId", async () => {
    dbMock.communityScreeningRun.findFirst.mockResolvedValue(null);

    await CommunityScreeningService.rescreenRun("acct_2", "run_1", {});

    expect(dbMock.communityScreeningRun.findFirst).toHaveBeenCalledWith({
      where: { id: "run_1", accountId: "acct_2" },
    });
  });

  it("returns null without mutating anything when the run is cross-tenant/not-found", async () => {
    dbMock.communityScreeningRun.findFirst.mockResolvedValue(null);

    const result = await CommunityScreeningService.rescreenRun("acct_2", "run_1", {});

    expect(result).toBeNull();
    expect(dbMock.communityScreeningPartyResult.updateMany).not.toHaveBeenCalled();
    expect(dbMock.communityScreeningRun.update).not.toHaveBeenCalled();
  });
});

describe("resolveCommunityScreeningParties: PARTY_MASTER mode account scoping", () => {
  it("resolves parties via loadCurrentIdentity scoped to the calling account, never a value from the input", async () => {
    vi.resetModules();
    const loadCurrentIdentity = vi.fn().mockResolvedValue({
      name: "Acme Trading Co",
      address: null,
      city: null,
      country: null,
      contactName: null,
    });
    vi.doMock("@/modules/agents/compliance/restrictedParty/partyIdentity", () => ({
      loadCurrentIdentity,
    }));
    vi.doMock("@/modules/compliance/communityScreening/upload/csv", () => ({ parseCommunityScreeningCsv: vi.fn() }));
    vi.doMock("@/modules/compliance/communityScreening/upload/xlsx", () => ({ parseCommunityScreeningXlsx: vi.fn() }));
    vi.doMock("@/modules/compliance/communityScreening/upload/json", () => ({ parseCommunityScreeningJson: vi.fn() }));

    const { resolveCommunityScreeningParties } = await import(
      "@/modules/compliance/communityScreening/partySource"
    );

    const tx = {} as never;
    const callingAccountId = "acct_1";

    const result = await resolveCommunityScreeningParties(tx, callingAccountId, {
      inputMode: "PARTY_MASTER",
      partyIds: ["party_1"],
    });

    expect(loadCurrentIdentity).toHaveBeenCalledWith(tx, callingAccountId, "party_1");
    expect(result.parties).toHaveLength(1);
    expect(result.parties[0]?.name).toBe("Acme Trading Co");
  });
});
