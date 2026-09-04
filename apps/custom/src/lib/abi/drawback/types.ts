import type { Decimal } from "@/lib/tariff/decimal";

// Types for the CATAIR Drawback (TFTEA / Core Drawback) chapter — Application
// Identifier DD (input) / JC (output). The complete 21-input/2-output record
// backbone: entry summary header, bond details, import entry details,
// classification, quantities, revenue claimed, manufacturing/produced article
// groupings, export/destroy groupings, notice of intent, NAFTA/USMCA coding,
// TFTEA export/destroy groupings, revenue totals, and output disposition
// responses.
// Source: docs/plans/catair-source-docs/07-drawback-tftea-v27.pdf
// (Pub # 0875-0419, June 24, 2025 - Revision 27)
//
// Deferred (not modeled this slice, per tests/abi-drawback-specs.test.ts's own
// scope note): the internal Drawback Matching/Claim Engine (already implemented
// in the business logic domain, src/modules/drawback/) and Trade Portal UI
// rendering.

export interface DrawbackHeaderInput {
  /** A = Add, R = Full Replacement, D = Delete. */
  summaryFilingActionRequestCode: "A" | "R" | "D";
  entryFilerCode: string;
  /** 8-char, right-justified with leading spaces (no hyphens). */
  entryNumberOrDrawbackClaimNumber: string;
  drawbackFilingPort: string;
  brokerReferenceNumber?: string;
  /** 2-char provision code (e.g. "01"=Unused Direct, "51"+=TFTEA) — see Appendix A. */
  drawbackProvision: string;
  bondWaiverIndicator?: string;
  bondWaiverReasonCode?: string;
  acceleratedPaymentRequestIndicator?: string;
  oneTimeWaiverIndicator?: string;
  waiverPriorNotice?: string;
  commercialInterchangeability?: string;
  electronicPetroleumCertification?: string;
  electronicManufacturingPetroleumCertification?: string;
  oilSpillTaxCertification?: string;
  naftaDrawbackClaimIndicator?: string;
  electronicSignature: string;
  claimantIdOrImporterRecordNumber: string;
  designatedNotifyPartyNumber?: string;
  substitutedUnusedWineCertification?: string;
  billOfMaterialsFormulaCertification?: string;
  certificationForValuationOfDestroyedMerchandise?: string;
  usmcaDrawbackClaimIndicator?: string;
  retailSalesSubstitutionIndicator?: string;
  superfundTaxCertification?: string;
}

export interface BondInfoInput {
  /** 8 = Continuous bond, 9 = Single transaction bond (STB). */
  bondTypeCode: "8" | "9";
  bondDesignationTypeCode: string;
  suretyCompanyCode: string;
  /** Whole US dollars — no implied decimals. Space-fill if continuous bond. */
  singleTransactionBondAmount?: Decimal;
  singleTransactionBondNumber?: string;
}

export interface ImportsDetailsInput {
  /** D/L/M/G/V/E/X/T/F — see the 40-Record's own code table. */
  actionIndicator: string;
  entryFilerCode: string;
  entryNumber: string;
  /** Current CBP ES Line Number — identifier, leading zero significant. */
  cbpEsLineNumber?: string;
  drawbackEligibleIndicator?: string;
  manufactureRulingNumber?: string;
  /** "01"-"08" — see the 40-Record's own code table. */
  basisOfClaim?: string;
  /** MMDDYY. */
  manufDateReceived?: Date;
  /** MMDDYY. */
  manufDateUsed?: Date;
  /** Import Tracking Identification Number (ITIN) — cross-record join key
   * (linked from Records 52/72), leading zero significant. */
  importTrackingIdNumber: string;
  /** "01"-"04" (or "00"/"01"-"08" depending on provision) — leading zero significant. */
  drawbackAccountingMethodCode?: string;
}

export interface ImportClassificationInput {
  htsNumber: string;
  articleDescriptionText: string;
}

export interface ImportQuantityUomInput {
  /** 4 implied decimal places. */
  quantity: Decimal;
  unitOfMeasureCode: string;
  /** 4 implied decimal places. */
  allowableQuantity?: Decimal;
  /** 4 implied decimal places. */
  enteredGoodsValuePerUnit: Decimal;
  /** 4 implied decimal places. */
  substitutedValuePerUnit?: Decimal;
}

