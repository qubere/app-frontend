/**
 * CATAIR Drawback (TFTEA / Core Drawback) Chapter Scope Note & Field Specification Tests
 * Source Document: docs/plans/catair-source-docs/07-drawback-tftea-v27.pdf
 * (Pub # 0875-0419, June 24, 2025 - Revision 27)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CATAIR DRAWBACK (TFTEA / CORE DRAWBACK) CHAPTER SCOPE NOTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Scope Overview & Architectural Pattern:
 * The Drawback interface allows automated transmission and management of Drawback Entry Summaries
 * under TFTEA (Trade Facilitation and Trade Enforcement Act) and Core Drawback rules between Filers
 * and CBP in ACE via Application Identifier 'DD' (Input Submission) and 'JC' (Output Response).
 * Following the mandatory backbone pattern, this chapter scopes in the complete set of 23 input and output
 * record types across entry summary header, bond details, import entry details, classifications, quantities,
 * revenue claimed, manufacturing/produced article groupings, export/destroy groupings, notice of intent,
 * NAFTA/USMCA coding, TFTEA export/destroy groupings, revenue totals, and output disposition responses.
 *
 * NOTE ON INTERNAL FILLER GAPS vs TRAILING FILLERS:
 * - Record 10 (Header): Contains internal filler gaps at pos 7-8 (2S), pos 17 (1S), pos 31-33 (3S), and trailing filler at pos 79-80 (2S).
 * - Record 31 (Bond): Contains internal filler gap at pos 5 (1S) and trailing filler at pos 29-80 (52S).
 * - Record 40 (Import Details): Contains internal filler gaps at pos 4-5 (2S), pos 9-10 (2S), pos 35-36 (2AN), and trailing filler at pos 58-80 (23S).
 * - Record 50 (Manufactured Article Grouping): Contains internal filler gap at pos 14-15 (2S). No trailing filler (Factory Location runs to pos 80).
 * - Record 62 (Notice of Intent): No internal gaps; trailing filler at pos 39-80 (42S).
 * - Record 64 (NAFTA Coding): No internal or trailing filler gaps — fields run contiguously pos 1-80.
 * - Record 89 (Revenue Class Totals): Contains internal filler gaps at pos 17-18 (2S), pos 33-34 (2S), pos 49-50 (2S), and trailing filler at pos 65-80 (16S).
 * - Record 90 (Revenue Grand Totals): Contains internal filler gaps at pos 14 (1S), pos 26 (1S), and trailing filler at pos 38-80 (43S).
 * - Output E0 (Condition Reference): Contains internal filler gaps at pos 3 (1S), pos 10 (1S), pos 17 (1S), and pos 25 (1S).
 * - Output E1 (Condition/Disposition Response): Contains internal filler gaps at pos 54-55 (2S) and pos 78-80 (3S).
 *
 * Scoped IN Records (Complete Backbone — 21 Input Records + 2 Output Records):
 *   1. Record 10 - Drawback Entry Summary Header (Input, Mandatory):
 *      [Pos 1-80: 2(10) + 1(action) + 3(filer) + 2(filler) + 8(entry#) + 1(filler) + 4(port) + 9(brokerRef) + 3(filler) + 2(prov) + 1(bondWaiver) + 3(bondReason) + 1(accel) + 1(otw) + 1(wpn) + 1(cid) + 1(petro) + 1(mfgPetro) + 1(oilSpill) + 1(nafta) + 1(sig) + 12(claimant) + 12(notify) + 1(wine) + 1(bom) + 1(val) + 1(usmca) + 1(retail) + 1(superfund) + 2(filler) = 80]
 *   2. Record 31 - Bond Information (Input, Conditional):
 *      [Pos 1-80: 2(31) + 1(type) + 1(desig) + 1(filler) + 3(surety) + 10(stbAmt) + 10(stbNum) + 52(filler) = 80]
 *   3. Record 40 - Imports Entry Summary Details (Input, Conditional):
 *      [Pos 1-80: 2(40) + 1(action) + 2(filler) + 3(filer) + 2(filler) + 8(entry#) + 5(line#) + 1(elig) + 10(ruling) + 2(filler) + 2(basis) + 6(dateRec) + 6(dateUsed) + 5(itin) + 2(acctMethod) + 23(filler) = 80]
 *   4. Record 41 - Import Classification (Input, Conditional):
 *      [Pos 1-80: 2(41) + 10(hts#) + 50(desc) + 18(filler) = 80]
 *   5. Record 42 - Import Quantity & UOM (Input, Conditional):
 *      [Pos 1-80: 2(42) + 16(qty) + 3(uom) + 16(allowQty) + 16(enteredValue) + 16(substValue) + 11(filler) = 80]
 *   6. Record 43 - Import Revenue Claimed (Input, Conditional):
 *      [Pos 1-80: 2(43) + 3(classCode) + 8(claimAmt) + 8(calcAmt) + 8(adjAmt) + 2(qualifier) + 49(filler) = 80]
 *   7. Record 50 - Manufactured/Produced Article Grouping (Input, Conditional):
 *      [Pos 1-80: 2(50) + 1(action) + 10(importMfgRuling) + 2(filler) + 10(hts#) + 16(qty) + 3(uom) + 6(prodDate) + 30(factoryLocation) = 80]
 *   8. Record 51 - Manufactured/Produced Article Description (Input, Conditional):
 *      [Pos 1-80: 2(51) + 50(desc) + 10(mfgRuling) + 5(mtin) + 13(filler) = 80]
 *   9. Record 52 - Linking Import to Manufactured/Produced Article (Input, Conditional):
 *      [Pos 1-80: 2(52) + 15x5(itin1..15) + 3(filler) = 80]
 *  10. Record 53 - Linking Manufactured/Produced Articles to Source Manufactured Articles (Input, Conditional):
 *      [Pos 1-80: 2(53) + 15x5(mtin1..15) + 3(filler) = 80]
 *  11. Record 60 - Export/Destroy Articles (Input, Conditional):
 *      [Pos 1-80: 2(60) + 1(action) + 10(hts#) + 16(qty) + 3(uom) + 6(date) + 1(noiInd) + 1(waiver) + 30(exporterName) + 2(countryDest) + 1(bolInd) + 4(bolCarrier) + 3(filler) = 80]
 *  12. Record 61 - Export/Destroy Articles Descriptions (Input, Conditional):
 *      [Pos 1-80: 2(61) + 50(desc) + 28(uniqueId) = 80]
 *  13. Record 62 - Notice of Intent (Input, Conditional):
 *      [Pos 1-80: 2(62) + 4(port) + 1(examInd) + 30(destructionLoc) + 1(examResults) + 42(filler) = 80]
 *  14. Record 63 - Examination & Witness Record (Input, Conditional):
 *      [Pos 1-80: 2(63) + 1(recordInd) + 40(cbpName) + 12(badge#) + 10(phone#) + 6(date) + 9(filler) = 80]
 *  15. Record 64 - NAFTA/USMCA Coding Group (Input, Conditional):
 *      [Pos 1-80: 2(64) + 20(entry#) + 6(entryDate) + 10(dutyPaid) + 10(exchangeRate) + 10(tariff1) + 10(tariff2) + 10(tariff3) + 2(country) = 80]
 *  16. Record 70 - TFTEA Export/Destroy Articles (Input, Conditional):
 *      [Pos 1-80: 2(70) + 1(action) + 10(hts#) + 16(qty) + 3(uom) + 6(date) + 1(noiInd) + 1(waiver) + 30(exporterName) + 2(countryDest) + 1(bolInd) + 4(bolCarrier) + 1(scheduleB) + 2(filler) = 80]
 *  17. Record 71 - TFTEA Export/Destroy Articles Descriptions (Input, Conditional):
 *      [Pos 1-80: 2(71) + 50(desc) + 28(uniqueId) = 80]
 *  18. Record 72 - Linking Export to Import Article (Input, Conditional):
 *      [Pos 1-80: 2(72) + 15x5(itin1..15) + 3(filler) = 80]
 *  19. Record 73 - Linking Export to Manufactured/Produced Article (Input, Conditional):
 *      [Pos 1-80: 2(73) + 15x5(mtin1..15) + 3(filler) = 80]
 *  20. Record 89 - Revenue Totals by Accounting Class Code (Input, Conditional):
 *      [Pos 1-80: 2(89) + 3(class1) + 11(amt1) + 2(filler) + 3(class2) + 11(amt2) + 2(filler) + 3(class3) + 11(amt3) + 2(filler) + 3(class4) + 11(amt4) + 16(filler) = 80]
 *  21. Record 90 - Revenue Totals (Input, Mandatory):
 *      [Pos 1-80: 2(90) + 11(duty) + 1(filler) + 11(userFee) + 1(filler) + 11(irTax) + 43(filler) = 80]
 *  22. Output Record E0 - Drawback Entry Summary Condition Reference (Output, Conditional):
 *      [Pos 1-80: 2(E0) + 1(filler) + 6(refCode) + 1(filler) + 6(pos) + 1(filler) + 7(constant 'REF ID:') + 1(filler) + 55(text) = 80]
 *  23. Output Record E1 - Entry Summary Condition/Disposition Response (Output, Mandatory):
 *      [Pos 1-80: 2(E1) + 1(disp) + 1(sev) + 3(cond) + 3(reason) + 40(narrative) + 3(filer) + 2(filler) + 8(entry#) + 5(version) + 9(brokerRef) + 3(filler) = 80]
 *
 * Explicitly Deferred (Out of Scope for Codec Backbone):
 *   - Internal Drawback Matching/Claim Engine (src/modules/drawback/): Already implemented in business logic domain.
 *   - Trade Portal UI Rendering: Human GUI forms deferred to frontend presentation components.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from "vitest";
import {
  RECORD_10_DRAWBACK_HEADER_SPEC,
  RECORD_31_BOND_INFO_SPEC,
  RECORD_40_IMPORTS_DETAILS_SPEC,
  RECORD_41_IMPORT_CLASSIFICATION_SPEC,
  RECORD_42_IMPORT_QUANTITY_UOM_SPEC,
  RECORD_43_IMPORT_REVENUE_CLAIMED_SPEC,
  RECORD_50_MANUFACTURED_ARTICLE_SPEC,
  RECORD_51_MANUFACTURED_DESC_SPEC,
  RECORD_52_LINK_IMPORT_MFG_SPEC,
  RECORD_53_LINK_MFG_SOURCE_SPEC,
  RECORD_60_EXPORT_DESTROY_SPEC,
  RECORD_61_EXPORT_DESC_SPEC,
  RECORD_62_NOTICE_OF_INTENT_SPEC,
  RECORD_63_EXAM_WITNESS_SPEC,
  RECORD_64_NAFTA_USMCA_SPEC,
  RECORD_70_TFTEA_EXPORT_DESTROY_SPEC,
  RECORD_71_TFTEA_EXPORT_DESC_SPEC,
  RECORD_72_LINK_EXPORT_IMPORT_SPEC,
  RECORD_73_LINK_EXPORT_MFG_SPEC,
  RECORD_89_REVENUE_CLASS_TOTALS_SPEC,
  RECORD_90_REVENUE_GRAND_TOTALS_SPEC,
  RECORD_E0_CONDITION_REF_SPEC,
  RECORD_E1_DISPOSITION_RESPONSE_SPEC,
} from "@/lib/abi/drawback/recordSpecs";

// ── Drawback Input & Output Record Specifications ───────────────────────────
// Moved into src/lib/abi/drawback/recordSpecs.ts — imported above. Money
// fields now bind to Decimal (impliedDecimalField/wholeDollarField), date
// fields to Date (dateField), and leading-zero-significant identifier/code
// fields (ITIN/MTIN/ETIN, CBP ES Line #, Accounting Class Code, Drawback
// Accounting Method Code) decode via numericCodeField instead of raw
// parseInt — see src/lib/abi/drawback/recordSpecs.ts for the corrected
// implementation these tests now validate.

const ALL_DRAWBACK_SPECS = [
  RECORD_10_DRAWBACK_HEADER_SPEC,
  RECORD_31_BOND_INFO_SPEC,
  RECORD_40_IMPORTS_DETAILS_SPEC,
  RECORD_41_IMPORT_CLASSIFICATION_SPEC,
  RECORD_42_IMPORT_QUANTITY_UOM_SPEC,
  RECORD_43_IMPORT_REVENUE_CLAIMED_SPEC,
  RECORD_50_MANUFACTURED_ARTICLE_SPEC,
  RECORD_51_MANUFACTURED_DESC_SPEC,
  RECORD_52_LINK_IMPORT_MFG_SPEC,
  RECORD_53_LINK_MFG_SOURCE_SPEC,
  RECORD_60_EXPORT_DESTROY_SPEC,
  RECORD_61_EXPORT_DESC_SPEC,
  RECORD_62_NOTICE_OF_INTENT_SPEC,
  RECORD_63_EXAM_WITNESS_SPEC,
  RECORD_64_NAFTA_USMCA_SPEC,
  RECORD_70_TFTEA_EXPORT_DESTROY_SPEC,
  RECORD_71_TFTEA_EXPORT_DESC_SPEC,
  RECORD_72_LINK_EXPORT_IMPORT_SPEC,
  RECORD_73_LINK_EXPORT_MFG_SPEC,
  RECORD_89_REVENUE_CLASS_TOTALS_SPEC,
  RECORD_90_REVENUE_GRAND_TOTALS_SPEC,
  RECORD_E0_CONDITION_REF_SPEC,
  RECORD_E1_DISPOSITION_RESPONSE_SPEC,
];

describe("Drawback (TFTEA / Core) Record Specs — 80-Column Layout Validation", () => {
  it.each(ALL_DRAWBACK_SPECS.map((spec) => [spec.recordType, spec]))(
    "%s has length 80 and field lengths sum to exactly 80",
    (_recordType, spec) => {
      expect(spec.length).toBe(80);
      const totalFieldLength = spec.fields.reduce((sum, f) => sum + f.length, 0);
      expect(totalFieldLength).toBe(80);
    }
  );

  it.each(ALL_DRAWBACK_SPECS.map((spec) => [spec.recordType, spec]))(
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

describe("Record 10 Drawback Header Spec — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 07 p. 28-36 stated positions & classes exactly (including internal filler gaps)", () => {
    const fields = Object.fromEntries(
      RECORD_10_DRAWBACK_HEADER_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );

    expect(fields.filler_1).toMatchObject({ start: 1, length: 2, class: "A", designation: "M", constant: "10" });
    expect(fields.summaryFilingActionRequestCode).toMatchObject({ start: 3, length: 1, class: "A", designation: "M" });
    expect(fields.entryFilerCode).toMatchObject({ start: 4, length: 3, class: "AN", designation: "M" });
    expect(fields.filler_7).toMatchObject({ start: 7, length: 2, class: "S", designation: "M" });
    expect(fields.entryNumberOrDrawbackClaimNumber).toMatchObject({ start: 9, length: 8, class: "AN", designation: "M" });
    expect(fields.filler_17).toMatchObject({ start: 17, length: 1, class: "S", designation: "M" });
    expect(fields.drawbackFilingPort).toMatchObject({ start: 18, length: 4, class: "AN", designation: "M" });
    expect(fields.brokerReferenceNumber).toMatchObject({ start: 22, length: 9, class: "X", designation: "O" });
    expect(fields.filler_31).toMatchObject({ start: 31, length: 3, class: "S", designation: "M" });
    expect(fields.drawbackProvision).toMatchObject({ start: 34, length: 2, class: "X", designation: "M" });
    expect(fields.claimantIdOrImporterRecordNumber).toMatchObject({ start: 49, length: 12, class: "X", designation: "M" });
    expect(fields.superfundTaxCertification).toMatchObject({ start: 78, length: 1, class: "AN", designation: "C" });
    expect(fields.filler_79).toMatchObject({ start: 79, length: 2, class: "S", designation: "M" });
  });
});

describe("Record 31 Bond & Record 40 Imports Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 07 p. 38-42 stated positions & classes exactly", () => {
    // Record 31
    const fields31 = Object.fromEntries(
      RECORD_31_BOND_INFO_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields31.bondTypeCode).toMatchObject({ start: 3, length: 1, class: "AN", designation: "M" });
    expect(fields31.bondDesignationTypeCode).toMatchObject({ start: 4, length: 1, class: "AN", designation: "M" });
    expect(fields31.filler_5).toMatchObject({ start: 5, length: 1, class: "S", designation: "M" });
    expect(fields31.suretyCompanyCode).toMatchObject({ start: 6, length: 3, class: "AN", designation: "M" });
    expect(fields31.singleTransactionBondAmount).toMatchObject({ start: 9, length: 10, class: "SN", designation: "C" });
    expect(fields31.singleTransactionBondNumber).toMatchObject({ start: 19, length: 10, class: "AN", designation: "C" });
    expect(fields31.filler_29).toMatchObject({ start: 29, length: 52, class: "S", designation: "M" });

    // Record 40
    const fields40 = Object.fromEntries(
      RECORD_40_IMPORTS_DETAILS_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields40.actionIndicator).toMatchObject({ start: 3, length: 1, class: "AN", designation: "M" });
    expect(fields40.filler_4).toMatchObject({ start: 4, length: 2, class: "S", designation: "M" });
    expect(fields40.entryFilerCode).toMatchObject({ start: 6, length: 3, class: "AN", designation: "M" });
    expect(fields40.filler_9).toMatchObject({ start: 9, length: 2, class: "S", designation: "M" });
    expect(fields40.entryNumber).toMatchObject({ start: 11, length: 8, class: "AN", designation: "M" });
    expect(fields40.cbpEsLineNumber).toMatchObject({ start: 19, length: 5, class: "N", designation: "M" });
    expect(fields40.importTrackingIdNumber).toMatchObject({ start: 51, length: 5, class: "N", designation: "M" });
    expect(fields40.drawbackAccountingMethodCode).toMatchObject({ start: 56, length: 2, class: "N", designation: "C" });
    expect(fields40.filler_58).toMatchObject({ start: 58, length: 23, class: "S", designation: "M" });
  });
});

describe("Record 41 Classification, 42 Quantity & 43 Revenue Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 07 p. 44-51 stated positions & classes exactly", () => {
    // Record 41
    const fields41 = Object.fromEntries(
      RECORD_41_IMPORT_CLASSIFICATION_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields41.htsNumber).toMatchObject({ start: 3, length: 10, class: "AN", designation: "M" });
    expect(fields41.articleDescriptionText).toMatchObject({ start: 13, length: 50, class: "X", designation: "M" });
    expect(fields41.filler_63).toMatchObject({ start: 63, length: 18, class: "S", designation: "M" });

    // Record 42
    const fields42 = Object.fromEntries(
      RECORD_42_IMPORT_QUANTITY_UOM_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields42.quantity).toMatchObject({ start: 3, length: 16, class: "SN", designation: "M" });
    expect(fields42.unitOfMeasureCode).toMatchObject({ start: 19, length: 3, class: "X", designation: "M" });
    expect(fields42.allowableQuantity).toMatchObject({ start: 22, length: 16, class: "SN", designation: "C" });
    expect(fields42.enteredGoodsValuePerUnit).toMatchObject({ start: 38, length: 16, class: "SN", designation: "M" });
    expect(fields42.substitutedValuePerUnit).toMatchObject({ start: 54, length: 16, class: "SN", designation: "C" });
    expect(fields42.filler_70).toMatchObject({ start: 70, length: 11, class: "S", designation: "M" });

    // Record 43
    const fields43 = Object.fromEntries(
      RECORD_43_IMPORT_REVENUE_CLAIMED_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields43.accountingClassCode).toMatchObject({ start: 3, length: 3, class: "N", designation: "M" });
    expect(fields43.claimAmount).toMatchObject({ start: 6, length: 8, class: "SN", designation: "M" });
    expect(fields43.calculatedAmount).toMatchObject({ start: 14, length: 8, class: "SN", designation: "C" });
    expect(fields43.adjustedClaimedAmount).toMatchObject({ start: 22, length: 8, class: "SN", designation: "C" });
    expect(fields43.qualifierIndicator).toMatchObject({ start: 30, length: 2, class: "AN", designation: "C" });
    expect(fields43.filler_32).toMatchObject({ start: 32, length: 49, class: "S", designation: "M" });
  });
});

describe("Record 50, 51, 52, 53 Manufacturing & Linkage Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 07 p. 53-61 stated positions & classes exactly", () => {
    // Record 50
    const fields50 = Object.fromEntries(
      RECORD_50_MANUFACTURED_ARTICLE_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields50.actionIndicator).toMatchObject({ start: 3, length: 1, class: "AN", designation: "M" });
    expect(fields50.importManufactureRulingNumber).toMatchObject({ start: 4, length: 10, class: "AN", designation: "M" });
    expect(fields50.filler_14).toMatchObject({ start: 14, length: 2, class: "S", designation: "M" });
    expect(fields50.htsNumber).toMatchObject({ start: 16, length: 10, class: "AN", designation: "M" });
    expect(fields50.quantity).toMatchObject({ start: 26, length: 16, class: "SN", designation: "M" });
    expect(fields50.unitOfMeasureCode).toMatchObject({ start: 42, length: 3, class: "X", designation: "M" });
    expect(fields50.productionDate).toMatchObject({ start: 45, length: 6, class: "D", designation: "M" });
    expect(fields50.factoryLocation).toMatchObject({ start: 51, length: 30, class: "AN", designation: "M" });

    // Record 51
    const fields51 = Object.fromEntries(
      RECORD_51_MANUFACTURED_DESC_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields51.manufacturedArticleDescriptionText).toMatchObject({ start: 3, length: 50, class: "X", designation: "M" });
    expect(fields51.manufactureRulingNumber).toMatchObject({ start: 53, length: 10, class: "AN", designation: "C" });
    expect(fields51.manufacturedTrackingIdNumber).toMatchObject({ start: 63, length: 5, class: "N", designation: "C" });
    expect(fields51.filler_68).toMatchObject({ start: 68, length: 13, class: "S", designation: "M" });

    // Record 52
    const fields52 = Object.fromEntries(
      RECORD_52_LINK_IMPORT_MFG_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields52.importTrackingIdNumber1).toMatchObject({ start: 3, length: 5, class: "N", designation: "M" });
    expect(fields52.importTrackingIdNumber15).toMatchObject({ start: 73, length: 5, class: "N", designation: "O" });
    expect(fields52.filler_78).toMatchObject({ start: 78, length: 3, class: "S", designation: "M" });

    // Record 53
    const fields53 = Object.fromEntries(
      RECORD_53_LINK_MFG_SOURCE_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields53.manufacturedTrackingIdNumber1).toMatchObject({ start: 3, length: 5, class: "N", designation: "C" });
    expect(fields53.manufacturedTrackingIdNumber15).toMatchObject({ start: 73, length: 5, class: "N", designation: "O" });
    expect(fields53.filler_78).toMatchObject({ start: 78, length: 3, class: "S", designation: "M" });
  });
});

describe("Record 60, 61, 62, 63, 64 Export & Witness Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 07 p. 60-66 stated positions & classes exactly", () => {
    // Record 60
    const fields60 = Object.fromEntries(
      RECORD_60_EXPORT_DESTROY_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields60.exportOrDestroyIndicator).toMatchObject({ start: 3, length: 1, class: "AN", designation: "M" });
    expect(fields60.htsNumber).toMatchObject({ start: 4, length: 10, class: "AN", designation: "M" });
    expect(fields60.exportOrDestroyQuantity).toMatchObject({ start: 14, length: 16, class: "SN", designation: "M" });
    expect(fields60.unitOfMeasureCode).toMatchObject({ start: 30, length: 3, class: "X", designation: "M" });
    expect(fields60.exportOrDestroyDate).toMatchObject({ start: 33, length: 6, class: "D", designation: "M" });
    expect(fields60.noticeOfIntentIndicator).toMatchObject({ start: 39, length: 1, class: "AN", designation: "C" });
    expect(fields60.waiverToDrawbackClaimRightsIndicator).toMatchObject({ start: 40, length: 1, class: "AN", designation: "C" });
    expect(fields60.nameOfExporterOrDestroyer).toMatchObject({ start: 41, length: 30, class: "AN", designation: "M" });
    expect(fields60.countryOfUltimateDestination).toMatchObject({ start: 71, length: 2, class: "AN", designation: "C" });
    expect(fields60.billOfLadingIndicator).toMatchObject({ start: 73, length: 1, class: "AN", designation: "O" });
    expect(fields60.billOfLadingCarrierCode).toMatchObject({ start: 74, length: 4, class: "AN", designation: "O" });
    expect(fields60.filler_78).toMatchObject({ start: 78, length: 3, class: "S", designation: "M" });

    // Record 61 — description first, then unique identifier (the transposed-order bug).
    const fields61 = Object.fromEntries(
      RECORD_61_EXPORT_DESC_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields61.exportOrDestroyArticleDescriptionText).toMatchObject({ start: 3, length: 50, class: "X", designation: "M" });
    expect(fields61.exportOrDestroyUniqueIdentifierNumber).toMatchObject({ start: 53, length: 28, class: "X", designation: "M" });

    // Record 62
    const fields62 = Object.fromEntries(
      RECORD_62_NOTICE_OF_INTENT_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields62.intendedPortOfExport).toMatchObject({ start: 3, length: 4, class: "AN", designation: "C" });
    expect(fields62.examinationWitnessIndicator).toMatchObject({ start: 7, length: 1, class: "AN", designation: "M" });
    expect(fields62.locationOfDestruction).toMatchObject({ start: 8, length: 30, class: "AN", designation: "C" });
    expect(fields62.resultsOfExaminationOrWitnessOfDestruction).toMatchObject({ start: 38, length: 1, class: "AN", designation: "C" });
    expect(fields62.filler_39).toMatchObject({ start: 39, length: 42, class: "S", designation: "M" });

    // Record 63
    const fields63 = Object.fromEntries(
      RECORD_63_EXAM_WITNESS_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields63.recordIndicator).toMatchObject({ start: 3, length: 1, class: "AN", designation: "M" });
    expect(fields63.nameOfCbpPersonnel).toMatchObject({ start: 4, length: 40, class: "AN", designation: "M" });
    expect(fields63.cbpPersonnelBadgeNumber).toMatchObject({ start: 44, length: 12, class: "AN", designation: "M" });
    expect(fields63.cbpPersonnelPhoneNumber).toMatchObject({ start: 56, length: 10, class: "AN", designation: "M" });
    expect(fields63.processingExaminationDate).toMatchObject({ start: 66, length: 6, class: "D", designation: "M" });
    expect(fields63.filler_72).toMatchObject({ start: 72, length: 9, class: "S", designation: "M" });

    // Record 64
    const fields64 = Object.fromEntries(
      RECORD_64_NAFTA_USMCA_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields64.entryNumber).toMatchObject({ start: 3, length: 20, class: "AN", designation: "M" });
    expect(fields64.entryDate).toMatchObject({ start: 23, length: 6, class: "D", designation: "M" });
    expect(fields64.dutyPaidToForeignGovtLocalCurrency).toMatchObject({ start: 29, length: 10, class: "SN", designation: "M" });
    // 6 implied decimal places — a new precision level for this chapter.
    expect(fields64.exchangeRate).toMatchObject({ start: 39, length: 10, class: "SN", designation: "M" });
    expect(fields64.tariffNumber1).toMatchObject({ start: 49, length: 10, class: "AN", designation: "M" });
    expect(fields64.tariffNumber2).toMatchObject({ start: 59, length: 10, class: "AN", designation: "C" });
    expect(fields64.tariffNumber3).toMatchObject({ start: 69, length: 10, class: "AN", designation: "C" });
    expect(fields64.countryOfExport).toMatchObject({ start: 79, length: 2, class: "AN", designation: "M" });
  });
});

describe("Record 70, 71, 72, 73 TFTEA Export & Linkage Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 07 p. 67-74 stated positions & classes exactly", () => {
    // Record 70
    const fields70 = Object.fromEntries(
      RECORD_70_TFTEA_EXPORT_DESTROY_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields70.exportOrDestroyIndicator).toMatchObject({ start: 3, length: 1, class: "AN", designation: "M" });
    expect(fields70.htsNumber).toMatchObject({ start: 4, length: 10, class: "AN", designation: "M" });
    expect(fields70.exportOrDestroyQuantity).toMatchObject({ start: 14, length: 16, class: "SN", designation: "M" });
    expect(fields70.unitOfMeasureCode).toMatchObject({ start: 30, length: 3, class: "X", designation: "M" });
    expect(fields70.exportOrDestroyDate).toMatchObject({ start: 33, length: 6, class: "D", designation: "M" });
    expect(fields70.nameOfExporterOrDestroyer).toMatchObject({ start: 41, length: 30, class: "AN", designation: "M" });
    // The one real structural difference from Record 60: the extra 1-char
    // Schedule B Code field at pos 78 (Record 60's equivalent space is just
    // part of its 3-char trailing filler).
    expect(fields70.scheduleBCode).toMatchObject({ start: 78, length: 1, class: "AN", designation: "C" });
    expect(fields70.filler_79).toMatchObject({ start: 79, length: 2, class: "S", designation: "M" });

    // Record 71 — description first, then unique identifier.
    const fields71 = Object.fromEntries(
      RECORD_71_TFTEA_EXPORT_DESC_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields71.exportOrDestroyArticleDescriptionText).toMatchObject({ start: 3, length: 50, class: "X", designation: "M" });
    expect(fields71.exportOrDestroyUniqueIdentifierNumber).toMatchObject({ start: 53, length: 28, class: "X", designation: "M" });

    // Record 72 & 73
    const fields72 = Object.fromEntries(
      RECORD_72_LINK_EXPORT_IMPORT_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields72.importTrackingIdNumber1).toMatchObject({ start: 3, length: 5, class: "N", designation: "M" });
    expect(fields72.filler_78).toMatchObject({ start: 78, length: 3, class: "S", designation: "M" });
  });
});

describe("Record 89, 90, E0 & E1 Revenue & Response Specs — Field Position Math & CATAIR Class Validation", () => {
  it("matches PDF 07 p. 75-86 stated positions & classes exactly (including internal filler gaps)", () => {
    // Record 89
    const fields89 = Object.fromEntries(
      RECORD_89_REVENUE_CLASS_TOTALS_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields89.accountingClassCode1).toMatchObject({ start: 3, length: 3, class: "N", designation: "M" });
    expect(fields89.totalAmount1).toMatchObject({ start: 6, length: 11, class: "SN", designation: "M" });
    expect(fields89.filler_17).toMatchObject({ start: 17, length: 2, class: "S", designation: "M" });
    expect(fields89.filler_65).toMatchObject({ start: 65, length: 16, class: "S", designation: "M" });

    // Record 90
    const fields90 = Object.fromEntries(
      RECORD_90_REVENUE_GRAND_TOTALS_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fields90.grandTotalDutyAmount).toMatchObject({ start: 3, length: 11, class: "SN", designation: "C" });
    expect(fields90.filler_14).toMatchObject({ start: 14, length: 1, class: "S", designation: "M" });
    expect(fields90.grandTotalUserFeeAmount).toMatchObject({ start: 15, length: 11, class: "SN", designation: "C" });
    expect(fields90.filler_26).toMatchObject({ start: 26, length: 1, class: "S", designation: "M" });
    expect(fields90.grandTotalIrTaxAmount).toMatchObject({ start: 27, length: 11, class: "SN", designation: "C" });
    expect(fields90.filler_38).toMatchObject({ start: 38, length: 43, class: "S", designation: "M" });

    // Output E0
    const fieldsE0 = Object.fromEntries(
      RECORD_E0_CONDITION_REF_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fieldsE0.filler_3).toMatchObject({ start: 3, length: 1, class: "S", designation: "M" });
    expect(fieldsE0.referenceDataTypeCode).toMatchObject({ start: 4, length: 6, class: "AN", designation: "M" });
    expect(fieldsE0.occurrencePosition).toMatchObject({ start: 11, length: 6, class: "N", designation: "M" });
    expect(fieldsE0.filler_18).toMatchObject({ start: 18, length: 7, class: "A", designation: "M", constant: "REF ID:" });
    expect(fieldsE0.referenceDataText).toMatchObject({ start: 26, length: 55, class: "X", designation: "M" });

    // Output E1
    const fieldsE1 = Object.fromEntries(
      RECORD_E1_DISPOSITION_RESPONSE_SPEC.fields.map((f) => [f.key ?? "filler_" + f.start, f])
    );
    expect(fieldsE1.dispositionTypeCode).toMatchObject({ start: 3, length: 1, class: "AN", designation: "M" });
    expect(fieldsE1.severityCode).toMatchObject({ start: 4, length: 1, class: "AN", designation: "M" });
    expect(fieldsE1.conditionCode).toMatchObject({ start: 5, length: 3, class: "AN", designation: "M" });
    expect(fieldsE1.narrativeText).toMatchObject({ start: 11, length: 40, class: "AN", designation: "M" });
    expect(fieldsE1.filler_54).toMatchObject({ start: 54, length: 2, class: "S", designation: "M" });
    expect(fieldsE1.filler_78).toMatchObject({ start: 78, length: 3, class: "S", designation: "M" });
  });
});
