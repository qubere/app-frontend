-- Extend the shared pipeline queue with durable workflow identity, retries,
-- heartbeat recovery, and idempotent TMS document triggers.
ALTER TABLE "PipelineJob"
  ADD COLUMN "workflowType" TEXT NOT NULL DEFAULT 'CUSTOMS',
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN "heartbeatAt" TIMESTAMP(3);

ALTER TABLE "PipelineStepExecution"
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "PipelineJob_accountId_idempotencyKey_key"
  ON "PipelineJob"("accountId", "idempotencyKey");
CREATE INDEX "PipelineJob_accountId_workflowType_shipmentId_createdAt_idx"
  ON "PipelineJob"("accountId", "workflowType", "shipmentId", "createdAt");
CREATE INDEX "PipelineJob_status_nextRetryAt_idx"
  ON "PipelineJob"("status", "nextRetryAt");
CREATE INDEX "PipelineJob_status_heartbeatAt_idx"
  ON "PipelineJob"("status", "heartbeatAt");
CREATE INDEX "PipelineStepExecution_jobId_attempt_idx"
  ON "PipelineStepExecution"("jobId", "attempt");
