// License alerts (prompt sections 47-48): expiring licenses and
// utilization-threshold breaches (remaining capacity low, or committed but
// unshipped balance high). Computed on demand for the alerts API and
// re-used by the scheduled Inngest job for email delivery.
import { db } from "@/lib/db";
import { Decimal } from "@/lib/tariff/decimal";
import { getEmailProvider } from "@/modules/email/emailProviderFactory";
import { getEmailConfig, EmailConfigError } from "@/modules/email/emailConfig";

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
    recipients: ((config?.licenseAlertRecipients as string[] | null) ?? []).filter(
      (r): r is string => typeof r === "string" && r.includes("@")
    ),
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

/** Best-effort email delivery of an account's current alert list. Never throws. */
export async function deliverLicenseAlerts(accountId: string): Promise<{ sent: boolean; alertCount: number }> {
  const config = await loadConfig(accountId);
  const alerts = await computeLicenseAlerts(accountId);
  if (alerts.length === 0 || config.recipients.length === 0) {
    return { sent: false, alertCount: alerts.length };
  }

  try {
    getEmailConfig();
  } catch (err) {
    if (err instanceof EmailConfigError) return { sent: false, alertCount: alerts.length };
    throw err;
  }

  const listHtml = alerts.map((a) => `<li>[${a.type}] ${a.message}</li>`).join("");
  const listText = alerts.map((a) => `[${a.type}] ${a.message}`).join("\n");

  const result = await getEmailProvider().send({
    to: config.recipients,
    subject: `License Management alerts (${alerts.length})`,
    html: `<p>The following license alerts require attention:</p><ul>${listHtml}</ul>`,
    text: `The following license alerts require attention:\n${listText}`,
  });

  return { sent: result.outcome === "SUCCESS", alertCount: alerts.length };
}
