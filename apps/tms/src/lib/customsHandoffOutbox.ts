import { db } from "@qubere/db";

export const CUSTOMS_HANDOFF_EVENT_TYPE = "CUSTOMS_HANDOFF_REQUESTED";
const OUTBOX_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

function retryAt(attempt: number): Date {
  return new Date(Date.now() + Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1)));
}

export async function dispatchCustomsHandoffOutboxEvent(eventKey: string): Promise<string> {
  const event = await db.workflowOutboxEvent.findUnique({
    where: { eventKey },
  });

  if (!event) throw new Error(`Outbox event with key ${eventKey} not found.`);
  if (event.status === "DISPATCHED") return "ALREADY_DISPATCHED";

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
    // Perform outbox dispatch logic (e.g. queue Inngest or process directly)
    // Mark event as DISPATCHED
    await db.workflowOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: "DISPATCHED",
        dispatchedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });

    return "DISPATCHED";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.workflowOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        lockedAt: null,
        lastError: message.slice(0, 2000),
        nextAttemptAt: retryAt(event.attemptCount + 1),
      },
    });
    return "FAILED";
  }
}

export async function recoverUndeliveredOutboxEvents(): Promise<number> {
  const now = new Date();

  const pendingEvents = await db.workflowOutboxEvent.findMany({
    where: {
      eventType: CUSTOMS_HANDOFF_EVENT_TYPE,
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: now },
    },
    take: 25,
  });

  let dispatchedCount = 0;
  for (const event of pendingEvents) {
    const res = await dispatchCustomsHandoffOutboxEvent(event.eventKey);
    if (res === "DISPATCHED") dispatchedCount++;
  }

  return dispatchedCount;
}
