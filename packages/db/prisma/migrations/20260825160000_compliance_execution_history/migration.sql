-- Additive only: introduces the unified compliance execution audit envelope
-- (ComplianceExecution) and a governed formal-override model
-- (ComplianceFormalOverride), plus one nullable back-link column on
-- ComplianceScreeningFinding. No existing table is altered destructively, no
-- existing row is touched, no audit/screening/decision/finding history is
-- cleared. No legacy SERVICE_USAGE_LINES table is introduced -- the
-- Qubere-native equivalent for embargo already exists as
-- EmbargoUsageHeader/EmbargoUsageLine and is left untouched; this migration
-- only adds the cross-domain envelope that groups it with RPS, classification,
-- and the other screening domains for search/history/service-usage purposes.

CREATE TYPE "ComplianceExecutionType" AS ENUM (
    'RESTRICTED_PARTY_SCREENING',
    'EMBARGO_SCREENING',
    'CLASSIFICATION',
    'FORCED_LABOR_SCREENING',
    'END_USE_SCREENING',
    'END_USER_SCREENING',
    'MILITARY_END_USE_SCREENING',
    'ANTI_BOYCOTT_SCREENING',
    'LICENSE_DETERMINATION'
);

CREATE TYPE "ComplianceExecutionStatus" AS ENUM (
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'PARTIAL',
    'FAILED',
    'CANCELLED'
);

CREATE TYPE "ComplianceExecutionSource" AS ENUM (
    'UI',
    'API',
    'CSV',
    'JSON',
    'XML',
    'BATCH',
    'PARTY_CREATE',
    'PARTY_UPDATE',
    'SHIPMENT_PIPELINE',
    'MANUAL_RESCREEN',
    'COPILOT',
    'SYSTEM'
);

CREATE TABLE IF NOT EXISTS "ComplianceExecution" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "executionType" "ComplianceExecutionType" NOT NULL,
    "status" "ComplianceExecutionStatus" NOT NULL DEFAULT 'COMPLETED',
    "correlationId" TEXT NOT NULL,
    "requestId" TEXT,
    "parentExecutionId" TEXT,
    "shipmentId" TEXT,
    "lineItemId" TEXT,
    "partyId" TEXT,
    "productId" TEXT,
    "countryRole" TEXT,
    "countryChecked" TEXT,
    "source" "ComplianceExecutionSource" NOT NULL,
    "initiatedByUserId" TEXT,
    "requestSnapshot" JSONB,
    "responseSnapshot" JSONB,
    "inputHash" TEXT,
    "outputHash" TEXT,
    "rulesetVersion" TEXT,
    "referenceDataAsOf" TIMESTAMP(3),
    "agentName" TEXT,
    "modelProvider" TEXT,
    "modelVersion" TEXT,
    "promptVersion" TEXT,
    "resultRefType" TEXT,
    "resultRefId" TEXT,
    "finalStatus" TEXT,
    "finalSummary" TEXT,
    "errorCategory" TEXT,
    "errorCode" TEXT,
    "failedStage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ComplianceExecution_accountId_startedAt_idx"
    ON "ComplianceExecution"("accountId", "startedAt");

CREATE INDEX IF NOT EXISTS "ComplianceExecution_accountId_executionType_startedAt_idx"
    ON "ComplianceExecution"("accountId", "executionType", "startedAt");

CREATE INDEX IF NOT EXISTS "ComplianceExecution_accountId_status_startedAt_idx"
    ON "ComplianceExecution"("accountId", "status", "startedAt");

CREATE INDEX IF NOT EXISTS "ComplianceExecution_accountId_shipmentId_idx"
    ON "ComplianceExecution"("accountId", "shipmentId");

CREATE INDEX IF NOT EXISTS "ComplianceExecution_accountId_partyId_idx"
    ON "ComplianceExecution"("accountId", "partyId");

CREATE INDEX IF NOT EXISTS "ComplianceExecution_accountId_initiatedByUserId_startedAt_idx"
    ON "ComplianceExecution"("accountId", "initiatedByUserId", "startedAt");

