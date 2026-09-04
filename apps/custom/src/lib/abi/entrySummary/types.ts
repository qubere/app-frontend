import type { Decimal } from "@/lib/tariff/decimal";

// Types for the CATAIR Entry Summary Create/Update (AE) input records — the
// core MVP subset (10, 11, 40, 50, 89, 90). See docs/plans/catair-source-docs/
// 02-entry-summary-create-update-2026-07.pdf, pages ESF-26 through ESF-131.

export interface HeaderControlInput {
  /** "A"/"R" = Add or entirely Replace, "D" = Delete. */
  summaryFilingActionRequestCode: "A" | "R" | "D";
  entryFilerCode: string;
  /** 7-digit transaction number + check digit (Appendix E). Use `buildEntryNumber()` from
   * `@/lib/abi/entryNumber` to compute it — `buildHeaderControl` rejects a wrong check digit. */
  entryNumber: string;
  districtPortOfEntry: string;
  brokerReferenceNumber?: string;
  entryTypeCode: string;
  modeOfTransportationCode?: string;
  /** "0" = bond waived/no bond required (spec note: use "0", not the conventional "Y"). */
  bondWaiverIndicator?: "0";
  /** "X" = Filer's Electronic Signature — mandatory when action is A or R. */
  electronicSignature?: "X";
  cargoReleaseCertificationRequestIndicator?: "A";
  electronicInvoiceIndicator?: "Y";
  consolidatedSummaryIndicator?: "Y";
  shipmentUsageTypeCode?: "P" | "X";
  liveEntryIndicator?: "Y";
  deferredTaxPaymentCode?: "1" | "2";
  tradeAgreementReconciliationIndicator?: "Y";
  reconciliationIssueCode?: string;
  paymentTypeCode?: string;
  preliminaryStatementPrintDate?: Date;
  periodicStatementMonth?: string;
  statementClientBranchIdentifier?: string;
  bondWaiverReasonCode?: string;
  postSummaryCorrectionIndicator?: "Y";
  acceleratedLiquidationRequestIndicator?: "Y";
  knownImporterIndicator?: "Y";
  /** "Y" = expedited release, "F" = weekly FTZ. */
  pgaDataIncludedIndicator?: "Y" | "F";
  tibDeclarationIndicator?: "Y";
  consolidatedExpressInformalIndicator?: "Y";
}

export interface HeaderContentInput {
  importerOfRecordNumber: string;
  consigneeNumber?: string;
  designatedNotifyPartyNumber?: string;
  estimatedEntryDate?: Date;
  dateOfImportation?: Date;
  usStateOfDestinationCode?: string;
  /** Format NNNXXXXXX — see 11-Record Note 3. */
  foreignTradeZoneIdentifier?: string;
}

export interface LineItemHeaderInput {
  /** Unique within the summary; must not be "*". */
  lineItemIdentifier: string;
  /** "X" = header of an article set, "V" = component of one. */
  articleSetIndicator?: "X" | "V";
  /** ISO country code, or "**" if unknown. */
  countryOfOriginCode: string;
  countryOfExportCode?: string;
  dateOfExportation?: Date;
  dateOfExportationForTextiles?: Date;
  tradeAgreementSpecialProgramClaimCode?: string;
  chargesAmount?: Decimal;
  foreignPortOfLadingCode?: string;
  grossShippingWeight?: Decimal;
  categoryCodeForTextiles?: string;
  productClaimCode?: string;
  relatedPartyIndicator?: "Y" | "N";
  naftaNetCostIndicator?: "Y";
  feeExemptionCode?: "1" | "2";
  adCaseNonReimbursementStatement?: "Y";
}

