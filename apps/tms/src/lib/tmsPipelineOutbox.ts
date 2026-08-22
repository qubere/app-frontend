import { after } from "next/server";
import { db } from "@qubere/db";
import {
  executeTmsPipelineJob,
  TMS_PIPELINE_OUTBOX_EVENT,
  TMS_WORKFLOW_TYPE,
} from "./tmsPipelineEngine";
import { queueTmsPipelineJob } from "./inngest/tmsPipelineEvents";

const OUTBOX_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const RECOVERY_BATCH_SIZE = 25;

export type TmsDispatchMode =
  | "INNGEST"
  | "NEXT_AFTER"
  | "LOCAL_DIRECT"
  | "ALREADY_DISPATCHED"
  | "OUTBOX_PENDING"
  | "BUSY";

function retryAt(attempt: number): Date {
  return new Date(Date.now() + Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1)));
}

export async function dispatchTmsPipelineOutboxEvent(jobId: string): Promise<TmsDispatchMode> {
  const event = await db.workflowOutboxEvent.findFirst({
    where: {
      eventType: TMS_PIPELINE_OUTBOX_EVENT,
      aggregateType: "PipelineJob",
      aggregateId: jobId,
    },
  });
  if (!event) throw new Error(`No transactional outbox event exists for TMS pipeline ${jobId}.`);
  if (event.status === "DISPATCHED") return "ALREADY_DISPATCHED";
  if (event.attemptCount >= event.maxAttempts) return "OUTBOX_PENDING";

  const now = new Date();
  const staleLock = new Date(now.getTime() - OUTBOX_LOCK_TIMEOUT_MS);
  const claimed = await db.workflowOutboxEvent.updateMany({
    where: {
      id: event.id,
      attemptCount: { lt: event.maxAttempts },
      OR: [
        { status: "PENDING", nextAttemptAt: { lte: now } },
        { status: "FAILED", nextAttemptAt: { lte: now } },
        { status: "DISPATCHING", lockedAt: { lt: staleLock } },
      ],
    },
    data: {
      status: "DISPATCHING",
      lockedAt: now,
      lastError: null,
      attemptCount: { increment: 1 },
    },
  });
  if (claimed.count !== 1) return "BUSY";

  try {
    let mode: TmsDispatchMode;
    if (process.env.INNGEST_EVENT_KEY) {
      await queueTmsPipelineJob(jobId);
      mode = "INNGEST";
    } else {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Durable TMS dispatch is not configured. Set INNGEST_EVENT_KEY in production.");
      }
      await executeTmsPipelineJob(jobId);
      mode = "LOCAL_DIRECT";
    }
    await db.workflowOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: "DISPATCHED",
        dispatchedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
    return mode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attempt = event.attemptCount + 1;
    await db.workflowOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        lockedAt: null,
        lastError: message.slice(0, 2000),
        nextAttemptAt: retryAt(attempt),
      },
    });
    console.error(`[TMS outbox] Dispatch failed for ${jobId}`, error);
    return "OUTBOX_PENDING";
  }
}

export async function scheduleTmsPipelineDispatch(jobId: string): Promise<TmsDispatchMode> {
  if (process.env.INNGEST_EVENT_KEY) return dispatchTmsPipelineOutboxEvent(jobId);
  if (process.env.NODE_ENV === "production") return dispatchTmsPipelineOutboxEvent(jobId);
  after(async () => {
    await dispatchTmsPipelineOutboxEvent(jobId);
  });
  return "NEXT_AFTER";
}

/**
 * Recovers the exact gaps a transactional outbox is meant to cover: a job
 * committed without successful publication, a delivered event that never
 * claimed its job, a stale worker heartbeat, or a retry whose backoff elapsed.
 */
export async function recoverTmsPipelineDispatches(): Promise<{
  inspected: number;
  redispatched: number;
}> {
  const now = new Date();
  const pendingCutoff = new Date(now.getTime() - 2 * 60 * 1000);
  const heartbeatCutoff = new Date(now.getTime() - 5 * 60 * 1000);
  const jobs = await db.pipelineJob.findMany({
    where: {
      workflowType: TMS_WORKFLOW_TYPE,
      attemptCount: { lt: 3 },
      OR: [
        { status: "PENDING", createdAt: { lt: pendingCutoff } },
        { status: "PROCESSING", heartbeatAt: { lt: heartbeatCutoff } },
        { status: "FAILED", nextRetryAt: { lte: now } },
      ],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: RECOVERY_BATCH_SIZE,
  });

  let redispatched = 0;
  for (const job of jobs) {
    const eventKey = `${TMS_PIPELINE_OUTBOX_EVENT}:${job.id}`;
    const event = await db.workflowOutboxEvent.upsert({
      where: { eventKey },
      update: {},
      create: {
        accountId: job.accountId,
        eventKey,
        eventType: TMS_PIPELINE_OUTBOX_EVENT,
        aggregateType: "PipelineJob",
        aggregateId: job.id,
        correlationId: job.correlationId,
        payload: { jobId: job.id },
      },
    });
    if (event.attemptCount >= event.maxAttempts) continue;
    const requeued = await db.workflowOutboxEvent.updateMany({
      where: {
        id: event.id,
        OR: [
          { status: "DISPATCHED" },
          { status: "DISPATCHING", lockedAt: { lt: heartbeatCutoff } },
          { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: now } },
        ],
      },
      data: { status: "PENDING", nextAttemptAt: now, lockedAt: null },
    });
    if (requeued.count !== 1) continue;
    const mode = await dispatchTmsPipelineOutboxEvent(job.id);
    if (mode === "INNGEST" || mode === "LOCAL_DIRECT") redispatched += 1;
  }
  return { inspected: jobs.length, redispatched };
}
