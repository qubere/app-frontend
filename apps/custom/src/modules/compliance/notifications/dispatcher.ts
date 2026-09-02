import { renderPortalEmail } from "@/lib/portal/portalNotifications";
import { renderAssistAlertEmail } from "@/modules/notifications/assistAlertNotifications";
// Asynchronous delivery of queued ComplianceNotification rows. Mirrors
// ShipmentEventConsumer.dispatchOutboxEvents: optimistic claim via updateMany
// (guarded on attemptCount so two concurrent workers can't both send the
// same notification), exponential backoff on retryable failure, stale
// PROCESSING reclaim via lockedAt. Never touches RestrictedPartyScreeningResult.
import { db } from "@/lib/db";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { getEmailProvider } from "@/modules/email/emailProviderFactory";
import { getEmailConfig, EmailConfigError } from "@/modules/email/emailConfig";
import { renderRpsEmail, renderLicenseAlertEmail, renderLicenseDeterminationReviewEmail } from "./templates";
import type { RpsEmailMatchSummary, RpsEmailResultView, RenderedEmail } from "./templates/types";
import type { LicenseAlertPayload, LicenseDeterminationReviewPayload } from "./templates/licenseTemplates";
import type { ComplianceNotificationType } from "@prisma/client";

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/** Notification types rendered from a live RestrictedPartyScreeningResult. Everything else (LICENSE_*) renders from the notification's own snapshotted `payload`. */
const RPS_NOTIFICATION_TYPES: ReadonlySet<ComplianceNotificationType> = new Set([
  "RPS_HIT",
  "RPS_REVIEW_REQUIRED",
  "PAL_RESCREEN_HIT",
  "PARTY_RESCREEN_HIT",
]);

function retryAt(attempt: number, baseSeconds: number): Date {
  return new Date(Date.now() + Math.min(30 * 60_000, baseSeconds * 1000 * 2 ** Math.max(0, attempt - 1)));
}

export interface DispatchResult {
  processedCount: number;
  sentCount: number;
  retriedCount: number;
  failedCount: number;
  errors: Array<{ notificationId: string; error: string }>;
}

