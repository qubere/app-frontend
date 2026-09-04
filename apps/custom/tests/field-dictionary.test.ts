import { describe, it, expect } from "vitest";
import {
  canonicalizeFieldKey,
  resolveField,
  expectedFieldsForDocType,
  extractedValueFor,
  reconciliationFieldValues,
} from "@/lib/documents/fieldDictionary";

describe("field dictionary — alias resolution", () => {
  it("resolves every spelling of a field to one canonical id", () => {
    const forms = [
      "destinationCountry",
      "countryOfDestination",
      "shipment.destinationCountry",
      "Destination Country",
    ];
    const canon = forms.map((f) => canonicalizeFieldKey(f));
    expect(new Set(canon).size).toBe(1);
    expect(canon[0]).toBe("shipment.destinationCountry");
  });

  it("resolves the snake_case extraction-schema key to the same field as the camelCase one", () => {
    expect(canonicalizeFieldKey("bl_number")).toBe(canonicalizeFieldKey("transportDocumentNumber"));
    expect(canonicalizeFieldKey("port_of_discharge")).toBe(canonicalizeFieldKey("portOfDischarge"));
    expect(canonicalizeFieldKey("gross_weight")).toBe(canonicalizeFieldKey("totalWeight"));
  });

  it("returns null for an unknown key", () => {
    expect(canonicalizeFieldKey("not_a_real_field")).toBeNull();
    expect(canonicalizeFieldKey(undefined)).toBeNull();
  });

  it("marks port / vessel / voyage fields as document-scoped (annotation only)", () => {
    for (const k of ["portOfDischarge", "portOfLoading", "vesselName", "voyageNumber"]) {
      expect(resolveField(k)?.scope).toBe("document");
    }
  });
});

describe("field dictionary — per-doc-type checklists", () => {
  it("asks a Packing List for weight / carton fields, not Incoterm", () => {
    const labels = expectedFieldsForDocType("PACKING_LIST").map((f) => f.label);
    expect(labels).toContain("Gross Weight");
    expect(labels).not.toContain("Incoterm");
    expect(labels).not.toContain("Total Invoice Amount");
  });

  it("asks a Bill of Lading for vessel / ports / B-L number", () => {
    const labels = expectedFieldsForDocType("Bill of Lading").map((f) => f.label);
    expect(labels).toEqual(
      expect.arrayContaining(["Vessel Name", "Port of Loading", "Port of Discharge", "Bill of Lading Number"])
    );
  });

  it("never puts the line-item HTS field on a per-document checklist", () => {
    for (const dt of ["COMMERCIAL_INVOICE", "BILL_OF_LADING", "PACKING_LIST"]) {
      expect(expectedFieldsForDocType(dt).map((f) => f.label)).not.toContain("HTS Classification Code");
    }
  });
});

describe("field dictionary — value extraction", () => {
  it("computes total quantity from line items when the header scalar is absent", () => {
    const value = extractedValueFor(
      canonicalizeFieldKey("totalQuantity")!,
      {},
      [{ quantity: 12 }, { quantity: 8 }]
    );
    expect(value).toBe("20");
  });

  it("emits reconciliation-keyed rows the engine can compare on", () => {
    const rows = reconciliationFieldValues(
      { totalWeight: "500kg", currency: "USD" },
      [{ quantity: 10 }, { quantity: 10 }]
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.fieldName, r.value]));
    expect(byKey.totalQuantity).toBe("20");
    expect(byKey.grossWeight).toBe("500kg");
    expect(byKey.currency).toBe("USD");
  });
});
