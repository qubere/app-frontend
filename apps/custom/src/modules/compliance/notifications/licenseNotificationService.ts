// Queues (never sends) ComplianceNotification rows for License Management
// portfolio alerts and License Determination review-required results,
// reusing the same durable/async/retry pipeline as RPS
// (ComplianceNotificationDispatcher). Delivery itself happens later, driven
// by the same compliance-notification-dispatch cron.
import { Prisma, type PrismaClient, type LicenseDeterminationStatus } from "@prisma/client";
import { createAuditLog, AuditAction } from "@/lib/audit";
import type { LicenseAlert } from "@/modules/licenses/alertsService";
import { shouldSendLicenseAlertDigest, shouldSendLicenseDeterminationReview } from "./licenseEligibility";

export type Tx = Prisma.TransactionClient | PrismaClient;

export interface QueueLicenseAlertDigestParams {
  accountId: string;
  alerts: LicenseAlert[];
}

/** One digest per account per calendar day -- skips if a not-yet-superseded LICENSE_ALERT notification was already queued today (application-level dedupe; there is no single source-record id to key a DB unique constraint on). */
export async function queueLicenseAlertDigest(tx: Tx, params: QueueLicenseAlertDigestParams): Promise<{ queued: boolean; alertCount: number }> {
  const { accountId, alerts } = params;
  const config = await tx.accountLicenseConfig.findUnique({ where: { accountId } });
  const eligibility = shouldSendLicenseAlertDigest(config, alerts.length);
  if (!eligibility.eligible) return { queued: false, alertCount: alerts.length };

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const existing = await tx.complianceNotification.findFirst({
    where: {
      accountId,
      notificationType: "LICENSE_ALERT",
      createdAt: { gte: startOfDay },
      deliveryStatus: { in: ["PENDING", "QUEUED", "PROCESSING", "SENT"] },
    },
  });
  if (existing) return { queued: false, alertCount: alerts.length };

  await tx.complianceNotification.create({
    data: {
      accountId,
      notificationType: "LICENSE_ALERT",
      channel: "EMAIL",
      recipients: eligibility.recipients,
      payload: { alerts } as unknown as Prisma.InputJsonValue,
      deliveryStatus: "PENDING",
      queuedAt: new Date(),
    },
  });

  await createAuditLog({
    accountId,
    action: AuditAction.LICENSE_NOTIFICATION_QUEUED,
    entity: "AccountLicenseConfig",
    entityId: accountId,
    source: "SYSTEM",
    metadata: { notificationType: "LICENSE_ALERT", alertCount: alerts.length, recipientCount: eligibility.recipients.length },
  });

  return { queued: true, alertCount: alerts.length };
}

export interface QueueLicenseDeterminationReviewParams {
  accountId: string;
  licenseDeterminationResultId: string;
  status: LicenseDeterminationStatus;
  reason: string;
  operationType: string;
  shipmentId?: string | null;
  productId?: string | null;
  transactionId?: string | null;
  createdByUserId?: string | null;
}

/** Idempotent by construction: a second call for the same licenseDeterminationResultId collides on ComplianceNotification's [licenseDeterminationResultId, notificationType] unique constraint and is treated as already-queued, not an error. */
export async function queueLicenseDeterminationReview(tx: Tx, params: QueueLicenseDeterminationReviewParams): Promise<void> {
  const { accountId, licenseDeterminationResultId, status, reason, operationType, shipmentId, productId, transactionId, createdByUserId } = params;

  const config = await tx.accountLicenseConfig.findUnique({ where: { accountId } });
  const eligibility = shouldSendLicenseDeterminationReview(config, status);
  if (!eligibility.eligible) return;

  try {
    await tx.complianceNotification.create({
      data: {
        accountId,
        notificationType: "LICENSE_DETERMINATION_REVIEW_REQUIRED",
        channel: "EMAIL",
        licenseDeterminationResultId,
        shipmentId: shipmentId ?? null,
        recipients: eligibility.recipients,
        payload: { status, reason, operationType, shipmentId, productId, transactionId } as unknown as Prisma.InputJsonValue,
        deliveryStatus: "PENDING",
        queuedAt: new Date(),
        createdByUserId: createdByUserId ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return; // Already queued for this licenseDeterminationResultId -- not an error.
    }
    throw error;
  }

  await createAuditLog({
    accountId,
    userId: createdByUserId ?? null,
    action: AuditAction.LICENSE_NOTIFICATION_QUEUED,
    entity: "LicenseDeterminationResult",
    entityId: licenseDeterminationResultId,
    source: "SYSTEM",
    metadata: { notificationType: "LICENSE_DETERMINATION_REVIEW_REQUIRED", status, recipientCount: eligibility.recipients.length },
  });
}
