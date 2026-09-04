import type { Decimal } from "@/lib/tariff/decimal";
import type {
  HeaderControlInput,
  HeaderContentInput,
  LineItemHeaderInput,
  TariffDetailInput,
  FeeTotalInput,
  GrandTotalsInput,
} from "@/lib/abi/entrySummary/types";

// Types for the CATAIR Entry Summary Query (ESQ) chapter — input J0/J1/J2
// records and output records JA/JB through JI (the records the Output Record
// Structure Map marks "M" — mandatory/always-present in a real response), the
// conditional detail records JK-JN, and the reused Entry Summary Details
// Grouping (output 10- through 90-Records) plus its 4A-Record.
// Source: docs/plans/catair-source-docs/03-entry-summary-query-2026-05-v26.pdf
//
// Deferred (not modeled this slice): output JJ (Protest Data, ESQ page 42) —
// conditional, only returned when specifically requested, same as JK-JN, but
// absent from this slice's source fixture (no page citation was given for it).

/** Always present (J0's only real field); the record's presence in a query is
 * itself the signal — omit the whole record if detail isn't wanted. */
export interface DetailReturnRequestInput {
  returnDetailRequestIndicator: "Y";
}

/** One Entry Filer Code + Entry Number pair to query. */
export interface EntryReference {
  entryFilerCode: string;
  /** 8-char (7-digit transaction number + check digit, Appendix E) — see `@/lib/abi/entryNumber`. */
  entryNumber: string;
}

/** Flat shape matching the J1-Record's 5 fixed field-pair positions. */
export interface EntryNumberQueryRequestInput {
  entryFilerCode1: string;
  entryNumber1: string;
  entryFilerCode2?: string;
  entryNumber2?: string;
  entryFilerCode3?: string;
  entryNumber3?: string;
  entryFilerCode4?: string;
  entryNumber4?: string;
  entryFilerCode5?: string;
  entryNumber5?: string;
}

export type CriteriaQueryTypeCode = "AII" | "DOC" | "RCN" | "PSC" | "LIQ" | "NLQ" | "EES";

/** Collection/Bill Information Code (J2-Record Note 5) — controls which of the
 * deferred JK/JL/JM/JN detail records get returned; kept as an input field even
 * though we don't decode those outputs yet, since the filer still needs to
 * request or suppress them. */
export type CollectionBillInformationCode = "1" | "2" | "3" | "4" | "5" | "6";

export interface CriteriaQueryRequestInput {
  criteriaQueryTypeCode: CriteriaQueryTypeCode;
  requestedFromDateTime: Date;
  requestedToDateTime: Date;
  entrySummariesFlag?: "Y";
  ftaReconSummariesFlag?: "Y";
  otherReconSummariesFlag?: "Y";
  drawbackSummariesFlag?: "Y";
  dutyDeferralSummariesFlag?: "Y";
  collectionBillInformationCode?: CollectionBillInformationCode;
}

// ── Output records ──────────────────────────────────────────────────────────

export interface CriteriaQueryResponseHeader {
  criteriaQueryTypeCode: string;
  requestedFromDateTime?: Date;
  requestedToDateTime?: Date;
}

export type LiquidationStatusCode = "1" | "2" | "3";

export interface EntrySummaryStatusInfo {
  entryFilerCode: string;
  entryNumber: string;
  /** Raw 5-char version number (major revision 1-3, minor 4-5) — see the same
   * convention as `E1Record.versionNumber` in the Create/Update chapter. */
  versionNumber: string;
  acceptDateTime?: Date;
  pscIndicator?: string;
  pscAcceptDate?: Date;
  ownershipDataReturnedIndicator?: string;
  liquidationStatusCode?: LiquidationStatusCode;
  liquidationDate?: Date;
  centerId: string;
}

export interface QueryReturnedCondition {
  conditionCode: string;
  reasonCode?: string;
  narrativeText: string;
  entryFilerCode?: string;
  entryNumber?: string;
  districtPortOfEntry?: string;
}

/** JC-Record: entry summary control/status codes and key dates. Status/reason
 * code fields are kept as raw strings (not literal unions) — see the source
 * PDF's own field-by-field code tables for the full valid-value lists. */
