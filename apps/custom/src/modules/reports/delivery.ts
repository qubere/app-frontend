import { db } from "@/lib/db";
import { createSignedReadUrl } from "@/lib/storage";
import { getEmailProvider } from "@/modules/email/emailProviderFactory";
import { getEmailConfig, EmailConfigError } from "@/modules/email/emailConfig";
import { getCatalogEntry } from "./catalog";

interface ScheduleDeliveryConfig {
  recipients?: string[];
}

/**
 * Emails a completed report run's artifacts to its schedule's configured
 * recipients. A no-op (leaves deliveryStatus at its default NOT_REQUESTED)
 * for manually-run reports or schedules with no recipients configured.
 */
export async function deliverReportRun(runId: string): Promise<void> {
  const run = await db.reportRun.findUnique({
    where: { id: runId },
    include: { artifacts: true, schedule: true },
  });
  if (!run || run.generationStatus !== "COMPLETED" || !run.schedule) return;

  const deliveryConfig = (run.schedule.deliveryConfig as ScheduleDeliveryConfig | null) ?? null;
  const recipients = (deliveryConfig?.recipients ?? []).filter((r): r is string => typeof r === "string" && r.includes("@"));
  if (recipients.length === 0 || run.artifacts.length === 0) return;

  await db.reportRun.update({ where: { id: runId }, data: { deliveryStatus: "PENDING" } });

  try {
    getEmailConfig();
  } catch (err) {
    if (err instanceof EmailConfigError) {
      await db.reportRun.update({
        where: { id: runId },
        data: { deliveryStatus: "FAILED", errorMessage: "Email delivery is not configured for this environment." },
      });
      return;
    }
    throw err;
  }

  const catalogEntry = getCatalogEntry(run.reportType);
  const reportName = catalogEntry?.name ?? run.reportType;

  try {
    const links = await Promise.all(
      run.artifacts.map(async (artifact) => ({
        fileName: artifact.fileName,
        url: await createSignedReadUrl(artifact.storageKey, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      }))
    );

    const linksHtml = links.map((l) => `<li><a href="${l.url}">${l.fileName}</a></li>`).join("");
    const result = await getEmailProvider().send({
      to: recipients,
      subject: `Scheduled report ready: ${reportName}`,
      html: `<p>Your scheduled report <strong>${reportName}</strong> has been generated.</p><ul>${linksHtml}</ul><p>Links expire in 7 days.</p>`,
      text: `Your scheduled report "${reportName}" has been generated:\n${links.map((l) => `${l.fileName}: ${l.url}`).join("\n")}\n\nLinks expire in 7 days.`,
    });

    await db.reportRun.update({
      where: { id: runId },
      data:
        result.outcome === "SUCCESS"
          ? { deliveryStatus: "DELIVERED" }
          : { deliveryStatus: "FAILED", errorMessage: result.errorMessage },
    });
  } catch (err) {
    await db.reportRun.update({
      where: { id: runId },
      data: { deliveryStatus: "FAILED", errorMessage: err instanceof Error ? err.message : "Report delivery failed." },
    });
  }
}