export interface ImportRevenueClaimedInput {
  /** CBP accounting classification code — leading zero significant. */
  accountingClassCode: string;
  /** 2 implied decimal places. */
  claimAmount: Decimal;
  /** 2 implied decimal places. */
  calculatedAmount?: Decimal;
  /** 2 implied decimal places. */
  adjustedClaimedAmount?: Decimal;
  qualifierIndicator?: string;
}

export interface ManufacturedArticleInput {
  /** D/L/M/G/V/E/X/T/F — see the 40-Record's own code table. */
  actionIndicator: string;
  /** Numeric portion of the Manufacturing Ruling Number, no hyphens.
   * "9999999999" if pending. */
  importManufactureRulingNumber: string;
  htsNumber: string;
  /** 4 implied decimal places. */
  quantity: Decimal;
  unitOfMeasureCode: string;
  /** MMDDYY. */
  productionDate: Date;
  /** City and state. */
  factoryLocation: string;
}

export interface ManufacturedDescInput {
  manufacturedArticleDescriptionText: string;
  /** Required if Record 50's Action Indicator is X or T. */
  manufactureRulingNumber?: string;
  /** Manufactured Tracking Identification Number (MTIN) — cross-record join
   * key (linked from Records 53/73), leading zero significant. Lives on this
   * record, not Record 50. */
  manufacturedTrackingIdNumber?: string;
}

/** Record 52: links an Import (40-Record) to a Manufactured/Produced Article
 * via up to 15 ITINs. */
export interface LinkImportMfgInput {
  importTrackingIdNumber1: string;
  importTrackingIdNumber2?: string;
  importTrackingIdNumber3?: string;
  importTrackingIdNumber4?: string;
  importTrackingIdNumber5?: string;
  importTrackingIdNumber6?: string;
  importTrackingIdNumber7?: string;
  importTrackingIdNumber8?: string;
  importTrackingIdNumber9?: string;
  importTrackingIdNumber10?: string;
  importTrackingIdNumber11?: string;
  importTrackingIdNumber12?: string;
  importTrackingIdNumber13?: string;
  importTrackingIdNumber14?: string;
  importTrackingIdNumber15?: string;
}

/** Record 53: links a Manufactured/Produced Article to its source
 * Manufactured Articles via up to 15 MTINs. */
export interface LinkMfgSourceInput {
  manufacturedTrackingIdNumber1?: string;
  manufacturedTrackingIdNumber2?: string;
  manufacturedTrackingIdNumber3?: string;
  manufacturedTrackingIdNumber4?: string;
  manufacturedTrackingIdNumber5?: string;
  manufacturedTrackingIdNumber6?: string;
  manufacturedTrackingIdNumber7?: string;
  manufacturedTrackingIdNumber8?: string;
  manufacturedTrackingIdNumber9?: string;
  manufacturedTrackingIdNumber10?: string;
  manufacturedTrackingIdNumber11?: string;
  manufacturedTrackingIdNumber12?: string;
  manufacturedTrackingIdNumber13?: string;
  manufacturedTrackingIdNumber14?: string;
  manufacturedTrackingIdNumber15?: string;
}

export interface ExportDestroyInput {
  /** E = Export, D = Destroy. */
  exportOrDestroyIndicator: string;
  htsNumber: string;
  /** 4 implied decimal places. */
  exportOrDestroyQuantity: Decimal;
  unitOfMeasureCode: string;
  /** MMDDYY, chronological order. */
  exportOrDestroyDate: Date;
  /** Y or space. */
  noticeOfIntentIndicator?: string;
  /** Y or space. */
  waiverToDrawbackClaimRightsIndicator?: string;
  nameOfExporterOrDestroyer: string;
  /** Space-fill if Export/Destroy Indicator = D. */
  countryOfUltimateDestination?: string;
  /** Y or space. */
  billOfLadingIndicator?: string;
  /** Required if Bill of Lading Indicator = Y. */
  billOfLadingCarrierCode?: string;
}

export interface ExportDescInput {
  exportOrDestroyArticleDescriptionText: string;
  /** Export BOL or invoice number. */
  exportOrDestroyUniqueIdentifierNumber: string;
}

