-- Work Management domain (PR #100): routed queue, stage orchestration,
-- SLA clocks & escalation (WM-S-01 .. WM-S-04).
--
-- Authored by hand from the schema.prisma diff during review (the PR shipped
-- the schema change with no migration, same as PR #97).
--
-- SAFETY: every statement is additive and idempotent — CREATE ... IF NOT
-- EXISTS, ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, and FK adds
-- wrapped so a pre-existing constraint is a no-op. Nothing is dropped or
-- rewritten. It is safe to run against a fresh database (via
-- `prisma migrate deploy`) OR against a database that already has these
-- objects from a dev `prisma db push` (e.g. the shared demo DB). On the
-- latter you may still prefer `prisma migrate resolve --applied
-- 20260829180000_work_management` to keep history tidy without re-executing.

-- AlterTable: Shipment
ALTER TABLE "Shipment"
  ADD COLUMN IF NOT EXISTS "stageStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "stageEnteredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "stageUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autoAdvance" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: AgentDecision
ALTER TABLE "AgentDecision"
  ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "assignedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "assignmentSource" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewSlaDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "firstTouchedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "slaBreachedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);

-- AlterTable: ExceptionItem
ALTER TABLE "ExceptionItem"
  ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "assignmentSource" TEXT,
  ADD COLUMN IF NOT EXISTS "slaDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "firstTouchedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "slaBreachedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);

-- CreateTable: ShipmentStageHistory
CREATE TABLE IF NOT EXISTS "ShipmentStageHistory" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exitedAt" TIMESTAMP(3),
  "outcome" TEXT,
  "advancedBy" TEXT,
  "gateDecisionId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentStageHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ShipmentStageHistory_shipmentId_enteredAt_idx" ON "ShipmentStageHistory" ("shipmentId", "enteredAt");
CREATE INDEX IF NOT EXISTS "ShipmentStageHistory_accountId_stage_idx" ON "ShipmentStageHistory" ("accountId", "stage");

-- CreateTable: PipelineStageRun
CREATE TABLE IF NOT EXISTS "PipelineStageRun" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL,
  "failureReason" TEXT,
  "breakerTrippedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PipelineStageRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PipelineStageRun_shipmentId_stage_attempt_key" ON "PipelineStageRun" ("shipmentId", "stage", "attempt");
CREATE INDEX IF NOT EXISTS "PipelineStageRun_accountId_status_idx" ON "PipelineStageRun" ("accountId", "status");

-- CreateTable: StageGatePolicy
CREATE TABLE IF NOT EXISTS "StageGatePolicy" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "entryType" TEXT,
  "mode" TEXT NOT NULL DEFAULT 'AUTO_ADVANCE',
  "minimumReviewerRole" TEXT NOT NULL DEFAULT 'SPECIALIST',
  "requireLicensedBroker" BOOLEAN NOT NULL DEFAULT false,
  "gateReason" TEXT,
  "createdBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StageGatePolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StageGatePolicy_accountId_stage_entryType_key" ON "StageGatePolicy" ("accountId", "stage", "entryType");
CREATE INDEX IF NOT EXISTS "StageGatePolicy_accountId_idx" ON "StageGatePolicy" ("accountId");

-- CreateTable: SlaPolicy
CREATE TABLE IF NOT EXISTS "SlaPolicy" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "workKind" TEXT NOT NULL,
  "priority" TEXT,
  "reviewHours" INTEGER NOT NULL,
  "resolveHours" INTEGER,
  "businessHoursOnly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SlaPolicy_accountId_workKind_priority_key" ON "SlaPolicy" ("accountId", "workKind", "priority");
CREATE INDEX IF NOT EXISTS "SlaPolicy_accountId_idx" ON "SlaPolicy" ("accountId");

-- CreateTable: EscalationRule
CREATE TABLE IF NOT EXISTS "EscalationRule" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "appliesToKinds" TEXT[],
  "trigger" TEXT NOT NULL DEFAULT 'SLA_BREACH',
  "thresholdHours" INTEGER NOT NULL,
  "escalateTo" TEXT NOT NULL,
  "maxLevel" INTEGER NOT NULL DEFAULT 2,
  "notifyChannel" TEXT NOT NULL DEFAULT 'in_app',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EscalationRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EscalationRule_accountId_active_idx" ON "EscalationRule" ("accountId", "active");

-- CreateTable: EscalationEvent
CREATE TABLE IF NOT EXISTS "EscalationEvent" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "workKind" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "fromUserId" TEXT,
  "toUserId" TEXT,
  "level" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  CONSTRAINT "EscalationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EscalationEvent_accountId_workItemId_idx" ON "EscalationEvent" ("accountId", "workItemId");
CREATE INDEX IF NOT EXISTS "EscalationEvent_toUserId_acknowledgedAt_idx" ON "EscalationEvent" ("toUserId", "acknowledgedAt");

-- Index for the new AgentDecision.assignedToUserId relation lookup and the
-- scope=mine queue read path (WHERE accountId = $1 AND assignedToUserId = $2).
CREATE INDEX IF NOT EXISTS "AgentDecision_assignedToUserId_idx" ON "AgentDecision" ("assignedToUserId");

-- AddForeignKey (idempotent — a pre-existing constraint of the same name is a no-op)
DO $$
BEGIN
  ALTER TABLE "ShipmentStageHistory" ADD CONSTRAINT "ShipmentStageHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "ShipmentStageHistory" ADD CONSTRAINT "ShipmentStageHistory_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "PipelineStageRun" ADD CONSTRAINT "PipelineStageRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "PipelineStageRun" ADD CONSTRAINT "PipelineStageRun_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "StageGatePolicy" ADD CONSTRAINT "StageGatePolicy_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "EscalationRule" ADD CONSTRAINT "EscalationRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "EscalationEvent" ADD CONSTRAINT "EscalationEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
