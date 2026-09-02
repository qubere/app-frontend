import { db } from "@/lib/db";
import { CRON_JOB_DEFINITIONS } from "./cronJobs.data";

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

// Derived from CRON_JOB_DEFINITIONS (cronJobs.data.ts) so this dashboard
// listing and infrastructure/gcp/configure-scheduler.sh can never drift back
// apart the way they previously did.
export const SYSTEM_CRON_JOBS: Omit<SystemCronJob, "lastRun" | "status" | "details">[] = CRON_JOB_DEFINITIONS.map(
  (job) => ({
    id: job.id,
    name: job.name,
    description: job.description,
    schedule: `${job.cronExpression} (${job.scheduleLabel})`,
    ...(job.trigger.kind === "http"
      ? { endpoint: job.trigger.path, method: job.trigger.method }
      : { endpoint: `gcloud run jobs execute ${job.trigger.defaultJobName}`, method: "POST" as const }),
  }),
);

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