export interface NoticeOfIntentInput {
  intendedPortOfExport?: string;
  /** Space = Waived, X = Exam Required & Witnessed. */
  examinationWitnessIndicator: string;
  /** City and state. */
  locationOfDestruction?: string;
  /** D = discrepant, N = non-discrepant, space = waived. Required if
   * Examination/Witness Indicator = X. */
  resultsOfExaminationOrWitnessOfDestruction?: string;
}

export interface ExamWitnessInput {
  /** P = Processor, E = Examiner. */
  recordIndicator: string;
  nameOfCbpPersonnel: string;
  cbpPersonnelBadgeNumber: string;
  cbpPersonnelPhoneNumber: string;
  /** MMDDYY. */
  processingExaminationDate: Date;
}

export interface NaftaUsmcaInput {
  /** Foreign entry number. */
  entryNumber: string;
  /** MMDDYY. Date of entry into the foreign country. */
  entryDate: Date;
  /** 2 implied decimal places. */
  dutyPaidToForeignGovtLocalCurrency: Decimal;
  /** Exchange rate to ONE US dollar — 6 implied decimal places. */
  exchangeRate: Decimal;
  /** HTS number as filed with the foreign government. */
  tariffNumber1: string;
  tariffNumber2?: string;
  tariffNumber3?: string;
  /** Must be CA or MX. */
  countryOfExport: string;
}

/** Record 70: same shape as Record 60 (Core Drawback) plus TFTEA's Schedule B
 * Code. */
export interface TfteaExportDestroyInput {
  exportOrDestroyIndicator: string;
  htsNumber: string;
  /** 4 implied decimal places. */
  exportOrDestroyQuantity: Decimal;
  unitOfMeasureCode: string;
  /** MMDDYY. */
  exportOrDestroyDate: Date;
  noticeOfIntentIndicator?: string;
  waiverToDrawbackClaimRightsIndicator?: string;
  nameOfExporterOrDestroyer: string;
  countryOfUltimateDestination?: string;
  billOfLadingIndicator?: string;
  billOfLadingCarrierCode?: string;
  /** Required if Schedule B classification used for HTS Number. */
  scheduleBCode?: string;
}

export type TfteaExportDescInput = ExportDescInput;

/** Record 72: TFTEA-side equivalent of Record 52 (links export to import article). */
export type LinkExportImportInput = LinkImportMfgInput;

/** Record 73: TFTEA-side equivalent of Record 53 (links export to manufactured article). */
export type LinkExportMfgInput = LinkMfgSourceInput;

export interface RevenueClassTotalsInput {
  /** CBP accounting classification code — leading zero significant. */
  accountingClassCode1: string;
  /** 2 implied decimal places. */
  totalAmount1: Decimal;
  accountingClassCode2?: string;
  /** 2 implied decimal places. */
  totalAmount2?: Decimal;
  accountingClassCode3?: string;
  /** 2 implied decimal places. */
  totalAmount3?: Decimal;
  accountingClassCode4?: string;
  /** 2 implied decimal places. */
  totalAmount4?: Decimal;
}

export interface RevenueGrandTotalsInput {
  /** 2 implied decimal places. */
  grandTotalDutyAmount?: Decimal;
  /** 2 implied decimal places. */
  grandTotalUserFeeAmount?: Decimal;
  /** 2 implied decimal places. */
  grandTotalIrTaxAmount?: Decimal;
}

// ── Output records ──────────────────────────────────────────────────────────

/** Output E0-Record: Drawback Entry Summary Condition Reference. Shares the
 * chapter-agnostic conditionReferencePrefix layout (positions 1-25) with
 * every other chapter's E0/X0-Record. */
export interface DrawbackE0Input {
  referenceDataTypeCode: string;
  /** A true relative-position count, not an identifier — decodes as a number. */
  occurrencePosition: number;
  referenceDataText: string;
}

/** Output E1-Record: Entry Summary Condition/Disposition Response. */
export interface DrawbackE1Input {
  /** " " = not final, A = accepted, R = rejected. */
  dispositionTypeCode: string;
  /** F = fatal, W = warning, I = informational, " " = none. */
  severityCode: string;
  conditionCode: string;
  reasonCode?: string;
  narrativeText: string;
  entryFilerCode?: string;
  entryNumber?: string;
  /** Raw 5-char version number (major/minor revision) — not parsed as a number. */
  versionNumber?: string;
  brokerReferenceNumber?: string;
}
