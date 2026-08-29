import { describe, it, expect } from "vitest";
import { inferShipmentLegs, type DocumentInput, type ShipmentInput } from "./inferLegs";
import { inferLegDocuments, matchDocumentToSlot } from "./inferLegDocuments";
import { generateDiffProposal, type ExistingLegSnapshot } from "./diffProposal";

const baseShipment: ShipmentInput = {
  id: "shp_1",
  shipmentNumber: "SHP-1",
  transportMode: "Ocean",
  countryOfExport: "CN",
  countryOfOrigin: "CN",
  destinationCountry: "US",
  portOfEntry: "USLAX",
  incoterm: "FOB",
};

const doc = (over: Partial<DocumentInput>): DocumentInput => ({
  id: `doc_${Math.round(Math.random() * 1e9)}`,
  docType: "",
  documentType: null,
  fileName: "",
  extractedJson: null,
  ...over,
});

describe("inferShipmentLegs", () => {
  it("builds export-haulage → main-carriage → import-haulage for a typical ocean import", () => {
    const res = inferShipmentLegs(baseShipment, [
      doc({ docType: "House Bill of Lading", documentType: "BILL_OF_LADING", fileName: "hbl.pdf" }),
      doc({ docType: "Master Bill of Lading", documentType: "BILL_OF_LADING", fileName: "mbl.pdf" }),
      doc({ docType: "Arrival Notice", fileName: "arrival-notice.pdf" }),
    ]);
    expect(res.legs.map((l) => l.legType)).toEqual(["EXPORT_HAULAGE", "MAIN_CARRIAGE", "IMPORT_HAULAGE"]);
    expect(res.legs.map((l) => l.sequence)).toEqual([1, 2, 3]);
    // shared-stop chain: each leg starts where the previous ended
    for (let i = 1; i < res.legs.length; i++) {
      expect(res.legs[i].originName).toBe(res.legs[i - 1].destinationName);
    }
  });

  it("splits the main carriage into MAIN_CARRIAGE + TRANSSHIPMENT when the MBL routes via a hub", () => {
    const res = inferShipmentLegs({ ...baseShipment, countryOfExport: null, countryOfOrigin: null, destinationCountry: null }, [
      doc({
        docType: "Master Bill of Lading",
        documentType: "BILL_OF_LADING",
        fileName: "mbl.pdf",
        extractedJson: JSON.stringify({ routing: "YANTIAN via BUSAN to LOS ANGELES" }),
      }),
    ]);
    expect(res.legs.map((l) => l.legType)).toEqual(["MAIN_CARRIAGE", "TRANSSHIPMENT"]);
    expect(res.legs.every((l) => l.needsConfirmation)).toBe(true);
    // the two segments share the hub stop
    expect(res.legs[0].destinationName).toBe(res.legs[1].originName);
  });

  it("detects AIR mode from an air waybill", () => {
    const res = inferShipmentLegs(
      { ...baseShipment, transportMode: null },
      [doc({ documentType: "AIR_WAYBILL", docType: "Master Air Waybill", fileName: "mawb.pdf" })]
    );
    expect(res.legs.find((l) => l.legType === "MAIN_CARRIAGE")?.mode).toBe("AIR");
  });

  it("falls back to one low-confidence main-carriage leg with no transport documents", () => {
    const res = inferShipmentLegs({ id: "s", shipmentNumber: "S", transportMode: "Ocean" }, []);
    const main = res.legs.find((l) => l.legType === "MAIN_CARRIAGE")!;
    expect(main.needsConfirmation).toBe(true);
    expect(main.confidence).toBeLessThan(0.7);
    expect(main.vesselName).toBeNull();
  });

  it("threads MBL / HBL / booking numbers from tracking identifiers", () => {
    const res = inferShipmentLegs(
      baseShipment,
      [doc({ documentType: "BILL_OF_LADING", docType: "Master Bill of Lading", fileName: "mbl.pdf" })],
      [
        { type: "MBL", value: "COSU777" },
        { type: "HBL", value: "HSE111" },
        { type: "BOOKING", value: "BK999" },
      ]
    );
    const main = res.legs.find((l) => l.legType === "MAIN_CARRIAGE")!;
    expect(main.billOfLadingNumber).toBe("COSU777");
    expect(main.billOfLadingType).toBe("MASTER");
    expect(res.legs[0].billOfLadingNumber).toBe("HSE111"); // export haulage rides the house bill
  });

  it("produces a stable inputsHash that changes only when the inputs change", () => {
    const docs = [doc({ id: "d1", documentType: "BILL_OF_LADING", docType: "MBL", fileName: "mbl.pdf" })];
    const a = inferShipmentLegs(baseShipment, docs);
    const b = inferShipmentLegs(baseShipment, [...docs]);
    expect(a.inputsHash).toBe(b.inputsHash);

    const c = inferShipmentLegs(baseShipment, [
      ...docs,
      doc({ id: "d2", docType: "Arrival Notice", fileName: "an.pdf" }),
    ]);
    expect(c.inputsHash).not.toBe(a.inputsHash);
  });
});

