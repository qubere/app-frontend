-- Tracking provider catalog and tenant connection configuration.
-- Executable adapter code stays versioned; provider selection, event mapping,
-- health, and Secret Manager references are database-managed.

CREATE TYPE "TrackingProviderStatus" AS ENUM ('ACTIVE', 'PREVIEW', 'DEPRECATED', 'DISABLED');
CREATE TYPE "TrackingProviderAuthType" AS ENUM ('NONE', 'API_KEY', 'BEARER', 'HMAC', 'OAUTH2', 'BASIC', 'CUSTOM');
CREATE TYPE "TrackingProviderMatchType" AS ENUM ('EXACT', 'PREFIX', 'CONTAINS', 'FALLBACK');

CREATE TABLE "TrackingProviderDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "status" "TrackingProviderStatus" NOT NULL DEFAULT 'PREVIEW',
    "authType" "TrackingProviderAuthType" NOT NULL DEFAULT 'API_KEY',
    "supportedModes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "configSchema" JSONB,
    "documentationUrl" TEXT,
    "operationalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingProviderDefinition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "IntegrationConfig"
    ADD COLUMN "trackingProviderDefinitionId" TEXT,
    ADD COLUMN "connectionKey" TEXT,
    ADD COLUMN "credentialRef" TEXT,
    ADD COLUMN "webhookSecretRef" TEXT,
    ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "lastEventAt" TIMESTAMP(3),
    ADD COLUMN "lastHealthCheckAt" TIMESTAMP(3);

ALTER TABLE "TrackingSubscription" ADD COLUMN "integrationConfigId" TEXT;

-- Existing tracking connections need a routable but non-secret callback key.
-- md5() is built into PostgreSQL; entropy comes from two independent random
-- values plus the existing row id and migration timestamp.
UPDATE "IntegrationConfig"
SET "connectionKey" = md5("id" || random()::TEXT || clock_timestamp()::TEXT)
    || md5(random()::TEXT || "id" || clock_timestamp()::TEXT)
WHERE "category" = 'SHIPMENT_TRACKING' AND "connectionKey" IS NULL;

