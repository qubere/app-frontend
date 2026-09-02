-- CreateEnum
CREATE TYPE "DocumentChannel" AS ENUM ('WEB_APP', 'CUSTOMER_PORTAL', 'EMAIL', 'API', 'INTEGRATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DocumentUploaderType" AS ENUM ('INTERNAL_USER', 'CUSTOMER_USER', 'API_CLIENT', 'EMAIL_SENDER', 'SYSTEM');

-- AlterTable
ALTER TABLE "ShipmentDocument"
  ADD COLUMN "channel" "DocumentChannel",
  ADD COLUMN "uploadedByUserId" TEXT,
  ADD COLUMN "uploadedByType" "DocumentUploaderType",
  ADD COLUMN "uploadedByName" TEXT,
  ADD COLUMN "uploadedByEmail" TEXT,
  ADD COLUMN "uploadedAt" TIMESTAMP(3),
  ADD COLUMN "channelMeta" JSONB;

-- CreateIndex
CREATE INDEX "ShipmentDocument_uploadedByUserId_idx" ON "ShipmentDocument"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "ShipmentDocument" ADD CONSTRAINT "ShipmentDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: map the legacy free-text `source` onto the normalized channel for
-- existing rows. `uploadedAt` defaults to the row's creation time.
UPDATE "ShipmentDocument" SET "channel" = CASE
  WHEN "source" IN ('PORTAL_UPLOAD') THEN 'CUSTOMER_PORTAL'::"DocumentChannel"
  WHEN "source" IN ('INBOUND_EMAIL', 'EMAIL', 'EMAIL_REQUEST') THEN 'EMAIL'::"DocumentChannel"
  WHEN "source" IN ('API') THEN 'API'::"DocumentChannel"
  WHEN "source" IN ('UI') THEN 'WEB_APP'::"DocumentChannel"
  WHEN "source" IN ('UPLOAD') THEN 'WEB_APP'::"DocumentChannel"
  ELSE NULL
END
WHERE "channel" IS NULL;

UPDATE "ShipmentDocument"
  SET "uploadedByType" = CASE
    WHEN "channel" = 'CUSTOMER_PORTAL' THEN 'CUSTOMER_USER'::"DocumentUploaderType"
    WHEN "channel" = 'EMAIL' THEN 'EMAIL_SENDER'::"DocumentUploaderType"
    WHEN "channel" = 'API' THEN 'API_CLIENT'::"DocumentUploaderType"
    WHEN "channel" = 'WEB_APP' THEN 'INTERNAL_USER'::"DocumentUploaderType"
    ELSE NULL
  END
  WHERE "uploadedByType" IS NULL;

UPDATE "ShipmentDocument" SET "uploadedAt" = "createdAt" WHERE "uploadedAt" IS NULL;
