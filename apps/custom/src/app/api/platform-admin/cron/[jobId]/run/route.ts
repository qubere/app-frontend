import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

/**
 * Fixed allowlist of cron jobs the platform-admin panel can trigger, mapped
 * to their real route + method. Keeps the client (`CronPanel.tsx`) from
 * needing the CRON_SECRET or being able to hit an arbitrary URL -- it only
 * ever sends a known job id, and this route is the only place the secret is
 * read and attached.
 */
const CRON_JOBS: Record<string, { name: string; endpoint: string; method: "GET" | "POST" }> = {
  "compliance-audit": { name: "Daily Compliance Audit", endpoint: "/api/cron/compliance-audit", method: "GET" },
  "data-dispatcher": { name: "Dataset Refresh & Staleness Dispatcher", endpoint: "/api/cron/data-dispatcher", method: "POST" },
  "fx-rate-refresh": { name: "FX Foreign Exchange Rate Refresh", endpoint: "/api/cron/fx-rate-refresh", method: "POST" },
  "deadline-sweep": { name: "Compliance Deadline Sweep", endpoint: "/api/cron/deadline-sweep", method: "GET" },
  "outbox-dispatch": { name: "Shipment Event Outbox Dispatcher", endpoint: "/api/cron/outbox-dispatch", method: "POST" },
  "document-processing": { name: "Document Processing Pipeline", endpoint: "/api/cron/document-processing", method: "GET" },
  "inbound-email-processing": { name: "Inbound Email Processing Backstop", endpoint: "/api/cron/inbound-email-processing", method: "GET" },
  "origin-re-eval": { name: "Rules of Origin Re-evaluation", endpoint: "/api/cron/origin-re-eval", method: "POST" },
  "work-metric-snapshot": { name: "Daily Work Metric Snapshot", endpoint: "/api/cron/work-metric-snapshot", method: "GET" },
  // Backward compatibility for data datasets
  "regulatory-ingest": { name: "Regulatory Notice Ingestion", endpoint: "/api/cron/regulatory-ingest", method: "POST" },
  "hts-refresh": { name: "HTS Schedule Refresh", endpoint: "/api/cron/hts-refresh", method: "POST" },
};

export const POST = withAuthenticatedRoute<{ jobId: string }>(async ({ ctx, params, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Platform Admin only", requestId } },
      { status: 403 }
    );
  }

  const { jobId } = await params;
  const job = CRON_JOBS[jobId];
  if (!job) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `Unknown cron job "${jobId}"`, requestId } },
      { status: 404 }
    );
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "CRON_SECRET is not configured on the server.", requestId } },
      { status: 500 }
    );
  }

  const datasetLogId = `cron:${jobId}`;
  const now = new Date();

  // Create a RUNNING log row in DatasetRefreshLog if DB is available
  let logRecordId: string | null = null;
  try {
    const log = await db.datasetRefreshLog.create({
      data: {
        datasetId: datasetLogId,
        datasetName: job.name,
        triggeredBy: "MANUAL",
        status: "RUNNING",
        startedAt: now,
      },
    });
    logRecordId = log.id;
  } catch (err) {
    console.error(`[cron/${jobId}/run] Failed to create DatasetRefreshLog entry:`, err);
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}${job.endpoint}`, {
      method: job.method,
      headers: { authorization: `Bearer ${cronSecret}` },
    });

    const data = await res.json().catch(() => ({}));

    if (logRecordId) {
      if (res.ok) {
        const summary = typeof data === "object" ? JSON.stringify(data) : String(data);
        await db.datasetRefreshLog.update({
          where: { id: logRecordId },
          data: {
            status: "SUCCESS",
            summary: summary.slice(0, 500),
            completedAt: new Date(),
          },
        }).catch((err) => console.error("[cron/run] Log update error:", err));
      } else {
        const errorMessage = data.error || data.message || `Endpoint returned HTTP ${res.status}`;
        await db.datasetRefreshLog.update({
          where: { id: logRecordId },
          data: {
            status: "FAILED",
            errorMessage: String(errorMessage).slice(0, 500),
            completedAt: new Date(),
          },
        }).catch((err) => console.error("[cron/run] Log update error:", err));
      }
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    const errorMsg = err.message || "Failed to trigger execution";
    if (logRecordId) {
      await db.datasetRefreshLog.update({
        where: { id: logRecordId },
        data: {
          status: "FAILED",
          errorMessage: errorMsg.slice(0, 500),
          completedAt: new Date(),
        },
      }).catch((e) => console.error("[cron/run] Log error catch:", e));
    }
    return NextResponse.json(
      { error: { code: "EXECUTION_ERROR", message: errorMsg, requestId } },
      { status: 500 }
    );
  }
});
