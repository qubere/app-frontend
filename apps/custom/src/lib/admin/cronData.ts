import { db } from "@/lib/db";
import { SYSTEM_CRON_JOBS, type SystemCronJob } from "@/app/api/platform-admin/cron/route";

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