export class ComplianceNotificationDispatcher {
  static async dispatchPending(limit: number = 50): Promise<DispatchResult> {
    const now = new Date();
    const staleLock = new Date(now.getTime() - LOCK_TIMEOUT_MS);

    const pending = await db.complianceNotification.findMany({
      where: {
        OR: [
          { deliveryStatus: "PENDING", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
          { deliveryStatus: "RETRYABLE_FAILURE", nextAttemptAt: { lte: now } },
          { deliveryStatus: "PROCESSING", lockedAt: { lt: staleLock } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    let sentCount = 0;
    let retriedCount = 0;
    let failedCount = 0;
    const errors: Array<{ notificationId: string; error: string }> = [];

    let config;
    try {
      config = getEmailConfig();
    } catch (error) {
      if (error instanceof EmailConfigError) {
        return { processedCount: 0, sentCount: 0, retriedCount: 0, failedCount: 0, errors: [] };
      }
      throw error;
    }

    for (const notification of pending) {
      const claimed = await db.complianceNotification.updateMany({
        where: {
          id: notification.id,
          attemptCount: notification.attemptCount,
          deliveryStatus: notification.deliveryStatus,
        },
        data: { deliveryStatus: "PROCESSING", lockedAt: new Date(), attemptCount: { increment: 1 } },
      });
      if (claimed.count !== 1) continue;

      try {
        let rendered: RenderedEmail;
        let format: string = "HTML";

        if (RPS_NOTIFICATION_TYPES.has(notification.notificationType)) {
          if (!notification.screeningResultId) {
            throw new Error("ComplianceNotification has no screeningResultId to render.");
          }

          const result = await db.restrictedPartyScreeningResult.findUnique({
            where: { id: notification.screeningResultId },
            include: { matches: true },
          });
          if (!result) throw new Error(`Screening result ${notification.screeningResultId} no longer exists.`);

          const accountConfig = await db.accountScreeningConfig.findUnique({ where: { accountId: notification.accountId } });
          const matches: RpsEmailMatchSummary[] = result.matches
            .filter((m) => !m.suppressedByApprovedParty)
            .map((m) => ({ sourceList: m.sourceList, matchedName: m.matchedName, nameScore: m.nameScore, matchMethod: m.matchMethod }));

          rendered = renderRpsEmail({
            notificationType: notification.notificationType,
            appBaseUrl: config.appBaseUrl,
            secure: accountConfig?.rpsSecureEmailEnabled === true,
            result: {
              id: result.id,
              // Notifications are only ever queued for HIT/REVIEW_REQUIRED results
              // (see persistResult.ts) -- the DB enum's extra STALE value can't occur here.
              status: result.status as RpsEmailResultView["status"],
              screenedName: result.screenedName,
              screenedAddress: result.screenedAddress,
              screenedCity: result.screenedCity,
              screenedCountry: result.screenedCountry,
              hitCount: result.hitCount,
              redFlagCount: result.redFlagCount,
              partyId: result.partyId,
              shipmentId: result.shipmentId,
              matches,
            },
          });
          format = accountConfig?.rpsEmailFormat ?? "HTML";
        } else if (notification.notificationType === "PORTAL_UPDATE") {
          rendered = renderPortalEmail(notification.payload);
        } else if (notification.notificationType === "ASSIST_AMORTIZATION_ALERT") {
          rendered = renderAssistAlertEmail(notification.payload, config.appBaseUrl);
        } else if (notification.notificationType === "LICENSE_ALERT") {
          const payload = notification.payload as unknown as LicenseAlertPayload | null;
          if (!payload?.alerts) throw new Error("LICENSE_ALERT notification has no payload to render.");
          rendered = renderLicenseAlertEmail(payload);
        } else if (notification.notificationType === "LICENSE_DETERMINATION_REVIEW_REQUIRED") {
          if (!notification.licenseDeterminationResultId) {
            throw new Error("ComplianceNotification has no licenseDeterminationResultId to render.");
          }
          const payload = notification.payload as unknown as LicenseDeterminationReviewPayload | null;
          if (!payload) throw new Error("LICENSE_DETERMINATION_REVIEW_REQUIRED notification has no payload to render.");
          rendered = renderLicenseDeterminationReviewEmail(notification.licenseDeterminationResultId, payload, config.appBaseUrl);
        } else {
          throw new Error(`Unsupported notification type "${notification.notificationType}".`);
        }

        const recipients = Array.isArray(notification.recipients)
          ? (notification.recipients as unknown[]).filter((r): r is string => typeof r === "string")
          : [];
        if (recipients.length === 0) throw new Error("Notification has no resolved recipients.");

        const isRpsType = RPS_NOTIFICATION_TYPES.has(notification.notificationType);
        const sentAction = isRpsType ? AuditAction.RPS_NOTIFICATION_SENT : notification.notificationType === "ASSIST_AMORTIZATION_ALERT" ? AuditAction.ASSIST_NOTIFICATION_SENT : AuditAction.LICENSE_NOTIFICATION_SENT;
        const retryAction = isRpsType ? AuditAction.RPS_NOTIFICATION_RETRY : notification.notificationType === "ASSIST_AMORTIZATION_ALERT" ? AuditAction.ASSIST_NOTIFICATION_RETRY : AuditAction.LICENSE_NOTIFICATION_RETRY;
        const failedAction = isRpsType ? AuditAction.RPS_NOTIFICATION_FAILED : notification.notificationType === "ASSIST_AMORTIZATION_ALERT" ? AuditAction.ASSIST_NOTIFICATION_FAILED : AuditAction.LICENSE_NOTIFICATION_FAILED;

        const provider = getEmailProvider();
        const sendResult = await provider.send({
          to: recipients,
          subject: rendered.subject,
          html: format === "HTML" ? rendered.html : undefined,
          text: rendered.text,
        });

        if (sendResult.outcome === "SUCCESS") {
          await db.complianceNotification.update({
            where: { id: notification.id },
            data: {
              deliveryStatus: "SENT",
              sentAt: new Date(),
              lockedAt: null,
              provider: config.provider,
              providerMessageId: sendResult.providerMessageId,
              lastErrorCode: null,
              lastErrorMessage: null,
            },
          });
          await createAuditLog({
            accountId: notification.accountId,
            action: sentAction,
            entity: "ComplianceNotification",
            entityId: notification.id,
            source: "SYSTEM",
            metadata: { notificationType: notification.notificationType, provider: config.provider },
          });
          sentCount++;
        } else if (sendResult.outcome === "RETRYABLE_FAILURE" && notification.attemptCount + 1 < config.maxRetryAttempts) {
          await db.complianceNotification.update({
            where: { id: notification.id },
            data: {
              deliveryStatus: "RETRYABLE_FAILURE",
              lockedAt: null,
              nextAttemptAt: retryAt(notification.attemptCount + 1, config.retryBaseSeconds),
              lastErrorCode: sendResult.errorCode,
              lastErrorMessage: sendResult.errorMessage,
            },
          });
          await createAuditLog({
            accountId: notification.accountId,
            action: retryAction,
            entity: "ComplianceNotification",
            entityId: notification.id,
            source: "SYSTEM",
            metadata: { errorCode: sendResult.errorCode, attempt: notification.attemptCount + 1 },
          });
          retriedCount++;
        } else {
          await db.complianceNotification.update({
            where: { id: notification.id },
            data: {
              deliveryStatus: "FAILED",
              failedAt: new Date(),
              lockedAt: null,
              lastErrorCode: sendResult.errorCode,
              lastErrorMessage: sendResult.errorMessage,
            },
          });
          await createAuditLog({
            accountId: notification.accountId,
            action: failedAction,
            entity: "ComplianceNotification",
            entityId: notification.id,
            source: "SYSTEM",
            metadata: { errorCode: sendResult.errorCode, errorMessage: sendResult.errorMessage },
          });
          failedCount++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ notificationId: notification.id, error: errorMessage });
        await db.complianceNotification
          .update({
            where: { id: notification.id },
            data: {
              deliveryStatus: "RETRYABLE_FAILURE",
              lockedAt: null,
              nextAttemptAt: retryAt(notification.attemptCount + 1, config.retryBaseSeconds),
              lastErrorCode: "DISPATCH_ERROR",
              lastErrorMessage: errorMessage,
            },
          })
          .catch(() => undefined);
        failedCount++;
      }
    }

    return { processedCount: sentCount + retriedCount + failedCount, sentCount, retriedCount, failedCount, errors };
  }
}
