import { describe, it, expect, vi, beforeEach } from "vitest";

// Concurrent recomputeShipmentDeadlines calls (attach, reprocess, field-review,
// reconciliation, tracking webhook can all fire close together for the same
// shipment) used to race past a plain findFirst-then-create check and create
// duplicate open ExceptionItem rows for the same (shipmentId, code) -- see
// migration 20260905130000. This exercises that the resulting P2002 from the
// DB's partial unique index is swallowed as a no-op, while any other error
// still propagates.

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    shipment: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    complianceDeadline: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    exceptionItem: {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock, runWithAccountId: vi.fn() }));

const createExceptionItem = vi.fn();
vi.mock("@/lib/exceptions/createException", () => ({
  createExceptionItem: (...args: unknown[]) => createExceptionItem(...args),
}));

const { recomputeShipmentDeadlines } = await import("@/modules/deadlines/deadline.service");

const SHIPMENT_WITH_NO_ANCHORS = {
  accountId: "acct_1",
  transportMode: "Ocean",
  ladingDate: null,
  arrivalDate: null,
  estimatedArrival: null,
  customsFilings: [],
  complianceDeadlines: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.shipment.findFirst.mockResolvedValue(SHIPMENT_WITH_NO_ANCHORS);
  dbMock.shipment.update.mockResolvedValue({});
  dbMock.complianceDeadline.findMany.mockResolvedValue([]);
  dbMock.exceptionItem.findFirst.mockResolvedValue(null);
  dbMock.exceptionItem.updateMany.mockResolvedValue({ count: 0 });
});

describe("recomputeShipmentDeadlines: concurrent missing-anchor exception races", () => {
  it("swallows a P2002 unique-violation as a no-op (another recompute already created it)", async () => {
    createExceptionItem.mockRejectedValue({ code: "P2002" });

    await expect(recomputeShipmentDeadlines("ship_1", "acct_1")).resolves.toBeUndefined();
    // One missing-anchor exception attempted per applicable rule (ISF, ENTRY_FILING, ENTRY_SUMMARY, DUTY_PAYMENT).
    expect(createExceptionItem).toHaveBeenCalledTimes(4);
  });

  it("still throws for any other error", async () => {
    createExceptionItem.mockRejectedValue(new Error("connection reset"));

    await expect(recomputeShipmentDeadlines("ship_1", "acct_1")).rejects.toThrow("connection reset");
  });
});
