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
-- PartyScreeningApproval.status: 20260825140000 created it as TEXT DEFAULT
-- 'PRE_APPROVED'; this converts it to the PartyScreeningApprovalStatus enum.
-- Non-destructive and replay-safe: convert in place while it is still TEXT
-- (preserving every row's value via a text->enum cast — the only legal TEXT
-- values were the two enum labels), add it if somehow missing, and do nothing
-- once it is already the enum. It must never DROP the column — that would
-- discard live approve/revoke state.
DO $$
DECLARE
  col_udt text;
BEGIN
  SELECT c.udt_name INTO col_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'PartyScreeningApproval'
    AND c.column_name = 'status';

  IF col_udt IS NULL THEN
    ALTER TABLE "public"."PartyScreeningApproval"
      ADD COLUMN "status" "public"."PartyScreeningApprovalStatus" NOT NULL DEFAULT 'PRE_APPROVED';
  ELSIF col_udt <> 'PartyScreeningApprovalStatus' THEN
    ALTER TABLE "public"."PartyScreeningApproval" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "public"."PartyScreeningApproval"
      ALTER COLUMN "status" TYPE "public"."PartyScreeningApprovalStatus"
      USING ("status"::text::"public"."PartyScreeningApprovalStatus");
    ALTER TABLE "public"."PartyScreeningApproval" ALTER COLUMN "status" SET DEFAULT 'PRE_APPROVED';
    ALTER TABLE "public"."PartyScreeningApproval" ALTER COLUMN "status" SET NOT NULL;
  END IF;
END $$;

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
-- `ALTER INDEX IF EXISTS ... RENAME` is a no-op (NOTICE, not error) when the
-- old name is already gone — i.e. the rename ran before — but still fails
-- loudly on a real collision (both names present) rather than swallowing it.
ALTER INDEX IF EXISTS "public"."ComplianceFormalOverride_accountId_resultRefType_resultRefId_id" RENAME TO "ComplianceFormalOverride_accountId_resultRefType_resultRefI_idx";

ALTER INDEX IF EXISTS "public"."ComplianceNotification_licenseDeterminationResultId_notif_key" RENAME TO "ComplianceNotification_licenseDeterminationResultId_notific_key";

ALTER INDEX IF EXISTS "public"."LicenseEvent_dedupe_key" RENAME TO "LicenseEvent_accountId_licenseLineId_eventType_transactionI_key";
