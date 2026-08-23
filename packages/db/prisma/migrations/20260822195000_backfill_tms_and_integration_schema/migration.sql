-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IntegrationCategory" AS ENUM ('ERP', 'ACCOUNTING', 'SHIPMENT_TRACKING', 'CARRIER_RATING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PROOF_OF_DELIVERY';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CARRIER_INVOICE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PartyRoleType" ADD VALUE IF NOT EXISTS 'WAREHOUSE';
ALTER TYPE "PartyRoleType" ADD VALUE IF NOT EXISTS 'TERMINAL';
ALTER TYPE "PartyRoleType" ADD VALUE IF NOT EXISTS 'DRAYAGE_PROVIDER';

-- DropIndex
DROP INDEX IF EXISTS "AccountMemory_embeddingVector_hnsw_idx";

-- AlterTable
ALTER TABLE "AgentDecision" ALTER COLUMN "shipmentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "actualBuyCost" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "costVariancePct" DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS "customerPromiseDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "demurrageExposureUsd" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "expectedBuyCost" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "grossMarginPct" DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS "grossProfit" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "lastFreeDay" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "promiseState" TEXT,
ADD COLUMN IF NOT EXISTS "sellAmount" DECIMAL(12,2);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IntegrationConfig" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT,
    "category" "IntegrationCategory" NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "baseUrl" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "configJson" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IntegrationPayload" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT,
    "integrationConfigId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT,
    "payloadJson" JSONB NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationPayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TransportationOrder" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT,
    "externalReference" TEXT,
    "customerReference" TEXT,
    "poReferences" JSONB,
    "source" TEXT NOT NULL DEFAULT 'EMAIL',
    "inboundEmailId" TEXT,
    "rawRequestText" TEXT,
    "requestedBy" TEXT,
    "requestedPickupWindow" JSONB,
    "requestedDeliveryWindow" JSONB,
    "requestedPickupDate" TIMESTAMP(3),
    "requestedDeliveryDate" TIMESTAMP(3),
    "incoterm" TEXT,
    "originAddress" JSONB,
    "destinationAddress" JSONB,
    "origin" JSONB,
    "destination" JSONB,
    "commodityDescription" TEXT,
    "cargoSummary" TEXT,
    "weight" DECIMAL(12,2),
    "totalWeight" DECIMAL(12,2),
    "totalVolume" DECIMAL(12,2),
    "packageInfo" JSONB,
    "equipmentRequirements" JSONB,
    "specialRequirements" JSONB,
    "customsRequired" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION,
    "mode" TEXT,
    "serviceLevel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "agentDecisionId" TEXT,
    "shipmentId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CarrierProfile" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "scac" TEXT,
    "dot" TEXT,
    "mc" TEXT,
    "modes" JSONB,
    "equipmentCapabilities" JSONB,
    "insuranceStatus" TEXT DEFAULT 'ACTIVE',
    "safetyStatus" TEXT DEFAULT 'SATISFACTORY',
    "approvedStatus" TEXT DEFAULT 'APPROVED',
    "preferredStatus" BOOLEAN NOT NULL DEFAULT false,
    "serviceAreas" JSONB,
    "trackingCapabilities" JSONB,
    "performanceMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Movement" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "carrierPartyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "equipment" TEXT,
    "vessel" TEXT,
    "voyage" TEXT,
    "flight" TEXT,
    "train" TEXT,
    "truckIdentifiers" TEXT,
    "bookingNumber" TEXT,
    "masterBillNumber" TEXT,
    "houseBillNumber" TEXT,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "currentETA" TIMESTAMP(3),
    "trackingProvider" TEXT,
    "trackingReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ShipmentMovement" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "relationshipType" TEXT NOT NULL DEFAULT 'DIRECT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MovementStop" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "partyId" TEXT,
    "siteId" TEXT,
    "locationName" TEXT,
    "address" JSONB,
    "unlocode" TEXT,
    "appointmentStart" TIMESTAMP(3),
    "appointmentEnd" TIMESTAMP(3),
    "plannedArrival" TIMESTAMP(3),
    "plannedDeparture" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovementStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TransportationEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "movementId" TEXT,
    "transportationOrderId" TEXT,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" JSONB,
    "payload" JSONB,
    "confidence" DOUBLE PRECISION,
    "correlationId" TEXT,
    "causationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Carrier" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "scac" TEXT,
    "mcNumber" TEXT,
    "dotNumber" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "insuranceOnFile" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CarrierRate" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "carrierPartyId" TEXT,
    "carrierName" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'OCEAN',
    "origin" JSONB NOT NULL,
    "destination" JSONB NOT NULL,
    "equipment" TEXT NOT NULL DEFAULT '40HC',
    "baseRate" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "minimums" DECIMAL(12,2),
    "surcharges" JSONB,
    "accessorials" JSONB,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "contractReference" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FreightQuote" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transportationOrderId" TEXT,
    "shipmentId" TEXT,
    "clientId" TEXT,
    "carrierId" TEXT,
    "carrierPartyId" TEXT,
    "carrierName" TEXT,
    "mode" TEXT DEFAULT 'OCEAN',
    "laneOrigin" JSONB,
    "laneDestination" JSONB,
    "equipment" TEXT,
    "buyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "markupPercentage" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "sellAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "margin" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "transitDays" INTEGER,
    "validUntil" TIMESTAMP(3),
    "surcharges" JSONB,
    "accessorials" JSONB,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "providerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "approvalState" TEXT NOT NULL DEFAULT 'AUTO_APPROVED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "agentDecisionId" TEXT,
    "rawProviderResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreightQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Tender" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "carrierId" TEXT,
    "freightQuoteId" TEXT,
    "status" TEXT NOT NULL,
    "history" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "sentByUserId" TEXT,
    "agentDecisionId" TEXT,
    "idempotencyKey" TEXT,
    "cascadeAttempt" INTEGER NOT NULL DEFAULT 0,
    "dispatchProvider" TEXT,
    "providerReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProofOfDelivery" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "receivedByName" TEXT,
    "exceptionNoted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProofOfDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CarrierInvoice" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "carrierId" TEXT,
    "documentId" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "matchStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CarrierInvoiceLine" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "carrierInvoiceId" TEXT NOT NULL,
    "chargeType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,

    CONSTRAINT "CarrierInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationConfig_accountId_category_idx" ON "IntegrationConfig"("accountId", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationConfig_accountId_clientId_idx" ON "IntegrationConfig"("accountId", "clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationPayload_accountId_provider_idx" ON "IntegrationPayload"("accountId", "provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationPayload_accountId_clientId_idx" ON "IntegrationPayload"("accountId", "clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationPayload_integrationConfigId_fetchedAt_idx" ON "IntegrationPayload"("integrationConfigId", "fetchedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransportationOrder_accountId_idx" ON "TransportationOrder"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransportationOrder_clientId_idx" ON "TransportationOrder"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransportationOrder_status_idx" ON "TransportationOrder"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransportationOrder_inboundEmailId_idx" ON "TransportationOrder"("inboundEmailId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransportationOrder_shipmentId_idx" ON "TransportationOrder"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CarrierProfile_partyId_key" ON "CarrierProfile"("partyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarrierProfile_accountId_idx" ON "CarrierProfile"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarrierProfile_scac_idx" ON "CarrierProfile"("scac");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarrierProfile_dot_idx" ON "CarrierProfile"("dot");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarrierProfile_mc_idx" ON "CarrierProfile"("mc");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Movement_accountId_idx" ON "Movement"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Movement_mode_status_idx" ON "Movement"("mode", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Movement_carrierPartyId_idx" ON "Movement"("carrierPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Movement_bookingNumber_idx" ON "Movement"("bookingNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Movement_masterBillNumber_idx" ON "Movement"("masterBillNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShipmentMovement_accountId_shipmentId_idx" ON "ShipmentMovement"("accountId", "shipmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShipmentMovement_accountId_movementId_idx" ON "ShipmentMovement"("accountId", "movementId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ShipmentMovement_shipmentId_movementId_key" ON "ShipmentMovement"("shipmentId", "movementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MovementStop_accountId_movementId_sequence_idx" ON "MovementStop"("accountId", "movementId", "sequence");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MovementStop_movementId_sequence_idx" ON "MovementStop"("movementId", "sequence");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MovementStop_unlocode_idx" ON "MovementStop"("unlocode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MovementStop_partyId_idx" ON "MovementStop"("partyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransportationEvent_accountId_entityType_entityId_idx" ON "TransportationEvent"("accountId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransportationEvent_accountId_shipmentId_occurredAt_idx" ON "TransportationEvent"("accountId", "shipmentId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransportationEvent_accountId_movementId_occurredAt_idx" ON "TransportationEvent"("accountId", "movementId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransportationEvent_accountId_eventType_idx" ON "TransportationEvent"("accountId", "eventType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransportationEvent_occurredAt_idx" ON "TransportationEvent"("occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarrierRate_accountId_idx" ON "CarrierRate"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarrierRate_mode_equipment_idx" ON "CarrierRate"("mode", "equipment");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarrierRate_carrierPartyId_idx" ON "CarrierRate"("carrierPartyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FreightQuote_accountId_idx" ON "FreightQuote"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FreightQuote_transportationOrderId_idx" ON "FreightQuote"("transportationOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FreightQuote_shipmentId_idx" ON "FreightQuote"("shipmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FreightQuote_carrierId_idx" ON "FreightQuote"("carrierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FreightQuote_status_idx" ON "FreightQuote"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FreightQuote_approvalState_idx" ON "FreightQuote"("approvalState");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tender_accountId_idx" ON "Tender"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tender_shipmentId_idx" ON "Tender"("shipmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tender_freightQuoteId_idx" ON "Tender"("freightQuoteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tender_carrierId_idx" ON "Tender"("carrierId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tender_accountId_idempotencyKey_key" ON "Tender"("accountId", "idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarrierInvoiceLine_accountId_idx" ON "CarrierInvoiceLine"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shipment_promiseState_idx" ON "Shipment"("promiseState");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shipment_lastFreeDay_idx" ON "Shipment"("lastFreeDay");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shipment_healthStatus_idx" ON "Shipment"("healthStatus");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IntegrationConfig" ADD CONSTRAINT "IntegrationConfig_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IntegrationConfig" ADD CONSTRAINT "IntegrationConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IntegrationPayload" ADD CONSTRAINT "IntegrationPayload_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IntegrationPayload" ADD CONSTRAINT "IntegrationPayload_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IntegrationPayload" ADD CONSTRAINT "IntegrationPayload_integrationConfigId_fkey" FOREIGN KEY ("integrationConfigId") REFERENCES "IntegrationConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TransportationOrder" ADD CONSTRAINT "TransportationOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TransportationOrder" ADD CONSTRAINT "TransportationOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TransportationOrder" ADD CONSTRAINT "TransportationOrder_inboundEmailId_fkey" FOREIGN KEY ("inboundEmailId") REFERENCES "InboundEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TransportationOrder" ADD CONSTRAINT "TransportationOrder_agentDecisionId_fkey" FOREIGN KEY ("agentDecisionId") REFERENCES "AgentDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TransportationOrder" ADD CONSTRAINT "TransportationOrder_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TransportationOrder" ADD CONSTRAINT "TransportationOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CarrierProfile" ADD CONSTRAINT "CarrierProfile_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CarrierProfile" ADD CONSTRAINT "CarrierProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Movement" ADD CONSTRAINT "Movement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Movement" ADD CONSTRAINT "Movement_carrierPartyId_fkey" FOREIGN KEY ("carrierPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ShipmentMovement" ADD CONSTRAINT "ShipmentMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ShipmentMovement" ADD CONSTRAINT "ShipmentMovement_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ShipmentMovement" ADD CONSTRAINT "ShipmentMovement_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MovementStop" ADD CONSTRAINT "MovementStop_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MovementStop" ADD CONSTRAINT "MovementStop_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MovementStop" ADD CONSTRAINT "MovementStop_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TransportationEvent" ADD CONSTRAINT "TransportationEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TransportationEvent" ADD CONSTRAINT "TransportationEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TransportationEvent" ADD CONSTRAINT "TransportationEvent_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TransportationEvent" ADD CONSTRAINT "TransportationEvent_transportationOrderId_fkey" FOREIGN KEY ("transportationOrderId") REFERENCES "TransportationOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Carrier" ADD CONSTRAINT "Carrier_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CarrierRate" ADD CONSTRAINT "CarrierRate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CarrierRate" ADD CONSTRAINT "CarrierRate_carrierPartyId_fkey" FOREIGN KEY ("carrierPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_transportationOrderId_fkey" FOREIGN KEY ("transportationOrderId") REFERENCES "TransportationOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_carrierPartyId_fkey" FOREIGN KEY ("carrierPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_agentDecisionId_fkey" FOREIGN KEY ("agentDecisionId") REFERENCES "AgentDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Tender" ADD CONSTRAINT "Tender_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Tender" ADD CONSTRAINT "Tender_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Tender" ADD CONSTRAINT "Tender_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Tender" ADD CONSTRAINT "Tender_freightQuoteId_fkey" FOREIGN KEY ("freightQuoteId") REFERENCES "FreightQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CarrierInvoice" ADD CONSTRAINT "CarrierInvoice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CarrierInvoice" ADD CONSTRAINT "CarrierInvoice_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CarrierInvoiceLine" ADD CONSTRAINT "CarrierInvoiceLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CarrierInvoiceLine" ADD CONSTRAINT "CarrierInvoiceLine_carrierInvoiceId_fkey" FOREIGN KEY ("carrierInvoiceId") REFERENCES "CarrierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

