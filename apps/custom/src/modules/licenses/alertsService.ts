// License alerts (prompt sections 47-48): expiring licenses and
// utilization-threshold breaches (remaining capacity low, or committed but
// unshipped balance high). Computed on demand for the alerts API and
// re-used by the scheduled Inngest job for email delivery.
import { db } from "@/lib/db";
import { Decimal } from "@/lib/tariff/decimal";
import { queueLicenseAlertDigest } from "@/modules/compliance/notifications/licenseNotificationService";

export interface LicenseAlert {
  type: "EXPIRING" | "REMAINING_QUANTITY_LOW" | "REMAINING_VALUE_LOW" | "COMMITTED_UNSHIPPED_HIGH";
  licenseId: string;
  licenseNumber: string;
  licenseLineId?: string;
  lineNumber?: number;
  message: string;
  expirationDate?: Date | null;
  detail?: Record<string, unknown>;
}

async function loadConfig(accountId: string) {
  const config = await db.accountLicenseConfig.findUnique({ where: { accountId } });
  return {
    licenseExpiryLeadDays: config?.licenseExpiryLeadDays ?? 90,
    remainingQuantityThresholdPct: config?.remainingQuantityThresholdPct ?? 20,
    remainingValueThresholdPct: config?.remainingValueThresholdPct ?? 20,
    committedButUnshippedQuantityThresholdPct: config?.committedButUnshippedQuantityThresholdPct ?? 50,
    committedButUnshippedValueThresholdPct: config?.committedButUnshippedValueThresholdPct ?? 50,
  };
}

export async function computeLicenseAlerts(accountId: string): Promise<LicenseAlert[]> {
  const config = await loadConfig(accountId);
  const alerts: LicenseAlert[] = [];
  const now = new Date();
  const leadCutoff = new Date(now.getTime() + config.licenseExpiryLeadDays * 24 * 60 * 60 * 1000);

  const licenses = await db.license.findMany({
    where: { accountId, status: { in: ["ACTIVE", "SUSPENDED"] } },
    include: { lines: true },
  });

  for (const license of licenses) {
    if (license.expirationDate && license.expirationDate <= leadCutoff) {
      alerts.push({
        type: "EXPIRING",
        licenseId: license.id,
        licenseNumber: license.licenseNumber,
        message: `License ${license.licenseNumber} expires on ${license.expirationDate.toISOString().slice(0, 10)}.`,
        expirationDate: license.expirationDate,
      });
    }

    for (const line of license.lines) {
      if (line.licensedQuantity != null) {
        const licensed = new Decimal(line.licensedQuantity);
        if (licensed.greaterThan(0)) {
          const remaining = licensed.minus(new Decimal(line.committedQuantity)).minus(new Decimal(line.shippedQuantity)).plus(new Decimal(line.adjustedQuantity));
          const remainingPct = remaining.dividedBy(licensed).times(100);
          if (remainingPct.lessThanOrEqualTo(config.remainingQuantityThresholdPct)) {
            alerts.push({
              type: "REMAINING_QUANTITY_LOW",
              licenseId: license.id,
              licenseNumber: license.licenseNumber,
              licenseLineId: line.id,
              lineNumber: line.lineNumber,
              message: `License ${license.licenseNumber} line ${line.lineNumber} has ${remainingPct.toFixed(1)}% quantity remaining.`,
              detail: { remaining: remaining.toString(), remainingPct: remainingPct.toString() },
            });
          }
        }
      }

      if (line.licensedValue != null) {
        const licensed = new Decimal(line.licensedValue);
        if (licensed.greaterThan(0)) {
          const remaining = licensed.minus(new Decimal(line.committedValue)).minus(new Decimal(line.shippedValue)).plus(new Decimal(line.adjustedValue));
          const remainingPct = remaining.dividedBy(licensed).times(100);
          if (remainingPct.lessThanOrEqualTo(config.remainingValueThresholdPct)) {
            alerts.push({
              type: "REMAINING_VALUE_LOW",
              licenseId: license.id,
              licenseNumber: license.licenseNumber,
              licenseLineId: line.id,
              lineNumber: line.lineNumber,
              message: `License ${license.licenseNumber} line ${line.lineNumber} has ${remainingPct.toFixed(1)}% value remaining.`,
              detail: { remaining: remaining.toString(), remainingPct: remainingPct.toString() },
            });
          }
        }
      }

      const committed = new Decimal(line.committedQuantity);
      if (line.licensedQuantity != null && new Decimal(line.licensedQuantity).greaterThan(0)) {
        const committedPct = committed.dividedBy(new Decimal(line.licensedQuantity)).times(100);
        if (committedPct.greaterThanOrEqualTo(config.committedButUnshippedQuantityThresholdPct)) {
          alerts.push({
            type: "COMMITTED_UNSHIPPED_HIGH",
            licenseId: license.id,
            licenseNumber: license.licenseNumber,
            licenseLineId: line.id,
            lineNumber: line.lineNumber,
            message: `License ${license.licenseNumber} line ${line.lineNumber} has ${committedPct.toFixed(1)}% quantity committed but not yet shipped.`,
            detail: { committedPct: committedPct.toString() },
          });
        }
      }
    }
  }

  return alerts;
}

/** Queues (never sends synchronously) a durable ComplianceNotification digest of an account's current alert list for async delivery via ComplianceNotificationDispatcher. Never throws. */
export async function deliverLicenseAlerts(accountId: string): Promise<{ queued: boolean; alertCount: number }> {
  const alerts = await computeLicenseAlerts(accountId);
  return queueLicenseAlertDigest(db, { accountId, alerts });
}

