/**
 * Scheduled cron job: computes and emails License Management alerts
 * (expiring licenses + utilization thresholds) for every account with
 * AccountLicenseConfig.licenseManagementEnabled and configured recipients.
 * Cross-tenant fan-out query, per-account delivery wrapped in that
 * account's own tenant context.
 */
import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/api/auth-guards";
import { db, runWithAccountId } from "@/lib/db";
import { deliverLicenseAlerts } from "@/modules/licenses/alertsService";

export const maxDuration = 60;

async function handleAlerts() {
  const configs = await db.accountLicenseConfig.findMany({
    where: { licenseManagementEnabled: true },
    select: { accountId: true },
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const config of configs) {
    await runWithAccountId(config.accountId, async () => {
      try {
        const result = await deliverLicenseAlerts(config.accountId);
        if (result.sent) sent += 1;
        else skipped += 1;
      } catch {
        errors += 1;
      }
    });
  }

  return { sent, skipped, errors, scanned: configs.length };
}

export const GET = withCronRoute(async ({ requestId }) => {
  const result = await handleAlerts();
  return NextResponse.json({ status: "SUCCESS", requestId, ...result });
});

export const POST = withCronRoute(async ({ requestId }) => {
  const result = await handleAlerts();
  return NextResponse.json({ status: "SUCCESS", requestId, ...result });
});
