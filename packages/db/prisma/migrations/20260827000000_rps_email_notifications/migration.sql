-- CreateEnum
CREATE TYPE "RpsEmailFormat" AS ENUM ('HTML', 'TEXT');

-- CreateEnum
CREATE TYPE "ComplianceNotificationType" AS ENUM ('RPS_HIT', 'RPS_REVIEW_REQUIRED', 'PAL_RESCREEN_HIT', 'PARTY_RESCREEN_HIT');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'SENT', 'RETRYABLE_FAILURE', 'FAILED', 'SUPPRESSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AccountScreeningConfig" ADD COLUMN     "rpsEmailAlertsEnabled" BOOLEAN,
ADD COLUMN     "rpsEmailFormat" "RpsEmailFormat",
ADD COLUMN     "rpsGeneralRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rpsHitRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rpsPalRescreenRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rpsSecureEmailEnabled" BOOLEAN,
ADD COLUMN     "rpsSuppressEmailAlerts" BOOLEAN;

-- CreateTable
CREATE TABLE "ComplianceNotification" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "notificationType" "ComplianceNotificationType" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "screeningResultId" TEXT,
    "complianceExecutionId" TEXT,
    "shipmentId" TEXT,
    "partyId" TEXT,
    "recipients" JSONB NOT NULL,
    "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,

    CONSTRAINT "ComplianceNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceNotification_accountId_deliveryStatus_idx" ON "ComplianceNotification"("accountId", "deliveryStatus");

-- CreateIndex
CREATE INDEX "ComplianceNotification_deliveryStatus_nextAttemptAt_idx" ON "ComplianceNotification"("deliveryStatus", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ComplianceNotification_accountId_createdAt_idx" ON "ComplianceNotification"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ComplianceNotification_partyId_idx" ON "ComplianceNotification"("partyId");

-- CreateIndex
CREATE INDEX "ComplianceNotification_shipmentId_idx" ON "ComplianceNotification"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceNotification_screeningResultId_notificationType_key" ON "ComplianceNotification"("screeningResultId", "notificationType");

-- AddForeignKey
ALTER TABLE "ComplianceNotification" ADD CONSTRAINT "ComplianceNotification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceNotification" ADD CONSTRAINT "ComplianceNotification_screeningResultId_fkey" FOREIGN KEY ("screeningResultId") REFERENCES "RestrictedPartyScreeningResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

