-- QuickBooks Online / OAuth 2.0 accounting integration.
-- Extends IntegrationConfig with encrypted OAuth connection state and adds
-- IntegrationSyncLog (sync history) + IntegrationEntityMap (idempotent
-- Qubere <-> provider record mapping).

ALTER TABLE "IntegrationConfig"
  ADD COLUMN IF NOT EXISTS "realmId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerAccountName" TEXT,
  ADD COLUMN IF NOT EXISTS "accessTokenEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "refreshTokenEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scopes" TEXT,
  ADD COLUMN IF NOT EXISTS "connectedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "connectedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "IntegrationConfig_accountId_provider_idx"
  ON "IntegrationConfig"("accountId", "provider");

CREATE TABLE IF NOT EXISTS "IntegrationSyncLog" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "integrationConfigId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "qubereId" TEXT,
    "providerId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "requestJson" JSONB,
    "responseJson" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IntegrationSyncLog_accountId_provider_createdAt_idx"
  ON "IntegrationSyncLog"("accountId", "provider", "createdAt");
CREATE INDEX IF NOT EXISTS "IntegrationSyncLog_integrationConfigId_createdAt_idx"
  ON "IntegrationSyncLog"("integrationConfigId", "createdAt");
CREATE INDEX IF NOT EXISTS "IntegrationSyncLog_accountId_entityType_qubereId_idx"
  ON "IntegrationSyncLog"("accountId", "entityType", "qubereId");

CREATE TABLE IF NOT EXISTS "IntegrationEntityMap" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "integrationConfigId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "qubereType" TEXT NOT NULL,
    "qubereId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "syncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationEntityMap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationEntityMap_provider_realmId_qubereType_qubereId_key"
  ON "IntegrationEntityMap"("provider", "realmId", "qubereType", "qubereId");
CREATE INDEX IF NOT EXISTS "IntegrationEntityMap_accountId_provider_idx"
  ON "IntegrationEntityMap"("accountId", "provider");
CREATE INDEX IF NOT EXISTS "IntegrationEntityMap_integrationConfigId_idx"
  ON "IntegrationEntityMap"("integrationConfigId");

DO $$ BEGIN
  ALTER TABLE "IntegrationSyncLog"
    ADD CONSTRAINT "IntegrationSyncLog_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "IntegrationSyncLog"
    ADD CONSTRAINT "IntegrationSyncLog_integrationConfigId_fkey"
    FOREIGN KEY ("integrationConfigId") REFERENCES "IntegrationConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "IntegrationEntityMap"
    ADD CONSTRAINT "IntegrationEntityMap_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "IntegrationEntityMap"
    ADD CONSTRAINT "IntegrationEntityMap_integrationConfigId_fkey"
    FOREIGN KEY ("integrationConfigId") REFERENCES "IntegrationConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