export interface TariffDetailInput {
  /** Full 10-digit HTS classification unless a legitimate 8-digit-only classification applies. */
  htsNumber: string;
  /** Implied 2 decimal places on the wire. */
  dutyAmount: Decimal;
  /** Whole U.S. dollars on the wire (no implied decimals). */
  valueOfGoodsAmount: Decimal;
  /** Implied 2 decimal places on the wire. */
  quantity1?: Decimal;
  unitOfMeasureCode1: string;
  quantity2?: Decimal;
  unitOfMeasureCode2?: string;
  quantity3?: Decimal;
  unitOfMeasureCode3?: string;
  /**
   * SE61: FTZ Privileged Foreign Status Additional Detail.
   * Reported at most once per Tariff/Value/Quantity Detail (50-Record).
   * PDF page ESF-92 explicitly states: "The SE61 record may be reported only once per Tariff/Value/Quantity Detail (Input 50-Record)."
   */
  ftzPrivilegedStatusDetail?: FtzPrivilegedStatusDetailInput;
}

/** One Accounting Class Code + Total Fee Amount pair, as reported on the 89-Record. */
export interface FeeTotalEntry {
  accountingClassCode: string;
  /** Implied 2 decimal places on the wire. */
  totalFeeAmount: Decimal;
}

/** Flat shape matching the 89-Record's 5 fixed field-pair positions. */
export interface FeeTotalInput {
  accountingClassCode1: string;
  totalFeeAmount1: Decimal;
  accountingClassCode2?: string;
  totalFeeAmount2?: Decimal;
  accountingClassCode3?: string;
  totalFeeAmount3?: Decimal;
  accountingClassCode4?: string;
  totalFeeAmount4?: Decimal;
  accountingClassCode5?: string;
  totalFeeAmount5?: Decimal;
}

// ── 31-Record: Bond Detail ───────────────────────────────────────────────────
// Header-level, conditional, reported up to 2 times per summary (the Bond
// Grouping). See docs/plans/catair-source-docs/02-entry-summary-create-update-
// 2026-07.pdf, pages ESF-49 through ESF-50.

export interface BondDetailInput {
  /** "8" = continuous (multiple transaction) bond, "9" = single transaction bond (STB). */
  bondTypeCode: "8" | "9";
  /** "B" = basic, "A" = additional, "U" = substitution STB, "E" = superseding STB. */
  bondDesignationTypeCode: "B" | "A" | "U" | "E";
  /**
   * "Y" = continuous bond supersedes the bond presented at time of entry, "S" =
   * substitution continuous bond replaces it. Space-fill if continuous yet not
   * superseding/substituting, or if STB.
   */
  continuousBondIndicator?: "Y" | "S";
  suretyCompanyCode: string;
  /** Whole U.S. dollars (no implied decimals). Space-fill if continuous bond. */
  singleTransactionBondAmount?: Decimal;
  /**
   * The Surety Reference Number from CBP Form 301, as assigned by the STB's
   * Surety company. Left-justified, trailing spaces. Space-fill if continuous bond.
   */
  singleTransactionBondProducerAccountNumber?: string;
}

// ── 41-Record: FTZ Status Information ────────────────────────────────────────
// Line-item-level, conditional, reported at most once per line item. See PDF
// page ESF-72.

export interface FtzStatusInput {
  /** "P" = Privileged Foreign, "N" = Non-Privileged Foreign, "D" = Domestic. */
  ftzMerchandiseStatusCode: "P" | "N" | "D";
  /**
   * The date the merchandise entered the zone. Only meaningful (and only
   * reported) for Privileged Foreign status — space-filled otherwise.
   */
  privilegedFtzMerchandiseFilingDate?: Date;
  /** Whole units removed from the FTZ and entered into U.S. commerce (no implied decimals). */
  ftzLineItemQuantity: Decimal;
}

// ── SE61-Record: FTZ Privileged Foreign Status Additional Detail ────────────
// Reported only once per Tariff/Value/Quantity Detail (50-Record), only when
// Privileged Foreign status was declared on the preceding 41-Record AND the
// 50-Record's declared HTS is no longer an active HTS number. See PDF page
// ESF-92. (The chapter's other conditional detail records mostly use a 2-char
// control identifier + separate record-type digit; SE61's own identifier is a
// single 4-char literal occupying positions 1-4.)

