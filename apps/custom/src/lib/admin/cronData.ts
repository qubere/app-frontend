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
    id: "regulatory-ingest",
    name: "Federal Register Ingestion",
    endpoint: "/api/cron/regulatory-ingest",
    method: "POST",
    schedule: "0 4 * * * (Daily at 04:00 UTC)",
    description: "Ingests CBP notices from the Federal Register, extracts affected HTS codes, and creates RegulatoryUpdate records.",
  },
  {
    id: "compliance-notification-dispatch",
    name: "Compliance Notification Dispatcher",
    endpoint: "/api/cron/compliance-notification-dispatch",
    method: "POST",
    schedule: "*/10 * * * * (Every 10 minutes)",
    description: "Processes queued compliance alerts and dispatches emails via configured EmailProvider.",
  },
  {
    id: "rdps-recall-validation",
    name: "RDPS Recall & Rescreening Sweeper",
    endpoint: "/api/cron/rdps-recall-validation",
    method: "POST",
    schedule: "0 5 * * * (Daily at 05:00 UTC)",
    description: "Executes continuous party rescreening for RDPS and records outcome changes.",
  },
  {
    id: "origin-re-eval",
    name: "Origin Re-evaluation Sweeper",
    endpoint: "/api/cron/origin-re-eval",
    method: "POST",
    schedule: "0 6 * * * (Daily at 06:00 UTC)",
    description: "Re-evaluates country of origin determinations for line items affected by recent product country fact updates.",
  },
];

export async function getSystemCronJobs(): Promise<SystemCronJob[]> {
  const datasetIdsToQuery = SYSTEM_CRON_JOBS.flatMap((j) => [`cron:${j.id}`, j.id]);

  const logsMap = new Map<
    string,
    { completedAt: Date | null; startedAt: Date; status: string; errorMessage: string | null; summary: string | null }
  >();

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
    console.error("[getSystemCronJobs] Error fetching dataset refresh logs:", err);
  }

  return SYSTEM_CRON_JOBS.map((job) => {
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
}
