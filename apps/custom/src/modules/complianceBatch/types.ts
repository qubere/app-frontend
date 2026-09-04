// Bulk Compliance Screening -- shared types.
//
// CanonicalComplianceRequest is the ONLY shape that drives compliance
// logic (prompt section 19/2) -- parser-specific row DTOs (see columns.ts)
// map into this and are discarded immediately after. Batch types beyond
// TRANSACTION_COMPLIANCE (PARTY_SCREENING, PRODUCT_CLASSIFICATION) are
// reserved for a later increment; see the gap notes in docs.
// PRE_APPROVED_PARTY_IMPORT has its own row shape (see
// PreApprovedPartyImportRow below) since it doesn't drive RPS/License/
// Embargo/Classification at all -- each row just calls the same
// createPreApproval() used by the one-at-a-time API (see preApproval.ts).

import type { ClassificationInput, LicenseConditionsInput } from "@/modules/licenses/types";
import type { LicenseOperationType } from "@prisma/client";

export interface ComplianceBatchServiceFlags {
  partyScreening: boolean;
  licenseScreening: boolean;
  /** Screens complianceCountry -> destinationCountry via the canonical
   *  doEmbargoCheck dispatcher (TRANSACTION level), same call pattern as
   *  communityScreening/evaluator.ts. */
  embargoScreening: boolean;
  /** Calls the canonical ClassificationService.classifyProduct for rows that
   *  carry product facts instead of (or alongside) an already-known ECCN/HTS. */
  productClassification: boolean;
}

export interface CanonicalPartyIdentity {
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
}

/** Product facts for productClassification -- distinct from `classification`
 *  (an already-known ECCN/HTS fed to License Determination); this is the
 *  input ClassificationService.classifyProduct uses to *determine* one. */
export interface CanonicalProductFacts {
  description: string;
  materialComposition?: string | null;
  functionUsage?: string | null;
  principalUse?: string | null;
  partNumber?: string | null;
  brandModel?: string | null;
}

/** The single normalized shape every TRANSACTION_COMPLIANCE row is parsed into. */
export interface CanonicalComplianceRequest {
  transactionId?: string | null;
  lineNumber?: number | null;
  correlationId: string;

  party?: CanonicalPartyIdentity | null;
  product?: CanonicalProductFacts | null;

  operationType: LicenseOperationType;
  classification?: ClassificationInput | null;
  originCountry?: string | null;
  destinationCountry?: string | null;
  complianceCountry?: string | null;
  conditions?: LicenseConditionsInput | null;

  quantity?: string | null;
  value?: string | null;
  currency?: string | null;

  serviceFlags: ComplianceBatchServiceFlags;
}

export interface BatchRowValidationError {
  rowNumber: number;
  errors: string[];
}

export interface ParsedBatchInput {
  records: CanonicalComplianceRequest[];
  /** Same length/order as `records` -- the original 1-based row number each came from. */
  sourceRowNumbers: number[];
  invalidRows: BatchRowValidationError[];
}

/** One row of a PRE_APPROVED_PARTY_IMPORT file -- validated for structure only; partyId existence and identity/reference-data checks are deferred to createPreApproval() at processing time, same as every other batch type. */
export interface PreApprovedPartyImportRow {
  partyId: string;
  reason: string | null;
  /** ISO-8601 datetime string, matching the one-at-a-time API's bodySchema. */
  expiresAt: string | null;
}

export interface ParsedPreApprovedPartyImportInput {
  records: PreApprovedPartyImportRow[];
  sourceRowNumbers: number[];
  invalidRows: BatchRowValidationError[];
}
