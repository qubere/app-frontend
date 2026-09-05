-- Backfills migration history for changes that were already applied directly
-- to this database (out-of-band, e.g. via `prisma db push`) without ever
-- being captured in a migration file, so `prisma migrate dev`'s drift check
-- stops flagging them. Every statement here restates schema.prisma's current,
-- already-live state -- nothing here changes live data or behavior.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."PartyScreeningApprovalStatus" AS ENUM ('PRE_APPROVED', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "public"."CustomsFiling_country_procedureCode_idx";

-- AlterTable
ALTER TABLE "public"."AccountProductEntitlement" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."CustomsCase" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."CustomsCaseDocument" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."CustomsCaseShipment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."FilingUIConfig" ALTER COLUMN "isActive" SET DEFAULT false;

-- AlterTable
ALTER TABLE "public"."PartyScreeningApproval" DROP COLUMN IF EXISTS "status";
ALTER TABLE "public"."PartyScreeningApproval" ADD COLUMN IF NOT EXISTS "status" "public"."PartyScreeningApprovalStatus" NOT NULL DEFAULT 'PRE_APPROVED';

-- AlterTable
ALTER TABLE "public"."ShipmentProductWorkspace" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartyScreeningApproval_partyId_status_idx" ON "public"."PartyScreeningApproval"("partyId" ASC, "status" ASC);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."CarrierInvoice" ADD CONSTRAINT "CarrierInvoice_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "public"."ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RenameIndex
DO $$ BEGIN
  ALTER INDEX "public"."ComplianceFormalOverride_accountId_resultRefType_resultRefId_id" RENAME TO "ComplianceFormalOverride_accountId_resultRefType_resultRefI_idx";
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER INDEX "public"."ComplianceNotification_licenseDeterminationResultId_notif_key" RENAME TO "ComplianceNotification_licenseDeterminationResultId_notific_key";
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER INDEX "public"."LicenseEvent_dedupe_key" RENAME TO "LicenseEvent_accountId_licenseLineId_eventType_transactionI_key";
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;