export interface EntrySummaryStatusDetail {
  entrySummaryControlStatus: string;
  entrySummaryStatusCode: string;
  entrySummaryStatusDate?: Date;
  lateFilingStatusCode: string;
  releaseStatusCode?: string;
  releaseDate?: Date;
  collectionStatusCode: string;
  collectionDate?: Date;
  extensionSuspensionDate?: Date;
  extensionSuspensionNoticeDate?: Date;
  censusHeaderStatusCode: string;
  invoiceStatusCode?: string;
  protestStatusCode: string;
  quotaStatusCode?: string;
  tradeAgreementReconciliationFilerCode?: string;
  tradeAgreementReconciliationEntryNumber?: string;
  otherReconciliationFilerCode?: string;
  otherReconciliationEntryNumber?: string;
  /** Liquidation extension/suspension reason codes — see `LIQUIDATION_EXTENSION_SUSPENSION_CODES`. */
  extensionSuspensionStatusCode1?: string;
  extensionSuspensionStatusCode2?: string;
  extensionSuspensionStatusCode3?: string;
  extensionSuspensionStatusCode4?: string;
}

/** JD-Record: liquidation amounts and reason. Amounts can be negative (a
 * different, non-zero-padded wire encoding — see `signedImpliedDecimalField`
 * in recordSpecs.ts) for refund-type entry summaries. */
export interface LiquidationInfo {
  cbpReviewIndicator: string;
  entryDate?: Date;
  liquidatedDuty?: Decimal;
  liquidatedTax?: Decimal;
  liquidatedFees?: Decimal;
  liquidatedInterest?: Decimal;
  liquidatedAdCvd?: Decimal;
  /** See `LIQUIDATION_REASON_CODES`. */
  liquidationReasonCode1?: string;
  liquidationReasonCode2?: string;
  liquidationReasonCode3?: string;
  immediateDeliveryIndicator: string;
}

/** JE-Record: estimated (pre-liquidation) revenue amounts — same signed-amount
 * wire encoding as JD. */
export interface EstimatedRevenueInfo {
  estimatedDuty?: Decimal;
  estimatedTax?: Decimal;
  estimatedFees?: Decimal;
  estimatedInterest?: Decimal;
  estimatedAdCvd?: Decimal;
}

/** JF-Record: importer, entry type, filing dates, and port. */
export interface EntrySummaryFilingInfo {
  importerOfRecordNumber?: string;
  entryTypeCode?: string;
  rejectDate?: Date;
  acceleratedDrawbackIndicator?: string;
  electronicInvoiceIndicator?: string;
  districtPortOfEntry: string;
  entrySummaryFilingDate?: Date;
}

/** JG-Record: warehouse withdrawal, team, center, and line count. */
export interface WarehouseAndLineInfo {
  numberOfWithdrawals?: number;
  warehouseFinalWithdrawalIndicator?: string;
  importSpecialistTeam?: string;
  centerId?: string;
  numberOfLineItems?: number;
}

/** JH-Record: CBP Form 4811 reference, preliminary statement date, broker reference. */
export interface FormReferenceInfo {
  cbpForm4811ReferenceNumber?: string;
  preliminaryStatementPrintDate?: Date;
  brokerReferenceNumber?: string;
}

/** JI-Record: one bond/surety reference. Repeats (whole-record, up to 20) when
 * multiple bonds apply — see the Output Record Structure Map. */
export interface BondSuretyInfo {
  suretyCode?: string;
  primarySuretyIndicator?: string;
  bondTypeCode?: string;
  bondDesignationTypeCode?: string;
  multipleBondsIndicator?: string;
  bondNumber?: string;
  singleEntryBondAmount?: Decimal;
  /** Whole US dollars — no implied decimals. */
  suretyLiabilityAmount?: Decimal;
}

/** JK-Record: one bill's status and amounts. Repeats (whole-record, up to 999)
 * — see the Output Record Structure Map. Only returned when the J2-Record's
 * Collection/Bill Information Code requests billing data (codes 2, 4, 6). Not
 * signed (unlike JL/JM below) — the source PDF attaches no negative-amount
 * usage note to any of this record's amount fields. */