export interface FtzPrivilegedStatusDetailInput {
  /**
   * The current, full 10-digit HTS classification for Privileged Foreign
   * status merchandise whose originally-declared 50-Record HTS is no longer
   * active. Used only to identify current PGA flagging — not used for duty
   * calculation or entry summary reporting.
   */
  currentHtsNumber: string;
}

// ── 53-Record: AD/CVD Case Detail ────────────────────────────────────────────
// Line-item-level, conditional, up to 2 times per line item. See PDF pages
// ESF-98 through ESF-99. Note the three distinct implied-decimal conventions
// among this record's own numeric fields: Case Deposit Rate (2), AD/CVD Value
// of Goods Amount (0 — whole dollars), AD/CVD Quantity (4), AD/CVD Duty
// Amount (2).

export interface AdcvdCaseDetailInput {
  /** The AD/CVD case number, without hyphens. */
  caseNumber: string;
  /** "B" = surety bond, "C" = cash deposit. */
  bondCashClaimCode: "B" | "C";
  /** Implied 2 decimal places on the wire. */
  caseDepositRate: Decimal;
  /** "A" = ad valorem rate, "S" = specific rate. */
  caseRateTypeQualifierCode: "A" | "S";
  /** Whole U.S. dollars (no implied decimals); used in lieu of the line item value. */
  valueOfGoodsAmount?: Decimal;
  /** Primary unit quantity for specific-rate calculations. Implied 4 decimal places on the wire. */
  quantity?: Decimal;
  /** Estimated duty amount, in U.S. dollars and cents. Implied 2 decimal places on the wire. */
  dutyAmount: Decimal;
  /** Blanket non-reimbursement declaration identifier. */
  nonReimbursementDeclarationIdentifier?: string;
}

// ── 88-Record: AD/CVD Duty Totals ────────────────────────────────────────────
// Totals-level, conditional, reported at most once per summary. See PDF page
// ESF-128. All four amounts carry 2 implied decimal places.

export interface AdcvdDutyTotalsInput {
  totalBondedAdDutyAmount?: Decimal;
  totalCashDepositAdDutyAmount?: Decimal;
  totalBondedCvDutyAmount?: Decimal;
  totalCashDepositCvDutyAmount?: Decimal;
}

export interface GrandTotalsInput {
  grandTotalDutyAmount?: Decimal;
  grandTotalUserFeeAmount?: Decimal;
  grandTotalIrTaxAmount?: Decimal;
  grandTotalAdDutyAmount?: Decimal;
  grandTotalCvDutyAmount?: Decimal;
  grandTotalOtherRevenueAmount?: Decimal;
}

/**
 * Structured Line-Level Cargo Entity Grouping (SE50 + optional SE51s + optional SE55s + optional SE56).
 * See PDF pages ESF-80 through ESF-88.
 */
export interface LineEntityGroupInput {
  entity: LineEntityInput;
  gbiIdentifiers?: LineEntityGbiInput[];
  streetAddresses?: LineEntityStreetAddressInput[];
  geographicArea?: LineEntityGeographicAreaInput;
}

/**
 * Structured EIP Invoice Grouping (42 Invoice Line Reference + optional 43 Ruling + optional 44 Commercial Descriptions).
 * See PDF pages ESF-23 & ESF-74.
 */
export interface EipInvoiceGroupInput {
  invoice: InvoiceLineReferenceInput;
  ruling?: RulingsDetailInput;
  commercialDescriptions?: CommercialDescriptionInput[];
}

