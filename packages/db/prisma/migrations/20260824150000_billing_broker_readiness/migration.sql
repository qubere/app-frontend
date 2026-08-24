-- Shared customer-billing product discriminator.
CREATE TYPE "BillingProductLine" AS ENUM ('CUSTOMS', 'TMS', 'WMS');

ALTER TABLE "BillingEventDefinition" ADD COLUMN "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "RateCard" ADD COLUMN "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "RateRule" ADD COLUMN "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "UsageEvent" ADD COLUMN "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "Invoice" ADD COLUMN "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "RateCard" ADD COLUMN "createdById" TEXT;
ALTER TABLE "RateCardVersion" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "sentById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "voidedById" TEXT;

ALTER TABLE "Client" ADD COLUMN "billingContactName" TEXT;
ALTER TABLE "Client" ADD COLUMN "billingContactEmail" TEXT;
ALTER TABLE "Client" ADD COLUMN "paymentTermsDays" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "UsageEvent" DROP CONSTRAINT "UsageEvent_eventCode_fkey";
DROP INDEX "BillingEventDefinition_eventCode_key";
CREATE UNIQUE INDEX "BillingEventDefinition_accountId_eventCode_productLine_key"
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

ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_accountId_eventCode_productLine_fkey"
  FOREIGN KEY ("accountId", "eventCode", "productLine")
  REFERENCES "BillingEventDefinition"("accountId", "eventCode", "productLine")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "BillingEventDefinition_productLine_idx" ON "BillingEventDefinition"("productLine");
CREATE INDEX "RateCard_accountId_productLine_idx" ON "RateCard"("accountId", "productLine");
CREATE INDEX "RateRule_productLine_idx" ON "RateRule"("productLine");
CREATE INDEX "UsageEvent_accountId_productLine_occurredAt_idx" ON "UsageEvent"("accountId", "productLine", "occurredAt");
CREATE INDEX "Invoice_accountId_productLine_status_idx" ON "Invoice"("accountId", "productLine", "status");
CREATE INDEX "BillingException_usageEventId_idx" ON "BillingException"("usageEventId");

-- Retry guarantees. A usage event can create one revenue charge and one cost
-- per cost component; nullable event ids remain unrestricted for manual rows.
CREATE UNIQUE INDEX "ShipmentCharge_usageEventId_key" ON "ShipmentCharge"("usageEventId");
CREATE UNIQUE INDEX "ShipmentCost_usageEventId_costType_key" ON "ShipmentCost"("usageEventId", "costType");

ALTER TABLE "BillingException" ADD CONSTRAINT "BillingException_usageEventId_fkey"
  FOREIGN KEY ("usageEventId") REFERENCES "UsageEvent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Financial invariants are database-enforced as a final line of defence.
ALTER TABLE "ShipmentCharge" ADD CONSTRAINT "ShipmentCharge_nonnegative_amounts_check"
  CHECK ("quantity" >= 0 AND "unitPrice" >= 0 AND "grossAmount" >= 0 AND "discountAmount" >= 0 AND "netAmount" >= 0);
ALTER TABLE "ShipmentCost" ADD CONSTRAINT "ShipmentCost_nonnegative_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "ChargeAdjustment" ADD CONSTRAINT "ChargeAdjustment_amounts_check"
  CHECK ("originalAmount" >= 0 AND "newAmount" >= 0 AND "adjustmentAmount" <= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_nonnegative_amounts_check"
  CHECK ("subtotal" >= 0 AND "totalDiscounts" >= 0 AND "totalTax" >= 0 AND "totalAmount" >= 0 AND "paidAmount" >= 0 AND "balanceDue" >= 0 AND "paidAmount" <= "totalAmount");
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_nonnegative_amounts_check"
  CHECK ("quantity" >= 0 AND "unitPrice" >= 0 AND "amount" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount_check" CHECK ("amount" > 0);
ALTER TABLE "Client" ADD CONSTRAINT "Client_payment_terms_check" CHECK ("paymentTermsDays" BETWEEN 0 AND 365);

-- DISPUTED/CREDITED had no workflow implementation. Normalize legacy values,
-- then remove them so the public state machine only exposes supported states.
UPDATE "Invoice" SET "status" = 'SENT' WHERE "status" = 'DISPUTED';
UPDATE "Invoice" SET "status" = 'VOID' WHERE "status" = 'CREDITED';
ALTER TYPE "InvoiceStatus" RENAME TO "InvoiceStatus_legacy";
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');
ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE "InvoiceStatus" USING ("status"::text::"InvoiceStatus");
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "InvoiceStatus_legacy";
