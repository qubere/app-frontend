// Shared types for the Export/Import License Determination & License
// Management domain. Mirrors packages/db/prisma/schema.prisma's
// LicenseDeterminationResult/License/LicenseLine/LicenseEvent models.
//
// NOTE: no jurisdiction-specific regulatory rule datasets are ingested in
// this repo (only `commerce_control_list` = ECCN/CCL master exists). The
// LicenseControlRule lookup table exists and is wired into the resolver,
// but ships with zero rows -- the determination engine therefore never
// fabricates a NO_LICENSE_REQUIRED / LICENSE_REQUIRED outcome from rules it
// doesn't have -- it returns RULE_DATA_UNAVAILABLE / INCOMPLETE /
// REVIEW_REQUIRED instead, until real rule content is ingested from an
// authoritative source.
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
  /** End-user certificate or letter of assurance is on file for this party. */
  endUserCertificateOnFile?: TriState;
  /** Destination is within a customs free zone. */
  customsFreeZone?: TriState;
  /** License exception encryption registration number (BIS), when asserted. */
  encryptionExceptionZNumber?: string | null;
  /** Commodity Classification Automated Tracking System number, when asserted. */
  encryptionExceptionCcatsNumber?: string | null;
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

/**
 * "GENERIC" -- the fail-safe path, no jurisdiction rule data was consulted
 * (or none matched). "MATCHED_RULE" -- a LicenseControlRule row matched and
 * its decision was used.
 */
export type LicenseRuleSource = "GENERIC" | "MATCHED_RULE";

export interface LicenseDeterminationOutcome {
  status: LicenseDeterminationStatus;
  baseDecision: LicenseDeterminationStatus;
  finalDecision: LicenseDeterminationStatus;
  reason: string;
  exceptionCode?: string | null;
  exceptionDescription?: string | null;
  missingInputs?: string[];
  ruleSource?: LicenseRuleSource | null;
  ruleVersion?: string | null;
  evidence?: Record<string, unknown> | null;
}

/**
 * A candidate row from LicenseControlRule, decoupled from Prisma so
 * ruleResolver.ts stays a pure, DB-free function -- callers load rows and
 * map them to this shape before calling resolveLicenseDetermination, the
 * same way AccountLicenseGates is loaded and passed in rather than fetched
 * inside the resolver.
 */
export interface LicenseControlRuleCandidate {
  operationType: LicenseOperationType;
  /** ECCN | USML | HTS | SCHEDULE_B | ICN, or "*" wildcard. */
  classificationType: string;
  /** Exact classification value, or "*" wildcard. */
  classificationValue: string;
  /** ISO 3166-1 alpha-2, or "*" wildcard. */
  country: string;
  /** LICENSE_REQUIRED | NO_LICENSE_REQUIRED -- enforced by a DB check constraint. */
  decision: LicenseDeterminationStatus;
  authority?: string | null;
  citation?: string | null;
  ruleVersion: string;
}

export const MISSING_INPUT_CODES = {
  CLASSIFICATION: "classification",
  DESTINATION_COUNTRY: "destinationCountry",
  END_USE_CONDITIONS: "endUseConditions",
  ENCRYPTION_CONDITIONS: "encryptionConditions",
} as const;
