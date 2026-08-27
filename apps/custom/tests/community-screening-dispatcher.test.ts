import { describe, it, expect, vi, beforeEach } from "vitest";

// Community Screening dispatcher: mirrors ComplianceNotificationDispatcher's
// optimistic per-row claim via updateMany. Verifies the claim-loses-the-race
// guard, batch size respecting config, QUEUED->RUNNING transition on first
// claim only, per-run finalization once no PENDING rows remain, and that one
// row's evaluateParty exception is captured without stopping the batch.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    communityScreeningPartyResult: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    communityScreeningRun: {
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const evaluateParty = vi.fn();
vi.mock("@/modules/compliance/communityScreening/evaluator", () => ({
  evaluateParty: (...args: unknown[]) => evaluateParty(...args),
}));

const getCommunityScreeningBatchSize = vi.fn();
vi.mock("@/modules/compliance/communityScreening/config", () => ({
  getCommunityScreeningBatchSize: () => getCommunityScreeningBatchSize(),
}));

const finalizeRunIfComplete = vi.fn();
vi.mock("@/modules/compliance/communityScreening/service", () => ({
  CommunityScreeningService: {
    finalizeRunIfComplete: (...args: unknown[]) => finalizeRunIfComplete(...args),
  },
}));

const { CommunityScreeningDispatcher } = await import("@/modules/compliance/communityScreening/dispatcher");

function candidateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row_1",
    runId: "run_1",
    accountId: "acct_1",
    aggregateStatus: "PENDING",
    run: {
      id: "run_1",
      status: "QUEUED",
      startedAt: null,
      checksEnabled: { restrictedParty: true, embargo: false },
      overrides: null,
      complianceCountry: "US",
      requestedByUserId: "user_1",
    },
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCommunityScreeningBatchSize.mockReturnValue(50);
  dbMock.communityScreeningPartyResult.updateMany.mockResolvedValue({ count: 1 });
  dbMock.communityScreeningPartyResult.count.mockResolvedValue(0);
  dbMock.communityScreeningRun.update.mockResolvedValue({});
  evaluateParty.mockResolvedValue(undefined);
  finalizeRunIfComplete.mockResolvedValue({});
});

describe("CommunityScreeningDispatcher.dispatchPending: optimistic claim", () => {
  it("does not evaluate or count a row whose claim lost the race (updateMany count 0)", async () => {
    dbMock.communityScreeningPartyResult.findMany.mockResolvedValue([candidateRow()]);
    dbMock.communityScreeningPartyResult.updateMany.mockResolvedValue({ count: 0 });

    const result = await CommunityScreeningDispatcher.dispatchPending();

    expect(evaluateParty).not.toHaveBeenCalled();
    expect(result.claimedCount).toBe(0);
  });

  it("evaluates and counts a row whose claim succeeds", async () => {
    dbMock.communityScreeningPartyResult.findMany.mockResolvedValue([candidateRow()]);

    const result = await CommunityScreeningDispatcher.dispatchPending();

    expect(evaluateParty).toHaveBeenCalledTimes(1);
    expect(result.claimedCount).toBe(1);
  });
});

describe("CommunityScreeningDispatcher.dispatchPending: batch size", () => {
  it("passes getCommunityScreeningBatchSize() as the take param to findMany", async () => {
    getCommunityScreeningBatchSize.mockReturnValue(7);
    dbMock.communityScreeningPartyResult.findMany.mockResolvedValue([]);

    await CommunityScreeningDispatcher.dispatchPending();

    expect(dbMock.communityScreeningPartyResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 7 })
    );
  });
});

describe("CommunityScreeningDispatcher.dispatchPending: run status transition", () => {
  it("transitions a QUEUED run to RUNNING with startedAt set on first claim", async () => {
    dbMock.communityScreeningPartyResult.findMany.mockResolvedValue([candidateRow()]);

    await CommunityScreeningDispatcher.dispatchPending();

    expect(dbMock.communityScreeningRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({ status: "RUNNING", startedAt: expect.any(Date) }),
      })
    );
  });

  it("does not re-update a run that is already RUNNING", async () => {
    dbMock.communityScreeningPartyResult.findMany.mockResolvedValue([
      candidateRow({ run: { ...candidateRow().run, status: "RUNNING" } }),
    ]);

    await CommunityScreeningDispatcher.dispatchPending();

    expect(dbMock.communityScreeningRun.update).not.toHaveBeenCalled();
  });
});

describe("CommunityScreeningDispatcher.dispatchPending: per-run finalization", () => {
  it("finalizes a run exactly once when no PENDING rows remain for it", async () => {
    dbMock.communityScreeningPartyResult.findMany.mockResolvedValue([candidateRow()]);
    dbMock.communityScreeningPartyResult.count.mockResolvedValue(0);

    const result = await CommunityScreeningDispatcher.dispatchPending();

    expect(finalizeRunIfComplete).toHaveBeenCalledTimes(1);
    expect(finalizeRunIfComplete).toHaveBeenCalledWith("run_1");
    expect(result.runsFinalized).toBe(1);
  });

  it("does not finalize a run when rows remain PENDING for it", async () => {
    dbMock.communityScreeningPartyResult.findMany.mockResolvedValue([candidateRow()]);
    dbMock.communityScreeningPartyResult.count.mockResolvedValue(2);

    const result = await CommunityScreeningDispatcher.dispatchPending();

    expect(finalizeRunIfComplete).not.toHaveBeenCalled();
    expect(result.runsFinalized).toBe(0);
  });
});

describe("CommunityScreeningDispatcher.dispatchPending: per-row error isolation", () => {
  it("captures an evaluateParty exception into errors and keeps processing the rest of the batch", async () => {
    const rowA = candidateRow({ id: "row_a", runId: "run_a", run: { ...candidateRow().run } });
    const rowB = candidateRow({ id: "row_b", runId: "run_b", run: { ...candidateRow().run } });
    dbMock.communityScreeningPartyResult.findMany.mockResolvedValue([rowA, rowB]);
    evaluateParty.mockRejectedValueOnce(new Error("evaluator blew up")).mockResolvedValueOnce(undefined);

    const result = await CommunityScreeningDispatcher.dispatchPending();

    expect(result.claimedCount).toBe(2);
    expect(result.errors).toEqual([{ rowId: "row_a", error: "evaluator blew up" }]);
    expect(evaluateParty).toHaveBeenCalledTimes(2);
  });
});
