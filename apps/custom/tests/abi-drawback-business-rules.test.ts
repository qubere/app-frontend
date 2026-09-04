/**
 * CATAIR Drawback (TFTEA / Core Drawback) Business Rules & Codec Tests
 * Source Document: docs/plans/catair-source-docs/07-drawback-tftea-v27.pdf
 * (Pub # 0875-0419, June 24, 2025 - Revision 27)
 */

import { describe, it, expect } from "vitest";
import { encodeRecord, decodeRecord } from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
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

// Helper functions for validating Drawback business rules
function validateSummaryFilingAction(code: string): boolean {
  return code === "A" || code === "R" || code === "D";
}

function validateDrawbackProvision(code: string): boolean {
  const validProvisions = ["01", "02", "03", "04", "05", "08", "50", "56"];
  return validProvisions.includes(code);
}

function validateAccountingMethod(code: string): boolean {
  const validMethods = ["01", "02", "03", "04"];
  return validMethods.includes(code);
}

function validateAccountingClassCode(code: string): boolean {
  const validClasses = ["001", "053", "054", "374", "398"];
  return validClasses.includes(code);
}

function validateDispositionTypeCode(code: string): boolean {
  return code === "A" || code === "R" || code === " ";
}

function validateSeverityCode(code: string): boolean {
  return code === "F" || code === "W" || code === "I" || code === " ";
}

describe("Drawback Business Rules — Summary Filing Action & Provisions", () => {
  it("validates Summary Filing Action Request Codes (A=Add, R=Replace, D=Delete)", () => {
    expect(validateSummaryFilingAction("A")).toBe(true);
    expect(validateSummaryFilingAction("R")).toBe(true);
    expect(validateSummaryFilingAction("D")).toBe(true);
    expect(validateSummaryFilingAction("X")).toBe(false);
  });

  it("validates Drawback Provisions (01=Unused Direct, 02=Unused Substitution, 03=Mfg Direct, 04=Mfg Substitution, 05=Rejected)", () => {
    const valid = ["01", "02", "03", "04", "05", "08", "50"];
    for (const code of valid) {
      expect(validateDrawbackProvision(code)).toBe(true);
    }
    expect(validateDrawbackProvision("99")).toBe(false);
  });

  it("encodes Record 10 header with Action A and Provision 01", () => {
    const line = encodeRecord(RECORD_10_DRAWBACK_HEADER_SPEC, {
      summaryFilingActionRequestCode: "A",
      entryFilerCode: "ABC",
      entryNumberOrDrawbackClaimNumber: "12345678",
      drawbackFilingPort: "4601",
      drawbackProvision: "01",
      electronicSignature: "Y",
      claimantIdOrImporterRecordNumber: "12345678900",
    });

    expect(line.slice(0, 2)).toBe("10");
    expect(line[2]).toBe("A");
    expect(line.slice(3, 6)).toBe("ABC");
    expect(line.slice(8, 16)).toBe("12345678");
    expect(line.slice(33, 35)).toBe("01");

    const decoded = decodeRecord(RECORD_10_DRAWBACK_HEADER_SPEC, line);
    expect(decoded.summaryFilingActionRequestCode).toBe("A");
    expect(decoded.entryFilerCode).toBe("ABC");
    expect(decoded.drawbackProvision).toBe("01");
  });
});

