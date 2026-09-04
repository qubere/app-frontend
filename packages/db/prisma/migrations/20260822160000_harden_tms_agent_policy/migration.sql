-- TMS agent execution is deny-by-default. A tenant must explicitly opt an
-- action into autonomous execution; AUTONOMOUS mode never implies all actions.

ALTER TABLE "AgentPolicyConfig"
  ADD COLUMN IF NOT EXISTS "autonomyMode" TEXT DEFAULT 'SUPERVISED',
  ADD COLUMN IF NOT EXISTS "financialThreshold" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "marginThreshold" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "carrierApprovalRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "requireInsurance" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "requireCustomsRelease" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "allowedAutoActions" JSONB,
  ADD COLUMN IF NOT EXISTS "forbiddenAutoActions" JSONB;

ALTER TABLE "AgentPolicyConfig"
  ALTER COLUMN "autonomyMode" SET DEFAULT 'SUPERVISED',
  ALTER COLUMN "carrierApprovalRequired" SET DEFAULT TRUE;

-- Existing rows were created while BALANCED was the implicit default and did
-- not carry an action allowlist. Moving only those implicit policies to
-- SUPERVISED avoids silently granting new write authority after deployment.
UPDATE "AgentPolicyConfig"
SET "autonomyMode" = 'SUPERVISED'
WHERE "autonomyMode" = 'BALANCED'
  AND "allowedAutoActions" IS NULL;

-- Tender state is only SENT after a carrier-provider acknowledgement. These
-- fields make draft retries durable and cap automatic fallback proposals.
DO $$
BEGIN
  IF to_regclass('public."Tender"') IS NOT NULL THEN
    ALTER TABLE "Tender"
      ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
      ADD COLUMN IF NOT EXISTS "cascadeAttempt" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "dispatchProvider" TEXT,
      ADD COLUMN IF NOT EXISTS "providerReference" TEXT;

    CREATE UNIQUE INDEX IF NOT EXISTS "Tender_accountId_idempotencyKey_key"
      ON "Tender" ("accountId", "idempotencyKey");
    CREATE UNIQUE INDEX IF NOT EXISTS "Tender_one_accepted_per_shipment_idx"
      ON "Tender" ("accountId", "shipmentId")
      WHERE "status" = 'ACCEPTED' AND "shipmentId" IS NOT NULL;
  END IF;
END $$;