describe("inferLegDocuments", () => {
  it("gives IMPORT_HAULAGE three distinct slots even though all map to DocumentType.OTHER", () => {
    const { slots } = inferLegDocuments("IMPORT_HAULAGE", "TRUCK", { isUsImport: true });
    const keys = slots.map((s) => s.slotKey);
    expect(keys).toContain("ARRIVAL_NOTICE");
    expect(keys).toContain("DELIVERY_ORDER");
    expect(keys).toContain("CBP_RELEASE");
    // slotKey uniqueness — this is the regression guard for @@unique([legId, slotKey])
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("requires MBL + ISF on a US ocean main carriage, MAWB on air", () => {
    const ocean = inferLegDocuments("MAIN_CARRIAGE", "OCEAN", { isUsImport: true }).slots.map((s) => s.slotKey);
    expect(ocean).toEqual(expect.arrayContaining(["MBL", "ISF_10_2"]));
    const air = inferLegDocuments("MAIN_CARRIAGE", "AIR", { isUsImport: true }).slots.map((s) => s.slotKey);
    expect(air).toContain("MAWB");
    expect(air).not.toContain("ISF_10_2");
  });

  it("adds a certificate-of-origin slot when a preference claim is present", () => {
    const withClaim = inferLegDocuments("MAIN_CARRIAGE", "OCEAN", { hasPreferenceClaim: true }).slots.map((s) => s.slotKey);
    expect(withClaim).toContain("CERT_OF_ORIGIN");
  });

  it("adds an optional POD slot only on the final leg", () => {
    expect(inferLegDocuments("IMPORT_HAULAGE", "TRUCK", { isFinalLeg: false }).slots.map((s) => s.slotKey)).not.toContain("POD");
    expect(inferLegDocuments("IMPORT_HAULAGE", "TRUCK", { isFinalLeg: true }).slots.map((s) => s.slotKey)).toContain("POD");
  });
});

describe("matchDocumentToSlot", () => {
  const catalog = inferLegDocuments("IMPORT_HAULAGE", "TRUCK", { isUsImport: true, isFinalLeg: true }).slots;

  it("matches by filename keyword", () => {
    expect(matchDocumentToSlot({ fileName: "ARRIVAL NOTICE 8821.pdf" }, catalog)).toBe("ARRIVAL_NOTICE");
    expect(matchDocumentToSlot({ fileName: "delivery order.pdf" }, catalog)).toBe("DELIVERY_ORDER");
  });

  it("matches by document type", () => {
    expect(matchDocumentToSlot({ documentType: "ENTRY_SUMMARY" }, catalog)).toBe("CBP_RELEASE");
    expect(matchDocumentToSlot({ documentType: "PROOF_OF_DELIVERY" }, catalog)).toBe("POD");
  });

  it("returns null when nothing matches", () => {
    expect(matchDocumentToSlot({ fileName: "random-notes.txt", documentType: "OTHER" }, catalog)).toBeNull();
  });
});

describe("generateDiffProposal", () => {
  const inference = inferShipmentLegs(baseShipment, [
    doc({ documentType: "BILL_OF_LADING", docType: "MBL", fileName: "mbl.pdf" }),
    doc({ docType: "Arrival Notice", fileName: "an.pdf" }),
  ]);

  it("proposes an ADD for every leg when the shipment has none", () => {
    const p = generateDiffProposal("shp_1", "2026-08-29T00:00:00Z", [], inference);
    expect(p.hasChanges).toBe(true);
    expect(p.changes.every((c) => c.type === "ADD")).toBe(true);
    expect(p.changes).toHaveLength(inference.legs.length);
  });

  it("never rewrites a leg that already has tracking actuals", () => {
    const frozen: ExistingLegSnapshot[] = inference.legs.map((l, i) => ({
      id: `leg_${i}`,
      sequence: l.sequence,
      legType: l.legType,
      mode: l.mode,
      originName: l.originName,
      destinationName: l.destinationName,
      confirmedAt: new Date(),
      actualDeparture: i === 0 ? new Date() : null,
      actualArrival: null,
    }));
    const p = generateDiffProposal("shp_1", "2026-08-29T00:00:00Z", frozen, inference);
    expect(p.changes.some((c) => c.type === "REMOVE" || c.type === "UPDATE")).toBe(false);
  });
});
