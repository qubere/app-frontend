-- Additive: embargo screening outcome for a BatchRecord (no persisted
-- per-check result row for embargo, unlike RPS/License -- see schema comment)
-- plus its ComplianceExecution audit-trail link (prompt section 25).
ALTER TABLE "BatchRecord" ADD COLUMN "embargoStatus" TEXT;
ALTER TABLE "BatchRecord" ADD COLUMN "embargoEvidence" JSONB;
ALTER TABLE "BatchRecord" ADD COLUMN "embargoComplianceExecutionId" TEXT;
