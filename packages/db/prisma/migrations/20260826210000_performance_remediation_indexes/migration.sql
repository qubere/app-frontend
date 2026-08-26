-- DropIndex
DROP INDEX IF EXISTS "AgentDecision_accountId_triageState_idx";

-- CreateIndex
CREATE INDEX "Shipment_accountId_deletedAt_createdAt_idx" ON "Shipment"("accountId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "AgentDecision_accountId_createdAt_idx" ON "AgentDecision"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentDecision_accountId_triageState_createdAt_idx" ON "AgentDecision"("accountId", "triageState", "createdAt");

-- CreateIndex
CREATE INDEX "AgentDecision_accountId_status_createdAt_idx" ON "AgentDecision"("accountId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ShipmentDocument_accountId_createdAt_idx" ON "ShipmentDocument"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ShipmentDocument_accountId_status_createdAt_idx" ON "ShipmentDocument"("accountId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ExceptionItem_accountId_status_createdAt_idx" ON "ExceptionItem"("accountId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ComplianceFinding_accountId_status_createdAt_idx" ON "ComplianceFinding"("accountId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ComplianceAuditRecord_accountId_runAt_idx" ON "ComplianceAuditRecord"("accountId", "runAt");

-- CreateIndex
CREATE INDEX "RegulatoryUpdate_effectiveDate_idx" ON "RegulatoryUpdate"("effectiveDate");
