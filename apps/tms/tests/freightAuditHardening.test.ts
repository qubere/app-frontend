import { beforeEach, describe, expect, it, vi } from "vitest";
import { performFreightAudit } from "../src/modules/invoices/services/freightAuditService";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    carrierInvoice: { findFirst: vi.fn(), findMany: vi.fn() },
    shipmentCost: { findMany: vi.fn() },
    proofOfDelivery: { findFirst: vi.fn() },
  },
}));

vi.mock("@qubere/db", () => ({ db: dbMock }));

const ctx = { accountId: "acc_999" };

describe("Freight audit evidence gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.carrierInvoice.findFirst.mockResolvedValue({
      id: "invoice_1",
      accountId: ctx.accountId,
      shipmentId: "shipment_1",
      currency: "USD",
      totalAmount: 1000,
      lines: [{ chargeType: "LINEHAUL", amount: 1000 }],
    });
    dbMock.shipmentCost.findMany.mockResolvedValue([
      { costType: "LINEHAUL", amount: 1000, currency: "USD", description: "Linehaul" },
    ]);
    dbMock.proofOfDelivery.findFirst.mockResolvedValue({
      id: "pod_1",
      exceptionNoted: false,
    });
  });

  it("flags an uncontracted accessorial instead of treating it as zero variance", async () => {
    dbMock.carrierInvoice.findFirst.mockResolvedValue({
      id: "invoice_1",
      accountId: ctx.accountId,
      shipmentId: "shipment_1",
      currency: "USD",
      totalAmount: 1100,
      lines: [
        { chargeType: "LINEHAUL", amount: 1000 },
        { chargeType: "WAIT_TIME", amount: 100 },
      ],
    });

    const result = await performFreightAudit(ctx, "invoice_1");

    expect(result.auditStatus).toBe("VARIANCE_FLAGGED");
    expect(result.uncontractedChargeTypes).toEqual(["WAIT_TIME"]);
    expect(result.lines.find((line) => line.chargeType === "WAIT_TIME")?.variancePct).toBe(100);
  });

  it("does not approve a mathematically matched invoice without proof of delivery", async () => {
    dbMock.proofOfDelivery.findFirst.mockResolvedValue(null);

    const result = await performFreightAudit(ctx, "invoice_1");

    expect(result.auditStatus).toBe("EXCEPTION");
    expect(result.hasSignedPod).toBe(false);
    expect(result.notes).toContain("Proof of delivery is required");
  });

  it("blocks matching when invoice and expected-cost currencies differ", async () => {
    dbMock.shipmentCost.findMany.mockResolvedValue([
      { costType: "LINEHAUL", amount: 1000, currency: "EUR", description: "Linehaul" },
    ]);

    const result = await performFreightAudit(ctx, "invoice_1");

    expect(result.auditStatus).toBe("EXCEPTION");
    expect(result.currencyConsistent).toBe(false);
    expect(result.notes).toContain("does not match the expected cost currency");
  });
});
