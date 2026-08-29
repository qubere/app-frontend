-- Work Management domain (PR #100): routed queue, stage orchestration,
-- SLA clocks & escalation (WM-S-01 .. WM-S-04).
--
-- NOTE: this migration was authored by hand from the schema diff during
-- review — the PR shipped the schema.prisma change with no migration (same
-- as PR #97). If the target database already has these objects from a dev
-- `prisma db push`, run
--   prisma migrate resolve --applied 20260829180000_work_management
-- instead of `migrate deploy`. On a fresh database `migrate deploy` runs it
-- normally. Regenerate against a shadow DB with `prisma migrate diff` before
-- relying on it in CI.

-- AlterTable: Shipment
ALTER TABLE "Shipment"
  ADD COLUMN "stageStatus" TEXT,
  ADD COLUMN "stageEnteredAt" TIMESTAMP(3),
  ADD COLUMN "stageUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "autoAdvance" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: AgentDecision
ALTER TABLE "AgentDecision"
  ADD COLUMN "assignedToUserId" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3),
  ADD COLUMN "assignedBy" TEXT,
  ADD COLUMN "assignmentSource" TEXT,
  ADD COLUMN "reviewSlaDueAt" TIMESTAMP(3),
  ADD COLUMN "firstTouchedAt" TIMESTAMP(3),
  ADD COLUMN "slaBreachedAt" TIMESTAMP(3),
  ADD COLUMN "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "escalatedAt" TIMESTAMP(3);

-- AlterTable: ExceptionItem
ALTER TABLE "ExceptionItem"
  ADD COLUMN "assignedAt" TIMESTAMP(3),
  ADD COLUMN "assignmentSource" TEXT,
  ADD COLUMN "slaDueAt" TIMESTAMP(3),
  ADD COLUMN "firstTouchedAt" TIMESTAMP(3),
  ADD COLUMN "slaBreachedAt" TIMESTAMP(3),
  ADD COLUMN "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "escalatedAt" TIMESTAMP(3);

-- CreateTable: ShipmentStageHistory
CREATE TABLE "ShipmentStageHistory" (
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
CREATE INDEX "ShipmentStageHistory_shipmentId_enteredAt_idx" ON "ShipmentStageHistory" ("shipmentId", "enteredAt");
CREATE INDEX "ShipmentStageHistory_accountId_stage_idx" ON "ShipmentStageHistory" ("accountId", "stage");

-- CreateTable: PipelineStageRun
CREATE TABLE "PipelineStageRun" (
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
CREATE UNIQUE INDEX "PipelineStageRun_shipmentId_stage_attempt_key" ON "PipelineStageRun" ("shipmentId", "stage", "attempt");
CREATE INDEX "PipelineStageRun_accountId_status_idx" ON "PipelineStageRun" ("accountId", "status");

-- CreateTable: StageGatePolicy
CREATE TABLE "StageGatePolicy" (
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
CREATE UNIQUE INDEX "StageGatePolicy_accountId_stage_entryType_key" ON "StageGatePolicy" ("accountId", "stage", "entryType");
CREATE INDEX "StageGatePolicy_accountId_idx" ON "StageGatePolicy" ("accountId");

-- CreateTable: SlaPolicy
CREATE TABLE "SlaPolicy" (
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
CREATE UNIQUE INDEX "SlaPolicy_accountId_workKind_priority_key" ON "SlaPolicy" ("accountId", "workKind", "priority");
CREATE INDEX "SlaPolicy_accountId_idx" ON "SlaPolicy" ("accountId");

-- CreateTable: EscalationRule
CREATE TABLE "EscalationRule" (
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
CREATE INDEX "EscalationRule_accountId_active_idx" ON "EscalationRule" ("accountId", "active");

-- CreateTable: EscalationEvent
CREATE TABLE "EscalationEvent" (
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
CREATE INDEX "EscalationEvent_accountId_workItemId_idx" ON "EscalationEvent" ("accountId", "workItemId");
CREATE INDEX "EscalationEvent_toUserId_acknowledgedAt_idx" ON "EscalationEvent" ("toUserId", "acknowledgedAt");

-- Index for the new AgentDecision.assignedToUserId relation lookup and the
-- scope=mine queue read path (WHERE accountId = $1 AND assignedToUserId = $2).
CREATE INDEX "AgentDecision_assignedToUserId_idx" ON "AgentDecision" ("assignedToUserId");

-- AddForeignKey
ALTER TABLE "ShipmentStageHistory" ADD CONSTRAINT "ShipmentStageHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentStageHistory" ADD CONSTRAINT "ShipmentStageHistory_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PipelineStageRun" ADD CONSTRAINT "PipelineStageRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PipelineStageRun" ADD CONSTRAINT "PipelineStageRun_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageGatePolicy" ADD CONSTRAINT "StageGatePolicy_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EscalationRule" ADD CONSTRAINT "EscalationRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EscalationEvent" ADD CONSTRAINT "EscalationEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
