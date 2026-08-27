import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

export interface SystemCronJob {
  id: string;
  name: string;
  endpoint: string;
  method: "GET" | "POST";
  schedule: string;
  description: string;
  lastRun: string | null;
  status: "idle" | "running" | "success" | "error";
  details?: string | null;
}

export const SYSTEM_CRON_JOBS: Omit<SystemCronJob, "lastRun" | "status" | "details">[] = [
  {
    id: "compliance-audit",
    name: "Daily Compliance Audit",
    endpoint: "/api/cron/compliance-audit",
    method: "GET",
    schedule: "0 1 * * * (Daily at 01:00 UTC)",
    description: "Sweeps compliance deadlines, generates audit findings, and notifies account owners of upcoming or overdue filings.",
  },
  {
    id: "data-dispatcher",
    name: "Dataset Refresh & Staleness Dispatcher",
    endpoint: "/api/cron/data-dispatcher",
    method: "POST",
    schedule: "0 2 * * * (Daily at 02:00 UTC)",
    description: "Master fan-out cron checking dataset freshness, triggering due ingesting pipelines, and alerting on stale datasets.",
  },
  {
    id: "fx-rate-refresh",
    name: "FX Foreign Exchange Rate Refresh",
    endpoint: "/api/cron/fx-rate-refresh",
    method: "POST",
    schedule: "0 3 * * * (Daily at 03:00 UTC)",
    description: "Fetches latest ECB / Federal Reserve foreign currency exchange rates for landed cost multi-currency conversion.",
  },
  {
    id: "deadline-sweep",
    name: "Compliance Deadline Sweep",
    endpoint: "/api/cron/deadline-sweep",
    method: "GET",
    schedule: "*/15 * * * * (Every 15 minutes)",
    description: "High-frequency sweep checking impending customs entry and ISF filing deadlines.",
  },
  {
    id: "outbox-dispatch",
    name: "Shipment Event Outbox Dispatcher",
    endpoint: "/api/cron/outbox-dispatch",
    method: "POST",
    schedule: "*/5 * * * * (Every 5 minutes)",
    description: "Dispatches queued shipment outbox domain events to external webhooks and downstream event consumers.",
  },
  {
    id: "document-processing",
    name: "Document Processing Pipeline",
    endpoint: "/api/cron/document-processing",
    method: "GET",
    schedule: "0 9 * * * (Daily at 09:00 UTC / Backstop)",
    description: "Backstop worker advancing unparsed customs documents through OCR, entity extraction, and classification.",
  },
  {
    id: "inbound-email-processing",
    name: "Inbound Email Processing Backstop",
    endpoint: "/api/cron/inbound-email-processing",
    method: "GET",
    schedule: "Daily Backstop Tick (On-demand / 1h)",
    description: "Retries and processes queued inbound email attachments stuck in routing pipeline.",
  },
  {
    id: "origin-re-eval",
    name: "Rules of Origin Re-evaluation",
    endpoint: "/api/cron/origin-re-eval",
    method: "POST",
    schedule: "Daily (24h product sweep)",
    description: "Re-evaluates FTA tariff shift and RVC origin determinations for products updated within the last 24 hours.",
  },
  {
    id: "compliance-notification-dispatch",
    name: "Compliance Notification Dispatcher",
    endpoint: "/api/cron/compliance-notification-dispatch",
    method: "POST",
    schedule: "*/2 * * * * (Every 2 minutes)",
    description: "Sends queued Restricted Party Screening email notifications (RPS hits, review-required, PAL/Party re-screen exceptions) with retry backoff.",
  },
  {
    id: "community-screening-dispatch",
    name: "Community Screening Dispatcher",
    endpoint: "/api/cron/community-screening-dispatch",
    method: "POST",
    schedule: "*/1 * * * * (Every 1 minute)",
    description: "Processes queued async Community Screening runs -- claims pending party rows in bounded batches and evaluates each against Restricted Party and Embargo screening.",
  },
  {
    id: "rdps-delta-impact-dispatch",
    name: "RDPS Delta-Impact Dispatcher",
    endpoint: "/api/cron/rdps-delta-impact-dispatch",
    method: "POST",
    schedule: "*/5 * * * * (Every 5 minutes)",
    description: "Continuous Party Monitoring: claims pending reference-data change sets, rescreens impacted Parties, and raises exceptions on worsening screening transitions.",
  },
  {
    id: "rdps-full-population-dispatch",
    name: "RDPS Full-Population Dispatcher",
    endpoint: "/api/cron/rdps-full-population-dispatch",
    method: "POST",
    schedule: "*/1 * * * * (Every 1 minute)",
    description: "Continuous Party Monitoring: advances a manually/scheduled-triggered full-population baseline sweep in bounded batches, then runs an exhaustive recall validation once the sweep completes.",
  },
  {
    id: "rdps-recall-validation",
    name: "RDPS Recall Validation (Daily)",
    endpoint: "/api/cron/rdps-recall-validation",
    method: "POST",
    schedule: "0 4 * * * (Daily at 04:00 UTC)",
    description: "Continuous Party Monitoring release-safety net: replays a bounded sample of Parties through the forward matcher to confirm the reverse impact index never under-selects candidates.",
  },
  {
    id: "work-metric-snapshot",
    name: "Daily Work Metric Snapshot",
    endpoint: "/api/cron/work-metric-snapshot",
    method: "GET",
    schedule: "0 0 * * * (Daily at 00:00 UTC)",
    description: "Snapshots daily work volume metrics, processed shipments, and broker queue productivity across tenants.",
  },
];

export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Platform Admin only", requestId } },
      { status: 403 }
    );
  }

  const datasetIdsToQuery = SYSTEM_CRON_JOBS.flatMap((j) => [`cron:${j.id}`, j.id]);

  const logsMap = new Map<string, { completedAt: Date | null; startedAt: Date; status: string; errorMessage: string | null; summary: string | null }>();

  try {
    const logs = await db.datasetRefreshLog.findMany({
      where: {
        datasetId: { in: datasetIdsToQuery },
      },
      orderBy: { startedAt: "desc" },
      distinct: ["datasetId"],
    });

    for (const log of logs) {
      logsMap.set(log.datasetId, log);
    }
  } catch (err) {
    console.error("[api/platform-admin/cron GET] Error fetching refresh logs:", err);
  }

  const jobs: SystemCronJob[] = SYSTEM_CRON_JOBS.map((job) => {
    const log = logsMap.get(`cron:${job.id}`) || logsMap.get(job.id);
    if (!log) {
      return {
        ...job,
        lastRun: null,
        status: "idle",
        details: null,
      };
    }

    let mappedStatus: "idle" | "running" | "success" | "error" = "idle";
    if (log.status === "RUNNING") mappedStatus = "running";
    else if (log.status === "SUCCESS") mappedStatus = "success";
    else if (log.status === "FAILED") mappedStatus = "error";

    return {
      ...job,
      lastRun: (log.completedAt ?? log.startedAt).toISOString(),
      status: mappedStatus,
      details: log.errorMessage ?? log.summary ?? null,
    };
  });

  return NextResponse.json({ jobs, requestId });
});
