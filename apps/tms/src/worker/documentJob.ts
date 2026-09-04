import { randomUUID } from "node:crypto";
import {
  acquireDocumentWorkerLease,
  db,
  releaseDocumentWorkerLease,
  renewDocumentWorkerLease,
} from "@qubere/db";
import { executeTmsPipelineJob, TMS_WORKFLOW_TYPE } from "../lib/tmsPipelineEngine";

const LEASE = "tms-document-worker";
const LEASE_TTL_MS = 5 * 60_000;
const BUDGET_MS = Number(process.env.DOCUMENT_JOB_BUDGET_MS || 13 * 60_000);

export async function runTmsDocumentJob(): Promise<void> {
  const owner = randomUUID();
  if (!(await acquireDocumentWorkerLease(LEASE, owner, LEASE_TTL_MS))) {
    console.log("[TmsDocumentJob] another execution owns the lease; exiting");
    return;
  }
  const renewal = setInterval(() => void renewDocumentWorkerLease(LEASE, owner, LEASE_TTL_MS), 60_000);
  renewal.unref();
  const deadline = Date.now() + BUDGET_MS;
  try {
    while (Date.now() < deadline) {
      const now = new Date();
      const jobs = await db.pipelineJob.findMany({
        where: {
          workflowType: TMS_WORKFLOW_TYPE,
          attemptCount: { lt: 3 },
          OR: [
            { status: "PENDING" },
            { status: "FAILED", nextRetryAt: { lte: now } },
            { status: "PROCESSING", heartbeatAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
          ],
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 10,
        select: { id: true },
      });
      if (jobs.length) {
        for (const job of jobs) {
          try { await executeTmsPipelineJob(job.id); }
          catch (error) { console.error("[TmsDocumentJob] job failed", { jobId: job.id, error }); }
        }
        continue;
      }
      const retry = await db.pipelineJob.findFirst({
        where: { workflowType: TMS_WORKFLOW_TYPE, status: "FAILED", attemptCount: { lt: 3 }, nextRetryAt: { gt: now } },
        orderBy: { nextRetryAt: "asc" }, select: { nextRetryAt: true },
      });
      if (!retry?.nextRetryAt || retry.nextRetryAt.getTime() >= deadline) return;
      await sleep(Math.min(5_000, retry.nextRetryAt.getTime() - Date.now()));
    }
  } finally {
    clearInterval(renewal);
    await releaseDocumentWorkerLease(LEASE, owner);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

runTmsDocumentJob().catch((error) => {
  console.error("[TmsDocumentJob] fatal", error);
  process.exit(1);
});
