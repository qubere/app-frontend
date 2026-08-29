import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  return {
    db: {
      licenseEvent: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      licenseLine: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
      licenseAdjustment: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(db)),
    },
  };
});

import { db } from "@/lib/db";
import { postLicenseEvent, postLicenseAdjustment, LicenseEventConflictError } from "@/modules/licenses/utilizationService";

const baseLine = {
  id: "line_1",
  accountId: "acc_1",
  version: 3,
  committedQuantity: "10",
  committedValue: "1000",
  shippedQuantity: "5",
  shippedValue: "500",
  adjustedQuantity: "0",
  adjustedValue: "0",
};

describe("utilizationService.postLicenseEvent — duplicate detection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the existing event and does not double-count when the same source event is replayed", async () => {
    const existingEvent = { id: "evt_1", accountId: "acc_1", licenseLineId: "line_1", eventType: "SHIPMENT" };
    (db.licenseEvent.findFirst as any).mockResolvedValue(existingEvent);

    const result = await postLicenseEvent({
      accountId: "acc_1",
      licenseLineId: "line_1",
      eventType: "SHIPMENT",
      transactionId: "txn_1",
      transactionLineId: "line_a",
      quantityDelta: 5,
    });

    expect(result).toEqual({ event: existingEvent, deduped: true });
    expect(db.licenseLine.updateMany).not.toHaveBeenCalled();
    expect(db.licenseEvent.create).not.toHaveBeenCalled();
  });

  it("scopes the dedupe lookup by accountId, licenseLineId, eventType, transactionId, and transactionLineId", async () => {
    (db.licenseEvent.findFirst as any).mockResolvedValue({ id: "evt_1" });

    await postLicenseEvent({
      accountId: "acc_1",
      licenseLineId: "line_1",
      eventType: "SHIPMENT",
      transactionId: "txn_1",
      transactionLineId: "line_a",
    });

    expect(db.licenseEvent.findFirst).toHaveBeenCalledWith({
      where: {
        accountId: "acc_1",
        licenseLineId: "line_1",
        eventType: "SHIPMENT",
        transactionId: "txn_1",
        transactionLineId: "line_a",
      },
    });
  });
});

describe("utilizationService.postLicenseEvent — optimistic concurrency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws LicenseEventConflictError when the CAS updateMany matches zero rows (version moved)", async () => {
    (db.licenseEvent.findFirst as any).mockResolvedValue(null);
    (db.licenseLine.findFirst as any).mockResolvedValue(baseLine);
    (db.licenseLine.updateMany as any).mockResolvedValue({ count: 0 });

    await expect(
      postLicenseEvent({
        accountId: "acc_1",
        licenseLineId: "line_1",
        eventType: "SHIPMENT",
        quantityDelta: 2,
      })
    ).rejects.toThrow(LicenseEventConflictError);

    expect(db.licenseEvent.create).not.toHaveBeenCalled();
  });

  it("guards the update with a where clause keyed on the version read at the start of the transaction", async () => {
    (db.licenseEvent.findFirst as any).mockResolvedValue(null);
    (db.licenseLine.findFirst as any).mockResolvedValue(baseLine);
    (db.licenseLine.updateMany as any).mockResolvedValue({ count: 1 });
    (db.licenseEvent.create as any).mockResolvedValue({ id: "evt_new" });

    await postLicenseEvent({
      accountId: "acc_1",
      licenseLineId: "line_1",
      eventType: "SHIPMENT",
      quantityDelta: 2,
    });

    expect(db.licenseLine.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: baseLine.id, version: baseLine.version } })
    );
  });

  it("commits the transaction with Serializable isolation", async () => {
    (db.licenseEvent.findFirst as any).mockResolvedValue(null);
    (db.licenseLine.findFirst as any).mockResolvedValue(baseLine);
    (db.licenseLine.updateMany as any).mockResolvedValue({ count: 1 });
    (db.licenseEvent.create as any).mockResolvedValue({ id: "evt_new" });

    await postLicenseEvent({
      accountId: "acc_1",
      licenseLineId: "line_1",
      eventType: "SHIPMENT",
      quantityDelta: 2,
    });

    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });
});

describe("utilizationService.postLicenseAdjustment — reason requirement and concurrency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an adjustment with a blank reason before touching the database", async () => {
    await expect(
      postLicenseAdjustment({
        accountId: "acc_1",
        licenseLineId: "line_1",
        adjustmentType: "CORRECTION",
        reason: "   ",
      })
    ).rejects.toThrow(/reason is required/i);

    expect(db.licenseLine.findFirst).not.toHaveBeenCalled();
  });

  it("throws LicenseEventConflictError when the CAS updateMany matches zero rows", async () => {
    (db.licenseLine.findFirst as any).mockResolvedValue(baseLine);
    (db.licenseLine.updateMany as any).mockResolvedValue({ count: 0 });

    await expect(
      postLicenseAdjustment({
        accountId: "acc_1",
        licenseLineId: "line_1",
        adjustmentType: "CORRECTION",
        reason: "manual correction",
        quantityDelta: 1,
      })
    ).rejects.toThrow(LicenseEventConflictError);

    expect(db.licenseAdjustment.create).not.toHaveBeenCalled();
  });
});