describe("Drawback Business Rules — Quantities & Values (4 Implied Decimals)", () => {
  it("formats Quantity and Per Unit Values with 4 implied decimal places in 16(S)N format", () => {
    // Record 42: Quantity 100.5000 -> "0000000001005000"
    const line = encodeRecord(RECORD_42_IMPORT_QUANTITY_UOM_SPEC, {
      quantity: new Decimal("100.5"),
      unitOfMeasureCode: "PCS",
      enteredGoodsValuePerUnit: new Decimal("2.5"), // $2.5000 per unit
    });

    const qtyField = line.slice(2, 18); // pos 3-18 (0-indexed 2..18)
    expect(qtyField).toHaveLength(16);
    expect(qtyField).toBe("0000000001005000");

    // Round-trip the money fields to confirm they survive as Decimal, not raw ints
    // (the 3rd/4th implied-decimal digits would be silently lost by a naive
    // round-to-cents-then-scale implementation).
    const decoded = decodeRecord(RECORD_42_IMPORT_QUANTITY_UOM_SPEC, line);
    expect(decoded.quantity?.toString()).toBe("100.5");
    expect(decoded.enteredGoodsValuePerUnit?.toString()).toBe("2.5");
    expect(decoded.unitOfMeasureCode).toBe("PCS");
  });

  it("formats TFTEA Export/Destroy Quantity in Record 70 with 4 implied decimals", () => {
    const line = encodeRecord(RECORD_70_TFTEA_EXPORT_DESTROY_SPEC, {
      exportOrDestroyIndicator: "E",
      htsNumber: "8504409580",
      exportOrDestroyQuantity: new Decimal("5"), // 5.0000 units
      unitOfMeasureCode: "PCS",
      exportOrDestroyDate: new Date(2025, 5, 24), // MMDDYY -> 062425
      nameOfExporterOrDestroyer: "ACME EXPORTS INC",
      scheduleBCode: "Y",
    });

    const qtyField = line.slice(13, 29); // pos 14-29 (0-indexed 13..29)
    expect(qtyField).toHaveLength(16);
    expect(qtyField).toBe("0000000000050000");
    expect(line.slice(32, 38)).toBe("062425"); // pos 33-38 date
    expect(line[77]).toBe("Y"); // pos 78 Schedule B Code — the field that
    // distinguishes Record 70 from Record 60's identical-length trailing filler.

    const decoded = decodeRecord(RECORD_70_TFTEA_EXPORT_DESTROY_SPEC, line);
    expect(decoded.exportOrDestroyIndicator).toBe("E");
    expect(decoded.htsNumber).toBe("8504409580");
    expect(decoded.exportOrDestroyDate?.getFullYear()).toBe(2025);
    expect(decoded.exportOrDestroyDate?.getMonth()).toBe(5); // June, 0-indexed
    expect(decoded.exportOrDestroyDate?.getDate()).toBe(24);
    expect(decoded.exportOrDestroyQuantity?.toString()).toBe("5");
    expect(decoded.nameOfExporterOrDestroyer?.trim()).toBe("ACME EXPORTS INC");
    expect(decoded.scheduleBCode).toBe("Y");
  });
});

describe("Drawback Business Rules — Revenue Claimed & Class Totals (2 Implied Decimals)", () => {
  it("formats Claim Amount in Record 43 with 2 implied decimal places (8(S)N format)", () => {
    // $1,250.75 -> "00125075"
    const line = encodeRecord(RECORD_43_IMPORT_REVENUE_CLAIMED_SPEC, {
      accountingClassCode: "001", // Duty
      claimAmount: new Decimal("1250.75"),
    });

    const amtField = line.slice(5, 13); // pos 6-13 (0-indexed 5..13)
    expect(amtField).toHaveLength(8);
    expect(amtField).toBe("00125075");

    const decoded = decodeRecord(RECORD_43_IMPORT_REVENUE_CLAIMED_SPEC, line);
    // Leading zero preserved on decode — Accounting Class Code is an
    // identifier, not a quantity.
    expect(decoded.accountingClassCode).toBe("001");
    expect(decoded.claimAmount?.toString()).toBe("1250.75");
  });

  it("formats Grand Total Duty, MPF, and IR Tax in Record 90 with 2 implied decimals", () => {
    const line = encodeRecord(RECORD_90_REVENUE_GRAND_TOTALS_SPEC, {
      grandTotalDutyAmount: new Decimal("1250.75"),
      grandTotalUserFeeAmount: new Decimal("35.00"), // MPF
      grandTotalIrTaxAmount: new Decimal("0"),
    });

    expect(line.slice(2, 13)).toBe("00000125075");
    expect(line[13]).toBe(" "); // pos 14 filler
    expect(line.slice(14, 25)).toBe("00000003500");
    expect(line[25]).toBe(" "); // pos 26 filler
    expect(line.slice(26, 37)).toBe("00000000000");

    const decoded = decodeRecord(RECORD_90_REVENUE_GRAND_TOTALS_SPEC, line);
    expect(decoded.grandTotalDutyAmount?.toString()).toBe("1250.75");
    expect(decoded.grandTotalUserFeeAmount?.toString()).toBe("35");
  });
});

