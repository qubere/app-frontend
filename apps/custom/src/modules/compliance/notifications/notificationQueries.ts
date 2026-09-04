// Read-only lookups for "was an email sent for this screening result" style
// questions (Ask Qubere). Tenant-scoped by accountId on every query. Never
// returns recipient email addresses -- only counts, status, type, and provider.
import { db } from "@/lib/db";

export interface NotificationStatusView {
  found: boolean;
  notificationId: string | null;
  notificationType: string | null;
  deliveryStatus: string | null;
  recipientCount: number | null;
  provider: string | null;
  attemptCount: number | null;
  queuedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  lastErrorCode: string | null;
  reason: string | null;
}

function toView(
  notification: {
    id: string;
    notificationType: string;
    deliveryStatus: string;
    recipients: unknown;
    provider: string | null;
    attemptCount: number;
    queuedAt: Date | null;
    sentAt: Date | null;
    failedAt: Date | null;
    lastErrorCode: string | null;
  } | null
): NotificationStatusView {
  if (!notification) {
    return {
      found: false,
      notificationId: null,
      notificationType: null,
      deliveryStatus: null,
      recipientCount: null,
      provider: null,
      attemptCount: null,
      queuedAt: null,
      sentAt: null,
      failedAt: null,
      lastErrorCode: null,
      reason: "No notification was ever queued for this screening result -- either it did not qualify for an alert (status was not HIT/REVIEW_REQUIRED) or email alerts were not enabled at the time.",
    };
  }
  return {
    found: true,
    notificationId: notification.id,
    notificationType: notification.notificationType,
    deliveryStatus: notification.deliveryStatus,
    recipientCount: Array.isArray(notification.recipients) ? notification.recipients.length : 0,
    provider: notification.provider,
    attemptCount: notification.attemptCount,
    queuedAt: notification.queuedAt?.toISOString() ?? null,
    sentAt: notification.sentAt?.toISOString() ?? null,
    failedAt: notification.failedAt?.toISOString() ?? null,
    lastErrorCode: notification.lastErrorCode,
    reason: notification.deliveryStatus === "SUPPRESSED" ? "Email alerts are suppressed for this account (rpsSuppressEmailAlerts)." : null,
  };
}

export async function getNotificationStatusForScreeningResult(
  accountId: string,
  screeningResultId: string
): Promise<NotificationStatusView> {
  const notification = await db.complianceNotification.findFirst({
    where: { accountId, screeningResultId },
    select: {
      id: true,
      notificationType: true,
      deliveryStatus: true,
      recipients: true,
      provider: true,
      attemptCount: true,
      queuedAt: true,
      sentAt: true,
      failedAt: true,
      lastErrorCode: true,
    },
  });
  return toView(notification);
}
