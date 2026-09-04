import {
  dateField,
  filler,
  constantField,
  conditionReferencePrefix,
  numericCodeField,
  type FieldSpec,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
import type {
  DrawbackHeaderInput,
  BondInfoInput,
  ImportsDetailsInput,
  ImportClassificationInput,
  ImportQuantityUomInput,
  ImportRevenueClaimedInput,
  ManufacturedArticleInput,
  ManufacturedDescInput,
  LinkImportMfgInput,
  LinkMfgSourceInput,
  ExportDestroyInput,
  ExportDescInput,
  NoticeOfIntentInput,
  ExamWitnessInput,
  NaftaUsmcaInput,
  TfteaExportDestroyInput,
  TfteaExportDescInput,
  LinkExportImportInput,
  LinkExportMfgInput,
  RevenueClassTotalsInput,
  RevenueGrandTotalsInput,
  DrawbackE0Input,
  DrawbackE1Input,
} from "./types";

// RecordSpecs for the CATAIR Drawback (TFTEA / Core Drawback) chapter.
// Source: docs/plans/catair-source-docs/07-drawback-tftea-v27.pdf
// Position math for every field cross-checked against the extracted PDF tables
// (including internal filler gaps — not just trailing fillers) before writing;
// see tests/abi-drawback-specs.test.ts's own scope note for the full per-record
// position breakdown this was built from.

/**
 * A right-justified, zero-padded numeric field with `decimals` implied decimal
 * places, bound to `Decimal`. Unlike the sibling chapters' `impliedDecimalField`
 * (which always pre-rounds through `roundToCents` before scaling — harmless
 * when every caller passes `decimals: 2`, but would silently truncate a
 * genuinely 4-implied-decimal quantity/value field down to 2 decimals),
 * this rounds directly to the field's own `decimals` count.
 */
function impliedDecimalField<K extends string>(
  key: K,
  start: number,
  length: number,
  decimals: number,
  designation: "M" | "C" | "O"
): FieldSpec<K> {
  const scale = new Decimal(10).pow(decimals);
  return {
    key,
    start,
    length,
    class: "SN",
    designation,
    encodeValue: (raw) => {
      const scaled = (raw as Decimal).times(scale).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      return scaled.toString().padStart(length, "0");
    },
    decodeValue: (field) => {
      const trimmed = field.trim();
      if (trimmed.length === 0) return undefined;
      return new Decimal(trimmed).dividedBy(scale);
    },
  };
}

/** A whole-dollar (no implied decimals) numeric amount field, bound to
 * `Decimal` — Record 31's Single Transaction Bond Amount is explicitly whole
 * US dollars, no decimals (matching eBond's convention), per the source PDF's
 * own "STB coverage amount in whole U.S. dollars, no decimals" note. */
function wholeDollarField<K extends string>(
  key: K,
  start: number,
  length: number,
  designation: "M" | "C" | "O"
): FieldSpec<K> {
  return impliedDecimalField(key, start, length, 0, designation);
}

// ── Record 10: Drawback Entry Summary Header ─────────────────────────────────

export const RECORD_10_DRAWBACK_HEADER_SPEC: RecordSpec<DrawbackHeaderInput> = {
  recordType: "Record 10 (Drawback Entry Summary Header)",
  length: 80,
  fields: [
    constantField(1, "10"),
    { key: "summaryFilingActionRequestCode", start: 3, length: 1, class: "A", designation: "M" },
    { key: "entryFilerCode", start: 4, length: 3, class: "AN", designation: "M" },
    filler(7, 2),
    { key: "entryNumberOrDrawbackClaimNumber", start: 9, length: 8, class: "AN", designation: "M" },
    filler(17, 1),
    { key: "drawbackFilingPort", start: 18, length: 4, class: "AN", designation: "M" },
    { key: "brokerReferenceNumber", start: 22, length: 9, class: "X", designation: "O" },
    filler(31, 3),
    { key: "drawbackProvision", start: 34, length: 2, class: "X", designation: "M" },
    { key: "bondWaiverIndicator", start: 36, length: 1, class: "AN", designation: "C" },
    { key: "bondWaiverReasonCode", start: 37, length: 3, class: "AN", designation: "C" },
    { key: "acceleratedPaymentRequestIndicator", start: 40, length: 1, class: "AN", designation: "C" },
    { key: "oneTimeWaiverIndicator", start: 41, length: 1, class: "AN", designation: "C" },
    { key: "waiverPriorNotice", start: 42, length: 1, class: "AN", designation: "C" },
    { key: "commercialInterchangeability", start: 43, length: 1, class: "AN", designation: "C" },
    { key: "electronicPetroleumCertification", start: 44, length: 1, class: "AN", designation: "C" },
    { key: "electronicManufacturingPetroleumCertification", start: 45, length: 1, class: "AN", designation: "C" },
    { key: "oilSpillTaxCertification", start: 46, length: 1, class: "AN", designation: "C" },
    { key: "naftaDrawbackClaimIndicator", start: 47, length: 1, class: "AN", designation: "C" },
    { key: "electronicSignature", start: 48, length: 1, class: "AN", designation: "M" },
    { key: "claimantIdOrImporterRecordNumber", start: 49, length: 12, class: "X", designation: "M" },
    { key: "designatedNotifyPartyNumber", start: 61, length: 12, class: "X", designation: "C" },
    { key: "substitutedUnusedWineCertification", start: 73, length: 1, class: "AN", designation: "C" },
    { key: "billOfMaterialsFormulaCertification", start: 74, length: 1, class: "AN", designation: "C" },
    { key: "certificationForValuationOfDestroyedMerchandise", start: 75, length: 1, class: "AN", designation: "C" },
    { key: "usmcaDrawbackClaimIndicator", start: 76, length: 1, class: "AN", designation: "C" },
    { key: "retailSalesSubstitutionIndicator", start: 77, length: 1, class: "AN", designation: "C" },
    { key: "superfundTaxCertification", start: 78, length: 1, class: "AN", designation: "C" },
    filler(79, 2),
  ],
};

// ── Record 31: Bond Information ──────────────────────────────────────────────

export const RECORD_31_BOND_INFO_SPEC: RecordSpec<BondInfoInput> = {
  recordType: "Record 31 (Bond Information)",
  length: 80,
  fields: [
    constantField(1, "31"),
    { key: "bondTypeCode", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "bondDesignationTypeCode", start: 4, length: 1, class: "AN", designation: "M" },
    filler(5, 1),
    { key: "suretyCompanyCode", start: 6, length: 3, class: "AN", designation: "M" },
    wholeDollarField("singleTransactionBondAmount", 9, 10, "C"),
    { key: "singleTransactionBondNumber", start: 19, length: 10, class: "AN", designation: "C" },
    filler(29, 52),
  ],
};

// ── Record 40: Imports Entry Summary Details ─────────────────────────────────

export const RECORD_40_IMPORTS_DETAILS_SPEC: RecordSpec<ImportsDetailsInput> = {
  recordType: "Record 40 (Imports Entry Summary Details)",
  length: 80,
  fields: [
    constantField(1, "40"),
    { key: "actionIndicator", start: 3, length: 1, class: "AN", designation: "M" },
    filler(4, 2),
    { key: "entryFilerCode", start: 6, length: 3, class: "AN", designation: "M" },
    filler(9, 2),
    { key: "entryNumber", start: 11, length: 8, class: "AN", designation: "M" },
    numericCodeField("cbpEsLineNumber", 19, 5, "M"),
    { key: "drawbackEligibleIndicator", start: 24, length: 1, class: "AN", designation: "C" },
    { key: "manufactureRulingNumber", start: 25, length: 10, class: "AN", designation: "C" },
    filler(35, 2),
    { key: "basisOfClaim", start: 37, length: 2, class: "AN", designation: "C" },
    dateField("manufDateReceived", 39, "C"),
    dateField("manufDateUsed", 45, "C"),
    numericCodeField("importTrackingIdNumber", 51, 5, "M"),
    numericCodeField("drawbackAccountingMethodCode", 56, 2, "C"),
    filler(58, 23),
  ],
};

// ── Record 41: Import Classification ─────────────────────────────────────────

export const RECORD_41_IMPORT_CLASSIFICATION_SPEC: RecordSpec<ImportClassificationInput> = {
  recordType: "Record 41 (Import Classification)",
  length: 80,
  fields: [
    constantField(1, "41"),
    { key: "htsNumber", start: 3, length: 10, class: "AN", designation: "M" },
    { key: "articleDescriptionText", start: 13, length: 50, class: "X", designation: "M" },
    filler(63, 18),
  ],
};

// ── Record 42: Import Quantity & UOM ─────────────────────────────────────────

export const RECORD_42_IMPORT_QUANTITY_UOM_SPEC: RecordSpec<ImportQuantityUomInput> = {
  recordType: "Record 42 (Import Quantity & UOM)",
  length: 80,
  fields: [
    constantField(1, "42"),
    impliedDecimalField("quantity", 3, 16, 4, "M"),
    { key: "unitOfMeasureCode", start: 19, length: 3, class: "X", designation: "M" },
    impliedDecimalField("allowableQuantity", 22, 16, 4, "C"),
    impliedDecimalField("enteredGoodsValuePerUnit", 38, 16, 4, "M"),
    impliedDecimalField("substitutedValuePerUnit", 54, 16, 4, "C"),
    filler(70, 11),
  ],
};

// ── Record 43: Import Revenue Claimed ────────────────────────────────────────

export const RECORD_43_IMPORT_REVENUE_CLAIMED_SPEC: RecordSpec<ImportRevenueClaimedInput> = {
  recordType: "Record 43 (Import Revenue Claimed)",
  length: 80,
  fields: [
    constantField(1, "43"),
    numericCodeField("accountingClassCode", 3, 3, "M"),
    impliedDecimalField("claimAmount", 6, 8, 2, "M"),
    impliedDecimalField("calculatedAmount", 14, 8, 2, "C"),
    impliedDecimalField("adjustedClaimedAmount", 22, 8, 2, "C"),
    { key: "qualifierIndicator", start: 30, length: 2, class: "AN", designation: "C" },
    filler(32, 49),
  ],
};

// ── Record 50: Manufactured/Produced Article Grouping ───────────────────────

export const RECORD_50_MANUFACTURED_ARTICLE_SPEC: RecordSpec<ManufacturedArticleInput> = {
  recordType: "Record 50 (Manufactured/Produced Article Grouping)",
  length: 80,
  fields: [
    constantField(1, "50"),
    { key: "actionIndicator", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "importManufactureRulingNumber", start: 4, length: 10, class: "AN", designation: "M" },
    filler(14, 2),
    { key: "htsNumber", start: 16, length: 10, class: "AN", designation: "M" },
    impliedDecimalField("quantity", 26, 16, 4, "M"),
    { key: "unitOfMeasureCode", start: 42, length: 3, class: "X", designation: "M" },
    dateField("productionDate", 45, "M"),
    { key: "factoryLocation", start: 51, length: 30, class: "AN", designation: "M" },
  ],
};

// ── Record 51: Manufactured/Produced Article Description ────────────────────

export const RECORD_51_MANUFACTURED_DESC_SPEC: RecordSpec<ManufacturedDescInput> = {
  recordType: "Record 51 (Manufactured/Produced Article Description)",
  length: 80,
  fields: [
    constantField(1, "51"),
    { key: "manufacturedArticleDescriptionText", start: 3, length: 50, class: "X", designation: "M" },
    { key: "manufactureRulingNumber", start: 53, length: 10, class: "AN", designation: "C" },
    numericCodeField("manufacturedTrackingIdNumber", 63, 5, "C"),
    filler(68, 13),
  ],
};

/** Shared by Records 52/72 (ITIN linkage) and 53/73 (MTIN linkage) — 15
 * repeating 5-char tracking-ID slots at fixed positions plus trailing filler. */
function trackingIdLinkFields<K extends string>(
  constant: string,
  keyFor: (n: number) => K,
  designationFor: (n: number) => "M" | "C" | "O"
): FieldSpec<K>[] {
  const fields: FieldSpec<K>[] = [constantField(1, constant)];
  for (let n = 1; n <= 15; n++) {
    fields.push(numericCodeField(keyFor(n), 3 + (n - 1) * 5, 5, designationFor(n)));
  }
  fields.push(filler(78, 3));
  return fields;
}

// ── Record 52: Linking Import to Manufactured/Produced Article (ITIN) ───────

export const RECORD_52_LINK_IMPORT_MFG_SPEC: RecordSpec<LinkImportMfgInput> = {
  recordType: "Record 52 (Linking Import to Manufactured/Produced Article)",
  length: 80,
  fields: trackingIdLinkFields(
    "52",
    (n) => `importTrackingIdNumber${n}` as keyof LinkImportMfgInput & string,
    (n) => (n === 1 ? "M" : n === 2 ? "C" : "O")
  ),
};

// ── Record 53: Linking Manufactured Articles to Source Manufactured Articles (MTIN) ─

export const RECORD_53_LINK_MFG_SOURCE_SPEC: RecordSpec<LinkMfgSourceInput> = {
  recordType: "Record 53 (Linking Manufactured Articles to Source Manufactured Articles)",
  length: 80,
  fields: trackingIdLinkFields(
    "53",
    (n) => `manufacturedTrackingIdNumber${n}` as keyof LinkMfgSourceInput & string,
    (n) => (n <= 2 ? "C" : "O")
  ),
};

// ── Record 60: Export/Destroy Articles (Core Drawback) ──────────────────────

export const RECORD_60_EXPORT_DESTROY_SPEC: RecordSpec<ExportDestroyInput> = {
  recordType: "Record 60 (Export/Destroy Articles)",
  length: 80,
  fields: [
    constantField(1, "60"),
    { key: "exportOrDestroyIndicator", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "htsNumber", start: 4, length: 10, class: "AN", designation: "M" },
    impliedDecimalField("exportOrDestroyQuantity", 14, 16, 4, "M"),
    { key: "unitOfMeasureCode", start: 30, length: 3, class: "X", designation: "M" },
    dateField("exportOrDestroyDate", 33, "M"),
    { key: "noticeOfIntentIndicator", start: 39, length: 1, class: "AN", designation: "C" },
    { key: "waiverToDrawbackClaimRightsIndicator", start: 40, length: 1, class: "AN", designation: "C" },
    { key: "nameOfExporterOrDestroyer", start: 41, length: 30, class: "AN", designation: "M" },
    { key: "countryOfUltimateDestination", start: 71, length: 2, class: "AN", designation: "C" },
    { key: "billOfLadingIndicator", start: 73, length: 1, class: "AN", designation: "O" },
    { key: "billOfLadingCarrierCode", start: 74, length: 4, class: "AN", designation: "O" },
    filler(78, 3),
  ],
};

// ── Record 61: Export/Destroy Articles Descriptions ──────────────────────────

export const RECORD_61_EXPORT_DESC_SPEC: RecordSpec<ExportDescInput> = {
  recordType: "Record 61 (Export/Destroy Articles Descriptions)",
  length: 80,
  fields: [
    constantField(1, "61"),
    { key: "exportOrDestroyArticleDescriptionText", start: 3, length: 50, class: "X", designation: "M" },
    { key: "exportOrDestroyUniqueIdentifierNumber", start: 53, length: 28, class: "X", designation: "M" },
  ],
};

// ── Record 62: Notice of Intent ──────────────────────────────────────────────

export const RECORD_62_NOTICE_OF_INTENT_SPEC: RecordSpec<NoticeOfIntentInput> = {
  recordType: "Record 62 (Notice of Intent)",
  length: 80,
  fields: [
    constantField(1, "62"),
    { key: "intendedPortOfExport", start: 3, length: 4, class: "AN", designation: "C" },
    { key: "examinationWitnessIndicator", start: 7, length: 1, class: "AN", designation: "M" },
    { key: "locationOfDestruction", start: 8, length: 30, class: "AN", designation: "C" },
    { key: "resultsOfExaminationOrWitnessOfDestruction", start: 38, length: 1, class: "AN", designation: "C" },
    filler(39, 42),
  ],
};

// ── Record 63: Examination & Witness Record ──────────────────────────────────

export const RECORD_63_EXAM_WITNESS_SPEC: RecordSpec<ExamWitnessInput> = {
  recordType: "Record 63 (Examination & Witness Record)",
  length: 80,
  fields: [
    constantField(1, "63"),
    { key: "recordIndicator", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "nameOfCbpPersonnel", start: 4, length: 40, class: "AN", designation: "M" },
    { key: "cbpPersonnelBadgeNumber", start: 44, length: 12, class: "AN", designation: "M" },
    { key: "cbpPersonnelPhoneNumber", start: 56, length: 10, class: "AN", designation: "M" },
    dateField("processingExaminationDate", 66, "M"),
    filler(72, 9),
  ],
};

// ── Record 64: NAFTA/USMCA Coding Group ──────────────────────────────────────

export const RECORD_64_NAFTA_USMCA_SPEC: RecordSpec<NaftaUsmcaInput> = {
  recordType: "Record 64 (NAFTA/USMCA Coding Group)",
  length: 80,
  fields: [
    constantField(1, "64"),
    { key: "entryNumber", start: 3, length: 20, class: "AN", designation: "M" },
    dateField("entryDate", 23, "M"),
    impliedDecimalField("dutyPaidToForeignGovtLocalCurrency", 29, 10, 2, "M"),
    // Exchange rate to ONE US dollar — 6 implied decimal places, a new
    // precision level for this chapter (every other money field here uses 2
    // or 4). impliedDecimalField's `decimals` param is generic (scales by
    // 10^decimals via Decimal.pow), so decimals: 6 works without any change
    // to the helper itself.
    impliedDecimalField("exchangeRate", 39, 10, 6, "M"),
    { key: "tariffNumber1", start: 49, length: 10, class: "AN", designation: "M" },
    { key: "tariffNumber2", start: 59, length: 10, class: "AN", designation: "C" },
    { key: "tariffNumber3", start: 69, length: 10, class: "AN", designation: "C" },
    { key: "countryOfExport", start: 79, length: 2, class: "AN", designation: "M" },
  ],
};

// ── Record 70: TFTEA Export/Destroy Articles ─────────────────────────────────

export const RECORD_70_TFTEA_EXPORT_DESTROY_SPEC: RecordSpec<TfteaExportDestroyInput> = {
  recordType: "Record 70 (TFTEA Export/Destroy Articles)",
  length: 80,
  fields: [
    constantField(1, "70"),
    { key: "exportOrDestroyIndicator", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "htsNumber", start: 4, length: 10, class: "AN", designation: "M" },
    impliedDecimalField("exportOrDestroyQuantity", 14, 16, 4, "M"),
    { key: "unitOfMeasureCode", start: 30, length: 3, class: "X", designation: "M" },
    dateField("exportOrDestroyDate", 33, "M"),
    { key: "noticeOfIntentIndicator", start: 39, length: 1, class: "AN", designation: "C" },
    { key: "waiverToDrawbackClaimRightsIndicator", start: 40, length: 1, class: "AN", designation: "C" },
    { key: "nameOfExporterOrDestroyer", start: 41, length: 30, class: "AN", designation: "M" },
    { key: "countryOfUltimateDestination", start: 71, length: 2, class: "AN", designation: "C" },
    { key: "billOfLadingIndicator", start: 73, length: 1, class: "AN", designation: "O" },
    { key: "billOfLadingCarrierCode", start: 74, length: 4, class: "AN", designation: "O" },
    { key: "scheduleBCode", start: 78, length: 1, class: "AN", designation: "C" },
    filler(79, 2),
  ],
};

// ── Record 71: TFTEA Export/Destroy Articles Descriptions ───────────────────
// Same layout as Record 61 (description first, then unique identifier).

export const RECORD_71_TFTEA_EXPORT_DESC_SPEC: RecordSpec<TfteaExportDescInput> = {
  recordType: "Record 71 (TFTEA Export/Destroy Articles Descriptions)",
  length: 80,
  fields: [
    constantField(1, "71"),
    { key: "exportOrDestroyArticleDescriptionText", start: 3, length: 50, class: "X", designation: "M" },
    { key: "exportOrDestroyUniqueIdentifierNumber", start: 53, length: 28, class: "X", designation: "M" },
  ],
};

// ── Record 72: Linking Export to Import Article (ITIN) ──────────────────────

export const RECORD_72_LINK_EXPORT_IMPORT_SPEC: RecordSpec<LinkExportImportInput> = {
  recordType: "Record 72 (Linking Export to Import Article)",
  length: 80,
  fields: trackingIdLinkFields(
    "72",
    (n) => `importTrackingIdNumber${n}` as keyof LinkExportImportInput & string,
    (n) => (n === 1 ? "M" : "O")
  ),
};

// ── Record 73: Linking Export to Manufactured/Produced Article (MTIN) ───────

export const RECORD_73_LINK_EXPORT_MFG_SPEC: RecordSpec<LinkExportMfgInput> = {
  recordType: "Record 73 (Linking Export to Manufactured/Produced Article)",
  length: 80,
  fields: trackingIdLinkFields(
    "73",
    (n) => `manufacturedTrackingIdNumber${n}` as keyof LinkExportMfgInput & string,
    (n) => (n === 1 ? "C" : "O")
  ),
};

// ── Record 89: Revenue Totals by Accounting Class Code ──────────────────────

export const RECORD_89_REVENUE_CLASS_TOTALS_SPEC: RecordSpec<RevenueClassTotalsInput> = {
  recordType: "Record 89 (Revenue Totals by Accounting Class Code)",
  length: 80,
  fields: [
    constantField(1, "89"),
    numericCodeField("accountingClassCode1", 3, 3, "M"),
    impliedDecimalField("totalAmount1", 6, 11, 2, "M"),
    filler(17, 2),
    numericCodeField("accountingClassCode2", 19, 3, "C"),
    impliedDecimalField("totalAmount2", 22, 11, 2, "C"),
    filler(33, 2),
    numericCodeField("accountingClassCode3", 35, 3, "C"),
    impliedDecimalField("totalAmount3", 38, 11, 2, "C"),
    filler(49, 2),
    numericCodeField("accountingClassCode4", 51, 3, "C"),
    impliedDecimalField("totalAmount4", 54, 11, 2, "C"),
    filler(65, 16),
  ],
};

// ── Record 90: Revenue Totals (Grand Totals) ─────────────────────────────────

export const RECORD_90_REVENUE_GRAND_TOTALS_SPEC: RecordSpec<RevenueGrandTotalsInput> = {
  recordType: "Record 90 (Revenue Totals)",
  length: 80,
  fields: [
    constantField(1, "90"),
    impliedDecimalField("grandTotalDutyAmount", 3, 11, 2, "C"),
    filler(14, 1),
    impliedDecimalField("grandTotalUserFeeAmount", 15, 11, 2, "C"),
    filler(26, 1),
    impliedDecimalField("grandTotalIrTaxAmount", 27, 11, 2, "C"),
    filler(38, 43),
  ],
};

// ── Output Record E0: Drawback Entry Summary Condition Reference ────────────
// Positions 1-25 (control id, reference data type code, occurrence position,
// "REF ID:" literal) are the chapter-agnostic conditionReferencePrefix shared
// with Batch & Block Control's X0-Record and Entry Summary's E0-Record.

export const RECORD_E0_CONDITION_REF_SPEC: RecordSpec<DrawbackE0Input> = {
  recordType: "Record E0 (Drawback Entry Summary Condition Reference)",
  length: 80,
  fields: [
    ...conditionReferencePrefix("E0"),
    { key: "referenceDataText", start: 26, length: 55, class: "X", designation: "M" },
  ],
};

// ── Output Record E1: Entry Summary Condition/Disposition Response ──────────

export const RECORD_E1_DISPOSITION_RESPONSE_SPEC: RecordSpec<DrawbackE1Input> = {
  recordType: "Record E1 (Entry Summary Condition/Disposition Response)",
  length: 80,
  fields: [
    constantField(1, "E1"),
    { key: "dispositionTypeCode", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "severityCode", start: 4, length: 1, class: "AN", designation: "M" },
    { key: "conditionCode", start: 5, length: 3, class: "AN", designation: "M" },
    { key: "reasonCode", start: 8, length: 3, class: "AN", designation: "C" },
    { key: "narrativeText", start: 11, length: 40, class: "AN", designation: "M" },
    { key: "entryFilerCode", start: 51, length: 3, class: "AN", designation: "C" },
    filler(54, 2),
    { key: "entryNumber", start: 56, length: 8, class: "AN", designation: "C" },
    { key: "versionNumber", start: 64, length: 5, class: "AN", designation: "C" },
    { key: "brokerReferenceNumber", start: 69, length: 9, class: "X", designation: "C" },
    filler(78, 3),
  ],
};
