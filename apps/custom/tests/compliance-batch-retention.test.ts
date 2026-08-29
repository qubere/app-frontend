import { describe, it, expect, vi, beforeEach } from "vitest";

// Bulk Compliance Screening retention sweep: only terminal batches
// (COMPLETED/FAILED/CANCELLED) past the retention window flip to EXPIRED,
// via the same optimistic-claim (updateMany count) pattern as the dispatcher.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    complianceBatch: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({
  db: dbMock,
  runWithAccountId: (_accountId: string | null | undefined, fn: () => unknown) => fn(),
}));

const createAuditLog = vi.fn();
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, createAuditLog };
});

const { sweepExpiredBatches, BATCH_RETENTION_DAYS } = await import("@/modules/complianceBatch/retention");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sweepExpiredBatches", () => {
  it("does nothing when no batches are past the retention window", async () => {
    dbMock.complianceBatch.findMany.mockResolvedValue([]);

    const result = await sweepExpiredBatches();

    expect(result).toEqual({ scanned: 0, expired: 0 });
    expect(dbMock.complianceBatch.updateMany).not.toHaveBeenCalled();
  });

  it("marks eligible terminal batches EXPIRED and audit-logs each one", async () => {
    dbMock.complianceBatch.findMany.mockResolvedValue([
      { id: "batch_1", accountId: "acct_1" },
      { id: "batch_2", accountId: "acct_2" },
    ]);
    dbMock.complianceBatch.updateMany.mockResolvedValue({ count: 1 });

    const result = await sweepExpiredBatches();

    expect(result).toEqual({ scanned: 2, expired: 2 });
    expect(dbMock.complianceBatch.updateMany).toHaveBeenCalledTimes(2);
    expect(dbMock.complianceBatch.updateMany).toHaveBeenCalledWith({
      where: { id: "batch_1", processingStatus: { in: ["COMPLETED", "FAILED", "CANCELLED"] } },
      data: { processingStatus: "EXPIRED" },
    });
    expect(createAuditLog).toHaveBeenCalledTimes(2);
    expect(createAuditLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ accountId: "acct_1", entityId: "batch_1", action: "COMPLIANCE_BATCH_EXPIRED" })
    );
    expect(createAuditLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ accountId: "acct_2", entityId: "batch_2", action: "COMPLIANCE_BATCH_EXPIRED" })
    );
  });

  it("does not count or audit-log a batch whose claim loses the race (updateMany count 0)", async () => {
    dbMock.complianceBatch.findMany.mockResolvedValue([{ id: "batch_1", accountId: "acct_1" }]);
    dbMock.complianceBatch.updateMany.mockResolvedValue({ count: 0 });

    const result = await sweepExpiredBatches();

    expect(result).toEqual({ scanned: 1, expired: 0 });
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("queries only terminal processingStatus values within the retention cutoff", async () => {
    dbMock.complianceBatch.findMany.mockResolvedValue([]);

    await sweepExpiredBatches();

    const call = dbMock.complianceBatch.findMany.mock.calls[0][0];
    expect(call.where.processingStatus).toEqual({ in: ["COMPLETED", "FAILED", "CANCELLED"] });
    expect(BATCH_RETENTION_DAYS).toBeGreaterThan(0);
  });
});