describe("Drawback Business Rules — Leading-Zero-Significant Identifiers (ITIN/MTIN/ETIN Join Keys)", () => {
  it("preserves ITIN leading zeros across a Record 40 -> 52 join so linked records don't silently fail to match", () => {
    const rec40 = encodeRecord(RECORD_40_IMPORTS_DETAILS_SPEC, {
      actionIndicator: "A",
      entryFilerCode: "ABC",
      entryNumber: "87654321",
      cbpEsLineNumber: "00001",
      importTrackingIdNumber: "00042",
      drawbackAccountingMethodCode: "01",
    });
    const rec52 = encodeRecord(RECORD_52_LINK_IMPORT_MFG_SPEC, {
      importTrackingIdNumber1: "00042",
    });

    const decoded40 = decodeRecord(RECORD_40_IMPORTS_DETAILS_SPEC, rec40);
    const decoded52 = decodeRecord(RECORD_52_LINK_IMPORT_MFG_SPEC, rec52);

    // A naive parseInt-based decode would turn "00042" into 42, and the two
    // records' ITINs would no longer be `===`-equal strings.
    expect(decoded40.importTrackingIdNumber).toBe("00042");
    expect(decoded52.importTrackingIdNumber1).toBe("00042");
    expect(decoded40.importTrackingIdNumber).toBe(decoded52.importTrackingIdNumber1);
  });

  it("preserves MTIN leading zeros on Record 51 (the MTIN lives on 51, not 50)", () => {
    const line = encodeRecord(RECORD_51_MANUFACTURED_DESC_SPEC, {
      manufacturedArticleDescriptionText: "STATIC CONVERTERS POWER SUPPLY",
      manufacturedTrackingIdNumber: "00007",
    });
    expect(decodeRecord(RECORD_51_MANUFACTURED_DESC_SPEC, line).manufacturedTrackingIdNumber).toBe("00007");
  });

  it("validates Drawback Accounting Method Code (01-04) and preserves its leading zero", () => {
    for (const code of ["01", "02", "03", "04"]) {
      expect(validateAccountingMethod(code)).toBe(true);
    }
    expect(validateAccountingMethod("99")).toBe(false);

    const line = encodeRecord(RECORD_40_IMPORTS_DETAILS_SPEC, {
      actionIndicator: "X",
      entryFilerCode: "ABC",
      entryNumber: "87654321",
      cbpEsLineNumber: "00001",
      importTrackingIdNumber: "00001",
      drawbackAccountingMethodCode: "01",
    });
    expect(decodeRecord(RECORD_40_IMPORTS_DETAILS_SPEC, line).drawbackAccountingMethodCode).toBe("01");
  });

  it("validates Accounting Class Code and preserves its leading zero across Record 43 and Record 89", () => {
    expect(validateAccountingClassCode("001")).toBe(true);
    expect(validateAccountingClassCode("999")).toBe(false);

    const rec43 = encodeRecord(RECORD_43_IMPORT_REVENUE_CLAIMED_SPEC, {
      accountingClassCode: "001",
      claimAmount: new Decimal("100"),
    });
    const rec89 = encodeRecord(RECORD_89_REVENUE_CLASS_TOTALS_SPEC, {
      accountingClassCode1: "001",
      totalAmount1: new Decimal("100"),
    });
    expect(decodeRecord(RECORD_43_IMPORT_REVENUE_CLAIMED_SPEC, rec43).accountingClassCode).toBe("001");
    expect(decodeRecord(RECORD_89_REVENUE_CLASS_TOTALS_SPEC, rec89).accountingClassCode1).toBe("001");
  });
});