/** One line item: 40-Record plus conditional line-level records and 1-32 Tariff (50) details. */
export interface LineItemInput {
  header: LineItemHeaderInput;
  ftzStatus?: FtzStatusInput;
  /** EIP Invoice Groupings (42 + optional 43 + optional 44s) */
  eipInvoices?: EipInvoiceGroupInput[];
  /** Flat array options for 42 / 43 / 44 if not using eipInvoices */
  invoices?: InvoiceLineReferenceInput[];
  ruling?: RulingsDetailInput;
  rulings?: RulingsDetailInput[];
  commercialDescriptions?: CommercialDescriptionInput[];
  /** Article Party Grouping (47), up to 4 — see ArticlePartyInput's doc comment
   * on the PDF's own structure-map/narrative discrepancy for this limit. */
  articleParties?: ArticlePartyInput[];
  /** Line Level Cargo Entity Grouping (SE50 + optional SE51, SE55, SE56) */
  entities?: (LineEntityInput | LineEntityGroupInput)[];
  /** 1 to 32 Tariff/Value/Quantity details (50), each with optional SE61 */
  tariffDetails: TariffDetailInput[];
  /** Standard Visa Information (51), at most one per line item. */
  standardVisa?: StandardVisaInput;
  licenseCertificatePermit?: LicenseCertificatePermitInput;
  licenses?: LicenseCertificatePermitInput[];
  adcvdCases?: AdcvdCaseDetailInput[];
  importersAdditionalDeclarations?: ImportersAdditionalDeclarationInput[];
  irTax?: IrTaxInput;
  otherRevenue?: OtherRevenueInput;
  userFees?: LineUserFeeInput[];
  pscLineReasons?: PscLineReasonsInput;
  censusWarningOverride?: CensusWarningOverrideInput;
}

/** One full Entry Summary TRANSACTION grouping: 10(+11), optional header records, N line items, optional totals. */
export interface EntrySummaryTransactionInput {
  headerControl: HeaderControlInput;
  headerContent?: HeaderContentInput;
  bonds?: BondDetailInput[];
  headerFees?: HeaderFeesInput;
  pscHeaderReasons?: PscHeaderReasonsInput;
  pscFilingExplanations?: PscFilingExplanationInput[];
  /** Header Level Cargo Entity Grouping (SE30 + optional SE31, SE35, SE36), up
   * to 12 — see HeaderEntityGroupInput's doc comment. */
  headerEntities?: HeaderEntityGroupInput[];
  lineItems: LineItemInput[];
  adcvdDutyTotals?: AdcvdDutyTotalsInput;
  feeTotals?: FeeTotalEntry[];
  grandTotals?: GrandTotalsInput;
}

// ── 42-Record: Invoice Line Reference Detail ─────────────────────────────────
// Line-item-level, conditional, repeated as often as needed to cross-reference
// all invoice lines comprising the Entry Summary line. See PDF pages ESF-74
// through ESF-75. Note: the source PDF's Supplier ID Code (positions 3-17)
// shifts every subsequent field 15 columns later than a naive reading of the
// invoice-line-range fields alone would suggest — see recordSpecs.ts comment.

export interface InvoiceLineReferenceInput {
  /** Per CBP Directive 3500-13 (Nov 24, 1986). */
  supplierIdCode: string;
  /** Alphanumeric and dash only, per the source PDF's own field note. */
  invoiceNumber: string;
  invoiceLineRange1Begin: number;
  invoiceLineRange1End: number;
  invoiceLineRange2Begin?: number;
  invoiceLineRange2End?: number;
  invoiceLineRange3Begin?: number;
  invoiceLineRange3End?: number;
  invoiceLineRange4Begin?: number;
  invoiceLineRange4End?: number;
}

// ── 43-Record: Rulings Detail ────────────────────────────────────────────────
// Line-item-level, conditional. See PDF page ESF-76.

export interface RulingsDetailInput {
  /** "C" = Pre-Classification, "P" = Pre-Approval, "R" = Binding Ruling. */
  rulingTypeCode: "C" | "P" | "R";
  /** The numeric portion only — do not report the ruling's leading alpha code (e.g. "N", "H"). */
  rulingNumber?: string;
}

// ── 44-Record: Commercial Description ────────────────────────────────────────
// Line-item-level, conditional, reported up to 999 times per grouping. See PDF
// page ESF-77.

export interface CommercialDescriptionInput {
  commercialDescriptionText: string;
}

// ── 52-Record: License/Certificate/Permit Detail ─────────────────────────────
// Line-item-level, conditional, reported at most once per line item. See PDF
// pages ESF-95 through ESF-97.