CREATE INDEX IF NOT EXISTS "ComplianceExecution_accountId_correlationId_idx"
    ON "ComplianceExecution"("accountId", "correlationId");

CREATE INDEX IF NOT EXISTS "ComplianceExecution_parentExecutionId_idx"
    ON "ComplianceExecution"("parentExecutionId");

CREATE TABLE IF NOT EXISTS "ComplianceFormalOverride" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "executionId" TEXT,
    "resultRefType" TEXT NOT NULL,
    "resultRefId" TEXT NOT NULL,
    "originalDecision" TEXT NOT NULL,
    "overrideDecision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "overriddenByUserId" TEXT NOT NULL,
    "overriddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceFormalOverride_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ComplianceFormalOverride_accountId_resultRefType_resultRefId_idx"
    ON "ComplianceFormalOverride"("accountId", "resultRefType", "resultRefId");

CREATE INDEX IF NOT EXISTS "ComplianceFormalOverride_accountId_executionId_idx"
    ON "ComplianceFormalOverride"("accountId", "executionId");

CREATE INDEX IF NOT EXISTS "ComplianceFormalOverride_accountId_overriddenAt_idx"
    ON "ComplianceFormalOverride"("accountId", "overriddenAt");

-- Additive, nullable back-link column so existing ComplianceScreeningFinding
-- rows (Country Embargo / UFLPA / End-Use / End-User / Military End-Use /
-- Anti-Boycott findings) remain untouched; only newly recorded findings will
-- populate it.
ALTER TABLE "ComplianceScreeningFinding" ADD COLUMN IF NOT EXISTS "executionId" TEXT;

CREATE INDEX IF NOT EXISTS "ComplianceScreeningFinding_executionId_idx"
    ON "ComplianceScreeningFinding"("executionId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComplianceExecution_accountId_fkey'
    ) THEN
        ALTER TABLE "ComplianceExecution"
            ADD CONSTRAINT "ComplianceExecution_accountId_fkey"
            FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComplianceExecution_parentExecutionId_fkey'
    ) THEN
        ALTER TABLE "ComplianceExecution"
            ADD CONSTRAINT "ComplianceExecution_parentExecutionId_fkey"
            FOREIGN KEY ("parentExecutionId") REFERENCES "ComplianceExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComplianceExecution_shipmentId_fkey'
    ) THEN
        ALTER TABLE "ComplianceExecution"
            ADD CONSTRAINT "ComplianceExecution_shipmentId_fkey"
            FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComplianceExecution_lineItemId_fkey'
    ) THEN
        ALTER TABLE "ComplianceExecution"
            ADD CONSTRAINT "ComplianceExecution_lineItemId_fkey"
            FOREIGN KEY ("lineItemId") REFERENCES "ShipmentLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComplianceExecution_partyId_fkey'
    ) THEN
        ALTER TABLE "ComplianceExecution"
            ADD CONSTRAINT "ComplianceExecution_partyId_fkey"
            FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComplianceExecution_productId_fkey'
    ) THEN
        ALTER TABLE "ComplianceExecution"
            ADD CONSTRAINT "ComplianceExecution_productId_fkey"
            FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComplianceExecution_initiatedByUserId_fkey'
    ) THEN
        ALTER TABLE "ComplianceExecution"
            ADD CONSTRAINT "ComplianceExecution_initiatedByUserId_fkey"
            FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComplianceFormalOverride_accountId_fkey'
    ) THEN
        ALTER TABLE "ComplianceFormalOverride"
            ADD CONSTRAINT "ComplianceFormalOverride_accountId_fkey"
            FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComplianceFormalOverride_executionId_fkey'
    ) THEN
        ALTER TABLE "ComplianceFormalOverride"
            ADD CONSTRAINT "ComplianceFormalOverride_executionId_fkey"
            FOREIGN KEY ("executionId") REFERENCES "ComplianceExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComplianceScreeningFinding_executionId_fkey'
    ) THEN
        ALTER TABLE "ComplianceScreeningFinding"
            ADD CONSTRAINT "ComplianceScreeningFinding_executionId_fkey"
            FOREIGN KEY ("executionId") REFERENCES "ComplianceExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