describe("Drawback Business Rules — Dates (MMDDYY -> Date)", () => {
  it("round-trips Manuf Date Received/Used on Record 40 as Date objects", () => {
    const line = encodeRecord(RECORD_40_IMPORTS_DETAILS_SPEC, {
      actionIndicator: "X",
      entryFilerCode: "ABC",
      entryNumber: "87654321",
      cbpEsLineNumber: "00001",
      importTrackingIdNumber: "00001",
      manufDateReceived: new Date(2025, 0, 15), // MMDDYY -> 011525
      manufDateUsed: new Date(2025, 2, 1), // MMDDYY -> 030125
    });

    expect(line.slice(38, 44)).toBe("011525");
    expect(line.slice(44, 50)).toBe("030125");

    const decoded = decodeRecord(RECORD_40_IMPORTS_DETAILS_SPEC, line);
    expect(decoded.manufDateReceived?.getFullYear()).toBe(2025);
    expect(decoded.manufDateReceived?.getMonth()).toBe(0);
    expect(decoded.manufDateReceived?.getDate()).toBe(15);
    expect(decoded.manufDateUsed?.getMonth()).toBe(2);
    expect(decoded.manufDateUsed?.getDate()).toBe(1);
  });

  it("round-trips Production Date on Record 50 as a Date object", () => {
    const line = encodeRecord(RECORD_50_MANUFACTURED_ARTICLE_SPEC, {
      actionIndicator: "A",
      importManufactureRulingNumber: "9999999999",
      htsNumber: "8504409580",
      quantity: new Decimal("100.5"),
      unitOfMeasureCode: "PCS",
      productionDate: new Date(2025, 3, 10), // MMDDYY -> 041025
      factoryLocation: "DETROIT MI",
    });
    expect(line.slice(44, 50)).toBe("041025");
    const decoded = decodeRecord(RECORD_50_MANUFACTURED_ARTICLE_SPEC, line);
    expect(decoded.productionDate?.getMonth()).toBe(3);
    expect(decoded.productionDate?.getDate()).toBe(10);
    expect(decoded.quantity?.toString()).toBe("100.5");
    expect(decoded.factoryLocation?.trim()).toBe("DETROIT MI");
  });

  it("round-trips Export/Destroy Date on Record 60 as a Date object", () => {
    const line = encodeRecord(RECORD_60_EXPORT_DESTROY_SPEC, {
      exportOrDestroyIndicator: "E",
      htsNumber: "8504409580",
      exportOrDestroyQuantity: new Decimal("100.5"),
      unitOfMeasureCode: "PCS",
      exportOrDestroyDate: new Date(2025, 5, 24), // MMDDYY -> 062425
      nameOfExporterOrDestroyer: "ACME EXPORTS INC",
    });
    expect(line.slice(32, 38)).toBe("062425");
    const decoded = decodeRecord(RECORD_60_EXPORT_DESTROY_SPEC, line);
    expect(decoded.exportOrDestroyDate?.getMonth()).toBe(5);
    expect(decoded.exportOrDestroyDate?.getDate()).toBe(24);
    expect(decoded.exportOrDestroyQuantity?.toString()).toBe("100.5");
  });

  it("round-trips Processing/Examination Date on Record 63 as a Date object", () => {
    const line = encodeRecord(RECORD_63_EXAM_WITNESS_SPEC, {
      recordIndicator: "E",
      nameOfCbpPersonnel: "JANE DOE",
      cbpPersonnelBadgeNumber: "B123456",
      cbpPersonnelPhoneNumber: "2025551234",
      processingExaminationDate: new Date(2025, 6, 4), // MMDDYY -> 070425
    });
    expect(line.slice(65, 71)).toBe("070425");
    const decoded = decodeRecord(RECORD_63_EXAM_WITNESS_SPEC, line);
    expect(decoded.processingExaminationDate?.getMonth()).toBe(6);
    expect(decoded.processingExaminationDate?.getDate()).toBe(4);
    expect(decoded.nameOfCbpPersonnel?.trim()).toBe("JANE DOE");
  });

  it("round-trips Entry Date on Record 64 (NAFTA/USMCA Coding Group) as a Date object, including the new 6-implied-decimal Exchange Rate", () => {
    const line = encodeRecord(RECORD_64_NAFTA_USMCA_SPEC, {
      entryNumber: "87654321",
      entryDate: new Date(2025, 1, 20), // MMDDYY -> 022025
      dutyPaidToForeignGovtLocalCurrency: new Decimal("1250.75"), // 2 implied decimals
      exchangeRate: new Decimal("1.234567"), // 6 implied decimals, to ONE US dollar
      tariffNumber1: "8504409580",
      countryOfExport: "CA",
    });
    expect(line.slice(22, 28)).toBe("022025");
    // Duty Paid: 10 chars, 2 implied decimals -> "0000125075"
    expect(line.slice(28, 38)).toBe("0000125075");
    // Exchange Rate: 10 chars, 6 implied decimals -> "0001234567"
    expect(line.slice(38, 48)).toBe("0001234567");

    const decoded = decodeRecord(RECORD_64_NAFTA_USMCA_SPEC, line);
    expect(decoded.entryDate?.getMonth()).toBe(1);
    expect(decoded.entryDate?.getDate()).toBe(20);
    expect(decoded.dutyPaidToForeignGovtLocalCurrency?.toString()).toBe("1250.75");
    // A naive 2-or-4-decimal-only implementation would silently truncate this.
    expect(decoded.exchangeRate?.toString()).toBe("1.234567");
    expect(decoded.countryOfExport?.trim()).toBe("CA");
  });
});

