-- Additive: product classification outcome for a BatchRecord (no persisted
-- case row for a standalone batch call to ClassificationService.classifyProduct,
-- same "inline outcome" shape as the embargo columns) plus its
-- ComplianceExecution audit-trail link (prompt section 25).
ALTER TABLE "BatchRecord" ADD COLUMN "classificationStatus" TEXT;
ALTER TABLE "BatchRecord" ADD COLUMN "classificationHtsCode" TEXT;
ALTER TABLE "BatchRecord" ADD COLUMN "classificationAgentDecisionId" TEXT;
ALTER TABLE "BatchRecord" ADD COLUMN "classificationComplianceExecutionId" TEXT;
