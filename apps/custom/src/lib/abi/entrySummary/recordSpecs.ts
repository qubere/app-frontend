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
  HeaderControlInput,
  HeaderContentInput,
  LineItemHeaderInput,
  TariffDetailInput,
  FeeTotalInput,
  GrandTotalsInput,
  E0SummaryReference,
  E0OtherReference,
  E1Record,
  BondDetailInput,
  FtzStatusInput,
  FtzPrivilegedStatusDetailInput,
  AdcvdCaseDetailInput,
  AdcvdDutyTotalsInput,
  InvoiceLineReferenceInput,
  RulingsDetailInput,
  CommercialDescriptionInput,
  LicenseCertificatePermitInput,
  LineEntityInput,
  LineEntityGbiInput,
  LineEntityStreetAddressInput,
  LineEntityGeographicAreaInput,
  GbiPartyTypeDescriptionInput,
  ArticlePartyInput,
  StandardVisaInput,
  ImportersAdditionalDeclarationInput,
  HeaderFeesInput,
  LineUserFeeInput,
  IrTaxInput,
  OtherRevenueInput,
  PscHeaderReasonsInput,
  PscFilingExplanationInput,
  PscLineReasonsInput,
  CensusWarningOverrideInput,
} from "./types";

// RecordSpecs for the CATAIR Entry Summary Create/Update (AE) input records —
// core MVP subset (10, 11, 40, 50, 89, 90) plus the AD/CVD, Bond, and FTZ
// records (31, 41, SE61, 53, 88).
// Source: docs/plans/catair-source-docs/02-entry-summary-create-update-2026-07.pdf

/** A right-justified, zero-padded numeric field with `decimals` implied decimal
 * places on the wire (e.g. Duty Amount: 2 implied decimals, $1,234.56 -> "0000123456"
 * for a 10-char field). Bound to `Decimal`, never a float.
 *
 * Rounds directly to the field's own `decimals` count rather than pre-rounding
 * through `roundToCents` (harmless when every caller passes `decimals: 2`, but
 * would silently truncate a genuinely 4-implied-decimal field — e.g. the
 * 53-Record's AD/CVD Quantity — down to 2 decimals before scaling). Same fix
 * as the Drawback chapter's own `impliedDecimalField` applied for the same
 * reason; see its comment for the full rationale.
 *
 * `cls` defaults to "SN" (money/rate fields, per this chapter's existing
 * convention) but the 41-Record's FTZ Line Item Quantity is documented as
 * plain class "N" (not "(S)N") in the source PDF, so it's a caller-supplied
 * override rather than a hardcoded assumption.
 */