describe("Drawback Business Rules — Record 61 Transposition Fix & Record 62 Notice of Intent Fields", () => {
  it("encodes Record 61 with Article Description Text first, then the Unique Identifier Number (not the reverse)", () => {
    const line = encodeRecord(RECORD_61_EXPORT_DESC_SPEC, {
      exportOrDestroyArticleDescriptionText: "EXPORTED STATIC CONVERTERS POWER SUPPLY",
      exportOrDestroyUniqueIdentifierNumber: "EXP-2025-001",
    });

    // Description occupies pos 3-52 (0-indexed 2..52); ID occupies pos 53-80
    // (0-indexed 52..80) — the opposite of the old, fabricated field order.
    expect(line.slice(2, 52).trim()).toBe("EXPORTED STATIC CONVERTERS POWER SUPPLY");
    expect(line.slice(52, 80).trim()).toBe("EXP-2025-001");

    const decoded = decodeRecord(RECORD_61_EXPORT_DESC_SPEC, line);
    expect(decoded.exportOrDestroyArticleDescriptionText?.trim()).toBe("EXPORTED STATIC CONVERTERS POWER SUPPLY");
    expect(decoded.exportOrDestroyUniqueIdentifierNumber?.trim()).toBe("EXP-2025-001");
  });

  it("encodes and decodes Record 62 Notice of Intent with the real field set (no fabricated notice filer/number/form fields)", () => {
    const line = encodeRecord(RECORD_62_NOTICE_OF_INTENT_SPEC, {
      intendedPortOfExport: "4601",
      examinationWitnessIndicator: "X",
      locationOfDestruction: "DETROIT MI",
      resultsOfExaminationOrWitnessOfDestruction: "N",
    });

    expect(line.slice(2, 6)).toBe("4601");
    expect(line[6]).toBe("X");
    expect(line.slice(7, 37).trim()).toBe("DETROIT MI");
    expect(line[37]).toBe("N");

    const decoded = decodeRecord(RECORD_62_NOTICE_OF_INTENT_SPEC, line);
    expect(decoded.intendedPortOfExport?.trim()).toBe("4601");
    expect(decoded.examinationWitnessIndicator).toBe("X");
    expect(decoded.locationOfDestruction?.trim()).toBe("DETROIT MI");
    expect(decoded.resultsOfExaminationOrWitnessOfDestruction).toBe("N");
  });
});

