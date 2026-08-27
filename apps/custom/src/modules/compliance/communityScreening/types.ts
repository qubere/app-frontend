// Community Screening -- shared types.
//
// A Community Screening run is a thin orchestration record: it screens a
// batch of parties (entered directly, picked from Party Master, or uploaded
// as a file) against the *existing* RPS and Embargo engines and aggregates
// the per-party outcomes. It never duplicates matching/normalization logic
// and never mutates Party or reference-data tables. License Determination is
// explicitly out of scope for V1 and must be labeled "not evaluated"
// everywhere it could otherwise be inferred as a pass.
import type {
  CommunityScreeningInputMode,
  CommunityScreeningPartyStatus,
  CommunityScreeningRun,
  CommunityScreeningRunStatus,
  CommunityScreeningSource,
} from "@prisma/client";

export interface CommunityScreeningChecksEnabled {
  restrictedParty: boolean;
  embargo: boolean;
}

export interface CommunityScreeningOverrides {
  nameThreshold?: number;
  addressThreshold?: number;
  countryMatchRequired?: boolean;
  redFlagCheckEnabled?: boolean;
}

/** One party row as normalized from any of the three input modes, before persistence. */
export interface CommunityScreeningPartyInput {
  partyId?: string | null;
  externalReference?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  contactName?: string | null;
}

export interface CommunityScreeningDirectEntryInput {
  inputMode: "DIRECT_ENTRY";
  parties: CommunityScreeningPartyInput[];
}

export interface CommunityScreeningPartyMasterInput {
  inputMode: "PARTY_MASTER";
  partyIds: string[];
}

export interface CommunityScreeningFileUploadInput {
  inputMode: "FILE_UPLOAD";
  fileName: string;
  fileType: "CSV" | "XLSX" | "JSON";
  fileContent: Buffer;
}

export type CommunityScreeningInputSource =
  | CommunityScreeningDirectEntryInput
  | CommunityScreeningPartyMasterInput
  | CommunityScreeningFileUploadInput;

export interface CommunityScreeningCreateInput {
  source: CommunityScreeningSource;
  input: CommunityScreeningInputSource;
  checksEnabled: CommunityScreeningChecksEnabled;
  complianceCountry?: string | null;
  transactionReference?: string | null;
  overrides?: CommunityScreeningOverrides | null;
}

export interface CommunityScreeningActor {
  userId?: string | null;
  requestId?: string;
  /** True only for callers holding the elevated override-management permission; gates whether `overrides` may be non-null. */
  mayOverride?: boolean;
}

export type CommunityScreeningRunWithChecks = CommunityScreeningRun & {
  checksEnabled: CommunityScreeningChecksEnabled;
  overrides: CommunityScreeningOverrides | null;
};

export interface CommunityScreeningRowEvidence {
  restrictedParty: {
    enabled: boolean;
    status: string | null;
    resultId: string | null;
  };
  embargo: {
    enabled: boolean;
    status: string | null;
    evidence: Record<string, unknown> | null;
  };
}

export const LICENSE_DETERMINATION_NOTICE =
  "License determination was not performed as part of this screening. This result reflects Restricted Party and Embargo screening only.";

export type { CommunityScreeningInputMode, CommunityScreeningPartyStatus, CommunityScreeningRunStatus };
