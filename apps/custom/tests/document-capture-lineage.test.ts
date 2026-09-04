import { beforeEach, describe, expect, it, vi } from "vitest";

// #331 Phase 2: Document extraction pipeline capture contract (#340)
// Tests promotion of Consignee / Notify Party to ShipmentParty,
// and product matching during line item creation via LineItemReconciler.

const mocks = vi.hoisted(() => ({
  db: {
    legalEntity: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    shipmentParty: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    shipmentLineItem: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    product: { findMany: vi.fn() },
    fact: { create: vi.fn(), createMany: vi.fn() },
    extractionField: { deleteMany: vi.fn(), createMany: vi.fn() },
    shipmentDocument: { findFirst: vi.fn(), updateMany: vi.fn() },
    documentParseVersion: { create: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/exceptions/createException", () => ({ createExceptionItem: vi.fn() }));

const { ShipmentPartyService } = await import("../src/modules/shipment/shipmentPartyService");
const { LineItemReconciler } = await import("../src/modules/shipment/lineItemReconciler");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Document Capture Contract (#331 Phase 2 / #340)", () => {
  describe("ShipmentPartyService roles", () => {
    it("supports CONSIGNEE and NOTIFY_PARTY roles when assigning parties to a shipment", async () => {
      mocks.db.legalEntity.findFirst.mockResolvedValue({ id: "le-consignee" });
      mocks.db.shipmentParty.findFirst.mockResolvedValue(null);
      mocks.db.shipmentParty.create.mockResolvedValue({ id: "sp-1", role: "CONSIGNEE" });

      await ShipmentPartyService.assignParty({
        shipmentId: "shipment-1",
        legalEntityId: "le-consignee",
        role: "CONSIGNEE",
        accountId: "acct-1",
      });

      expect(mocks.db.shipmentParty.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shipmentId: "shipment-1",
            legalEntityId: "le-consignee",
            role: "CONSIGNEE",
          }),
        })
      );

      mocks.db.legalEntity.findFirst.mockResolvedValue({ id: "le-notify" });
      mocks.db.shipmentParty.findFirst.mockResolvedValue(null);
      mocks.db.shipmentParty.create.mockResolvedValue({ id: "sp-2", role: "NOTIFY_PARTY" });

      await ShipmentPartyService.assignParty({
        shipmentId: "shipment-1",
        legalEntityId: "le-notify",
        role: "NOTIFY_PARTY",
        accountId: "acct-1",
      });

      expect(mocks.db.shipmentParty.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shipmentId: "shipment-1",
            legalEntityId: "le-notify",
            role: "NOTIFY_PARTY",
          }),
        })
      );
    });
  });

  describe("LineItemReconciler product matching", () => {
    it("sets productId, productMatchStatus, and productMatchedAt when product matches EXACT_MATCH", async () => {
      // Mock exact match product in db
      mocks.db.product.findMany.mockResolvedValue([
        {
          id: "product-exact-1",
          productName: "Widget A",
          brand: "BrandX",
          internalSku: "SKU-100",
          clientId: null,
          identifiers: [{ identifierType: "INTERNAL_SKU", normalizedValue: "SKU100" }],
          parties: [],
        },
      ]);
      mocks.db.shipmentLineItem.findFirst.mockResolvedValue(null);
      mocks.db.shipmentLineItem.create.mockResolvedValue({ id: "line-1" });

      await LineItemReconciler.applyDiscoveries({
        shipmentId: "ship-1",
        accountId: "acct-1",
        sourceType: "EXTRACTED",
        items: [
          {
            lineNumber: 1,
            description: "Widget A",
            partNumber: "SKU-100",
            quantity: 10,
            unitPrice: 5.0,
            countryOfOrigin: "US",
          },
        ],
      });

      expect(mocks.db.shipmentLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shipmentId: "ship-1",
            accountId: "acct-1",
            lineNumber: 1,
            productId: "product-exact-1",
            productMatchStatus: "EXACT_MATCH",
            productMatchedAt: expect.any(Date),
          }),
        })
      );
    });

    it("leaves productId null and sets productMatchStatus when product match is NO_MATCH or non-exact", async () => {
      mocks.db.product.findMany.mockResolvedValue([]);
      mocks.db.shipmentLineItem.findFirst.mockResolvedValue(null);
      mocks.db.shipmentLineItem.create.mockResolvedValue({ id: "line-2" });

      await LineItemReconciler.applyDiscoveries({
        shipmentId: "ship-1",
        accountId: "acct-1",
        sourceType: "EXTRACTED",
        items: [
          {
            lineNumber: 2,
            description: "Unknown Mystery Item",
            partNumber: "UNKNOWN-999",
            quantity: 1,
            unitPrice: 100.0,
            countryOfOrigin: "CN",
          },
        ],
      });

      expect(mocks.db.shipmentLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shipmentId: "ship-1",
            accountId: "acct-1",
            lineNumber: 2,
            productId: null,
            productMatchStatus: "NO_MATCH",
            productMatchedAt: expect.any(Date),
          }),
        })
      );
    });
  });
});
