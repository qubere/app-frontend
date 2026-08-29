// Deterministic eligibility for License Management / License Determination
// email notifications -- mirrors shouldSendRpsNotification's role for RPS.
import type { AccountLicenseConfig, LicenseDeterminationStatus } from "@prisma/client";
import { normalizeRecipientList } from "./recipients";

/** Statuses worth alerting a reviewer on. INCOMPLETE/RULE_DATA_UNAVAILABLE/ERROR/INVALID_CLASSIFICATION/UNSUPPORTED_JURISDICTION reflect missing inputs or unsupported data, not a compliance exception requiring an email. */
const NOTIFIABLE_DETERMINATION_STATUSES: ReadonlySet<LicenseDeterminationStatus> = new Set(["REVIEW_REQUIRED", "BLOCKED"]);

export type LicenseNotificationEligibility =
  | { eligible: true; recipients: string[] }
  | { eligible: false; reason: "STATUS_NOT_NOTIFIABLE" | "MANAGEMENT_DISABLED" | "NO_RECIPIENTS" };

function resolveLicenseRecipients(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw.filter((r): r is string => typeof r === "string") : [];
  return normalizeRecipientList(arr);
}

/** Portfolio expiry/utilization-threshold digest (alertsService.ts). One email bundles every current alert for the account -- eligibility only depends on there being at least one alert and a configured recipient. */
export function shouldSendLicenseAlertDigest(
  config: Pick<AccountLicenseConfig, "licenseManagementEnabled" | "licenseAlertRecipients"> | null,
  alertCount: number
): LicenseNotificationEligibility {
  if (!config || config.licenseManagementEnabled !== true) return { eligible: false, reason: "MANAGEMENT_DISABLED" };
  if (alertCount === 0) return { eligible: false, reason: "STATUS_NOT_NOTIFIABLE" };
  const recipients = resolveLicenseRecipients(config.licenseAlertRecipients);
  if (recipients.length === 0) return { eligible: false, reason: "NO_RECIPIENTS" };
  return { eligible: true, recipients };
}

/** One LicenseDeterminationResult whose outcome requires human review/action. Reuses the same licenseAlertRecipients list as the portfolio digest -- no separate recipient config surface. */
export function shouldSendLicenseDeterminationReview(
  config: Pick<AccountLicenseConfig, "licenseDeterminationEnabled" | "licenseAlertRecipients"> | null,
  status: LicenseDeterminationStatus
): LicenseNotificationEligibility {
  if (!NOTIFIABLE_DETERMINATION_STATUSES.has(status)) return { eligible: false, reason: "STATUS_NOT_NOTIFIABLE" };
  if (!config || config.licenseDeterminationEnabled !== true) return { eligible: false, reason: "MANAGEMENT_DISABLED" };
  const recipients = resolveLicenseRecipients(config.licenseAlertRecipients);
  if (recipients.length === 0) return { eligible: false, reason: "NO_RECIPIENTS" };
  return { eligible: true, recipients };
}
