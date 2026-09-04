import type { Decimal } from "@/lib/tariff/decimal";

// Types for the CATAIR Importer/Bond Query chapter (Application Identifier
// KI input / KR output) — up to 6 importer numbers queried per input K-record
// (repeatable), and 8 possible output records (K1 mandatory per bond on
// file, K2-K8 conditional on address request code / data availability).
// Source: docs/plans/catair-source-docs/importer-bond-query-v7.pdf
// (July 15, 2025, Draft Version 7 — Pages QIB-8 through QIB-20)
//
// Like eBond's currency fields, this chapter's Bond Amount (K1 pos 52-60,
// 9N/9S, or K2 pos 58-67, 10N/10S — whichever fits, per K1's own "Bond
// Amount Record Location Indicator") is explicitly whole US dollars, no
// implied decimals — confirmed both by the source PDF's own field
// description (Note 4 / Note 1) and independently re-verified before
// implementation.

/** Up to six importer numbers may be queried per input K-record (repeatable
 * as a separate K-record for additional importers beyond six). The first
 * importer number/address request code pair is mandatory; pairs 2-6 must be
 * used contiguously (per PDF Note 2) and are otherwise space-filled. */
export interface ImporterBondQueryInput {
  /** Format NN-NNNNNNNXX (IRS), YYDDPP-NNNNN (CBP-assigned), or NNN-NN-NNNN (SSN). */
  importerNumber1: string;
  /** " " = transmit K1,K2,K7,K8 on output. "1" = transmit K1-K8 on output. */
  addressRequestCode1: " " | "1";
  importerNumber2?: string;
  addressRequestCode2?: " " | "1";
  importerNumber3?: string;
  addressRequestCode3?: " " | "1";
  importerNumber4?: string;
  addressRequestCode4?: " " | "1";
  importerNumber5?: string;
  addressRequestCode5?: " " | "1";
  importerNumber6?: string;
  addressRequestCode6?: " " | "1";
}

/** 0=No info on file, 1=On file w/ continuous bond, 2=On file w/ no bond,
 * 3=Voided, 4=Inactive. */
export type QueryResultsCode = 0 | 1 | 2 | 3 | 4;

/** Continuous bond activity code (CBPF 301 equivalent) — letters A-T, excluding I. */
export type BondActivityCode =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "J" | "K"
  | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T";

/** Record K1 (Output) — mandatory, returned for each bond type/activity code on
 * file for the queried importer. */
export interface K1Output {
  importerNumber: string;
  queryResultsCode: QueryResultsCode;
  importerName?: string;
  suretyCode?: string;
  /** Continuous bonds only (bond type 8). */
  bondTypeActivityCode?: BondActivityCode;
  /** Whole US dollars, no implied decimals. Populated here only when the bond
   * amount is <= 9 digits — a 10-digit amount is space-filled here and
   * populated on K2's `bondAmount` instead (see `bondAmountRecordLocationIndicator`). */
  bondAmount?: Decimal;
  districtPortWhereBondFiled?: string;
  /** MMDDYY. */
  bondEffectiveDate?: Date;
  bondNumber?: string;
  /** 1 = bond amount is on this K1 record, 2 = bond amount is on the K2 record. */
  bondAmountRecordLocationIndicator?: "1" | "2";
}

/** Record K2 (Output) — conditional; name qualifier/second name line plus bond
 * date/status detail, and the 10-digit bond amount overflow from K1. */
export interface K2Output {
  nameQualifier?: "DBA" | "DIV" | "AKA";
  importerNameLine2?: string;
  /** MMDDYY. */
  bondTerminationDate?: Date;
  periodicMonthlyStatementStatus?: "Y" | "N";
  bondSufficiencyIndicator?: "Y" | "N";
  bondUserStatusIndicator?: "A" | "T";
  /** MMDDYY. */
  bondUserTerminationDate?: Date;
  /** Whole US dollars, no implied decimals. Populated here only for 10-digit
   * bond amounts — see K1's `bondAmountRecordLocationIndicator`. */
  bondAmount?: Decimal;
}

/** Record K3 (Output) — conditional; mailing address lines 1-2. */
export interface K3Output {
  addressLine1?: string;
  addressLine2?: string;
}

/** Record K4 (Output) — conditional; mailing address city/state/postal. */
export interface K4Output {
  city: string;
  /** US state, Canadian province/territory, Mexican state, or "FN" for foreign. */
  stateCode: string;
  postalCode: string;
}

/** Record K5 (Output) — conditional; physical address lines 1-2. Same shape as K3. */
export interface K5Output {
  addressLine1?: string;
  addressLine2?: string;
}

/** Record K6 (Output) — conditional; physical address city/state/postal. Same shape as K4. */
export interface K6Output {
  city: string;
  stateCode: string;
  postalCode: string;
}

/** CBP Center of Excellence and Expertise identifier (K7 Output). */
export type CenterIdentifier =
  | "CEE001" | "CEE002" | "CEE003" | "CEE004" | "CEE005"
  | "CEE006" | "CEE007" | "CEE008" | "CEE009" | "CEE010"
  | "NOTELG" | "PNDING";

/** Record K7 (Output) — conditional; full legal importer name and Center ID. */
export interface K7Output {
  fullLegalImporterName: string;
  centerIdentifier: CenterIdentifier;
  centerIdDescription: string;
}

/** Record K8 (Output) — conditional, repeatable; overflow text for K7's full
 * legal name (IN1) or Center ID description (IN2). */
export interface K8Output {
  additionalInformationQualifierCode: "IN1" | "IN2";
  additionalInformation: string;
}
