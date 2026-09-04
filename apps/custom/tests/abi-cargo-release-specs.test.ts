/**
 * CATAIR ACE Cargo Release (SE) Chapter Scope Note & Field Specification Tests
 * Source PDF: docs/plans/catair-source-docs/04-cargo-release-implementation-guide-v40.pdf (July 1, 2025 - Version 40)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CATAIR CARGO RELEASE (SE) CHAPTER SCOPE NOTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Scoped IN (Mandatory Backbone & Core Commercial Extensions):
 *   1. SE10 - SE Header (Input/Output, Mandatory): Primary transaction header.
 *      [Pos 1-80: 4(SE10) + 1(action) + 3(filer) + 2(filler) + 8(entry#) + 1(filler) + 2(type) + 3(impType) + 12(imp#) + 2(mot) + 1(bond) + 10(val) + 5(port) + 1(split) + 5(unlading) + 20(filler) = 80]
 *   2. SE11 - SE Additional Header (Input/Output, Conditional): Additional header fields for Weekly FTZ, Location of Goods, FIRMS, manifest, GO#.
 *      [Pos 1-80: 4(SE11) + 1(electionCode) + 6(electedDate) + 4(locGoodsFirms) + 4(examSiteFirms) + 20(convFtzId) + 5(manifest#) + 20(go#) + 4(whseFirms) + 3(origFiler) + 8(origEntry#) + 1(idInd) = 80]
 *   3. SE13 - Contact / Correction / Cancellation (Input/Output, Mandatory for A, R, D): Filer contact info & cancellation codes.
 *      [Pos 1-80: 4(SE13) + 40(contactName) + 15(phone) + 2(reasonCode) + 1(multDisp) + 1(disInd) + 1(splitInd) + 16(filler) = 80]
 *   4. SE15 - Bill of Lading Information (Input/Output, Conditional): Master/House/Simple bill data and internal 5S filler.
 *      [Pos 1-80: 4(SE15) + 1(billType) + 4(issuer) + 50(bill#) + 8(qty) + 5(filler) + 1(nonAmsInd) + 7(filler) = 80]
 *   5. SE16 - Conveyance Information (Input/Output, Conditional): Carrier SCAC, voyage/flight, date of arrival, split qty.
 *      [Pos 1-80: 4(SE16) + 4(carrier) + 5(voyage#) + 6(arrDate) + 8(qty) + 5(uom) + 20(convName) + 28(filler) = 80]
 *   6. SE20 - Reference Information (Input/Output, Conditional): Reference qualifiers and values.
 *      [Pos 1-80: 4(SE20) + 3(qualifier) + 50(referenceId) + 23(filler) = 80]
 *   7. SE30 - Header Entity (Input/Output, Conditional): Trade party code, name, identifier.
 *      [Pos 1-80: 4(SE30) + 3(entityCode) + 35(name) + 3(idQualifier) + 20(entityId) + 15(filler) = 80]
 *   8. SE35 - Header Entity Address (Input/Output, Conditional): Parsed street address lines 1 & 2.
 *      [Pos 1-80: 4(SE35) + 2(qual1) + 35(addr1) + 2(qual2) + 35(addr2) + 2(filler) = 80]
 *   9. SE36 - Header Entity Geo (Input/Output, Conditional): City name, country sub-entity, internal 6S filler, postal code, ISO country code.
 *      [Pos 1-80: 4(SE36) + 35(city) + 3(state) + 6(filler) + 15(postal) + 2(country) + 15(filler) = 80]
 *  10. SE40 - Line Item (Input/Output, Conditional): Line item sequence identifier, ISO country of origin, internal 1S filler, commercial description.
 *      [Pos 1-80: 4(SE40) + 3(line#) + 2(country) + 1(filler) + 70(desc) = 80]
 *  11. SE50 - Line Entity (Input/Output, Conditional): Line-level trade party name and identifier.
 *      [Pos 1-80: 4(SE50) + 3(entityCode) + 35(name) + 3(idQualifier) + 20(entityId) + 15(filler) = 80]
 *  12. SE55 - Line Entity Address (Input/Output, Conditional): Line-level parsed street address.
 *      [Pos 1-80: 4(SE55) + 2(qual1) + 35(addr1) + 2(qual2) + 35(addr2) + 2(filler) = 80]
 *  13. SE56 - Line Entity Geo (Input/Output, Conditional): Line-level city, state, internal 6S filler, postal code, ISO country code.
 *      [Pos 1-80: 4(SE56) + 35(city) + 3(state) + 6(filler) + 15(postal) + 2(country) + 15(filler) = 80]
 *  14. SE60 - HTS Line (Input/Output, Conditional): 10-digit HTS classification and whole dollar line value.
 *      [Pos 1-80: 4(SE60) + 10(hts#) + 10(value) + 56(filler) = 80]
 *  15. SE90 - Output Disposition (Output, Mandatory): Output message type, condition code, narrative.
 *      [Pos 1-80: 4(SE90) + 2(msgType) + 3(msgId) + 40(narrative) + 31(filler) = 80]
 *
 * Implementation notes (post-audit): field positions below were independently
 * re-verified against the raw PDF twice (see docs/plans/ABI-CERTIFICATION-READINESS.md
 * history) — including a spot-check of SE10 against a second, independent PDF
 * extraction. Two correctness fixes applied beyond the raw CATAIR "N" class
 * during implementation: `estimatedEntryValue`/`lineItemValue` are whole-dollar
 * money fields, bound to `Decimal` (not a raw JS number) per this codebase's
 * established money-handling convention; `lineItemIdentifier` (a 3-char
 * sequential identifier like "001") preserves leading zeros as a string via
 * `numericCodeField`, since a plain class-N decode would silently return the
 * number 1 instead of "001" — the same leading-zero bug found and fixed in
 * Entry Summary Query's JF-Record and Entry Summary Create/Update's 89-Record.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from "vitest";
import {
  SE10_HEADER_SPEC,
  SE11_ADDITIONAL_HEADER_SPEC,
  SE13_CONTACT_CANCEL_SPEC,
  SE15_BILL_OF_LADING_SPEC,
  SE16_CONVEYANCE_SPEC,
  SE20_REFERENCE_SPEC,
  SE30_HEADER_ENTITY_SPEC,
  SE35_HEADER_ENTITY_ADDRESS_SPEC,
  SE36_HEADER_ENTITY_GEO_SPEC,
  SE40_LINE_ITEM_SPEC,
  SE50_LINE_ENTITY_SPEC,
  SE55_LINE_ENTITY_ADDRESS_SPEC,
  SE56_LINE_ENTITY_GEO_SPEC,
  SE60_HTS_LINE_SPEC,
  SE90_OUTPUT_DISPOSITION_SPEC,
} from "@/lib/abi/cargoRelease/recordSpecs";

const ALL_CARGO_RELEASE_SPECS = [
  SE10_HEADER_SPEC,
  SE11_ADDITIONAL_HEADER_SPEC,
  SE13_CONTACT_CANCEL_SPEC,
  SE15_BILL_OF_LADING_SPEC,
  SE16_CONVEYANCE_SPEC,
  SE20_REFERENCE_SPEC,
  SE30_HEADER_ENTITY_SPEC,
  SE35_HEADER_ENTITY_ADDRESS_SPEC,
  SE36_HEADER_ENTITY_GEO_SPEC,
  SE40_LINE_ITEM_SPEC,
  SE50_LINE_ENTITY_SPEC,
  SE55_LINE_ENTITY_ADDRESS_SPEC,
  SE56_LINE_ENTITY_GEO_SPEC,
  SE60_HTS_LINE_SPEC,
  SE90_OUTPUT_DISPOSITION_SPEC,
];

describe("Cargo Release Record Specs — 80-Column Layout Validation", () => {
  it.each(ALL_CARGO_RELEASE_SPECS.map((spec) => [spec.recordType, spec] as const))(
    "%s has length 80 and field lengths sum to exactly 80",
    (_recordType, spec) => {
      expect(spec.length).toBe(80);
      const totalFieldLength = spec.fields.reduce((sum, f) => sum + f.length, 0);
      expect(totalFieldLength).toBe(80);
    }
  );

  it.each(ALL_CARGO_RELEASE_SPECS.map((spec) => [spec.recordType, spec] as const))(
    "%s has contiguous 1-indexed field position ranges",
    (_recordType, spec) => {
      let expectedStart = 1;
      for (const field of spec.fields) {
        expect(field.start).toBe(expectedStart);
        expectedStart += field.length;
      }
      expect(expectedStart - 1).toBe(80);
    }
  );
});

describe("SE10 Header Record Spec — Re-verified Field Positions", () => {
  it("matches PDF 04 p. 33-34 stated positions exactly (including internal fillers at 9-10 and 19)", () => {
    const fields = Object.fromEntries(
      SE10_HEADER_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.actionCode).toMatchObject({ start: 5, length: 1, class: "A", designation: "M" });
    expect(fields.entryFilerCode).toMatchObject({ start: 6, length: 3, class: "AN", designation: "M" });
    expect(fields.filler_9).toMatchObject({ start: 9, length: 2, class: "S", designation: "M" });
    expect(fields.entryNumber).toMatchObject({ start: 11, length: 8, class: "AN", designation: "M" });
    expect(fields.filler_19).toMatchObject({ start: 19, length: 1, class: "S", designation: "M" });
    expect(fields.entryTypeCode).toMatchObject({ start: 20, length: 2, class: "AN", designation: "M" });
    expect(fields.importerOfRecordType).toMatchObject({ start: 22, length: 3, class: "AN", designation: "C" });
    expect(fields.importerOfRecordNumber).toMatchObject({ start: 25, length: 12, class: "X", designation: "C" });
    expect(fields.modeOfTransportationCode).toMatchObject({ start: 37, length: 2, class: "AN", designation: "C" });
    expect(fields.bondTypeCode).toMatchObject({ start: 39, length: 1, class: "N", designation: "M" });
    expect(fields.estimatedEntryValue).toMatchObject({ start: 40, length: 10, class: "SN", designation: "M" });
    expect(fields.plannedPortOfEntry).toMatchObject({ start: 50, length: 5, class: "AN", designation: "C" });
    expect(fields.splitShipmentReleaseCode).toMatchObject({ start: 55, length: 1, class: "AN", designation: "O" });
    expect(fields.portOfUnlading).toMatchObject({ start: 56, length: 5, class: "AN", designation: "C" });
    expect(fields.filler_61).toMatchObject({ start: 61, length: 20, class: "S", designation: "M" });
  });
});

describe("SE15 Bill of Lading Record Spec — Internal Filler Verification", () => {
  it("matches PDF 04 p. 46-47 stated positions exactly (including internal 5S filler at 68-72)", () => {
    const fields = Object.fromEntries(
      SE15_BILL_OF_LADING_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.billTypeIndicator).toMatchObject({ start: 5, length: 1, class: "A", designation: "M" });
    expect(fields.issuerCodeOfBillOfLadingNumber).toMatchObject({ start: 6, length: 4, class: "AN", designation: "C" });
    expect(fields.billOfLadingNumber).toMatchObject({ start: 10, length: 50, class: "X", designation: "M" });
    expect(fields.quantity).toMatchObject({ start: 60, length: 8, class: "N", designation: "C" });
    expect(fields.filler_68).toMatchObject({ start: 68, length: 5, class: "S", designation: "M" });
    expect(fields.nonAmsIndicator).toMatchObject({ start: 73, length: 1, class: "X", designation: "M" });
    expect(fields.filler_74).toMatchObject({ start: 74, length: 7, class: "S", designation: "M" });
  });
});

describe("SE36 & SE56 Entity Geographic Area Spec — Internal Filler Verification", () => {
  it("matches PDF 04 p. 63 & p. 72 stated positions exactly (including internal 6S filler at 43-48)", () => {
    const fields36 = Object.fromEntries(
      SE36_HEADER_ENTITY_GEO_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields36.cityName).toMatchObject({ start: 5, length: 35, class: "X", designation: "M" });
    expect(fields36.countrySubEntityCode).toMatchObject({ start: 40, length: 3, class: "AN", designation: "O" });
    expect(fields36.filler_43).toMatchObject({ start: 43, length: 6, class: "S", designation: "M" });
    expect(fields36.postalCode).toMatchObject({ start: 49, length: 15, class: "X", designation: "C" });
    expect(fields36.countryCode).toMatchObject({ start: 64, length: 2, class: "A", designation: "M" });
    expect(fields36.filler_66).toMatchObject({ start: 66, length: 15, class: "S", designation: "M" });

    const fields56 = Object.fromEntries(
      SE56_LINE_ENTITY_GEO_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields56.cityName).toMatchObject({ start: 5, length: 35, class: "X", designation: "M" });
    expect(fields56.countrySubEntityCode).toMatchObject({ start: 40, length: 3, class: "AN", designation: "O" });
    expect(fields56.filler_43).toMatchObject({ start: 43, length: 6, class: "S", designation: "M" });
    expect(fields56.postalCode).toMatchObject({ start: 49, length: 15, class: "X", designation: "C" });
    expect(fields56.countryCode).toMatchObject({ start: 64, length: 2, class: "A", designation: "M" });
    expect(fields56.filler_66).toMatchObject({ start: 66, length: 15, class: "S", designation: "M" });
  });
});

describe("SE40 Line Item Spec — Internal Filler Verification", () => {
  it("matches PDF 04 p. 64 stated positions exactly (including internal 1S filler at 10)", () => {
    const fields = Object.fromEntries(
      SE40_LINE_ITEM_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.lineItemIdentifier).toMatchObject({ start: 5, length: 3, class: "N", designation: "M" });
    expect(fields.countryOfOrigin).toMatchObject({ start: 8, length: 2, class: "A", designation: "M" });
    expect(fields.filler_10).toMatchObject({ start: 10, length: 1, class: "S", designation: "M" });
    expect(fields.commercialInvoiceDescription).toMatchObject({ start: 11, length: 70, class: "X", designation: "O" });
  });
});
