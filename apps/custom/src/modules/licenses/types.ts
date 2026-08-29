// Shared types for the Export/Import License Determination & License
// Management domain. Mirrors packages/db/prisma/schema.prisma's
// LicenseDeterminationResult/License/LicenseLine/LicenseEvent models.
//
// NOTE: no jurisdiction-specific regulatory rule datasets are ingested in
// this repo (only `commerce_control_list` = ECCN/CCL master exists). The
// determination engine therefore never fabricates a NO_LICENSE_REQUIRED /
// LICENSE_REQUIRED outcome from rules it doesn't have -- it returns
// RULE_DATA_UNAVAILABLE / INCOMPLETE / REVIEW_REQUIRED instead. See
// docs/LICENSE-DETERMINATION-GAP-MATRIX.md.
import type { LicenseDeterminationStatus, LicenseOperationType } from "@prisma/client";

/** A tri-plus-state flag: never collapse "unknown" into false. */
export type TriState = "TRUE" | "FALSE" | "UNKNOWN" | "DISABLED";

export type ClassificationType = "ECCN" | "USML" | "HTS" | "SCHEDULE_B" | "ICN";

export interface ClassificationInput {
  type: ClassificationType;
  /** Raw value as provided by the caller, e.g. "5A002.a.1", "0A919", "8481.80.5090". */
  value: string;
}

export interface NormalizedClassification extends ClassificationInput {
  /** Normalized (uppercased, whitespace-stripped) form used for comparisons. */
  normalizedValue: string;
  /** Structural validity of the value's format for its declared type -- NOT a controlled-item lookup. */
  formatValid: boolean;
  formatError?: string;
}

/** End-use / end-user / encryption / RPL condition flags -- section 12. */
export interface LicenseConditionsInput {
  governmentEndUser?: TriState;
  militaryEndUser?: TriState;
  nuclearEndUse?: TriState;
  missileTechnologyEndUse?: TriState;
  chemicalBiologicalEndUse?: TriState;
  internalUseOnly?: TriState;
  usSubsidiary?: TriState;
  encryptionItem?: TriState;
  encryptionSelfClassified?: TriState;
  replacementPartsIndicator?: TriState;
  militaryEndUseCountry?: TriState;
}

export interface LicenseDeterminationRequestInput {
  accountId: string;
  operationType: LicenseOperationType;
  classification: ClassificationInput;
  complianceCountry?: string | null;
  destinationCountry?: string | null;
  originCountry?: string | null;
  conditions?: LicenseConditionsInput;
  quantity?: number | string | null;
  value?: number | string | null;
  currency?: string | null;
  shipmentId?: string | null;
  lineItemId?: string | null;
  productId?: string | null;
  transactionId?: string | null;
  transactionLineId?: string | null;
  /** Correlation id shared with the caller's ComplianceExecution row, when one already exists. */
  correlationId?: string | null;
  userId?: string | null;
  source?: string | null;
}

export interface LicenseDeterminationOutcome {
  status: LicenseDeterminationStatus;
  baseDecision: LicenseDeterminationStatus;
  finalDecision: LicenseDeterminationStatus;
  reason: string;
  exceptionCode?: string | null;
  exceptionDescription?: string | null;
  missingInputs?: string[];
  ruleSource?: string | null;
  ruleVersion?: string | null;
  evidence?: Record<string, unknown> | null;
}

export const MISSING_INPUT_CODES = {
  CLASSIFICATION: "classification",
  DESTINATION_COUNTRY: "destinationCountry",
  END_USE_CONDITIONS: "endUseConditions",
  ENCRYPTION_CONDITIONS: "encryptionConditions",
} as const;
