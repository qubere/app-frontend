// Single source of truth for every recurring backend job: what the admin
// dashboard displays (via cronData.ts) AND what
// infrastructure/gcp/configure-scheduler.sh provisions in Cloud Scheduler
// (via infrastructure/gcp/generate-configure-scheduler.mjs). Add a job here
// once and both consumers pick it up — that is the fix for the cron gap that
// kept recurring because the two were maintained by hand in parallel.
//
// This file must stay free of "@/..." and other Next.js-only imports: the
// generator script loads it directly with `tsx` outside of the Next.js
// runtime.

export type HttpCronTrigger = {
  kind: "http";
  path: string;
  method: "GET" | "POST";
};

export type CloudRunJobCronTrigger = {
  kind: "cloud-run-job";
  /** Env var configure-scheduler.sh reads for the underlying Cloud Run Job name. */
  jobNameEnvVar: string;
  /** Default Cloud Run Job name when jobNameEnvVar is unset. */
  defaultJobName: string;
  /** Name of the Cloud Scheduler job itself (distinct from the Cloud Run Job it triggers). */
  schedulerJobName: string;
};

export interface CronJobDefinition {
  id: string;
  /** Cloud Scheduler job name for "http" triggers. Ignored for "cloud-run-job" triggers. */
  schedulerName: string;
  name: string;
  description: string;
  cronExpression: string;
  scheduleLabel: string;
  trigger: HttpCronTrigger | CloudRunJobCronTrigger;
}

