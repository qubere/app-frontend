-- Additive: links each BatchRecord to the ComplianceExecution row(s) produced
-- by the canonical services actually run against it (prompt section 25).
ALTER TABLE "BatchRecord" ADD COLUMN "rpsComplianceExecutionId" TEXT;
ALTER TABLE "BatchRecord" ADD COLUMN "licenseComplianceExecutionId" TEXT;
