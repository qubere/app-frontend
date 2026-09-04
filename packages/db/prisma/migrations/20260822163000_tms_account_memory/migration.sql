-- Keep one tenant-scoped memory ledger while separating Customs and TMS
-- retrieval. Existing rows are Customs memories by default.
DO $$ BEGIN
  CREATE TYPE "AccountMemoryDomain" AS ENUM ('CUSTOMS', 'TMS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'CUSTOMER';
ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'CARRIER';
ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'LANE';
ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'FACILITY';
ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'MOVEMENT';
ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'APPOINTMENT';
ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'RATE';
ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'TENDER';
ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'TRACKING';
ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'ETA';
ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'ACCESSORIAL';
ALTER TYPE "AccountMemorySubjectType" ADD VALUE IF NOT EXISTS 'INVOICE';

ALTER TYPE "AccountMemorySourceType" ADD VALUE IF NOT EXISTS 'CUSTOMER_INSTRUCTION';
ALTER TYPE "AccountMemorySourceType" ADD VALUE IF NOT EXISTS 'TENDER_OUTCOME';
ALTER TYPE "AccountMemorySourceType" ADD VALUE IF NOT EXISTS 'CARRIER_PERFORMANCE';
ALTER TYPE "AccountMemorySourceType" ADD VALUE IF NOT EXISTS 'TRACKING_OUTCOME';
ALTER TYPE "AccountMemorySourceType" ADD VALUE IF NOT EXISTS 'INVOICE_AUDIT';

ALTER TABLE "AccountMemory"
  ADD COLUMN IF NOT EXISTS "domain" "AccountMemoryDomain" NOT NULL DEFAULT 'CUSTOMS',
  ADD COLUMN IF NOT EXISTS "task" TEXT,
  ADD COLUMN IF NOT EXISTS "agentName" TEXT,
  ADD COLUMN IF NOT EXISTS "eventKey" TEXT,
  ADD COLUMN IF NOT EXISTS "scope" JSONB,
  ADD COLUMN IF NOT EXISTS "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "MemoryEvidence"
  ADD COLUMN IF NOT EXISTS "eventKey" TEXT;

CREATE INDEX IF NOT EXISTS "AccountMemory_accountId_domain_task_idx"
  ON "AccountMemory"("accountId", "domain", "task");

-- A durable TMS event must project at most once, even under concurrent worker
-- retries. Existing Customs rows remain NULL and are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "AccountMemory_eventKey_key"
  ON "AccountMemory"("eventKey");

CREATE UNIQUE INDEX IF NOT EXISTS "MemoryEvidence_eventKey_key"
  ON "MemoryEvidence"("eventKey");