export const CRON_JOB_DEFINITIONS: CronJobDefinition[] = [
  {
    id: "data-dispatcher",
    schedulerName: "qubere-data-dispatcher",
    name: "Dataset Refresh & Staleness Dispatcher",
    description: "Master fan-out cron checking dataset freshness, triggering due ingesting pipelines, and alerting on stale datasets.",
    cronExpression: "0 2 * * *",
    scheduleLabel: "Daily at 02:00 UTC",
    trigger: { kind: "http", path: "/api/cron/data-dispatcher", method: "GET" },
  },
  {
    id: "document-processing",
    schedulerName: "qubere-document-processing-backstop",
    name: "Document Processing Pipeline",
    description: "Backstop worker advancing unparsed customs documents through OCR, entity extraction, and classification.",
    cronExpression: "*/5 * * * *",
    scheduleLabel: "Every 5 minutes / Backstop",
    trigger: {
      kind: "cloud-run-job",
      jobNameEnvVar: "DOCUMENT_PROCESSING_JOB",
      defaultJobName: "qubere-document-worker-demo",
      schedulerJobName: "qubere-document-processing-backstop",
    },
  },
  {
    id: "bis-csl-ingest",
    schedulerName: "qubere-bis-csl-ingest",
    name: "BIS Consolidated Screening List Ingestion",
    description: "Ingests the BIS Consolidated Screening List dataset used by Restricted Party Screening.",
    cronExpression: "0 4 * * *",
    scheduleLabel: "Daily at 04:00 UTC",
    trigger: { kind: "http", path: "/api/cron/bis-csl-ingest", method: "GET" },
  },
  {
    id: "fx-rate-refresh",
    schedulerName: "qubere-fx-rate-refresh",
    name: "FX Foreign Exchange Rate Refresh",
    description: "Fetches latest ECB / Federal Reserve foreign currency exchange rates for landed cost multi-currency conversion.",
    cronExpression: "0 3 * * *",
    scheduleLabel: "Daily at 03:00 UTC",
    trigger: { kind: "http", path: "/api/cron/fx-rate-refresh", method: "GET" },
  },
  {
    id: "uflpa-ingest",
    schedulerName: "qubere-uflpa-ingest",
    name: "UFLPA Entity List Ingestion",
    description: "Ingests the DHS UFLPA Entity List dataset used by Restricted Party Screening.",
    cronExpression: "0 6 * * *",
    scheduleLabel: "Daily at 06:00 UTC",
    trigger: { kind: "http", path: "/api/cron/uflpa-entity-list-ingest", method: "GET" },
  },
  {
    id: "cbp-cross-ingest",
    schedulerName: "qubere-cbp-cross-ingest",
    name: "CBP CROSS Rulings Ingestion",
    description: "Ingests CBP CROSS tariff classification rulings for the regulatory reference library.",
    cronExpression: "0 5 * * *",
    scheduleLabel: "Daily at 05:00 UTC",
    trigger: { kind: "http", path: "/api/cron/cbp-cross-rulings-ingest", method: "POST" },
  },
  {
    id: "outbox-dispatch",
    schedulerName: "qubere-outbox-dispatch",
    name: "Shipment Event Outbox Dispatcher",
    description: "Dispatches queued shipment outbox domain events to external webhooks and downstream event consumers.",
    cronExpression: "*/5 * * * *",
    scheduleLabel: "Every 5 minutes",
    trigger: { kind: "http", path: "/api/cron/outbox-dispatch", method: "GET" },
  },
  {
    id: "compliance-notification-dispatch",
    schedulerName: "qubere-compliance-notification-dispatch",
    name: "Compliance Notification Dispatcher",
    description: "Processes queued compliance alerts and dispatches emails via configured EmailProvider.",
    cronExpression: "*/2 * * * *",
    scheduleLabel: "Every 2 minutes",
    trigger: { kind: "http", path: "/api/cron/compliance-notification-dispatch", method: "GET" },
  },
  {
    id: "compliance-audit",
    schedulerName: "qubere-compliance-audit",
    name: "Daily Compliance Audit",
    description: "Sweeps compliance deadlines, generates audit findings, and notifies account owners of upcoming or overdue filings.",
    cronExpression: "0 1 * * *",
    scheduleLabel: "Daily at 01:00 UTC",
    trigger: { kind: "http", path: "/api/cron/compliance-audit", method: "GET" },
  },
  {
    id: "deadline-sweep",
    schedulerName: "qubere-deadline-sweep",
    name: "Compliance Deadline Sweep",
    description: "High-frequency sweep checking impending customs entry and ISF filing deadlines.",
    cronExpression: "*/15 * * * *",
    scheduleLabel: "Every 15 minutes",
    trigger: { kind: "http", path: "/api/cron/deadline-sweep", method: "GET" },
  },
  {
    id: "sla-sweep",
    schedulerName: "qubere-sla-sweep",
    name: "SLA Breach & Escalation Sweep",
    description: "Marks SLA breaches on open decisions/exceptions, evaluates active escalation rules, and fires notifications.",
    cronExpression: "*/15 * * * *",
    scheduleLabel: "Every 15 minutes",
    trigger: { kind: "http", path: "/api/cron/sla-sweep", method: "GET" },
  },
  {
    id: "regulatory-ingest",
    schedulerName: "qubere-regulatory-ingest",
    name: "Federal Register Ingestion",
    description: "Ingests CBP notices from the Federal Register, extracts affected HTS codes, and creates RegulatoryUpdate records.",
    cronExpression: "0 4 * * *",
    scheduleLabel: "Daily at 04:00 UTC",
    trigger: { kind: "http", path: "/api/cron/regulatory-ingest", method: "POST" },
  },
  {
    id: "rdps-recall-validation",
    schedulerName: "qubere-rdps-recall-validation",
    name: "RDPS Recall & Rescreening Sweeper",
    description: "Executes continuous party rescreening for RDPS and records outcome changes.",
    cronExpression: "0 5 * * *",
    scheduleLabel: "Daily at 05:00 UTC",
    trigger: { kind: "http", path: "/api/cron/rdps-recall-validation", method: "GET" },
  },
  {
    id: "origin-re-eval",
    schedulerName: "qubere-origin-re-eval",
    name: "Origin Re-evaluation Sweeper",
    description: "Re-evaluates country of origin determinations for line items affected by recent product country fact updates.",
    cronExpression: "0 6 * * *",
    scheduleLabel: "Daily at 06:00 UTC",
    trigger: { kind: "http", path: "/api/cron/origin-re-eval", method: "GET" },
  },
  {
    id: "rdps-delta-impact-dispatch",
    schedulerName: "qubere-rdps-delta-impact-dispatch",
    name: "RDPS Delta-Impact Dispatcher",
    description: "Reacts to denied-party reference-data changes by re-screening only the parties a given change could plausibly affect.",
    cronExpression: "*/10 * * * *",
    scheduleLabel: "Every 10 minutes",
    trigger: { kind: "http", path: "/api/cron/rdps-delta-impact-dispatch", method: "GET" },
  },
  {
    id: "rdps-full-population-dispatch",
    schedulerName: "qubere-rdps-full-population-dispatch",
    name: "RDPS Full-Population Dispatcher",
    description: "Proactively walks the account's entire screened-party population as a periodic safety net, independent of reference-data changes.",
    cronExpression: "0 * * * *",
    scheduleLabel: "Hourly",
    trigger: { kind: "http", path: "/api/cron/rdps-full-population-dispatch", method: "GET" },
  },
  {
    id: "reference-data-expiry-sweep",
    schedulerName: "qubere-reference-data-expiry-sweep",
    name: "Reference Data Expiry Sweep",
    description: "Supersedes published reference-data entities whose own expirationDate has passed and records an EXPIRED change so RDPS re-screens affected parties.",
    cronExpression: "0 * * * *",
    scheduleLabel: "Hourly",
    trigger: { kind: "http", path: "/api/cron/reference-data-expiry-sweep", method: "GET" },
  },
  {
    id: "community-screening-dispatch",
    schedulerName: "qubere-community-screening-dispatch",
    name: "Community Screening Dispatcher",
    description: "Processes queued Community Screening runs claimed row-by-row, mirroring the compliance-notification dispatch pattern.",
    cronExpression: "*/2 * * * *",
    scheduleLabel: "Every 2 minutes",
    trigger: { kind: "http", path: "/api/cron/community-screening-dispatch", method: "GET" },
  },
  {
    id: "compliance-batch-dispatch",
    schedulerName: "qubere-compliance-batch-dispatch",
    name: "Bulk Compliance Screening Dispatcher",
    description: "Processes queued Bulk Compliance Screening batch records claimed row-by-row through Party/License screening.",
    cronExpression: "*/2 * * * *",
    scheduleLabel: "Every 2 minutes",
    trigger: { kind: "http", path: "/api/cron/compliance-batch-dispatch", method: "GET" },
  },
  {
    id: "compliance-batch-retention-sweep",
    schedulerName: "qubere-compliance-batch-retention-sweep",
    name: "Bulk Compliance Screening Retention Sweep",
    description: "Marks terminal Bulk Compliance Screening batches older than the retention window as EXPIRED (status flag only, never deletes data).",
    cronExpression: "0 4 * * *",
    scheduleLabel: "Daily at 04:00 UTC",
    trigger: { kind: "http", path: "/api/cron/compliance-batch-retention-sweep", method: "GET" },
  },
  {
    id: "db-backup",
    schedulerName: "qubere-db-backup-schedule",
    name: "Automated Database Backup Job",
    description: "Executes automated Cloud Run DB backup job exporting PostgreSQL pg_dump dumps to GCP Cloud Storage.",
    cronExpression: "0 */6 * * *",
    scheduleLabel: "Every 6 hours",
    trigger: {
      kind: "cloud-run-job",
      jobNameEnvVar: "BACKUP_JOB",
      defaultJobName: "qubere-db-backup-demo",
      schedulerJobName: "qubere-db-backup-schedule",
    },
  },
];