export interface BillDetailStatusInfo {
  /** Class AN (not N) per the source PDF — unlike JN's own Bill Number below. */
  billNumber: string;
  billDate?: Date;
  /** 1=Deferred Tax, 2=Supplemental Duty, 3=Regional Supplemental Duty,
   * 4=Miscellaneous, 5=Region Reimbursable, 6=System Reimbursable, 7=Debit Voucher. */
  billTypeCode: string;
  /** 01=Not Paid .. 11=Write-off with Partial Payment — see the JK-Record's own code table. */
  billCollectionStatusCode: string;
  totalBillAmount: Decimal;
  paidAmount?: Decimal;
  principalAmount?: Decimal;
  interestAmount?: Decimal;
}

/** JL-Record: one collection's date and total amount. Repeats up to 20. Only
 * returned when Collection/Bill Information Code requests collections data
 * (codes 1, 4, 5, 6). Total Amount can be negative for certain Entry Types
 * (Duty/Tax/Fee/Interest) per the source PDF's usage note — same signed,
 * non-zero-padded wire encoding as JD/JE, see `signedImpliedDecimalField`. */
export interface CollectionDetailStatusInfo {
  collectionDate?: Date;
  totalAmount: Decimal;
}

/** JM-Record: one collection class code and its amount — paired 1:1 following
 * a JL-Record. Repeats up to 20. Class Code Amount carries the same
 * negative-amount usage note (and signed wire encoding) as JL's Total Amount. */
export interface CollectionClassCodeDetailInfo {
  classCode?: string;
  classCodeAmount?: Decimal;
}

/** JN-Record: one surety-specific bill, carrying the same bill data as JK plus
 * Surety fields. Repeats up to 999. Only returned when Collection/Bill
 * Information Code requests surety billing data (codes 3, 5, 6). Not signed,
 * same rationale as JK. */
export interface SuretyBillDetailStatusInfo {
  suretyCode?: string;
  /** "Y" = Primary Surety, "N" = Non-Primary Surety. */
  primarySuretyIndicator?: string;
  /** Date the bill first appeared on CBP Report 612 (Formal Demand on Surety). */
  report612Date?: Date;
  /** Class N (not AN) per the source PDF — unlike JK's own Bill Number above;
   * kept as a leading-zero-preserving string identifier, not a parsed number. */
  billNumber: string;
  billDate?: Date;
  billTypeCode: string;
  billCollectionStatusCode: string;
  totalBillAmount: Decimal;
  paidAmount?: Decimal;
  principalAmount?: Decimal;
  interestAmount?: Decimal;
}

/** 4A-Record: precedes each Entry Summary Details Grouping's 40-Record (Line
 * Item Header), conveying the ordinal CBP Line Number ACE assigned to that
 * line. Right-justified, zero-filled; kept as a string (not a parsed number)
 * since it's an identifier, not a quantity. */
export interface CbpLineNumberInfo {
  cbpLineNumber: string;
}

/** One line item within the Entry Summary Details Grouping: the 4A-Record's
 * CBP Line Number, the 40-Record itself, and its 1+ 50-Record tariff details. */
export interface EntrySummaryDetailsLineItem {
  cbpLineNumber: string;
  header: LineItemHeaderInput;
  tariffDetails: TariffDetailInput[];
}

/**
 * Entry Summary Details Grouping (output 10- through 90-Records): the latest
 * detail (content) of the entry summary, returned only when the input
 * J0-Record's Return Detail Request Indicator was set. Per the source PDF,
 * "[t]he output 10- through 90-Records provides the latest detail of the
 * entry summary in the form of input AE 10- through 90-Records" — i.e. these
 * output records are documented as identical in layout to the respective
 * input 10- through 90-Records the filer submits in the Entry Summary
 * Create/Update (AE) transaction (the one documented difference being that
 * output numeric fields are space-padded rather than AE's own zero-padded
 * encoding — immaterial for decoding, since this codec's numeric decode
 * trims either padding style the same way). So these are reused directly from
 * `@/lib/abi/entrySummary` rather than redefined here — see recordSpecs.ts
 * for the reuse and the position-by-position evidence. This slice models
 * only the subset AE itself models (10/11/40/50/89/90); the many other
 * conditional detail records in the full grouping (20-36, 41-47, OA/OI/FC01/
 * FC02, 51-54, 60-63, CW02, ...) aren't built in either chapter yet.
 */
export interface EntrySummaryDetailsGrouping {
  headerControl: HeaderControlInput;
  headerContent?: HeaderContentInput;
  lineItems: EntrySummaryDetailsLineItem[];
  feeTotals?: FeeTotalInput;
  grandTotals?: GrandTotalsInput;
}