describe("Drawback Business Rules — Output Disposition & Condition Reference (Records E0, E1)", () => {
  it("encodes and decodes Output E0 Condition Reference with constant 'REF ID:'", () => {
    const line = encodeRecord(RECORD_E0_CONDITION_REF_SPEC, {
      referenceDataTypeCode: "FILER",
      occurrencePosition: 1,
      referenceDataText: "ABC12345678",
    });

    expect(line.slice(0, 2)).toBe("E0");
    expect(line[2]).toBe(" "); // pos 3 filler
    expect(line.slice(3, 9)).toBe("FILER ");
    expect(line.slice(17, 24)).toBe("REF ID:");
    expect(line.slice(25, 36)).toBe("ABC12345678");

    const decoded = decodeRecord(RECORD_E0_CONDITION_REF_SPEC, line);
    expect(decoded.referenceDataTypeCode).toBe("FILER");
    expect(decoded.occurrencePosition).toBe(1);
    expect(decoded.referenceDataText).toBe("ABC12345678");
  });

  it("encodes and decodes Output E1 Condition/Disposition Response", () => {
    expect(validateDispositionTypeCode("A")).toBe(true);
    expect(validateSeverityCode("I")).toBe(true);

    const line = encodeRecord(RECORD_E1_DISPOSITION_RESPONSE_SPEC, {
      dispositionTypeCode: "A",
      severityCode: "I",
      conditionCode: "001",
      narrativeText: "DRAWBACK CLAIM ACCEPTED BY CBP",
      entryFilerCode: "ABC",
      entryNumber: "12345678",
      versionNumber: "00100",
    });

    expect(line.slice(0, 2)).toBe("E1");
    expect(line[2]).toBe("A"); // Accepted
    expect(line[3]).toBe("I"); // Info
    expect(line.slice(4, 7)).toBe("001");
    expect(line.slice(10, 40)).toBe("DRAWBACK CLAIM ACCEPTED BY CBP");
    expect(line.slice(50, 53)).toBe("ABC");
    expect(line.slice(55, 63)).toBe("12345678");
    expect(line.slice(63, 68)).toBe("00100");

    const decoded = decodeRecord(RECORD_E1_DISPOSITION_RESPONSE_SPEC, line);
    expect(decoded.dispositionTypeCode).toBe("A");
    expect(decoded.severityCode).toBe("I");
    expect(decoded.conditionCode).toBe("001");
  });
});

