import { db } from "@qubere/db";
import { tmsInngest } from "../client";
import { candidateFromDomainEvent } from "../../../modules/memory/memory.domain-events";
import { TmsMemoryExtractor } from "../../../modules/memory/memory.extractor";
import type { TmsMemoryDomainEvent } from "../../../modules/memory/memory.types";

export const TMS_MEMORY_EVENT = "tms/memory.domain-event";
const TMS_MEMORY_OUTBOX_EVENT = "tms.memory.domain-event";
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

function aggregateId(event: TmsMemoryDomainEvent): string {
  if (event.kind === "DECISION_REVIEWED") return `${event.decisionId}:${event.action}`;
  if (event.kind === "EXCEPTION_RESOLVED") return event.exceptionId;
  if (event.kind === "TENDER_OUTCOME_RECORDED") return event.tenderId;
  return `${event.carrierInvoiceId}:${event.decisionId}`;
}

function outboxKey(event: TmsMemoryDomainEvent): string {
  return `${TMS_MEMORY_OUTBOX_EVENT}:${event.accountId}:${event.kind}:${aggregateId(event)}`;
}

async function dispatchTmsMemoryOutboxEvent(outboxId: string): Promise<boolean> {
  const event = await db.workflowOutboxEvent.findUnique({ where: { id: outboxId } });
  if (!event || event.eventType !== TMS_MEMORY_OUTBOX_EVENT) return false;
  if (event.status === "DISPATCHED") return true;
  if (event.attemptCount >= event.maxAttempts) return false;

  const now = new Date();
  const claimed = await db.workflowOutboxEvent.updateMany({
    where: {
      id: event.id,
      attemptCount: { lt: event.maxAttempts },
      OR: [
        { status: "PENDING", nextAttemptAt: { lte: now } },
        { status: "FAILED", nextAttemptAt: { lte: now } },
        { status: "DISPATCHING", lockedAt: { lt: new Date(now.getTime() - LOCK_TIMEOUT_MS) } },
      ],
    },
    data: {
      status: "DISPATCHING",
      lockedAt: now,
      lastError: null,
      attemptCount: { increment: 1 },
    },
  });
  if (claimed.count !== 1) return false;

  try {
    await tmsInngest.send({
      name: TMS_MEMORY_EVENT,
      data: event.payload as unknown as TmsMemoryDomainEvent,
    });
    await db.workflowOutboxEvent.update({
      where: { id: event.id },
      data: { status: "DISPATCHED", dispatchedAt: new Date(), lockedAt: null, lastError: null },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attempt = event.attemptCount + 1;
    await db.workflowOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        lockedAt: null,
        lastError: message.slice(0, 2000),
        nextAttemptAt: new Date(Date.now() + Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1))),
      },
    });
    throw error;
  }
}

/** Persist first, publish second. Repeated business callbacks reuse eventKey. */
export async function queueTmsMemoryEvent(event: TmsMemoryDomainEvent): Promise<void> {
  const eventKey = outboxKey(event);
  const outbox = await db.workflowOutboxEvent.upsert({
    where: { eventKey },
    update: {},
    create: {
      accountId: event.accountId,
      eventKey,
      eventType: TMS_MEMORY_OUTBOX_EVENT,
      aggregateType: "TmsMemoryProjection",
      aggregateId: aggregateId(event),
      correlationId: event.kind === "DECISION_REVIEWED" || event.kind === "EXCEPTION_RESOLVED" ? event.eventId : null,
      payload: event as any,
    },
  });
  await dispatchTmsMemoryOutboxEvent(outbox.id);
}

export const tmsMemoryExtractionJob = (tmsInngest.createFunction as any)(
  { id: "tms-account-memory-extraction", retries: 4, triggers: [{ event: TMS_MEMORY_EVENT }] },
  async ({ event, step }: { event: { data: TmsMemoryDomainEvent }; step: any }) => {
    const candidate = await step.run("build-memory-candidate", () => candidateFromDomainEvent(event.data));
    if (!candidate) return { stored: false, reason: "event-not-durable" };
    const memory = await step.run("store-account-memory", () => TmsMemoryExtractor.process(candidate));
    return { stored: Boolean(memory), memoryId: memory?.id ?? null };
  }
);

export const tmsMemoryOutboxRecoveryJob = (tmsInngest.createFunction as any)(
  {
    id: "tms-memory-outbox-recovery",
    retries: 2,
    triggers: [{ cron: "*/2 * * * *" }],
    concurrency: [{ limit: 1 }],
  },
  async ({ step }: { step: any }) =>
    step.run("recover-memory-events", async () => {
      const now = new Date();
      const events = await db.workflowOutboxEvent.findMany({
        where: {
          eventType: TMS_MEMORY_OUTBOX_EVENT,
          attemptCount: { lt: 12 },
          OR: [
            { status: "PENDING", nextAttemptAt: { lte: now } },
            { status: "FAILED", nextAttemptAt: { lte: now } },
            { status: "DISPATCHING", lockedAt: { lt: new Date(now.getTime() - LOCK_TIMEOUT_MS) } },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 25,
      });
      let dispatched = 0;
      for (const event of events) {
        if (await dispatchTmsMemoryOutboxEvent(event.id)) dispatched += 1;
      }
      return { inspected: events.length, dispatched };
    })
);