export interface LicenseCertificatePermitInput {
  /** "01" = Steel Import License, "06" = Diamond Certificate, "28" = Aluminum
   * Import License, "31" = Argentine White Grape Juice Concentrate Export
   * License, among others — see the source PDF's full 31-code list. */
  licenseCertificatePermitTypeCode: string;
  licenseCertificatePermitNumber: string;
}

// ── SE50-Record: Line Entity Name and Type ───────────────────────────────────
// Line-item-level, conditional (Cargo Release Certification only). See PDF
// pages ESF-80 through ESF-82.

export interface LineEntityInput {
  /** MF=Manufacturer, SE=Seller, BY=Buyer, ST=Ship To, LG=Scheduled Container
   * Stuffing Location, CS=Consolidator, CN=Consignee, SH=Shipper, EX=Exporter,
   * DR=Distributor, PK=Packager (SH/EX/DR/PK only under the GBI test). */
  entityCode: string;
  entityName?: string;
  /** Mandatory (in lieu of name/address) when entityCode is "CN". */
  entityIdentifierQualifier?: string;
  entityIdentifier?: string;
}

// ── SE51-Record: Line Entity GBI Identifier ──────────────────────────────────
// Line-item-level, conditional (GBI test participation only). Must immediately
// follow its SE50-Record. See PDF page ESF-85.

export interface LineEntityGbiInput {
  gbiIdentifierQualifier: "LEI" | "GLN" | "DUNS" | "ALTA";
  identifier: string;
  /** SE52/SE32: GBI Party Type Description, up to 9 per GBI identifier. Sequence
   * number is derived from array order, not supplied here. PDF page ESF-86 (line),
   * ESF-62 (header). */
  partyTypeDescriptions?: string[];
}

/** SE32/SE52: Entity GBI Party Type Description. Identical layout at header and
 * line level bar the control identifier. See PDF pages ESF-62 and ESF-86. */
export interface GbiPartyTypeDescriptionInput {
  sequenceNumber: number;
  description: string;
}

// ── SE55-Record: Line Entity Street Address ──────────────────────────────────
// Line-item-level, conditional — used together with SE50/SE56 whenever the
// entity is reported by name/address rather than identifier. See PDF page
// ESF-87.

export interface LineEntityStreetAddressInput {
  /** See PDF Note 1 for the full code list, e.g. "01" = Street Number, "02" =
   * Street Name, "05" = P.O. Box Number. */
  addressComponentQualifier1: string;
  addressInformation1: string;
  addressComponentQualifier2?: string;
  addressInformation2?: string;
}

// ── SE56-Record: Line Entity Geographic Area ─────────────────────────────────
// Line-item-level, conditional — used together with SE50/SE55. See PDF page
// ESF-88.

export interface LineEntityGeographicAreaInput {
  cityName: string;
  /** ISO subdivision code. */
  countrySubEntityCode?: string;
  postalCode?: string;
  /** ISO country code (Appendix B). */
  countryCode: string;
}

// ── SE30/SE31/SE35/SE36: Header Level Cargo Entity Grouping ──────────────────
// Header-level counterpart of the Line Level Cargo Entity Grouping above —
// same field layouts as SE50/SE51/SE55/SE56 (only the control identifier
// differs), so this reuses those input types rather than duplicating them.
// Only transmit when certifying the entry summary for ACE Cargo Release
// processing (Cargo Release Certification Request Indicator = "A").
// See PDF pages ESF-58 through ESF-64.

export interface HeaderEntityGroupInput {
  entity: LineEntityInput;
  gbiIdentifiers?: LineEntityGbiInput[];
  streetAddresses?: LineEntityStreetAddressInput[];
  geographicArea?: LineEntityGeographicAreaInput;
}

// ── 47-Record: Article Party ──────────────────────────────────────────────────
// Line-item-level, conditional. PDF page ESF-78 narrative says "up to four
// times per Line Item"; the ES Line Grouping Input Structure Map (page ESF-23)
// says "6" for the same grouping — a genuine discrepancy in the source PDF.
// Trusting the narrative's "4" since it matches the 4 valid Party Type Codes
// (M/C/S/E) exactly, one occurrence per code.

