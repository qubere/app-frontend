import { describe, it, expect, vi, beforeEach } from "vitest";

// Bulk Compliance Screening service: tenant isolation on read paths, and the
// cancel/retry/rescreen state-machine guards (only certain processingStatus
// values are eligible for each action, per aggregation.ts's fail-safe design).

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    complianceBatch: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    batchRecord: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const createAuditLog = vi.fn();
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, createAuditLog };
});

const { ComplianceBatchService, ComplianceBatchStateError } = await import("@/modules/complianceBatch/service");

beforeEach(() => {
  vi.clearAllMocks();
});

function batchRow(overrides: Record<string, unknown> = {}) {
  return { id: "batch_1", accountId: "acct_1", processingStatus: "PROCESSING", ...overrides };
}

describe("ComplianceBatchService.getBatch", () => {
  it("scopes the lookup by id and the caller's accountId", async () => {
    dbMock.complianceBatch.findFirst.mockResolvedValue(batchRow());

    await ComplianceBatchService.getBatch("acct_1", "batch_1");

    expect(dbMock.complianceBatch.findFirst).toHaveBeenCalledWith({
      where: { id: "batch_1", accountId: "acct_1" },
    });
  });
});

describe("ComplianceBatchService.cancelBatch", () => {
  it("returns null when the batch is not found for the caller's tenant", async () => {
    dbMock.complianceBatch.findFirst.mockResolvedValue(null);

    const result = await ComplianceBatchService.cancelBatch("acct_2", "batch_1", "user_1");

    expect(result).toBeNull();
    expect(dbMock.complianceBatch.update).not.toHaveBeenCalled();
  });

  it("throws ComplianceBatchStateError when the batch is already terminal", async () => {
    dbMock.complianceBatch.findFirst.mockResolvedValue(batchRow({ processingStatus: "COMPLETED" }));

    await expect(ComplianceBatchService.cancelBatch("acct_1", "batch_1", "user_1")).rejects.toThrow(
      ComplianceBatchStateError
    );
    expect(dbMock.complianceBatch.update).not.toHaveBeenCalled();
  });

  it("marks a not-yet-terminal batch CANCELLED and audit-logs it", async () => {
    dbMock.complianceBatch.findFirst.mockResolvedValue(batchRow({ processingStatus: "READY" }));
    dbMock.complianceBatch.update.mockResolvedValue(batchRow({ processingStatus: "CANCELLED" }));

    const result = await ComplianceBatchService.cancelBatch("acct_1", "batch_1", "user_1");

    expect(dbMock.complianceBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "batch_1" }, data: expect.objectContaining({ processingStatus: "CANCELLED" }) })
    );
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(result?.processingStatus).toBe("CANCELLED");
  });
});

describe("ComplianceBatchService.retryBatch", () => {
  it("throws when the batch is not COMPLETED or FAILED", async () => {
    dbMock.complianceBatch.findFirst.mockResolvedValue(batchRow({ processingStatus: "PROCESSING" }));

    await expect(ComplianceBatchService.retryBatch("acct_1", "batch_1", "user_1")).rejects.toThrow(
      ComplianceBatchStateError
    );
  });

  it("throws when there are no ERROR records to requeue", async () => {
    dbMock.complianceBatch.findFirst.mockResolvedValue(batchRow({ processingStatus: "FAILED" }));
    dbMock.batchRecord.updateMany.mockResolvedValue({ count: 0 });

    await expect(ComplianceBatchService.retryBatch("acct_1", "batch_1", "user_1")).rejects.toThrow(
      ComplianceBatchStateError
    );
    expect(dbMock.complianceBatch.update).not.toHaveBeenCalled();
  });

  it("requeues ERROR records and moves the batch back to PROCESSING", async () => {
    dbMock.complianceBatch.findFirst.mockResolvedValue(batchRow({ processingStatus: "FAILED" }));
    dbMock.batchRecord.updateMany.mockResolvedValue({ count: 3 });
    dbMock.complianceBatch.update.mockResolvedValue(batchRow({ processingStatus: "PROCESSING" }));

    await ComplianceBatchService.retryBatch("acct_1", "batch_1", "user_1");

    expect(dbMock.batchRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ processingStatus: "ERROR" }) })
    );
    expect(dbMock.complianceBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processingStatus: "PROCESSING" }) })
    );
  });
});

describe("ComplianceBatchService.rescreenBatch", () => {
  it("throws when the batch is not COMPLETED or FAILED", async () => {
    dbMock.complianceBatch.findFirst.mockResolvedValue(batchRow({ processingStatus: "READY" }));

    await expect(ComplianceBatchService.rescreenBatch("acct_1", "batch_1", "user_1")).rejects.toThrow(
      ComplianceBatchStateError
    );
  });

  it("requeues every valid record and discards prior canonical result links", async () => {
    dbMock.complianceBatch.findFirst.mockResolvedValue(batchRow({ processingStatus: "COMPLETED" }));
    dbMock.batchRecord.updateMany.mockResolvedValue({ count: 5 });
    dbMock.complianceBatch.update.mockResolvedValue(batchRow({ processingStatus: "PROCESSING" }));

    await ComplianceBatchService.rescreenBatch("acct_1", "batch_1", "user_1");

    expect(dbMock.batchRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parseStatus: "VALID" }),
        data: expect.objectContaining({ rpsResultId: null, licenseDeterminationResultId: null }),
      })
    );
    expect(createAuditLog).toHaveBeenCalledTimes(1);
  });
});