function impliedDecimalField<K extends string>(
  key: K,
  start: number,
  length: number,
  decimals: number,
  designation: "M" | "C" | "O",
  cls: "SN" | "N" = "SN"
): FieldSpec<K> {
  const scale = new Decimal(10).pow(decimals);
  return {
    key,
    start,
    length,
    class: cls,
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

/** A whole-dollar (no implied decimals) numeric amount field. */
function wholeDollarField<K extends string>(
  key: K,
  start: number,
  length: number,
  designation: "M" | "C" | "O"
): FieldSpec<K> {
  return impliedDecimalField(key, start, length, 0, designation);
}

// ── 10-Record: Entry Summary Header Control ─────────────────────────────────

export const HEADER_CONTROL_SPEC: RecordSpec<HeaderControlInput> = {
  recordType: "10-Record (Entry Summary Header Control)",
  length: 80,
  fields: [
    constantField(1, "10"),
    { key: "summaryFilingActionRequestCode", start: 3, length: 1, class: "A", designation: "M" },
    { key: "entryFilerCode", start: 4, length: 3, class: "AN", designation: "M" },
    filler(7, 2),
    { key: "entryNumber", start: 9, length: 8, class: "AN", designation: "M" },
    filler(17, 1),
    { key: "districtPortOfEntry", start: 18, length: 4, class: "AN", designation: "M" },
    { key: "brokerReferenceNumber", start: 22, length: 9, class: "X", designation: "C" },
    filler(31, 3),
    { key: "entryTypeCode", start: 34, length: 2, class: "AN", designation: "M" },
    { key: "modeOfTransportationCode", start: 36, length: 2, class: "AN", designation: "C" },
    { key: "bondWaiverIndicator", start: 38, length: 1, class: "AN", designation: "C" },
    { key: "electronicSignature", start: 39, length: 1, class: "AN", designation: "C" },
    { key: "cargoReleaseCertificationRequestIndicator", start: 40, length: 1, class: "AN", designation: "C" },
    { key: "electronicInvoiceIndicator", start: 41, length: 1, class: "AN", designation: "C" },
    { key: "consolidatedSummaryIndicator", start: 42, length: 1, class: "AN", designation: "C" },
    { key: "shipmentUsageTypeCode", start: 43, length: 1, class: "AN", designation: "C" },
    { key: "liveEntryIndicator", start: 44, length: 1, class: "AN", designation: "C" },
    { key: "deferredTaxPaymentCode", start: 45, length: 1, class: "AN", designation: "C" },
    { key: "tradeAgreementReconciliationIndicator", start: 46, length: 1, class: "AN", designation: "C" },
    { key: "reconciliationIssueCode", start: 47, length: 3, class: "AN", designation: "C" },
    filler(50, 1),
    { key: "paymentTypeCode", start: 51, length: 1, class: "AN", designation: "C" },
    dateField("preliminaryStatementPrintDate", 52, "C"),
    { key: "periodicStatementMonth", start: 58, length: 2, class: "AN", designation: "C" },
    { key: "statementClientBranchIdentifier", start: 60, length: 2, class: "AN", designation: "C" },
    { key: "bondWaiverReasonCode", start: 62, length: 3, class: "AN", designation: "C" },
    { key: "postSummaryCorrectionIndicator", start: 65, length: 1, class: "AN", designation: "C" },
    { key: "acceleratedLiquidationRequestIndicator", start: 66, length: 1, class: "AN", designation: "C" },
    { key: "knownImporterIndicator", start: 67, length: 1, class: "AN", designation: "O" },
    { key: "pgaDataIncludedIndicator", start: 68, length: 1, class: "AN", designation: "C" },
    { key: "tibDeclarationIndicator", start: 69, length: 1, class: "AN", designation: "C" },
    { key: "consolidatedExpressInformalIndicator", start: 70, length: 1, class: "AN", designation: "C" },
    filler(71, 10),
  ],
};

// ── 11-Record: Entry Summary Header Content ─────────────────────────────────

export const HEADER_CONTENT_SPEC: RecordSpec<HeaderContentInput> = {
  recordType: "11-Record (Entry Summary Header Content)",
  length: 80,
  fields: [
    constantField(1, "11"),
    { key: "importerOfRecordNumber", start: 3, length: 12, class: "X", designation: "M" },
    { key: "consigneeNumber", start: 15, length: 12, class: "X", designation: "C" },
    { key: "designatedNotifyPartyNumber", start: 27, length: 12, class: "X", designation: "C" },
    filler(39, 3),
    dateField("estimatedEntryDate", 42, "C"),
    dateField("dateOfImportation", 48, "C"),
    filler(54, 7),
    { key: "usStateOfDestinationCode", start: 61, length: 2, class: "AN", designation: "C" },
    { key: "foreignTradeZoneIdentifier", start: 63, length: 9, class: "AN", designation: "C" },
    filler(72, 9),
  ],
};

// ── 40-Record: Line Item Header ─────────────────────────────────────────────

export const LINE_ITEM_HEADER_SPEC: RecordSpec<LineItemHeaderInput> = {
  recordType: "40-Record (Line Item Header)",
  length: 80,
  fields: [
    constantField(1, "40"),
    filler(3, 2),
    { key: "lineItemIdentifier", start: 5, length: 3, class: "X", designation: "M" },
    { key: "articleSetIndicator", start: 8, length: 1, class: "AN", designation: "C" },
    { key: "countryOfOriginCode", start: 9, length: 2, class: "X", designation: "M" },
    { key: "countryOfExportCode", start: 11, length: 2, class: "AN", designation: "C" },
    dateField("dateOfExportation", 13, "C"),
    dateField("dateOfExportationForTextiles", 19, "C"),
    { key: "tradeAgreementSpecialProgramClaimCode", start: 25, length: 2, class: "AN", designation: "C" },
    wholeDollarField("chargesAmount", 27, 10, "C"),
    { key: "foreignPortOfLadingCode", start: 37, length: 5, class: "AN", designation: "C" },
    wholeDollarField("grossShippingWeight", 42, 10, "C"),
    numericCodeField("categoryCodeForTextiles", 52, 3, "C"),
    { key: "productClaimCode", start: 55, length: 1, class: "AN", designation: "C" },
    { key: "relatedPartyIndicator", start: 56, length: 1, class: "AN", designation: "C" },
    { key: "naftaNetCostIndicator", start: 57, length: 1, class: "AN", designation: "C" },
    { key: "feeExemptionCode", start: 58, length: 1, class: "AN", designation: "C" },
    filler(59, 1),
    { key: "adCaseNonReimbursementStatement", start: 60, length: 1, class: "AN", designation: "C" },
    filler(61, 20),
  ],
};

// ── 50-Record: Tariff/Value/Quantity Detail ─────────────────────────────────

export const TARIFF_DETAIL_SPEC: RecordSpec<TariffDetailInput> = {
  recordType: "50-Record (Tariff/Value/Quantity Detail)",
  length: 80,
  fields: [
    constantField(1, "50"),
    { key: "htsNumber", start: 3, length: 10, class: "AN", designation: "M" },
    filler(13, 1),
    impliedDecimalField("dutyAmount", 14, 10, 2, "M"),
    filler(24, 1),
    wholeDollarField("valueOfGoodsAmount", 25, 10, "M"),
    filler(35, 1),
    impliedDecimalField("quantity1", 36, 12, 2, "C"),
    { key: "unitOfMeasureCode1", start: 48, length: 3, class: "AN", designation: "M" },
    impliedDecimalField("quantity2", 51, 12, 2, "C"),
    { key: "unitOfMeasureCode2", start: 63, length: 3, class: "AN", designation: "C" },
    impliedDecimalField("quantity3", 66, 12, 2, "C"),
    { key: "unitOfMeasureCode3", start: 78, length: 3, class: "AN", designation: "C" },
  ],
};

// ── 89-Record: Fee Total Detail ──────────────────────────────────────────────
// 5 repeating Accounting Class Code + Total Fee Amount pairs at fixed positions
// (not a loop construct in fixedWidth.ts — just more FieldSpec entries).

export const FEE_TOTAL_SPEC: RecordSpec<FeeTotalInput> = {
  recordType: "89-Record (Fee Total Detail)",
  length: 80,
  fields: [
    constantField(1, "89"),
    numericCodeField("accountingClassCode1", 3, 3, "M"),
    impliedDecimalField("totalFeeAmount1", 6, 11, 2, "M"),
    numericCodeField("accountingClassCode2", 17, 3, "C"),
    impliedDecimalField("totalFeeAmount2", 20, 11, 2, "C"),
    numericCodeField("accountingClassCode3", 31, 3, "C"),
    impliedDecimalField("totalFeeAmount3", 34, 11, 2, "C"),
    numericCodeField("accountingClassCode4", 45, 3, "C"),
    impliedDecimalField("totalFeeAmount4", 48, 11, 2, "C"),
    numericCodeField("accountingClassCode5", 59, 3, "C"),
    impliedDecimalField("totalFeeAmount5", 62, 11, 2, "C"),
    filler(73, 8),
  ],
};

// ── 90-Record: Grand Totals ──────────────────────────────────────────────────

export const GRAND_TOTALS_SPEC: RecordSpec<GrandTotalsInput> = {
  recordType: "90-Record (Grand Totals)",
  length: 80,
  fields: [
    constantField(1, "90"),
    impliedDecimalField("grandTotalDutyAmount", 3, 11, 2, "C"),
    filler(14, 1),
    impliedDecimalField("grandTotalUserFeeAmount", 15, 11, 2, "C"),
    filler(26, 1),
    impliedDecimalField("grandTotalIrTaxAmount", 27, 11, 2, "C"),
    filler(38, 1),
    impliedDecimalField("grandTotalAdDutyAmount", 39, 11, 2, "C"),
    filler(50, 1),
    impliedDecimalField("grandTotalCvDutyAmount", 51, 11, 2, "C"),
    filler(62, 1),
    impliedDecimalField("grandTotalOtherRevenueAmount", 63, 11, 2, "C"),
    filler(74, 7),
  ],
};

// ── 31-Record: Bond Detail ───────────────────────────────────────────────────

export const BOND_DETAIL_SPEC: RecordSpec<BondDetailInput> = {
  recordType: "31-Record (Bond Detail)",
  length: 80,
  fields: [
    constantField(1, "31"),
    { key: "bondTypeCode", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "bondDesignationTypeCode", start: 4, length: 1, class: "AN", designation: "M" },
    { key: "continuousBondIndicator", start: 5, length: 1, class: "AN", designation: "C" },
    { key: "suretyCompanyCode", start: 6, length: 3, class: "AN", designation: "M" },
    wholeDollarField("singleTransactionBondAmount", 9, 10, "C"),
    { key: "singleTransactionBondProducerAccountNumber", start: 19, length: 10, class: "AN", designation: "O" },
    filler(29, 52),
  ],
};

// ── 41-Record: FTZ Status Information ────────────────────────────────────────

export const FTZ_STATUS_SPEC: RecordSpec<FtzStatusInput> = {
  recordType: "41-Record (FTZ Status Information)",
  length: 80,
  fields: [
    constantField(1, "41"),
    { key: "ftzMerchandiseStatusCode", start: 3, length: 1, class: "AN", designation: "M" },
    dateField("privilegedFtzMerchandiseFilingDate", 4, "C"),
    impliedDecimalField("ftzLineItemQuantity", 10, 10, 0, "M", "N"),
    filler(20, 61),
  ],
};

// ── SE61-Record: FTZ Privileged Foreign Status Additional Detail ────────────
// Unlike this chapter's 2-char-code detail records, SE61's own control
// identifier is a single 4-char literal — `constantField` already supports an
// arbitrary-length literal, so this needs no new helper, just a 4-char value.

export const FTZ_PRIVILEGED_STATUS_DETAIL_SPEC: RecordSpec<FtzPrivilegedStatusDetailInput> = {
  recordType: "SE61-Record (FTZ Privileged Foreign Status Additional Detail)",
  length: 80,
  fields: [
    constantField(1, "SE61"),
    { key: "currentHtsNumber", start: 5, length: 10, class: "AN", designation: "M" },
    filler(15, 66),
  ],
};

// ── 53-Record: AD/CVD Case Detail ────────────────────────────────────────────
// Three distinct implied-decimal conventions in one record: Case Deposit Rate
// (2 decimals), AD/CVD Value of Goods Amount (0 — whole dollars), AD/CVD
// Quantity (4 decimals), AD/CVD Duty Amount (2 decimals) — each applied per
// field below, not a blanket record-level assumption.

export const ADCVD_CASE_DETAIL_SPEC: RecordSpec<AdcvdCaseDetailInput> = {
  recordType: "53-Record (AD/CVD Case Detail)",
  length: 80,
  fields: [
    constantField(1, "53"),
    { key: "caseNumber", start: 3, length: 10, class: "AN", designation: "M" },
    { key: "bondCashClaimCode", start: 13, length: 1, class: "AN", designation: "M" },
    impliedDecimalField("caseDepositRate", 14, 8, 2, "M"),
    { key: "caseRateTypeQualifierCode", start: 22, length: 1, class: "AN", designation: "M" },
    filler(23, 2),
    wholeDollarField("valueOfGoodsAmount", 25, 10, "C"),
    impliedDecimalField("quantity", 35, 12, 4, "C"),
    impliedDecimalField("dutyAmount", 47, 10, 2, "M"),
    { key: "nonReimbursementDeclarationIdentifier", start: 57, length: 10, class: "AN", designation: "C" },
    filler(67, 14),
  ],
};

// ── 88-Record: AD/CVD Duty Totals ────────────────────────────────────────────

export const ADCVD_DUTY_TOTALS_SPEC: RecordSpec<AdcvdDutyTotalsInput> = {
  recordType: "88-Record (AD/CVD Duty Totals)",
  length: 80,
  fields: [
    constantField(1, "88"),
    impliedDecimalField("totalBondedAdDutyAmount", 3, 11, 2, "C"),
    filler(14, 1),
    impliedDecimalField("totalCashDepositAdDutyAmount", 15, 11, 2, "C"),
    filler(26, 1),
    impliedDecimalField("totalBondedCvDutyAmount", 27, 11, 2, "C"),
    filler(38, 1),
    impliedDecimalField("totalCashDepositCvDutyAmount", 39, 11, 2, "C"),
    filler(50, 31),
  ],
};

// ── 42-Record: Invoice Line Reference Detail ─────────────────────────────────
// The source PDF's field order is Control Identifier / Supplier ID Code (15AN,
// 3-17) / Invoice Number (17X, 18-34) / ... — an earlier reading of this record
// mistook the Supplier ID Code column for filler and shifted every field after
// it 15 positions early. The invoice line range fields are plain integers (no
// implied decimals — class "(S)N" per the PDF, distinct from an implied-decimal
// money amount), so they use a plain `SN`-class field rather than
// `impliedDecimalField`.

export const INVOICE_LINE_REFERENCE_SPEC: RecordSpec<InvoiceLineReferenceInput> = {
  recordType: "42-Record (Invoice Line Reference Detail)",
  length: 80,
  fields: [
    constantField(1, "42"),
    { key: "supplierIdCode", start: 3, length: 15, class: "AN", designation: "M" },
    { key: "invoiceNumber", start: 18, length: 17, class: "X", designation: "M" },
    filler(35, 1),
    { key: "invoiceLineRange1Begin", start: 36, length: 4, class: "SN", designation: "M" },
    filler(40, 1),
    { key: "invoiceLineRange1End", start: 41, length: 4, class: "SN", designation: "M" },
    filler(45, 1),
    { key: "invoiceLineRange2Begin", start: 46, length: 4, class: "SN", designation: "C" },
    filler(50, 1),
    { key: "invoiceLineRange2End", start: 51, length: 4, class: "SN", designation: "C" },
    filler(55, 1),
    { key: "invoiceLineRange3Begin", start: 56, length: 4, class: "SN", designation: "C" },
    filler(60, 1),
    { key: "invoiceLineRange3End", start: 61, length: 4, class: "SN", designation: "C" },
    filler(65, 1),
    { key: "invoiceLineRange4Begin", start: 66, length: 4, class: "SN", designation: "C" },
    filler(70, 1),
    { key: "invoiceLineRange4End", start: 71, length: 4, class: "SN", designation: "C" },
    filler(75, 6),
  ],
};

// ── 43-Record: Rulings Detail ────────────────────────────────────────────────

export const RULINGS_DETAIL_SPEC: RecordSpec<RulingsDetailInput> = {
  recordType: "43-Record (Rulings Detail)",
  length: 80,
  fields: [
    constantField(1, "43"),
    { key: "rulingTypeCode", start: 3, length: 1, class: "AN", designation: "M" },
    filler(4, 5),
    { key: "rulingNumber", start: 9, length: 6, class: "AN", designation: "C" },
    filler(15, 66),
  ],
};

// ── 44-Record: Commercial Description ────────────────────────────────────────

export const COMMERCIAL_DESCRIPTION_SPEC: RecordSpec<CommercialDescriptionInput> = {
  recordType: "44-Record (Commercial Description)",
  length: 80,
  fields: [
    constantField(1, "44"),
    { key: "commercialDescriptionText", start: 3, length: 70, class: "X", designation: "M" },
    filler(73, 8),
  ],
};

// ── 52-Record: License/Certificate/Permit Detail ─────────────────────────────

export const LICENSE_CERTIFICATE_PERMIT_SPEC: RecordSpec<LicenseCertificatePermitInput> = {
  recordType: "52-Record (License/Certificate/Permit Detail)",
  length: 80,
  fields: [
    constantField(1, "52"),
    { key: "licenseCertificatePermitTypeCode", start: 3, length: 2, class: "AN", designation: "M" },
    { key: "licenseCertificatePermitNumber", start: 5, length: 10, class: "X", designation: "M" },
    filler(15, 10),
    filler(25, 56),
  ],
};

// ── SE50-Record: Line Entity Name and Type ───────────────────────────────────

export const LINE_ENTITY_SPEC: RecordSpec<LineEntityInput> = {
  recordType: "SE50-Record (Line Entity Name and Type)",
  length: 80,
  fields: [
    constantField(1, "SE50"),
    { key: "entityCode", start: 5, length: 3, class: "A", designation: "M" },
    { key: "entityName", start: 8, length: 35, class: "X", designation: "C" },
    { key: "entityIdentifierQualifier", start: 43, length: 3, class: "X", designation: "C" },
    { key: "entityIdentifier", start: 46, length: 20, class: "X", designation: "C" },
    filler(66, 15),
  ],
};

// ── SE51-Record: Line Entity GBI Identifier ──────────────────────────────────

export const LINE_ENTITY_GBI_SPEC: RecordSpec<LineEntityGbiInput> = {
  recordType: "SE51-Record (Line Entity GBI Identifier)",
  length: 80,
  fields: [
    constantField(1, "SE51"),
    { key: "gbiIdentifierQualifier", start: 5, length: 4, class: "A", designation: "M" },
    { key: "identifier", start: 9, length: 35, class: "AN", designation: "M" },
    filler(44, 37),
  ],
};

// ── SE55-Record: Line Entity Street Address ──────────────────────────────────

export const LINE_ENTITY_STREET_ADDRESS_SPEC: RecordSpec<LineEntityStreetAddressInput> = {
  recordType: "SE55-Record (Line Entity Street Address)",
  length: 80,
  fields: [
    constantField(1, "SE55"),
    { key: "addressComponentQualifier1", start: 5, length: 2, class: "AN", designation: "M" },
    { key: "addressInformation1", start: 7, length: 35, class: "X", designation: "M" },
    { key: "addressComponentQualifier2", start: 42, length: 2, class: "AN", designation: "O" },
    { key: "addressInformation2", start: 44, length: 35, class: "X", designation: "O" },
    filler(79, 2),
  ],
};

// ── SE56-Record: Line Entity Geographic Area ─────────────────────────────────

export const LINE_ENTITY_GEOGRAPHIC_AREA_SPEC: RecordSpec<LineEntityGeographicAreaInput> = {
  recordType: "SE56-Record (Line Entity Geographic Area)",
  length: 80,
  fields: [
    constantField(1, "SE56"),
    { key: "cityName", start: 5, length: 35, class: "X", designation: "M" },
    { key: "countrySubEntityCode", start: 40, length: 3, class: "AN", designation: "C" },
    filler(43, 6),
    { key: "postalCode", start: 49, length: 15, class: "X", designation: "C" },
    { key: "countryCode", start: 64, length: 2, class: "A", designation: "M" },
    filler(66, 15),
  ],
};

// ── SE32/SE52-Record: Entity GBI Party Type Description ──────────────────────
// Identical layout at header and line level bar the control identifier.
// See PDF pages ESF-62 (header) and ESF-86 (line).

export const HEADER_ENTITY_GBI_PARTY_TYPE_SPEC: RecordSpec<GbiPartyTypeDescriptionInput> = {
  recordType: "SE32-Record (Header Entity GBI Party Type Description)",
  length: 80,
  fields: [
    constantField(1, "SE32"),
    { key: "sequenceNumber", start: 5, length: 1, class: "N", designation: "M" },
    { key: "description", start: 6, length: 75, class: "X", designation: "M" },
  ],
};

export const LINE_ENTITY_GBI_PARTY_TYPE_SPEC: RecordSpec<GbiPartyTypeDescriptionInput> = {
  recordType: "SE52-Record (Line Entity GBI Party Type Description)",
  length: 80,
  fields: [
    constantField(1, "SE52"),
    { key: "sequenceNumber", start: 5, length: 1, class: "N", designation: "M" },
    { key: "description", start: 6, length: 75, class: "X", designation: "M" },
  ],
};

// ── SE30/SE31/SE35/SE36-Record: Header Level Cargo Entity Grouping ───────────
// Same field layouts as SE50/SE51/SE55/SE56 (only the control identifier
// differs) — verified field-for-field against the PDF. See PDF pages ESF-59
// through ESF-64.

export const HEADER_ENTITY_SPEC: RecordSpec<LineEntityInput> = {
  recordType: "SE30-Record (Header Entity Name and Type)",
  length: 80,
  fields: [
    constantField(1, "SE30"),
    { key: "entityCode", start: 5, length: 3, class: "A", designation: "M" },
    { key: "entityName", start: 8, length: 35, class: "X", designation: "C" },
    { key: "entityIdentifierQualifier", start: 43, length: 3, class: "X", designation: "C" },
    { key: "entityIdentifier", start: 46, length: 20, class: "X", designation: "C" },
    filler(66, 15),
  ],
};

export const HEADER_ENTITY_GBI_SPEC: RecordSpec<LineEntityGbiInput> = {
  recordType: "SE31-Record (Header Entity GBI Identifier)",
  length: 80,
  fields: [
    constantField(1, "SE31"),
    { key: "gbiIdentifierQualifier", start: 5, length: 4, class: "A", designation: "M" },
    { key: "identifier", start: 9, length: 35, class: "AN", designation: "M" },
    filler(44, 37),
  ],
};

export const HEADER_ENTITY_STREET_ADDRESS_SPEC: RecordSpec<LineEntityStreetAddressInput> = {
  recordType: "SE35-Record (Header Entity Street Address)",
  length: 80,
  fields: [
    constantField(1, "SE35"),
    { key: "addressComponentQualifier1", start: 5, length: 2, class: "AN", designation: "M" },
    { key: "addressInformation1", start: 7, length: 35, class: "X", designation: "M" },
    { key: "addressComponentQualifier2", start: 42, length: 2, class: "AN", designation: "O" },
    { key: "addressInformation2", start: 44, length: 35, class: "X", designation: "O" },
    filler(79, 2),
  ],
};

export const HEADER_ENTITY_GEOGRAPHIC_AREA_SPEC: RecordSpec<LineEntityGeographicAreaInput> = {
  recordType: "SE36-Record (Header Entity Geographic Area)",
  length: 80,
  fields: [
    constantField(1, "SE36"),
    { key: "cityName", start: 5, length: 35, class: "X", designation: "M" },
    { key: "countrySubEntityCode", start: 40, length: 3, class: "AN", designation: "C" },
    filler(43, 6),
    { key: "postalCode", start: 49, length: 15, class: "X", designation: "C" },
    { key: "countryCode", start: 64, length: 2, class: "A", designation: "M" },
    filler(66, 15),
  ],
};

// ── 47-Record: Article Party ──────────────────────────────────────────────────
// See PDF page ESF-78.

export const ARTICLE_PARTY_SPEC: RecordSpec<ArticlePartyInput> = {
  recordType: "47-Record (Article Party)",
  length: 80,
  fields: [
    constantField(1, "47"),
    { key: "partyTypeCode", start: 3, length: 1, class: "AN", designation: "M" },
    { key: "partyIdentifier", start: 4, length: 15, class: "AN", designation: "M" },
    filler(19, 62),
  ],
};

// ── 51-Record: Standard Visa Information ─────────────────────────────────────
// See PDF page ESF-94.

export const STANDARD_VISA_SPEC: RecordSpec<StandardVisaInput> = {
  recordType: "51-Record (Standard Visa Information)",
  length: 80,
  fields: [
    constantField(1, "51"),
    { key: "standardVisaNumber", start: 3, length: 9, class: "AN", designation: "M" },
    filler(12, 69),
  ],
};

// ── 54-Record: Importer's Additional Declaration Detail ──────────────────────
// Only the outer envelope (control id, type code, 76-char text blob) is
// modeled — see the `ImportersAdditionalDeclarationInput.declarationInformation`
// doc comment in types.ts for why the 12 type-specific sub-layouts aren't
// individually decoded in this slice.

export const IMPORTERS_ADDITIONAL_DECLARATION_SPEC: RecordSpec<ImportersAdditionalDeclarationInput> = {
  recordType: "54-Record (Importer's Additional Declaration Detail)",
  length: 80,
  fields: [
    constantField(1, "54"),
    { key: "declarationTypeCode", start: 3, length: 2, class: "AN", designation: "M" },
    { key: "declarationInformation", start: 5, length: 76, class: "X", designation: "M" },
  ],
};

// ── 34-Record: Entry Summary Header Fees ─────────────────────────────────────
// Accounting Class Code is class "3AN" per the source PDF (not "3N") — a plain
// string field, not `numericCodeField`, per this chapter's established
// AN-vs-N distinction (see `impliedDecimalField`'s doc comment and the 53-Record
// above for the same judgment call elsewhere in this file).

export const HEADER_FEES_SPEC: RecordSpec<HeaderFeesInput> = {
  recordType: "34-Record (Entry Summary Header Fees)",
  length: 80,
  fields: [
    constantField(1, "34"),
    { key: "accountingClassCode1", start: 3, length: 3, class: "AN", designation: "M" },
    impliedDecimalField("headerFeeAmount1", 6, 8, 2, "M"),
    { key: "accountingClassCode2", start: 14, length: 3, class: "AN", designation: "C" },
    impliedDecimalField("headerFeeAmount2", 17, 8, 2, "C"),
    filler(25, 56),
  ],
};

// ── 62-Record: Line User Fee Detail ───────────────────────────────────────────

export const LINE_USER_FEE_SPEC: RecordSpec<LineUserFeeInput> = {
  recordType: "62-Record (Line User Fee Detail)",
  length: 80,
  fields: [
    constantField(1, "62"),
    { key: "accountingClassCode", start: 3, length: 3, class: "AN", designation: "M" },
    impliedDecimalField("userFeeAmount", 6, 8, 2, "M"),
    filler(14, 67),
  ],
};

// ── 60-Record: IR Tax Information ────────────────────────────────────────────

export const IR_TAX_SPEC: RecordSpec<IrTaxInput> = {
  recordType: "60-Record (IR Tax Information)",
  length: 80,
  fields: [
    constantField(1, "60"),
    { key: "accountingClassCode", start: 3, length: 3, class: "AN", designation: "M" },
    impliedDecimalField("irTaxAmount", 6, 10, 2, "M"),
    filler(16, 65),
  ],
};

// ── 61-Record: Other Revenue Information ──────────────────────────────────────

export const OTHER_REVENUE_SPEC: RecordSpec<OtherRevenueInput> = {
  recordType: "61-Record (Other Revenue Information)",
  length: 80,
  fields: [
    constantField(1, "61"),
    { key: "accountingClassCode", start: 3, length: 3, class: "AN", designation: "M" },
    impliedDecimalField("otherRevenueAmount", 6, 10, 2, "M"),
    filler(16, 65),
  ],
};

// ── 35-Record: PSC Header Reasons ─────────────────────────────────────────────

export const PSC_HEADER_REASONS_SPEC: RecordSpec<PscHeaderReasonsInput> = {
  recordType: "35-Record (PSC Header Reasons)",
  length: 80,
  fields: [
    constantField(1, "35"),
    { key: "reasonCode1", start: 3, length: 3, class: "AN", designation: "M" },
    { key: "reasonCode2", start: 6, length: 3, class: "AN", designation: "C" },
    { key: "reasonCode3", start: 9, length: 3, class: "AN", designation: "C" },
    { key: "reasonCode4", start: 12, length: 3, class: "AN", designation: "C" },
    { key: "reasonCode5", start: 15, length: 3, class: "AN", designation: "C" },
    filler(18, 63),
  ],
};

// ── 36-Record: PSC Filing Explanation ─────────────────────────────────────────

export const PSC_FILING_EXPLANATION_SPEC: RecordSpec<PscFilingExplanationInput> = {
  recordType: "36-Record (PSC Filing Explanation)",
  length: 80,
  fields: [
    constantField(1, "36"),
    { key: "explanationText", start: 3, length: 75, class: "X", designation: "M" },
    filler(78, 3),
  ],
};

// ── 63-Record: PSC Line Reasons ───────────────────────────────────────────────

export const PSC_LINE_REASONS_SPEC: RecordSpec<PscLineReasonsInput> = {
  recordType: "63-Record (PSC Line Reasons)",
  length: 80,
  fields: [
    constantField(1, "63"),
    { key: "reasonCode1", start: 3, length: 3, class: "AN", designation: "M" },
    { key: "reasonCode2", start: 6, length: 3, class: "AN", designation: "C" },
    { key: "reasonCode3", start: 9, length: 3, class: "AN", designation: "C" },
    { key: "reasonCode4", start: 12, length: 3, class: "AN", designation: "C" },
    { key: "reasonCode5", start: 15, length: 3, class: "AN", designation: "C" },
    filler(18, 63),
  ],
};

// ── CW02-Record: Census Warning Condition Override Information ──────────────

export const CENSUS_WARNING_OVERRIDE_SPEC: RecordSpec<CensusWarningOverrideInput> = {
  recordType: "CW02-Record (Census Warning Condition Override Information)",
  length: 80,
  fields: [
    constantField(1, "CW02"),
    filler(5, 5),
    { key: "conditionCode1", start: 10, length: 3, class: "AN", designation: "M" },
    { key: "overrideCode1", start: 13, length: 2, class: "AN", designation: "M" },
    { key: "conditionCode2", start: 15, length: 3, class: "AN", designation: "C" },
    { key: "overrideCode2", start: 18, length: 2, class: "AN", designation: "C" },
    { key: "conditionCode3", start: 20, length: 3, class: "AN", designation: "C" },
    { key: "overrideCode3", start: 23, length: 2, class: "AN", designation: "C" },
    { key: "conditionCode4", start: 25, length: 3, class: "AN", designation: "C" },
    { key: "overrideCode4", start: 28, length: 2, class: "AN", designation: "C" },
    { key: "conditionCode5", start: 30, length: 3, class: "AN", designation: "C" },
    { key: "overrideCode5", start: 33, length: 2, class: "AN", designation: "C" },
    { key: "conditionCode6", start: 35, length: 3, class: "AN", designation: "C" },
    { key: "overrideCode6", start: 38, length: 2, class: "AN", designation: "C" },
    { key: "conditionCode7", start: 40, length: 3, class: "AN", designation: "C" },
    { key: "overrideCode7", start: 43, length: 2, class: "AN", designation: "C" },
    filler(45, 36),
  ],
};

// ── E0-Record: Entry Summary Condition Reference (output) ───────────────────
// Positions 1-25 (control id, reference data type code, occurrence position,
// "REF ID:" literal) are the chapter-agnostic conditionReferencePrefix shared
// with Batch & Block Control's X0-Record.

export const E0_SUMMARY_SPEC: RecordSpec<E0SummaryReference> = {
  recordType: "E0-Record (Entry Summary Condition Reference — SUMMRY)",
  length: 80,
  fields: [
    ...conditionReferencePrefix("E0"),
    { key: "entryFilerCode", start: 26, length: 3, class: "AN", designation: "C" },
    filler(29, 1),
    { key: "entryNumber", start: 30, length: 8, class: "AN", designation: "C" },
    filler(38, 1),
    { key: "brokerReferenceNumber", start: 39, length: 12, class: "X", designation: "C" },
    filler(51, 1),
    { key: "cbpTeamNumber", start: 52, length: 3, class: "AN", designation: "C" },
    filler(55, 26),
  ],
};

export const E0_GENERIC_SPEC: RecordSpec<E0OtherReference> = {
  recordType: "E0-Record (Entry Summary Condition Reference — generic)",
  length: 80,
  fields: [
    ...conditionReferencePrefix("E0"),
    { key: "referenceDataText", start: 26, length: 55, class: "X", designation: "M" },
  ],
};

// ── E1-Record: Entry Summary Condition/Disposition Response (output) ────────

/** Preserves the raw 5-char string (major revision 1-3, minor 4-5) rather than
 * parsing it as a single number, since the two parts are independently meaningful. */
function versionNumberField<K extends string>(key: K, start: number): FieldSpec<K> {
  return {
    key,
    start,
    length: 5,
    class: "SN",
    designation: "C",
    decodeValue: (field) => (field.trim().length === 0 ? undefined : field),
  };
}

export const E1_SPEC: RecordSpec<Omit<E1Record, "isFinalDisposition">> = {
  recordType: "E1-Record (Entry Summary Condition/Disposition Response)",
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
    versionNumberField("versionNumber", 64),
    { key: "brokerReferenceNumber", start: 69, length: 9, class: "X", designation: "C" },
    filler(78, 3),
  ],
};