export interface ArticlePartyInput {
  /** M=Manufacturer/Supplier, C=Delivered To Party, S=Sold To Party, E=Foreign Exporter. */
  partyTypeCode: "M" | "C" | "S" | "E";
  partyIdentifier: string;
}

// ── 51-Record: Standard Visa Information ─────────────────────────────────────
// Line-item-level, conditional, at most once per line item. See PDF page ESF-94.

export interface StandardVisaInput {
  standardVisaNumber: string;
}

// ── 54-Record: Importer's Additional Declaration Detail ──────────────────────
// Line-item-level, conditional, reported up to 9 times per line item. See PDF
// pages ESF-101 through ESF-117 (Note 1's 12 type-specific sub-layouts).

export type ImportersAdditionalDeclarationTypeCode =
  | "01" // Softwood Lumber Export Information
  | "02" // Product Exclusion Information - Steel products
  | "03" // Product Exclusion Information - Aluminum products
  | "04" // South Korean (KR) Export Steel Certificate
  | "05" // CBMA Product Detail
  | "06" // AD/CVD Certification Designation
  | "07" // Aluminum Smelt and Cast Country Detail
  | "08" // Steel Melt and Pour Country Detail
  | "09" // 201 Bifacial Certification Designation
  | "10" // Ship-to-Shore Crane Certification Designation
  | "11" // Auto Parts Offset License
  | "12"; // Copper Smelt and Cast Country Detail

export interface ImportersAdditionalDeclarationInput {
  declarationTypeCode: ImportersAdditionalDeclarationTypeCode;
  /**
   * Raw 76-char declaration payload. Its internal sub-layout is
   * type-code-specific (PDF Note 1 documents 12 distinct byte layouts, e.g.
   * Type 01's Softwood Lumber Declaration Indicator/Export Price/Export
   * Charges sub-fields packed within this same 76 bytes) — not decoded here,
   * carried through as free text. Same rationale as E0OtherReference's
   * undecoded Reference Data Text for reference types this slice hasn't
   * modeled: the outer 54-Record envelope (control id, type code, this text
   * blob) is what's on the wire; building 12 more RecordSpecs for the
   * sub-layouts is future scope.
   */
  declarationInformation: string;
}

// ── 34-Record: Entry Summary Header Fees ─────────────────────────────────────
// Header-level, conditional, reported at most once per summary. See PDF page
// ESF-53. Both Header Fee Amounts carry 2 implied decimal places.

export interface HeaderFeesInput {
  accountingClassCode1: string;
  headerFeeAmount1: Decimal;
  accountingClassCode2?: string;
  headerFeeAmount2?: Decimal;
}

// ── 62-Record: Line User Fee Detail ───────────────────────────────────────────
// Line-item-level, conditional, reported up to 9 times per line item. See PDF
// page ESF-120. User Fee Amount carries 2 implied decimal places.

export interface LineUserFeeInput {
  accountingClassCode: string;
  userFeeAmount: Decimal;
}

// ── 60-Record: IR Tax Information ────────────────────────────────────────────
// Line-item-level, conditional, reported at most once per line item. See PDF
// page ESF-118. IR Tax Amount carries 2 implied decimal places.

export interface IrTaxInput {
  accountingClassCode: string;
  irTaxAmount: Decimal;
}

// ── 61-Record: Other Revenue Information ──────────────────────────────────────
// Line-item-level, conditional, reported at most once per line item. See PDF
// pages ESF-118 through ESF-119. Other Revenue Amount carries 2 implied
// decimal places.

export interface OtherRevenueInput {
  accountingClassCode: string;
  otherRevenueAmount: Decimal;
}

// ── 35-Record: PSC Header Reasons ─────────────────────────────────────────────
// Header-level, conditional (PSC filings only), reported at most once per
// summary. See PDF page ESF-54.

export interface PscHeaderReasonsInput {
  reasonCode1: string;
  reasonCode2?: string;
  reasonCode3?: string;
  reasonCode4?: string;
  reasonCode5?: string;
}

