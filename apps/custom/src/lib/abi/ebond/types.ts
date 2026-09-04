import type { Decimal } from "@/lib/tariff/decimal";

// Types for the CATAIR eBond Create/Update chapter (Application Identifier
// CB input / CX output) — bond header, secondary notify parties, single
// transaction bond, principal/co-principal, bond user, surety/co-surety/
// re-insurer, and the output error/accept-reject message.
// Source: docs/plans/catair-source-docs/06-ebond-create-update-v1.9.pdf
//
// Deferred (not modeled this slice): interactive eBond Query transactions
// (Application Identifier QB/QX) and Trade Portal UI rendering.
//
// Unlike Entry Summary/Statement Processing's 2-implied-decimal money fields,
// eBond's currency fields (Bond Amount, Surety/Co-Surety Liability Amount) are
// explicitly whole US dollars, no implied decimals — confirmed both by the
// source PDF's own field description and independently re-verified against
// the raw PDF text before implementation.

export interface HeaderInput {
  /** B=Add basic, A=Add STB, V=Void STB, C=Adjust STB, U=Subst, E=Supersede, T=Term continuous, R=Rider. */
  bondDesignationTypeCode: "B" | "A" | "V" | "C" | "U" | "E" | "T" | "R";
  /** 8 = Continuous bond, 9 = Single transaction bond. */
  bondTypeCode: "8" | "9";
  bondActivityCode?: string;
  /** Whole US dollars — no implied decimals. */
  bondAmount?: Decimal;
  /** MMDDYY. */
  executionDate?: Date;
  suretyReferenceNumber?: string;
  effectiveDate?: Date;
  terminationDate?: Date;
  /** CBP-assigned bond number (input: for V/C/T/R actions; output: assigned on acceptance). */
  bondNumber?: string;
  reconciliationBondRiderFlag?: "Y" | "N";
  usviBondRiderFlag?: "Y";
}

export interface SecondaryNotifyInput {
  secondaryNotifyPartyCode1: string;
  secondaryNotifyPartyCode2?: string;
  secondaryNotifyPartyCode3?: string;
  secondaryNotifyPartyCode4?: string;
}

export interface SingleTransactionBondInput {
  /** 1=Entry#, 2=ISF, 3=Seizure, 4=Bill of Lading, 5=Carrier&Voyage. */
  transactionIdTypeCode: "1" | "2" | "3" | "4" | "5";
  /** Mandatory when transactionIdTypeCode = "1". */
  entryTypeCode?: string;
  transactionId: string;
}

export interface PrincipalInput {
  /** 1=EIN, 2=SSN, 3=CBP Assigned Number. */
  principalIdNumberType: "1" | "2" | "3";
  principalIdNumber: string;
  principalName?: string;
}

export interface CoPrincipalInput {
  coPrincipalIdNumberType: "1" | "2" | "3";
  coPrincipalIdNumber: string;
  coPrincipalName?: string;
}

export interface BondUserInput {
  /** 1=EIN, 2=SSN, 3=CBP Assigned Number. */
  bondUserIdNumberType: "1" | "2" | "3";
  bondUserIdNumber: string;
  bondUserName?: string;
  /** A = Add User to Bond, D = Delete User from Bond. */
  userRiderActionCode?: "A" | "D";
  userAddDate?: Date;
  userDeleteDate?: Date;
}

export interface SuretyInput {
  /** 3-digit CBP surety code — leading zero significant (e.g. "037"). */
  suretyCode: string;
  agentIdNumber: string;
  suretyName?: string;
  /** Whole US dollars — no implied decimals. */
  suretyLiabilityAmount?: Decimal;
}

export interface CoSuretyInput {
  coSuretyCode: string;
  agentIdNumber: string;
  coSuretyName?: string;
  coSuretyLiabilityAmount: Decimal;
}

export interface ReinsurerInput {
  suretyCodeForReinsurer: string;
  agentIdNumber: string;
  suretyName?: string;
}

export interface OutputMessageInput {
  /** " " = in-progress, A = accepted, R = rejected. */
  dispositionTypeCode: "A" | "R" | " ";
  /** F = fatal error, I = informational notice. */
  severityCode: "F" | "I";
  conditionCode: string;
  narrativeText: string;
}
