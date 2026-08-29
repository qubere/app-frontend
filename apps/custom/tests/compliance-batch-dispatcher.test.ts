import { describe, it, expect, vi, beforeEach } from "vitest";

// Bulk Compliance Screening dispatcher: mirrors CommunityScreeningDispatcher's
// optimistic per-row claim via updateMany. Verifies the claim-loses-the-race
// guard, that a processing exception is captured as a terminal ERROR without
// stopping the batch, and that a batch is only finalized once no
// PENDING/PROCESSING records remain.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    complianceBatch: {
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    batchRecord: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const processBatchRecord = vi.fn();
vi.mock("@/modules/complianceBatch/processing", () => ({
  processBatchRecord: (...args: unknown[]) => processBatchRecord(...args),
}));

const generateCompletionArtifacts = vi.fn();
vi.mock("@/modules/complianceBatch/artifacts", () => ({
  generateCompletionArtifacts: (...args: unknown[]) => generateCompletionArtifacts(...args),
}));

const { ComplianceBatchDispatcher } = await import("@/modules/complianceBatch/dispatcher");

function candidateRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec_1",
    accountId: "acct_1",
    batchId: "batch_1",
    processingStatus: "PENDING",
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.complianceBatch.updateMany.mockResolvedValue({ count: 1 });
  dbMock.complianceBatch.update.mockResolvedValue({});
  dbMock.batchRecord.updateMany.mockResolvedValue({ count: 1 });
  dbMock.batchRecord.update.mockResolvedValue({});
  dbMock.batchRecord.findMany.mockResolvedValue([]);
  processBatchRecord.mockResolvedValue(undefined);
});

describe("ComplianceBatchDispatcher.dispatchPending: optimistic claim", () => {
  it("does not process a record whose claim lost the race (updateMany count 0)", async () => {
    dbMock.batchRecord.findMany
      .mockResolvedValueOnce([candidateRecord()])
      .mockResolvedValue([{ processingStatus: "COMPLETED", complianceStatus: "PASSED" }]);
    dbMock.batchRecord.updateMany.mockResolvedValue({ count: 0 });

    const result = await ComplianceBatchDispatcher.dispatchPending();

    expect(processBatchRecord).not.toHaveBeenCalled();
    expect(result.claimedCount).toBe(0);
  });

  it("processes a record whose claim succeeds", async () => {
    dbMock.batchRecord.findMany
      .mockResolvedValueOnce([candidateRecord()])
      .mockResolvedValue([{ processingStatus: "COMPLETED", complianceStatus: "PASSED" }]);

    const result = await ComplianceBatchDispatcher.dispatchPending();

    expect(processBatchRecord).toHaveBeenCalledTimes(1);
    expect(result.claimedCount).toBe(1);
  });

  it("marks a record ERROR without throwing when processing itself rejects", async () => {
    dbMock.batchRecord.findMany
      .mockResolvedValueOnce([candidateRecord()])
      .mockResolvedValue([{ processingStatus: "ERROR", complianceStatus: "ERROR" }]);
    processBatchRecord.mockRejectedValue(new Error("boom"));

    const result = await ComplianceBatchDispatcher.dispatchPending();

    expect(result.errorCount).toBe(1);
    expect(dbMock.batchRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rec_1" },
        data: expect.objectContaining({ processingStatus: "ERROR", complianceStatus: "ERROR" }),
      })
    );
  });

  it("does not finalize the batch while a record is still PENDING/PROCESSING", async () => {
    dbMock.batchRecord.findMany
      .mockResolvedValueOnce([candidateRecord()])
      .mockResolvedValue([{ processingStatus: "PROCESSING", complianceStatus: "NOT_EVALUATED" }]);

    await ComplianceBatchDispatcher.dispatchPending();

    expect(dbMock.complianceBatch.update).not.toHaveBeenCalled();
  });

  it("finalizes the batch once every record is terminal", async () => {
    dbMock.batchRecord.findMany
      .mockResolvedValueOnce([candidateRecord()])
      .mockResolvedValue([{ processingStatus: "COMPLETED", complianceStatus: "PASSED" }]);

    await ComplianceBatchDispatcher.dispatchPending();

    expect(dbMock.complianceBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch_1" },
        data: expect.objectContaining({ processingStatus: "COMPLETED" }),
      })
    );
  });
});
