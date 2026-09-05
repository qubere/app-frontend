import { describe, it, expect } from "vitest";
import {
  resolveField,
  tradeMetadataKeyFor,
  expectedFieldsForDocType,
} from "@/lib/documents/fieldDictionary";

describe("fieldInventory -- new document type fields (Delivery Note, Shipping Instruction, CMR, Sea Waybill, Arrival Notice, Customs Entry, EUR.1, A.TR)", () => {
  it("resolves a new tradeMetadataKey and its extractionSchemaKeys alias to the same dictionary field", () => {
    const byCamel = resolveField("cmrNumber");
    const bySnake = resolveField("cmr_number");
    expect(byCamel).not.toBeNull();
    expect(byCamel).toBe(bySnake);
    expect(byCamel?.tradeMetadataKey).toBe("cmrNumber");
  });

  it("round-trips a snake_case alias to its camelCase tradeMetadataKey for a representative field per new doc type", () => {
    expect(tradeMetadataKeyFor("delivery_note_number")).toBe("deliveryNoteNumber");
    expect(tradeMetadataKeyFor("instruction_number")).toBe("instructionNumber");
    expect(tradeMetadataKeyFor("sea_waybill_number")).toBe("seaWaybillNumber");
    expect(tradeMetadataKeyFor("arrival_notice_number")).toBe("arrivalNoticeNumber");
    expect(tradeMetadataKeyFor("filing_date")).toBe("filingDate");
    expect(tradeMetadataKeyFor("certificate_number")).toBe("certificateNumber");
    expect(tradeMetadataKeyFor("awb_number")).toBe("airWaybill");
  });

  it("includes the new fields in the per-document-type expected-field checklist", () => {
    const deliveryNoteFields = expectedFieldsForDocType("Delivery Note").map((f) => f.tradeMetadataKey);
    expect(deliveryNoteFields).toContain("deliveryNoteNumber");
    expect(deliveryNoteFields).toContain("receivedBy");

    const shippingInstructionFields = expectedFieldsForDocType("Shipping Instruction").map((f) => f.tradeMetadataKey);
    expect(shippingInstructionFields).toContain("instructionNumber");
    expect(shippingInstructionFields).toContain("bookingNumber");

    const cmrFields = expectedFieldsForDocType("CMR Consignment Note").map((f) => f.tradeMetadataKey);
    expect(cmrFields).toContain("cmrNumber");
    expect(cmrFields).toContain("vehicleRegistration");

    const seaWaybillFields = expectedFieldsForDocType("Sea Waybill").map((f) => f.tradeMetadataKey);
    expect(seaWaybillFields).toContain("seaWaybillNumber");

    const arrivalNoticeFields = expectedFieldsForDocType("Arrival Notice").map((f) => f.tradeMetadataKey);
    expect(arrivalNoticeFields).toContain("arrivalNoticeNumber");
    expect(arrivalNoticeFields).toContain("releaseStatus");

    const customsEntryFields = expectedFieldsForDocType("Customs Entry").map((f) => f.tradeMetadataKey);
    expect(customsEntryFields).toContain("entryNumber");
    expect(customsEntryFields).toContain("totalDuty");

    const eur1Fields = expectedFieldsForDocType("EUR.1 Certificate").map((f) => f.tradeMetadataKey);
    expect(eur1Fields).toContain("certificateNumber");

    const atrFields = expectedFieldsForDocType("A.TR Certificate").map((f) => f.tradeMetadataKey);
    expect(atrFields).toContain("customsEndorsement");
  });

  it("does not duplicate fields already covered by an existing shared field (exporter/consignee/carrier/gross weight/B-L reference)", () => {
    // These snake_case names already resolve to a pre-existing shared field --
    // adding a new field for them would have been redundant.
    expect(resolveField("shipper_name")?.tradeMetadataKey).toBe("exporterName");
    expect(resolveField("consignee_name")?.tradeMetadataKey).toBe("importerName");
    expect(resolveField("carrier_name")?.tradeMetadataKey).toBe("carrier");
    expect(resolveField("gross_weight")?.tradeMetadataKey).toBe("totalWeight");
    expect(resolveField("bol_or_awb_reference")?.tradeMetadataKey).toBe("transportDocumentNumber");
  });
});
