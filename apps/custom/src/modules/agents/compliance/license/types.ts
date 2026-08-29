// License Determination -- typed input/result model.
// (Qubere_Export_Import_License_Determination_Management_Data_Ingestion_
// Modern_UIUX_Claude_Code_Prompt.md, sections 6-17.)
//
// Every "is this true" flag is a tri-state (true | false | undefined), never
// collapsed to boolean -- an unset/unknown input must never be treated as
// "false" (section 6). Request-supplied values override account defaults;
// callers only see account defaults applied when the request omits a field.
import type { LicenseDeterminationStatus, LicenseOperationType } from "@prisma/client";

export type TriState = boolean | undefined;

/** Normalized classification value, keeping the original caller-supplied form. */
export interface ClassificationValue {
  type: "ECCN" | "USML" | "HTS" | "SCHEDULE_B" | "ICN";
  /** Original value as supplied/stored, dotted/dashed form preserved. */
  rawValue: string;
  /** Digits/letters-only normalized form used for lookups. */
  normalizedValue: string;
}

export interface EndUseConditions {
  governmentEndUse?: TriState;
  militaryEndUse?: TriState;
  nuclearEndUse?: TriState;
  missileEndUse?: TriState;
  chemBioEndUse?: TriState;
  internalUseOnly?: TriState;
  usSubsidiaryEndUser?: TriState;
}

export interface EncryptionAttributes {
  containsEncryption?: TriState;
  ccatsNumber?: string;
  zNumber?: string;
  selfClassified?: TriState;
}

export type ProductSaleType = "SALE" | "REPLACEMENT" | "LOAN" | "OTHER";

export interface LicenseDeterminationInput {
  accountId: string;

  operationType: LicenseOperationType;

  shipmentId?: string;
  lineItemId?: string;
  productId?: string;
  transactionId?: string;
  transactionLineId?: string;

  /// ISO alpha-2 or "EU"-style compliance/ship-from country.
  complianceCountry?: string;
  destinationCountry?: string;
  originCountry?: string;

  /** Overrides the classification(s) resolved from ProductClassification when supplied. */
  classifications?: ClassificationValue[];

  endUse?: EndUseConditions;
  encryption?: EncryptionAttributes;

  productSaleType?: ProductSaleType;
  /** RPL (replacement parts license) applies only when productSaleType === "REPLACEMENT". */
  rplCountryOrGroup?: string;

  /** Caller-supplied exception code is never proof of applicability -- only an input to LicenseExceptionEvaluator. */
  claimedExceptionCode?: string;

  quantity?: number;
  value?: number;
  currency?: string;

  correlationId?: string;
  source?: string;
  initiatedByUserId?: string;
}

export interface LicenseExceptionOutcome {
  code: string;
  applicability: "APPLICABLE" | "NOT_APPLICABLE" | "REVIEW_REQUIRED" | "INCOMPLETE";
  description?: string;
  reason: string;
}

export interface LicenseDeterminationEvidence {
  authority?: string;
  jurisdiction?: string;
  datasetId?: string;
  datasetVersion?: string;
  ruleId?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  citation?: string;
  note?: string;
}

export interface LicenseDeterminationOutcome {
  status: LicenseDeterminationStatus;
  baseDecision: LicenseDeterminationStatus;
  finalDecision: LicenseDeterminationStatus;
  reason: string;
  exception?: LicenseExceptionOutcome;
  missingInputs?: string[];
  ruleSource: string;
  ruleVersion?: string;
  evidence: LicenseDeterminationEvidence[];
  conditions: Record<string, unknown>;
}
