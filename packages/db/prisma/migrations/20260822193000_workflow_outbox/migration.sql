-- Durable transactional outbox for workflow dispatch.
CREATE TYPE "WorkflowOutboxStatus" AS ENUM ('PENDING', 'DISPATCHING', 'DISPATCHED', 'FAILED');

CREATE TABLE "WorkflowOutboxEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "correlationId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "WorkflowOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 12,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowOutboxEvent_eventKey_key" ON "WorkflowOutboxEvent"("eventKey");
CREATE INDEX "WorkflowOutboxEvent_status_nextAttemptAt_idx" ON "WorkflowOutboxEvent"("status", "nextAttemptAt");
CREATE INDEX "WorkflowOutboxEvent_aggregateType_aggregateId_idx" ON "WorkflowOutboxEvent"("aggregateType", "aggregateId");
CREATE INDEX "WorkflowOutboxEvent_accountId_createdAt_idx" ON "WorkflowOutboxEvent"("accountId", "createdAt");

ALTER TABLE "WorkflowOutboxEvent"
ADD CONSTRAINT "WorkflowOutboxEvent_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
