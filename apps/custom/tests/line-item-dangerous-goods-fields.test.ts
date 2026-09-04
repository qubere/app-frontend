import { describe, it, expect, vi, afterEach } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    shipmentLineItem: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    fact: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/tariff/dutyEngine", () => ({
  loadHtsCodesMap: vi.fn().mockResolvedValue({}),
  calculateDutyStack: vi.fn().mockReturnValue({}),
}));

import { LineItemReconciler } from "@/modules/shipment/lineItemReconciler";

afterEach(() => {
  vi.clearAllMocks();
});

describe("LineItemReconciler dangerous-goods / transport-property fields", () => {
  it("records dangerous-goods facts and fills the created row when the document declares them", async () => {
    await LineItemReconciler.applyDiscoveries({
      shipmentId: "shp_1",
      accountId: "acc_1",
      documentId: "doc_1",
      sourceType: "EXTRACTED",
      items: [
        {
          lineNumber: 1,
          description: "Lithium Battery Pack",
          dangerousGoodsIndicator: true,
          unNumber: "UN3480",
          unProperShippingName: "Lithium ion batteries",
          dangerousGoodsClass: "9",
          packingGroup: "II",
          minimumTransportTemperature: -10,
          maximumTransportTemperature: 35,
          temperatureUom: "C",
          handlingInstructions: ["Keep upright", "Fragile"],
          productProperties: ["Rechargeable"],
        },
      ],
    });

    const rows = dbMock.fact.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(rows.find((r) => String(r.field).endsWith(".unNumber"))?.value).toBe("UN3480");
    expect(rows.find((r) => String(r.field).endsWith(".dangerousGoodsIndicator"))?.value).toBe("true");

    const created = dbMock.shipmentLineItem.create.mock.calls[0][0].data;
    expect(created.dangerousGoodsIndicator).toBe(true);
    expect(created.unNumber).toBe("UN3480");
    expect(created.dangerousGoodsClass).toBe("9");
    expect(created.handlingInstructions).toEqual(["Keep upright", "Fragile"]);
  });

  it("never overwrites an already-set dangerous-goods field, but fills a still-empty one", async () => {
    dbMock.shipmentLineItem.findFirst.mockResolvedValueOnce({
      id: "li_1",
      status: "Unreviewed",
      htsCode: "UNCLASSIFIABLE",
      countryOfOrigin: "Unknown",
      quantity: 1,
      unitPrice: { toNumber: () => 0 },
      totalValue: { toNumber: () => 0 },
      description: "Unspecified Item",
      partNumber: null,
      eccnCode: null,
      declaredHsCode: null,
      declaredCountryOfOrigin: null,
      declaredExportControlCode: null,
      dangerousGoodsIndicator: true,
      unNumber: "UN3480",
      unProperShippingName: null,
      dangerousGoodsClass: null,
      subsidiaryRisk: null,
      packingGroup: null,
      marinePollutantIndicator: null,
      minimumTransportTemperature: null,
      maximumTransportTemperature: null,
      temperatureUom: null,
      handlingInstructions: [],
      productProperties: [],
    });

    await LineItemReconciler.applyDiscoveries({
      shipmentId: "shp_1",
      accountId: "acc_1",
      documentId: "doc_2",
      sourceType: "EXTRACTED",
      items: [
        {
          lineNumber: 1,
          dangerousGoodsIndicator: false,
          unNumber: "UN9999",
          packingGroup: "III",
        },
      ],
    });

    const updateData = dbMock.shipmentLineItem.update.mock.calls[0][0].data;
    expect(updateData.dangerousGoodsIndicator).toBeUndefined();
    expect(updateData.unNumber).toBeUndefined();
    expect(updateData.packingGroup).toBe("III");
  });
});
