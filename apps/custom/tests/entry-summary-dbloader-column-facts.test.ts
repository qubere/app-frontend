import { describe, expect, it } from "vitest";

import { SYNTHESIZED_FACT_CONFIDENCE, synthesizeColumnFacts } from "@/modules/entrySummary/dbLoader";

const SHIPMENT_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");
const LINE_CREATED_AT = new Date("2026-01-02T00:00:00.000Z");

function baseShipment(overrides: Partial<Parameters<typeof synthesizeColumnFacts>[0]> = {}) {
  return {
    id: "shp_1",
    createdAt: SHIPMENT_CREATED_AT,
    entryType: null,
    portOfEntry: null,
    transportMode: null,
    countryOfExport: null,
    ...overrides,
  };
}

function baseLine(overrides: Partial<Parameters<typeof synthesizeColumnFacts>[1][number]> = {}) {
  return {
    id: "li_1",
    lineNumber: 1,
    createdAt: LINE_CREATED_AT,
    description: null,
    htsCode: null,
    countryOfOrigin: null,
    quantity: null,
    totalValue: null,
    ...overrides,
  };
}

describe("synthesizeColumnFacts (dbLoader column-fact synthesis)", () => {
  it("synthesizes a header fact for every populated Shipment column, skipping nulls", () => {
    const facts = synthesizeColumnFacts(
      baseShipment({ entryType: "01", portOfEntry: "2704", transportMode: null, countryOfExport: "CN" }),
      []
    );
    const byField = Object.fromEntries(facts.map((f) => [f.field, f]));

    expect(Object.keys(byField).sort()).toEqual(["entryType", "exportingCountry", "portOfEntry"]);
    expect(byField.entryType.value).toBe("01");
    expect(byField.portOfEntry.value).toBe("2704");
    expect(byField.exportingCountry.value).toBe("CN");
    for (const f of facts) {
      expect(f.entityRef).toBeNull();
      expect(f.sourceType).toBe("EXTRACTED");
      expect(f.confidence).toBe(SYNTHESIZED_FACT_CONFIDENCE);
      expect(f.documentId).toBeNull();
    }
  });

  it("synthesizes a line fact for every populated ShipmentLineItem column, skipping nulls", () => {
    const facts = synthesizeColumnFacts(
      baseShipment(),
      [
        baseLine({
          lineNumber: 3,
          description: "Valve",
          htsCode: "8481.80.5090",
          countryOfOrigin: "CN",
          quantity: 10,
          totalValue: 1000,
        }),
      ]
    );
    const byField = Object.fromEntries(facts.map((f) => [f.field, f]));

    expect(Object.keys(byField).sort()).toEqual(["countryOfOrigin", "description", "enteredValue", "htsCode", "netQuantity"]);
    expect(byField.description.value).toBe("Valve");
    expect(byField.htsCode.value).toBe("8481.80.5090");
    expect(byField.countryOfOrigin.value).toBe("CN");
    expect(byField.netQuantity.value).toBe("10");
    expect(byField.enteredValue.value).toBe("1000");
    for (const f of facts) {
      expect(f.entityRef).toBe("line:3");
    }
  });

  it("skips null, undefined, and empty-string column values entirely", () => {
    const facts = synthesizeColumnFacts(baseShipment(), [
      baseLine({ description: "", htsCode: null, countryOfOrigin: undefined as unknown as null, quantity: null, totalValue: null }),
    ]);
    expect(facts).toHaveLength(0);
  });

  it("assigns a stable, content-addressed id per column so re-synthesizing the same row twice is identical", () => {
    const line = baseLine({ description: "Valve", htsCode: "8481.80.5090" });
    const first = synthesizeColumnFacts(baseShipment(), [line]);
    const second = synthesizeColumnFacts(baseShipment(), [line]);
    expect(first).toEqual(second);
    const descFact = first.find((f) => f.field === "description")!;
    expect(descFact.id).toBe("col:shipmentLineItem:li_1:description");
  });

  it("uses a fixed epoch createdAt, never the real row's createdAt, so a genuine Fact always outranks it on recency", () => {
    const facts = synthesizeColumnFacts(baseShipment(), [baseLine({ description: "Valve" })]);
    expect(new Date(facts[0]!.createdAt).getTime()).toBe(0);
  });

  it("produces zero facts for a shipment and line item with every relevant column null", () => {
    const facts = synthesizeColumnFacts(baseShipment(), [baseLine()]);
    expect(facts).toHaveLength(0);
  });

  it("handles multiple line items independently, each with its own entityRef", () => {
    const facts = synthesizeColumnFacts(baseShipment(), [
      baseLine({ id: "li_1", lineNumber: 1, description: "Line one" }),
      baseLine({ id: "li_2", lineNumber: 2, description: "Line two" }),
    ]);
    const line1 = facts.find((f) => f.entityRef === "line:1");
    const line2 = facts.find((f) => f.entityRef === "line:2");
    expect(line1?.value).toBe("Line one");
    expect(line2?.value).toBe("Line two");
  });
});