CREATE TABLE "TrackingProviderEventMapping" (
    "id" TEXT NOT NULL,
    "providerDefinitionId" TEXT NOT NULL,
    "integrationConfigId" TEXT,
    "matchType" "TrackingProviderMatchType" NOT NULL DEFAULT 'EXACT',
    "rawEventPattern" TEXT NOT NULL,
    "canonicalEventType" TEXT NOT NULL,
    "classifier" "TrackingEventClassifier" NOT NULL,
    "sourceType" "TrackingSourceType" NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingProviderEventMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrackingProviderDefinition_key_key" ON "TrackingProviderDefinition"("key");
CREATE INDEX "TrackingProviderDefinition_status_idx" ON "TrackingProviderDefinition"("status");
CREATE INDEX "TrackingProviderDefinition_adapterKey_idx" ON "TrackingProviderDefinition"("adapterKey");
CREATE UNIQUE INDEX "IntegrationConfig_connectionKey_key" ON "IntegrationConfig"("connectionKey");
CREATE INDEX "IntegrationConfig_accountId_category_status_priority_idx" ON "IntegrationConfig"("accountId", "category", "status", "priority");
CREATE INDEX "IntegrationConfig_trackingProviderDefinitionId_idx" ON "IntegrationConfig"("trackingProviderDefinitionId");
CREATE INDEX "TrackingSubscription_integrationConfigId_idx" ON "TrackingSubscription"("integrationConfigId");
CREATE INDEX "TrackingProviderEventMapping_providerDefinitionId_active_priority_idx" ON "TrackingProviderEventMapping"("providerDefinitionId", "active", "priority");
CREATE INDEX "TrackingProviderEventMapping_integrationConfigId_active_priority_idx" ON "TrackingProviderEventMapping"("integrationConfigId", "active", "priority");

ALTER TABLE "IntegrationConfig" ADD CONSTRAINT "IntegrationConfig_trackingProviderDefinitionId_fkey"
    FOREIGN KEY ("trackingProviderDefinitionId") REFERENCES "TrackingProviderDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackingSubscription" ADD CONSTRAINT "TrackingSubscription_integrationConfigId_fkey"
    FOREIGN KEY ("integrationConfigId") REFERENCES "IntegrationConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackingProviderEventMapping" ADD CONSTRAINT "TrackingProviderEventMapping_providerDefinitionId_fkey"
    FOREIGN KEY ("providerDefinitionId") REFERENCES "TrackingProviderDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingProviderEventMapping" ADD CONSTRAINT "TrackingProviderEventMapping_integrationConfigId_fkey"
    FOREIGN KEY ("integrationConfigId") REFERENCES "IntegrationConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The current carrier webhook becomes a real adapter-backed provider. The
-- keyword behavior previously hard-coded in trackingProviderService.ts is now
-- editable reference data with an explicit fallback.
INSERT INTO "TrackingProviderDefinition" (
    "id", "key", "displayName", "adapterKey", "status", "authType",
    "supportedModes", "capabilities", "configSchema", "operationalNotes", "updatedAt"
) VALUES (
    'tpd_generic_webhook',
    'GENERIC_WEBHOOK',
    'Generic carrier webhook',
    'GENERIC_WEBHOOK_V1',
    'ACTIVE',
    'HMAC',
    ARRAY['OCEAN', 'AIR', 'RAIL', 'TRUCK', 'PARCEL'],
    ARRAY['PUSH_EVENTS', 'ETA'],
    '{"type":"object","additionalProperties":true}'::jsonb,
    'Canonical-compatible inbound webhook retained as the first production adapter.',
    CURRENT_TIMESTAMP
);

INSERT INTO "TrackingProviderEventMapping" (
    "id", "providerDefinitionId", "matchType", "rawEventPattern",
    "canonicalEventType", "classifier", "sourceType", "description", "priority", "updatedAt"
) VALUES
    ('tpem_generic_delivered', 'tpd_generic_webhook', 'CONTAINS', 'DELIVER', 'DELIVERED', 'ACTUAL', 'CARRIER', 'Delivery or POD confirmed', 10, CURRENT_TIMESTAMP),
    ('tpem_generic_pod', 'tpd_generic_webhook', 'CONTAINS', 'POD', 'DELIVERED', 'ACTUAL', 'CARRIER', 'Proof of delivery milestone', 11, CURRENT_TIMESTAMP),
    ('tpem_generic_discharged', 'tpd_generic_webhook', 'CONTAINS', 'DISCHARGE', 'CONTAINER_DISCHARGED', 'ACTUAL', 'CARRIER', 'Container discharged', 20, CURRENT_TIMESTAMP),
    ('tpem_generic_unloaded', 'tpd_generic_webhook', 'CONTAINS', 'UNLOAD', 'CONTAINER_DISCHARGED', 'ACTUAL', 'CARRIER', 'Container or cargo unloaded', 21, CURRENT_TIMESTAMP),
    ('tpem_generic_gate_out', 'tpd_generic_webhook', 'CONTAINS', 'GATE_OUT', 'GATE_OUT_PORT', 'ACTUAL', 'TERMINAL', 'Equipment gated out', 30, CURRENT_TIMESTAMP),
    ('tpem_generic_out_port', 'tpd_generic_webhook', 'CONTAINS', 'OUT_PORT', 'GATE_OUT_PORT', 'ACTUAL', 'TERMINAL', 'Equipment departed terminal', 31, CURRENT_TIMESTAMP),
    ('tpem_generic_departed', 'tpd_generic_webhook', 'CONTAINS', 'DEPART', 'VESSEL_DEPARTED', 'ACTUAL', 'CARRIER', 'Conveyance departed', 40, CURRENT_TIMESTAMP),
    ('tpem_generic_arrived', 'tpd_generic_webhook', 'CONTAINS', 'ARRIV', 'PORT_ARRIVED', 'ACTUAL', 'CARRIER', 'Conveyance arrived', 50, CURRENT_TIMESTAMP),
    ('tpem_generic_fallback', 'tpd_generic_webhook', 'FALLBACK', '*', 'TRACKING_UPDATE', 'ACTUAL', 'PROVIDER', 'Unclassified provider update', 1000, CURRENT_TIMESTAMP);

UPDATE "IntegrationConfig"
SET "trackingProviderDefinitionId" = 'tpd_generic_webhook'
WHERE "category" = 'SHIPMENT_TRACKING'
  AND "provider" IN ('CARRIER_WEBHOOK', 'GENERIC_WEBHOOK', 'MANUAL_UPDATE')
  AND "trackingProviderDefinitionId" IS NULL;
