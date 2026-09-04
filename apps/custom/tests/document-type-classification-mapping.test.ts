import { describe, it, expect } from "vitest";
import { mapToDocumentType } from "@/lib/documents/classificationMapping";
import type { DocumentType } from "@prisma/client";

describe("mapToDocumentType", () => {
  const cases: Array<[string, DocumentType]> = [
    ["Commercial Invoice", "COMMERCIAL_INVOICE"],
    ["Packing List", "PACKING_LIST"],
    ["Bill of Lading", "BILL_OF_LADING"],
    ["Air Waybill", "AIR_WAYBILL"],
    ["Certificate of Origin", "CERTIFICATE_OF_ORIGIN"],
    ["Phytosanitary Certificate", "PHYTOSANITARY_CERTIFICATE"],
    ["Fumigation Certificate", "FUMIGATION_CERTIFICATE"],
    ["Customs Bond", "CUSTOMS_BOND"],
    ["Power of Attorney", "POWER_OF_ATTORNEY"],
    ["Entry Summary", "ENTRY_SUMMARY"],
    ["Importer Security Filing", "ISF"],
    ["Proof of Delivery", "PROOF_OF_DELIVERY"],
    ["Carrier Invoice", "CARRIER_INVOICE"],
    ["Forwarding Instruction", "FORWARDING_INSTRUCTION"],
    ["Booking Request", "BOOKING_REQUEST"],
    ["Arrival Notice", "ARRIVAL_NOTICE"],
    ["Purchase Order", "PURCHASE_ORDER"],
    ["Delivery Note", "DELIVERY_NOTE"],
    ["Shipping Instruction", "SHIPPING_INSTRUCTION"],
    ["CMR Consignment Note", "CMR"],
    ["Sea Waybill", "SEA_WAYBILL"],
    ["Bill of Entry", "CUSTOMS_ENTRY"],
    ["EUR.1 Movement Certificate", "EUR1_CERTIFICATE"],
    ["A.TR Certificate", "ATR_CERTIFICATE"],
    ["Export Declaration", "EXPORT_DECLARATION"],
    ["Import Declaration", "IMPORT_DECLARATION"],
  ];

  it.each(cases)("maps %s to %s", (raw, expected) => {
    expect(mapToDocumentType(raw)).toBe(expected);
  });

  it("does not misclassify a carrier invoice as a commercial invoice", () => {
    expect(mapToDocumentType("Freight Invoice")).toBe("CARRIER_INVOICE");
  });

  it("does not misclassify an entry summary as a general customs entry", () => {
    // "Entry Summary" (CBP Form 7501) must win over the broader CUSTOMS_ENTRY
    // matcher even though "entry" is common to both labels.
    expect(mapToDocumentType("CBP Form 7501 Entry Summary")).toBe("ENTRY_SUMMARY");
  });

  it("distinguishes Forwarding Instruction from Shipping Instruction", () => {
    expect(mapToDocumentType("Forwarding Instruction")).toBe("FORWARDING_INSTRUCTION");
    expect(mapToDocumentType("Shipping Instruction")).toBe("SHIPPING_INSTRUCTION");
  });

  it("distinguishes Sea Waybill from Air Waybill", () => {
    expect(mapToDocumentType("Sea Waybill")).toBe("SEA_WAYBILL");
    expect(mapToDocumentType("Air Waybill")).toBe("AIR_WAYBILL");
  });

  it("falls back to OTHER for unrecognized text", () => {
    expect(mapToDocumentType("Some Random Document")).toBe("OTHER");
  });
});
