DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingProductLine') THEN
        CREATE TYPE "BillingProductLine" AS ENUM ('CUSTOMS', 'TMS', 'WMS');
    END IF;
END $$;

ALTER TABLE "BillingEventDefinition" ADD COLUMN IF NOT EXISTS "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "RateCard" ADD COLUMN IF NOT EXISTS "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "RateRule" ADD COLUMN IF NOT EXISTS "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "UsageEvent" ADD COLUMN IF NOT EXISTS "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "RateCard" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "RateCardVersion" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sentById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "voidedById" TEXT;

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "billingContactName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "billingContactEmail" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "paymentTermsDays" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "UsageEvent" DROP CONSTRAINT IF EXISTS "UsageEvent_eventCode_fkey";
DROP INDEX IF EXISTS "BillingEventDefinition_eventCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "BillingEventDefinition_accountId_eventCode_productLine_key"
  ON "BillingEventDefinition"("accountId", "eventCode", "productLine");

-- The legacy relation was global by eventCode even though both definitions and
-- usage events carried an accountId. Preserve populated databases by cloning the
-- canonical definition into every account/product pair that already uses it.
-- Rate-rule mappings are included so they remain tenant-local after the clone.
WITH "RequiredBillingDefinitions" AS (
  SELECT DISTINCT
    ue."accountId",
    ue."eventCode",
    ue."productLine"
  FROM "UsageEvent" ue
  UNION
  SELECT DISTINCT
    rc."accountId",
    source."eventCode",
    rr."productLine"
  FROM "RateRuleCapabilityMapping" mapping
  JOIN "RateRule" rr ON rr."id" = mapping."rateRuleId"
  JOIN "RateCardVersion" rcv ON rcv."id" = rr."rateCardVersionId"
  JOIN "RateCard" rc ON rc."id" = rcv."rateCardId"
  JOIN "BillingEventDefinition" source ON source."id" = mapping."eventDefId"
),
"DefinitionCopies" AS (
  SELECT DISTINCT ON (required."accountId", required."eventCode", required."productLine")
    required."accountId",
    required."eventCode",
    required."productLine",
    source."name",
    source."description",
    source."category",
    source."defaultUnit",
    source."isBillable",
    source."createdAt",
    source."updatedAt"
  FROM "RequiredBillingDefinitions" required
  JOIN "BillingEventDefinition" source
    ON source."eventCode" = required."eventCode"
   AND source."productLine" = required."productLine"
  ORDER BY
    required."accountId",
    required."eventCode",
    required."productLine",
    (source."accountId" = required."accountId") DESC,
    source."createdAt",
    source."id"
)
INSERT INTO "BillingEventDefinition" (
  "id",
  "accountId",
  "eventCode",
  "productLine",
  "name",
  "description",
  "category",
  "defaultUnit",
  "isBillable",
  "createdAt",
  "updatedAt"
)
SELECT
  'billing_def_' || md5(copy."accountId" || ':' || copy."eventCode" || ':' || copy."productLine"::text),
  copy."accountId",
  copy."eventCode",
  copy."productLine",
  copy."name",
  copy."description",
  copy."category",
  copy."defaultUnit",
  copy."isBillable",
  copy."createdAt",
  copy."updatedAt"
FROM "DefinitionCopies" copy
ON CONFLICT ("accountId", "eventCode", "productLine") DO NOTHING;

UPDATE "RateRuleCapabilityMapping" mapping
SET "eventDefId" = target."id"
FROM "RateRule" rr
JOIN "RateCardVersion" rcv ON rcv."id" = rr."rateCardVersionId"
JOIN "RateCard" rc ON rc."id" = rcv."rateCardId",
"BillingEventDefinition" source,
"BillingEventDefinition" target
WHERE mapping."rateRuleId" = rr."id"
  AND source."id" = mapping."eventDefId"
  AND target."accountId" = rc."accountId"
  AND target."eventCode" = source."eventCode"
  AND target."productLine" = rr."productLine"
  AND mapping."eventDefId" <> target."id";

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UsageEvent_accountId_eventCode_productLine_fkey') THEN
        ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_accountId_eventCode_productLine_fkey"
          FOREIGN KEY ("accountId", "eventCode", "productLine")
          REFERENCES "BillingEventDefinition"("accountId", "eventCode", "productLine")
          ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BillingEventDefinition_productLine_idx" ON "BillingEventDefinition"("productLine");
