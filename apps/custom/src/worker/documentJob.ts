import { randomUUID } from "node:crypto";
import {
  acquireDocumentWorkerLease,
  releaseDocumentWorkerLease,
  renewDocumentWorkerLease,
} from "@qubere/db";
import { runInboundEmailWorkerTick } from "../modules/documents/processing/inboundEmailWorker";
import { runWorkerTick } from "../modules/documents/processing/documentProcessingWorker";
import { countUnfinishedRuns } from "../modules/documents/processing/processingRuns";

const LEASE = "customs-document-worker";
const LEASE_TTL_MS = 5 * 60_000;
const BUDGET_MS = Number(process.env.DOCUMENT_JOB_BUDGET_MS || 13 * 60_000);

export async function runCustomsDocumentJob(): Promise<void> {
  const owner = randomUUID();
  if (!(await acquireDocumentWorkerLease(LEASE, owner, LEASE_TTL_MS))) {
    console.log("[CustomsDocumentJob] another execution owns the lease; exiting");
    return;
  }
  const renewal = setInterval(() => void renewDocumentWorkerLease(LEASE, owner, LEASE_TTL_MS), 60_000);
  renewal.unref();
  const deadline = Date.now() + BUDGET_MS;
  try {
    while (Date.now() < deadline) {
      const inbound = await runInboundEmailWorkerTick();
      const tick = await runWorkerTick();
      if (tick.blocker) {
        console.error("[CustomsDocumentJob] blocked", tick.blocker);
        return;
      }
      const didWork = inbound.claimed > 0 || tick.submitted > 0 || tick.polled > 0 ||
        tick.reclaimed.requeued > 0 || tick.reclaimed.resumedPolling > 0 || tick.pollTimeouts > 0;
      if ((await countUnfinishedRuns()) === 0) return;
      if (!didWork) await sleep(Math.min(5_000, deadline - Date.now()));
    }
  } finally {
    clearInterval(renewal);
    await releaseDocumentWorkerLease(LEASE, owner);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

runCustomsDocumentJob().catch((error) => {
  console.error("[CustomsDocumentJob] fatal", error);
  process.exit(1);
});
