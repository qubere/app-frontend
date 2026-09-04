-- Repair databases where `prisma db push` stopped while replacing the legacy
-- global BillingEventDefinition relation with the account/product relation.
-- This script is idempotent and does not delete financial records.

DO $$
BEGIN
  CREATE TYPE "BillingProductLine" AS ENUM ('CUSTOMS', 'TMS', 'WMS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "BillingEventDefinition"
  ADD COLUMN IF NOT EXISTS "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "UsageEvent"
  ADD COLUMN IF NOT EXISTS "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "RateCard"
  ADD COLUMN IF NOT EXISTS "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';
ALTER TABLE "RateRule"
  ADD COLUMN IF NOT EXISTS "productLine" "BillingProductLine" NOT NULL DEFAULT 'CUSTOMS';

ALTER TABLE "UsageEvent" DROP CONSTRAINT IF EXISTS "UsageEvent_eventCode_fkey";
DROP INDEX IF EXISTS "BillingEventDefinition_eventCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "BillingEventDefinition_accountId_eventCode_productLine_key"
  ON "BillingEventDefinition"("accountId", "eventCode", "productLine");

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UsageEvent_accountId_eventCode_productLine_fkey'
      AND conrelid = '"UsageEvent"'::regclass
  ) THEN
    ALTER TABLE "UsageEvent"
      ADD CONSTRAINT "UsageEvent_accountId_eventCode_productLine_fkey"
      FOREIGN KEY ("accountId", "eventCode", "productLine")
      REFERENCES "BillingEventDefinition"("accountId", "eventCode", "productLine")
      ON DELETE RESTRICT ON UPDATE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE "UsageEvent"
  VALIDATE CONSTRAINT "UsageEvent_accountId_eventCode_productLine_fkey";
