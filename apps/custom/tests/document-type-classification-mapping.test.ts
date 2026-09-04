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
  ];

  it.each(cases)("maps %s to %s", (raw, expected) => {
    expect(mapToDocumentType(raw)).toBe(expected);
  });

  it("does not misclassify a carrier invoice as a commercial invoice", () => {
    expect(mapToDocumentType("Freight Invoice")).toBe("CARRIER_INVOICE");
  });

  it("falls back to OTHER for unrecognized text", () => {
    expect(mapToDocumentType("Some Random Document")).toBe("OTHER");
  });
});
