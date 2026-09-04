import { describe, it, expect, vi } from "vitest";

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

describe("LineItemReconciler declared source-document fields", () => {
  it("records declared* fields as Facts and on the created row, distinct from the working fields", async () => {
    await LineItemReconciler.applyDiscoveries({
      shipmentId: "shp_1",
      accountId: "acc_1",
      documentId: "doc_1",
      sourceType: "EXTRACTED",
      items: [
        {
          lineNumber: 1,
          description: "Widget",
          countryOfOrigin: "Germany",
          htsCode: "8481.80.5090",
          declaredHsCode: "8481.80.5090",
          declaredCountryOfOrigin: "Germany",
          declaredExportControlCode: "3A002",
        },
      ],
    });

    const rows = dbMock.fact.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(rows.find((r) => String(r.field).endsWith(".declaredHsCode"))?.value).toBe("8481.80.5090");
    expect(rows.find((r) => String(r.field).endsWith(".declaredCountryOfOrigin"))?.value).toBe("Germany");
    expect(rows.find((r) => String(r.field).endsWith(".declaredExportControlCode"))?.value).toBe("3A002");

    const created = dbMock.shipmentLineItem.create.mock.calls[0][0].data;
    expect(created.declaredHsCode).toBe("8481.80.5090");
    expect(created.declaredCountryOfOrigin).toBe("Germany");
    expect(created.declaredExportControlCode).toBe("3A002");
  });

  it("never overwrites an already-recorded declared value with a later, differing one", async () => {
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
      declaredHsCode: "8481.80.5090",
      declaredCountryOfOrigin: "Germany",
      declaredExportControlCode: null,
      dangerousGoodsIndicator: null,
      unNumber: null,
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
          declaredHsCode: "9999.99.9999",
          declaredCountryOfOrigin: "France",
          declaredExportControlCode: "5A002",
        },
      ],
    });

    const updateData = dbMock.shipmentLineItem.update.mock.calls[0][0].data;
    expect(updateData.declaredHsCode).toBeUndefined();
    expect(updateData.declaredCountryOfOrigin).toBeUndefined();
    expect(updateData.declaredExportControlCode).toBe("5A002");
  });

  it("§79/§80 -- a declared HS code / country of origin conflicting with an already-approved (Valid) classification is recorded only as a Fact and never overwrites the approved columns", async () => {
    dbMock.shipmentLineItem.findFirst.mockResolvedValueOnce({
      id: "li_1",
      status: "Valid",
      htsCode: "8481.80.5090",
      countryOfOrigin: "Germany",
      quantity: 1,
      unitPrice: { toNumber: () => 0 },
      totalValue: { toNumber: () => 0 },
      description: "Widget",
      partNumber: null,
      eccnCode: null,
      declaredHsCode: null,
      declaredCountryOfOrigin: null,
      declaredExportControlCode: null,
      dangerousGoodsIndicator: null,
      unNumber: null,
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

    const updateCallsBefore = dbMock.shipmentLineItem.update.mock.calls.length;

    await LineItemReconciler.applyDiscoveries({
      shipmentId: "shp_1",
      accountId: "acc_1",
      documentId: "doc_3",
      sourceType: "EXTRACTED",
      items: [
        {
          lineNumber: 1,
          declaredHsCode: "8412.31.0000",
          declaredCountryOfOrigin: "India",
        },
      ],
    });

    // Recorded as source evidence regardless of the row's review status.
    const rows = dbMock.fact.createMany.mock.calls.at(-1)![0].data as Array<Record<string, unknown>>;
    expect(rows.find((r) => String(r.field).endsWith(".declaredHsCode"))?.value).toBe("8412.31.0000");
    expect(rows.find((r) => String(r.field).endsWith(".declaredCountryOfOrigin"))?.value).toBe("India");

    // A Valid row is fully locked -- no new update call is made at all, so
    // neither the approved htsCode/countryOfOrigin nor the declared* columns change.
    expect(dbMock.shipmentLineItem.update.mock.calls.length).toBe(updateCallsBefore);
  });
});