CREATE INDEX IF NOT EXISTS "RateCard_accountId_productLine_idx" ON "RateCard"("accountId", "productLine");
CREATE INDEX IF NOT EXISTS "RateRule_productLine_idx" ON "RateRule"("productLine");
CREATE INDEX IF NOT EXISTS "UsageEvent_accountId_productLine_occurredAt_idx" ON "UsageEvent"("accountId", "productLine", "occurredAt");
CREATE INDEX IF NOT EXISTS "Invoice_accountId_productLine_status_idx" ON "Invoice"("accountId", "productLine", "status");
CREATE INDEX IF NOT EXISTS "BillingException_usageEventId_idx" ON "BillingException"("usageEventId");

-- Retry guarantees. A usage event can create one revenue charge and one cost
-- per cost component; nullable event ids remain unrestricted for manual rows.
CREATE UNIQUE INDEX IF NOT EXISTS "ShipmentCharge_usageEventId_key" ON "ShipmentCharge"("usageEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShipmentCost_usageEventId_costType_key" ON "ShipmentCost"("usageEventId", "costType");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BillingException_usageEventId_fkey') THEN
        ALTER TABLE "BillingException" ADD CONSTRAINT "BillingException_usageEventId_fkey"
          FOREIGN KEY ("usageEventId") REFERENCES "UsageEvent"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Financial invariants are database-enforced as a final line of defence.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShipmentCharge_nonnegative_amounts_check') THEN
        ALTER TABLE "ShipmentCharge" ADD CONSTRAINT "ShipmentCharge_nonnegative_amounts_check"
          CHECK ("quantity" >= 0 AND "unitPrice" >= 0 AND "grossAmount" >= 0 AND "discountAmount" >= 0 AND "netAmount" >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShipmentCost_nonnegative_amount_check') THEN
        ALTER TABLE "ShipmentCost" ADD CONSTRAINT "ShipmentCost_nonnegative_amount_check" CHECK ("amount" >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChargeAdjustment_amounts_check') THEN
        ALTER TABLE "ChargeAdjustment" ADD CONSTRAINT "ChargeAdjustment_amounts_check"
          CHECK ("originalAmount" >= 0 AND "newAmount" >= 0 AND "adjustmentAmount" <= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_nonnegative_amounts_check') THEN
        ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_nonnegative_amounts_check"
          CHECK ("subtotal" >= 0 AND "totalDiscounts" >= 0 AND "totalTax" >= 0 AND "totalAmount" >= 0 AND "paidAmount" >= 0 AND "balanceDue" >= 0 AND "paidAmount" <= "totalAmount");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceLine_nonnegative_amounts_check') THEN
        ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_nonnegative_amounts_check"
          CHECK ("quantity" >= 0 AND "unitPrice" >= 0 AND "amount" >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_positive_amount_check') THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount_check" CHECK ("amount" > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Client_payment_terms_check') THEN
        ALTER TABLE "Client" ADD CONSTRAINT "Client_payment_terms_check" CHECK ("paymentTermsDays" BETWEEN 0 AND 365);
    END IF;
END $$;

-- DISPUTED/CREDITED had no workflow implementation. Normalize legacy values,
-- then remove them so the public state machine only exposes supported states.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus' AND EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = pg_type.oid AND enumlabel = 'DISPUTED')) THEN
        UPDATE "Invoice" SET "status" = 'SENT' WHERE "status" = 'DISPUTED';
        UPDATE "Invoice" SET "status" = 'VOID' WHERE "status" = 'CREDITED';
        ALTER TYPE "InvoiceStatus" RENAME TO "InvoiceStatus_legacy";
        CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');
        ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE "InvoiceStatus" USING ("status"::text::"InvoiceStatus");
        ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
        DROP TYPE IF EXISTS "InvoiceStatus_legacy";
    END IF;
END $$;
