-- Extend ComplianceNotification to support License Determination / License
-- Management email alerts alongside the existing RPS notification pipeline.
ALTER TYPE "ComplianceNotificationType" ADD VALUE IF NOT EXISTS 'LICENSE_ALERT';
ALTER TYPE "ComplianceNotificationType" ADD VALUE IF NOT EXISTS 'LICENSE_DETERMINATION_REVIEW_REQUIRED';

ALTER TABLE "ComplianceNotification" ADD COLUMN IF NOT EXISTS "licenseDeterminationResultId" TEXT;
ALTER TABLE "ComplianceNotification" ADD COLUMN IF NOT EXISTS "licenseId" TEXT;
ALTER TABLE "ComplianceNotification" ADD COLUMN IF NOT EXISTS "payload" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "ComplianceNotification_licenseDeterminationResultId_notif_key"
  ON "ComplianceNotification"("licenseDeterminationResultId", "notificationType");

CREATE INDEX IF NOT EXISTS "ComplianceNotification_licenseDeterminationResultId_idx"
  ON "ComplianceNotification"("licenseDeterminationResultId");
