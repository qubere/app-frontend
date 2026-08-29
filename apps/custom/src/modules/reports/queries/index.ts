import type { ReportRowsResult } from "../queryHelpers";
import { queryComplianceAudit } from "./complianceAudit";
import { queryScreeningActivity } from "./screeningActivity";
import { queryRestrictedPartyScreening } from "./restrictedPartyScreening";
import { queryEmbargoScreening } from "./embargoScreening";
import { queryPartyCompliance } from "./partyCompliance";
import { queryContinuousPartyMonitoring } from "./continuousPartyMonitoring";
import { queryExceptionsOverrides } from "./exceptionsOverrides";
import { queryClassificationDecisions } from "./classificationDecisions";

export type ReportQueryFn = (
  accountId: string,
  filters: Record<string, unknown>,
  limit: number
) => Promise<ReportRowsResult>;

/** Authorized domain query services, keyed by catalog report id. */
export const REPORT_QUERIES: Record<string, ReportQueryFn> = {
  "compliance-audit": queryComplianceAudit,
  "screening-activity": queryScreeningActivity,
  "restricted-party-screening": queryRestrictedPartyScreening,
  "embargo-screening": queryEmbargoScreening,
  "party-compliance": queryPartyCompliance,
  "continuous-party-monitoring": queryContinuousPartyMonitoring,
  "compliance-exceptions-overrides": queryExceptionsOverrides,
  "classification-decisions": queryClassificationDecisions,
};
