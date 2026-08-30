/**
 * Bell notifications for license alerts.
 *
 * Complements deliverLicenseAlerts() (which queues an email digest via the
 * ComplianceNotification pipeline): this drops one in-app row per affected
 * license so a broker sees an expiring or nearly-exhausted license without
 * opening License Management. Deduped per (license, alert kind) so the daily
 * cron does not re-notify while the condition persists.
 */

import { computeLicenseAlerts, type LicenseAlert } from "./alertsService";
import { notifyAccountRoleHolders } from "@/modules/notifications/notifyAccount";

/** EXPIRING -> LICENSE_EXPIRING; every utilization alert -> LICENSE_UTILIZATION. */
export function licenseAlertNotificationType(alert: LicenseAlert): "LICENSE_EXPIRING" | "LICENSE_UTILIZATION" {
  return alert.type === "EXPIRING" ? "LICENSE_EXPIRING" : "LICENSE_UTILIZATION";
}

interface PerLicenseAlert {
  licenseId: string;
  licenseNumber: string;
  type: "LICENSE_EXPIRING" | "LICENSE_UTILIZATION";
  messages: string[];
}

/**
 * Collapse the flat alert list to one entry per (license, notification type) so
 * a license with three low lines produces one "utilization" row, not three.
 */
export function groupLicenseAlerts(alerts: LicenseAlert[]): PerLicenseAlert[] {
  const byKey = new Map<string, PerLicenseAlert>();
  for (const alert of alerts) {
    const type = licenseAlertNotificationType(alert);
    const key = `${alert.licenseId}:${type}`;
    const existing = byKey.get(key);
    if (existing) existing.messages.push(alert.message);
    else
      byKey.set(key, {
        licenseId: alert.licenseId,
        licenseNumber: alert.licenseNumber,
        type,
        messages: [alert.message],
      });
  }
  return [...byKey.values()];
}

export function licenseAlertMessage(entry: PerLicenseAlert): string {
  if (entry.type === "LICENSE_EXPIRING") return entry.messages[0];
  if (entry.messages.length === 1) return entry.messages[0];
  return `License ${entry.licenseNumber}: ${entry.messages.length} lines near their licensed limit.`;
}

/**
 * Compute the account's current license alerts and raise a bell notification
 * for each affected license. Best-effort; returns the number of licenses that
 * produced a notification this run. Caller establishes the account context.
 */
export async function notifyLicenseAlerts(accountId: string): Promise<{ licenses: number }> {
  const alerts = await computeLicenseAlerts(accountId);
  const grouped = groupLicenseAlerts(alerts);

  let licenses = 0;
  for (const entry of grouped) {
    const created = await notifyAccountRoleHolders({
      accountId,
      permission: "licenses.view",
      type: entry.type,
      message: licenseAlertMessage(entry),
      entityType: "License",
      entityId: entry.licenseId,
      dedupe: true,
    });
    if (created > 0) licenses += 1;
  }
  return { licenses };
}
