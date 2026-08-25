-- CreateIndex
CREATE INDEX "AgentDecision_reviewedByUserId_idx" ON "AgentDecision"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "BillingException_clientId_idx" ON "BillingException"("clientId");

-- CreateIndex
CREATE INDEX "BillingException_shipmentId_idx" ON "BillingException"("shipmentId");

-- CreateIndex
CREATE INDEX "UsageEvent_accountId_eventCode_productLine_idx" ON "UsageEvent"("accountId", "eventCode", "productLine");

-- CreateIndex
CREATE INDEX "ExceptionItem_assignedToUserId_idx" ON "ExceptionItem"("assignedToUserId");

-- CreateIndex
CREATE INDEX "ExceptionItem_filingId_idx" ON "ExceptionItem"("filingId");

-- CreateIndex
CREATE INDEX "ExceptionItem_shipmentId_idx" ON "ExceptionItem"("shipmentId");
