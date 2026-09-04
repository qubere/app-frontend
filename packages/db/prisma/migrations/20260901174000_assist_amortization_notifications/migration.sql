ALTER TYPE "ComplianceNotificationType" ADD VALUE 'ASSIST_AMORTIZATION_ALERT';
ALTER TABLE "ComplianceNotification" ADD COLUMN "assistAlertKey" TEXT, ADD COLUMN "bellDeliveredAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "ComplianceNotification_assistAlertKey_key" ON "ComplianceNotification"("assistAlertKey");