describe("Drawback Golden Work Examples — CBP Reference Streams", () => {
  it("encodes and decodes a complete DD input stream for a TFTEA Unused Merchandise Claim", () => {
    const rec10 = encodeRecord(RECORD_10_DRAWBACK_HEADER_SPEC, {
      summaryFilingActionRequestCode: "A",
      entryFilerCode: "ABC",
      entryNumberOrDrawbackClaimNumber: "12345678",
      drawbackFilingPort: "4601",
      drawbackProvision: "01",
      electronicSignature: "Y",
      claimantIdOrImporterRecordNumber: "12345678900",
    });

    const rec31 = encodeRecord(RECORD_31_BOND_INFO_SPEC, {
      bondTypeCode: "8",
      bondDesignationTypeCode: "B",
      suretyCompanyCode: "456",
    });

    const rec40 = encodeRecord(RECORD_40_IMPORTS_DETAILS_SPEC, {
      actionIndicator: "A",
      entryFilerCode: "ABC",
      entryNumber: "87654321",
      cbpEsLineNumber: "00001",
      importTrackingIdNumber: "00001",
      drawbackAccountingMethodCode: "01", // FIFO
    });

    const rec41 = encodeRecord(RECORD_41_IMPORT_CLASSIFICATION_SPEC, {
      htsNumber: "8504409580",
      articleDescriptionText: "STATIC CONVERTERS POWER SUPPLY",
    });

    const rec42 = encodeRecord(RECORD_42_IMPORT_QUANTITY_UOM_SPEC, {
      quantity: new Decimal("100.5"),
      unitOfMeasureCode: "PCS",
      enteredGoodsValuePerUnit: new Decimal("2.5"),
    });

    const rec43 = encodeRecord(RECORD_43_IMPORT_REVENUE_CLAIMED_SPEC, {
      accountingClassCode: "001",
      claimAmount: new Decimal("1250.75"),
    });

    const rec70 = encodeRecord(RECORD_70_TFTEA_EXPORT_DESTROY_SPEC, {
      exportOrDestroyIndicator: "E",
      htsNumber: "8504409580",
      exportOrDestroyQuantity: new Decimal("100.5"),
      unitOfMeasureCode: "PCS",
      exportOrDestroyDate: new Date(2025, 5, 24),
      nameOfExporterOrDestroyer: "ACME EXPORTS INC",
    });

    const rec71 = encodeRecord(RECORD_71_TFTEA_EXPORT_DESC_SPEC, {
      exportOrDestroyArticleDescriptionText: "EXPORTED STATIC CONVERTERS POWER SUPPLY",
      exportOrDestroyUniqueIdentifierNumber: "EXP-2025-001",
    });

    const rec72 = encodeRecord(RECORD_72_LINK_EXPORT_IMPORT_SPEC, {
      importTrackingIdNumber1: "00001",
    });

    const rec89 = encodeRecord(RECORD_89_REVENUE_CLASS_TOTALS_SPEC, {
      accountingClassCode1: "001",
      totalAmount1: new Decimal("1250.75"),
    });

    const rec90 = encodeRecord(RECORD_90_REVENUE_GRAND_TOTALS_SPEC, {
      grandTotalDutyAmount: new Decimal("1250.75"),
    });

    const stream = [rec10, rec31, rec40, rec41, rec42, rec43, rec70, rec71, rec72, rec89, rec90].join("\n");
    const lines = stream.split("\n");

    expect(lines).toHaveLength(11);
    for (const line of lines) {
      expect(line).toHaveLength(80);
    }

    expect(lines[0].slice(0, 2)).toBe("10");
    expect(lines[1].slice(0, 2)).toBe("31");
    expect(lines[2].slice(0, 2)).toBe("40");
    expect(lines[3].slice(0, 2)).toBe("41");
    expect(lines[4].slice(0, 2)).toBe("42");
    expect(lines[5].slice(0, 2)).toBe("43");
    expect(lines[6].slice(0, 2)).toBe("70");
    expect(lines[7].slice(0, 2)).toBe("71");
    expect(lines[8].slice(0, 2)).toBe("72");
    expect(lines[9].slice(0, 2)).toBe("89");
    expect(lines[10].slice(0, 2)).toBe("90");

    // Cross-record ITIN join: Record 40's ITIN must match Record 72's link.
    const decoded40 = decodeRecord(RECORD_40_IMPORTS_DETAILS_SPEC, lines[2]);
    const decoded72 = decodeRecord(RECORD_72_LINK_EXPORT_IMPORT_SPEC, lines[8]);
    expect(decoded40.importTrackingIdNumber).toBe(decoded72.importTrackingIdNumber1);
  });

  it("encodes and decodes a complete JC output response stream (Record E0, E1)", () => {
    const recE0 = encodeRecord(RECORD_E0_CONDITION_REF_SPEC, {
      referenceDataTypeCode: "FILER",
      occurrencePosition: 1,
      referenceDataText: "ABC12345678",
    });

    const recE1 = encodeRecord(RECORD_E1_DISPOSITION_RESPONSE_SPEC, {
      dispositionTypeCode: "A",
      severityCode: "I",
      conditionCode: "001",
      narrativeText: "DRAWBACK CLAIM ACCEPTED BY CBP",
      entryFilerCode: "ABC",
      entryNumber: "12345678",
      versionNumber: "00100",
    });

    const stream = [recE0, recE1].join("\n");
    const lines = stream.split("\n");

    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toHaveLength(80);
    }

    expect(lines[0].slice(0, 2)).toBe("E0");
    expect(lines[1].slice(0, 2)).toBe("E1");
    expect(lines[1][2]).toBe("A"); // Accepted
  });
});