// ── 36-Record: PSC Filing Explanation ─────────────────────────────────────────
// Header-level, conditional (PSC filings only), reported up to 99 times per
// summary. See PDF page ESF-55.

export interface PscFilingExplanationInput {
  explanationText: string;
}

// ── 63-Record: PSC Line Reasons ───────────────────────────────────────────────
// Line-item-level, conditional (PSC filings only), reported at most once per
// line item. See PDF page ESF-125.

export interface PscLineReasonsInput {
  reasonCode1: string;
  reasonCode2?: string;
  reasonCode3?: string;
  reasonCode4?: string;
  reasonCode5?: string;
}

// ── CW02-Record: Census Warning Condition Override Information ──────────────
// Line-item-level, conditional, reported at most once per line item. See PDF
// pages ESF-126 through ESF-127.

export interface CensusWarningOverrideInput {
  conditionCode1: string;
  overrideCode1: string;
  conditionCode2?: string;
  overrideCode2?: string;
  conditionCode3?: string;
  overrideCode3?: string;
  conditionCode4?: string;
  overrideCode4?: string;
  conditionCode5?: string;
  overrideCode5?: string;
  conditionCode6?: string;
  overrideCode6?: string;
  conditionCode7?: string;
  overrideCode7?: string;
}

// ── Output response records (E0/E1) ─────────────────────────────────────────
// The "SUMMRY" Reference Data Type Code is unconditionally returned and its
// Reference Data Text sub-layout (Entry Filer Code/Entry Number/Broker Reference
// Number/CBP Team Number) is decoded. Every other type code (CARMAN, BOLINB,
// BNDDTL, PGA groupings, ...) identifies data on an input record this slice
// hasn't built yet — its Reference Data Text is carried through undecoded rather
// than guessed at.

export interface E0SummaryReference {
  referenceDataTypeCode: "SUMMRY";
  /** Relative sequence of this Entry Summary transaction within the Block Control Grouping. */
  occurrencePosition: number;
  entryFilerCode?: string;
  entryNumber?: string;
  brokerReferenceNumber?: string;
  cbpTeamNumber?: string;
}

export interface E0OtherReference {
  referenceDataTypeCode: string;
  occurrencePosition: number;
  /** Raw 55-char Reference Data Text — sub-layout not modeled for this reference type. */
  referenceDataText: string;
}

export type E0Record = E0SummaryReference | E0OtherReference;

/**
 * Type guard for narrowing E0Record. Plain `referenceDataTypeCode === "SUMMRY"`
 * equality checks don't narrow the union on their own, since E0OtherReference's
 * `referenceDataTypeCode` is a general `string` (an open-ended set of other
 * chapters' type codes), not a finite set of literals TS can discriminate against.
 */
export function isE0SummaryReference(record: E0Record): record is E0SummaryReference {
  return record.referenceDataTypeCode === "SUMMRY";
}

export interface E1Record {
  /** "" = not a final disposition; "A" = final, accepted; "R" = final, rejected. */
  dispositionTypeCode: string;
  /** "F" fatal / "W" Census warning / "P" PGA warning / "I" informational / "" none. */
  severityCode: string;
  conditionCode: string;
  reasonCode?: string;
  narrativeText: string;
  /** Filer's code as reported on the input 10-Record. */
  entryFilerCode?: string;
  entryNumber?: string;
  /**
   * Raw 5-char version number (major revision positions 1-3, minor 4-5), e.g.
   * "00100". Present only on an ACCEPTED final disposition after an Add/Replace —
   * blank on Delete, on Rejected, and on non-final condition records.
   */
  versionNumber?: string;
  brokerReferenceNumber?: string;
  isFinalDisposition: boolean;
}

/** One non-final condition, paired with the E0-Record(s) that identify what caused it. */
export interface EntrySummaryCondition {
  references: E0Record[];
  condition: E1Record;
}

/** The full parsed response for one Entry Summary TRANSACTION Grouping. */
export interface ParsedEntrySummaryResponse {
  scenario: "ACCEPTED" | "REJECTED";
  conditions: EntrySummaryCondition[];
  finalDisposition: E1Record;
}
