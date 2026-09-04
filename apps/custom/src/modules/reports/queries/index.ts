import type { ReportRowsResult } from "../queryHelpers";
import { queryComplianceAudit } from "./complianceAudit";
import { queryScreeningActivity } from "./screeningActivity";
import { queryRestrictedPartyScreening } from "./restrictedPartyScreening";
import { queryEmbargoScreening } from "./embargoScreening";
import { queryPartyCompliance } from "./partyCompliance";
import { queryContinuousPartyMonitoring } from "./continuousPartyMonitoring";
import { queryReferenceDataChanges } from "./referenceDataChanges";
import { queryExceptionsOverrides } from "./exceptionsOverrides";
import { queryClassificationDecisions } from "./classificationDecisions";
import { queryLicenseDetermination } from "./licenseDetermination";
import { queryLicenseInventory } from "./licenseInventory";
import { queryLicenseUtilization } from "./licenseUtilization";
import { queryExpiringLicenses } from "./expiringLicenses";
import { queryLicenseEventsAdjustments } from "./licenseEventsAdjustments";

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
  "reference-data-changes": queryReferenceDataChanges,
  "compliance-exceptions-overrides": queryExceptionsOverrides,
  "classification-decisions": queryClassificationDecisions,
  "license-determination": queryLicenseDetermination,
  "license-inventory": queryLicenseInventory,
  "license-utilization": queryLicenseUtilization,
  "expiring-licenses": queryExpiringLicenses,
  "license-events-adjustments": queryLicenseEventsAdjustments,
};
