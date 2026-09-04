// Deterministic single source of truth for "should an RPS email notification
// be queued for this result?" -- every caller (persistResult.ts, tests) must
// go through this, never re-implement the checks inline.
import type { AccountScreeningConfig } from "@prisma/client";
import type { RestrictedPartyScreeningStatus } from "@/modules/agents/compliance/restrictedParty/types";
import { resolveRecipients } from "./recipients";
import type { ComplianceNotificationType } from "@prisma/client";

/** Statuses that constitute an "exception" worth alerting on. REVIEW_REQUIRED is included -- the UI already treats it as needing attention, not merely informational. PARTIAL/ERROR/CLEAR/SKIPPED never notify. */
const NOTIFIABLE_STATUSES: ReadonlySet<RestrictedPartyScreeningStatus> = new Set(["HIT", "REVIEW_REQUIRED"]);

export type NotificationEligibility =
  | { eligible: true; recipients: string[] }
  | { eligible: false; reason: "STATUS_NOT_NOTIFIABLE" | "ALERTS_DISABLED" | "SUPPRESSED" | "NO_RECIPIENTS" };

export function shouldSendRpsNotification(
  config: AccountScreeningConfig | null,
  status: RestrictedPartyScreeningStatus,
  notificationType: ComplianceNotificationType
): NotificationEligibility {
  if (!NOTIFIABLE_STATUSES.has(status)) return { eligible: false, reason: "STATUS_NOT_NOTIFIABLE" };
  if (!config || config.rpsEmailAlertsEnabled !== true) return { eligible: false, reason: "ALERTS_DISABLED" };
  if (config.rpsSuppressEmailAlerts === true) return { eligible: false, reason: "SUPPRESSED" };

  const recipients = resolveRecipients(config, notificationType);
  if (recipients.length === 0) return { eligible: false, reason: "NO_RECIPIENTS" };

  return { eligible: true, recipients };
}
