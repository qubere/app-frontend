import { db } from "@/lib/db";
import { createSignedReadUrl } from "@/lib/storage";
import { PlatformEmailService } from "@/lib/email/platformEmailService";
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
    const result = await PlatformEmailService.sendEmail({
      to: recipients,
      subject: `Scheduled Report Ready: ${reportName}`,
      html: `
        <div style="font-family:sans-serif;max-width:580px;margin:0 auto;padding:24px;background:#ffffff;border-radius:16px;border:1px solid #e5e5ea">
          <h2 style="color:#0071e3;margin-top:0">Scheduled Report Ready: ${reportName}</h2>
          <p>Your scheduled compliance report <strong>${reportName}</strong> has been generated successfully.</p>
          <div style="background:#f4f4f8;padding:16px;border-radius:10px;margin:16px 0">
            <h4 style="margin:0 0 8px">Generated Report Artifacts:</h4>
            <ul>${linksHtml}</ul>
          </div>
          <p style="font-size:12px;color:#86868b">Download links expire in 7 days. Sent by Qubere Platform.</p>
        </div>
      `,
      text: `Your scheduled report "${reportName}" has been generated:\n${links.map((l) => `${l.fileName}: ${l.url}`).join("\n")}\n\nLinks expire in 7 days.`,
      fromName: "Qubere Compliance Reports",
    });

    await db.reportRun.update({
      where: { id: runId },
      data:
        result.success
          ? { deliveryStatus: "DELIVERED" }
          : { deliveryStatus: "FAILED", errorMessage: result.error },
    });
  } catch (err) {
    await db.reportRun.update({
      where: { id: runId },
      data: { deliveryStatus: "FAILED", errorMessage: err instanceof Error ? err.message : "Report delivery failed." },
    });
  }
}
