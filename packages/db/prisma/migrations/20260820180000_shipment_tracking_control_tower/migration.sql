-- CreateEnum
CREATE TYPE "TrackingIdentifierType" AS ENUM ('MBL', 'HBL', 'BOOKING', 'CONTAINER', 'MAWB', 'HAWB', 'PRO', 'TRACKING');

-- CreateEnum
CREATE TYPE "TrackingTransportMode" AS ENUM ('OCEAN', 'AIR', 'RAIL', 'TRUCK', 'PARCEL');

-- CreateEnum
CREATE TYPE "TrackingEventClassifier" AS ENUM ('PLANNED', 'ESTIMATED', 'ACTUAL');

-- CreateEnum
CREATE TYPE "TrackingSourceType" AS ENUM ('PROVIDER', 'CARRIER', 'TERMINAL', 'PORT', 'AIS', 'USER', 'SYSTEM', 'CBP', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "TrackingSubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'FAILED', 'ENDED');

-- CreateTable
CREATE TABLE "ShipmentTrackingIdentifier" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" "TrackingIdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "issuer" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShipmentTrackingIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportLeg" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "mode" "TrackingTransportMode" NOT NULL,
    "carrierCode" TEXT,
    "carrierName" TEXT,
    "vesselName" TEXT,
    "imoNumber" TEXT,
    "voyageNumber" TEXT,
    "flightNumber" TEXT,
    "originName" TEXT,
    "originUnlocode" TEXT,
    "destinationName" TEXT,
    "destinationUnlocode" TEXT,
    "plannedDeparture" TIMESTAMP(3),
    "estimatedDeparture" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "plannedArrival" TIMESTAMP(3),
    "estimatedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransportLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentStop" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "transportLegId" TEXT,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unlocode" TEXT,
    "firmsCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "plannedArrival" TIMESTAMP(3),
    "estimatedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "plannedDeparture" TIMESTAMP(3),
    "estimatedDeparture" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShipmentStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEquipment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "containerNumber" TEXT,
    "isoEquipmentCode" TEXT,
    "sealNumbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "currentLocationName" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShipmentEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "transportLegId" TEXT,
    "shipmentStopId" TEXT,
    "equipmentId" TEXT,
    "eventType" TEXT NOT NULL,
    "classifier" "TrackingEventClassifier" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUpdatedAt" TIMESTAMP(3),
    "locationName" TEXT,
    "unlocode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT,
    "sourceType" "TrackingSourceType" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "isInferred" BOOLEAN NOT NULL DEFAULT false,
    "isCorrection" BOOLEAN NOT NULL DEFAULT false,
    "supersedesEventId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "rawPayloadHash" TEXT,
    "rawPayloadRef" TEXT,
    "normalizedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtaObservation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "transportLegId" TEXT,
    "shipmentStopId" TEXT,
    "estimatedAt" TIMESTAMP(3) NOT NULL,
    "eta" TIMESTAMP(3) NOT NULL,
    "previousEta" TIMESTAMP(3),
    "deltaMinutes" INTEGER,
    "provider" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reasonCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EtaObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingSubscription" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTrackingId" TEXT,
    "status" "TrackingSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "nextPollAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentTrackingIdentifier_shipmentId_type_value_issuer_key" ON "ShipmentTrackingIdentifier"("shipmentId", "type", "value", "issuer");
CREATE INDEX "ShipmentTrackingIdentifier_accountId_type_value_idx" ON "ShipmentTrackingIdentifier"("accountId", "type", "value");
CREATE INDEX "ShipmentTrackingIdentifier_shipmentId_type_idx" ON "ShipmentTrackingIdentifier"("shipmentId", "type");
CREATE INDEX "ShipmentTrackingIdentifier_accountId_shipmentId_idx" ON "ShipmentTrackingIdentifier"("accountId", "shipmentId");
CREATE UNIQUE INDEX "TransportLeg_shipmentId_sequence_key" ON "TransportLeg"("shipmentId", "sequence");
CREATE INDEX "TransportLeg_accountId_shipmentId_idx" ON "TransportLeg"("accountId", "shipmentId");
CREATE INDEX "TransportLeg_mode_status_idx" ON "TransportLeg"("mode", "status");
CREATE UNIQUE INDEX "ShipmentStop_shipmentId_sequence_key" ON "ShipmentStop"("shipmentId", "sequence");
CREATE INDEX "ShipmentStop_accountId_shipmentId_idx" ON "ShipmentStop"("accountId", "shipmentId");
CREATE INDEX "ShipmentStop_transportLegId_idx" ON "ShipmentStop"("transportLegId");
CREATE INDEX "ShipmentStop_unlocode_idx" ON "ShipmentStop"("unlocode");
CREATE UNIQUE INDEX "ShipmentEquipment_shipmentId_containerNumber_key" ON "ShipmentEquipment"("shipmentId", "containerNumber");
CREATE INDEX "ShipmentEquipment_accountId_containerNumber_idx" ON "ShipmentEquipment"("accountId", "containerNumber");
CREATE INDEX "ShipmentEquipment_shipmentId_idx" ON "ShipmentEquipment"("shipmentId");
CREATE INDEX "ShipmentEquipment_accountId_shipmentId_idx" ON "ShipmentEquipment"("accountId", "shipmentId");
CREATE UNIQUE INDEX "TrackingEvent_accountId_provider_providerEventId_key" ON "TrackingEvent"("accountId", "provider", "providerEventId");
CREATE UNIQUE INDEX "TrackingEvent_accountId_idempotencyKey_key" ON "TrackingEvent"("accountId", "idempotencyKey");
CREATE INDEX "TrackingEvent_shipmentId_occurredAt_idx" ON "TrackingEvent"("shipmentId", "occurredAt");
CREATE INDEX "TrackingEvent_accountId_shipmentId_occurredAt_idx" ON "TrackingEvent"("accountId", "shipmentId", "occurredAt");
CREATE INDEX "TrackingEvent_transportLegId_idx" ON "TrackingEvent"("transportLegId");
CREATE INDEX "TrackingEvent_shipmentStopId_idx" ON "TrackingEvent"("shipmentStopId");
CREATE INDEX "TrackingEvent_equipmentId_idx" ON "TrackingEvent"("equipmentId");
CREATE INDEX "TrackingEvent_supersedesEventId_idx" ON "TrackingEvent"("supersedesEventId");
CREATE INDEX "TrackingEvent_eventType_classifier_idx" ON "TrackingEvent"("eventType", "classifier");
CREATE INDEX "EtaObservation_shipmentId_estimatedAt_idx" ON "EtaObservation"("shipmentId", "estimatedAt");
CREATE INDEX "EtaObservation_accountId_shipmentId_estimatedAt_idx" ON "EtaObservation"("accountId", "shipmentId", "estimatedAt");
CREATE INDEX "EtaObservation_transportLegId_idx" ON "EtaObservation"("transportLegId");
CREATE INDEX "EtaObservation_shipmentStopId_idx" ON "EtaObservation"("shipmentStopId");
CREATE UNIQUE INDEX "TrackingSubscription_accountId_shipmentId_provider_key" ON "TrackingSubscription"("accountId", "shipmentId", "provider");
CREATE INDEX "TrackingSubscription_status_nextPollAt_idx" ON "TrackingSubscription"("status", "nextPollAt");
CREATE INDEX "TrackingSubscription_shipmentId_idx" ON "TrackingSubscription"("shipmentId");

-- AddForeignKey
ALTER TABLE "ShipmentTrackingIdentifier" ADD CONSTRAINT "ShipmentTrackingIdentifier_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentTrackingIdentifier" ADD CONSTRAINT "ShipmentTrackingIdentifier_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportLeg" ADD CONSTRAINT "TransportLeg_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportLeg" ADD CONSTRAINT "TransportLeg_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentStop" ADD CONSTRAINT "ShipmentStop_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentStop" ADD CONSTRAINT "ShipmentStop_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentStop" ADD CONSTRAINT "ShipmentStop_transportLegId_fkey" FOREIGN KEY ("transportLegId") REFERENCES "TransportLeg"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShipmentEquipment" ADD CONSTRAINT "ShipmentEquipment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentEquipment" ADD CONSTRAINT "ShipmentEquipment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_transportLegId_fkey" FOREIGN KEY ("transportLegId") REFERENCES "TransportLeg"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_shipmentStopId_fkey" FOREIGN KEY ("shipmentStopId") REFERENCES "ShipmentStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "ShipmentEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_supersedesEventId_fkey" FOREIGN KEY ("supersedesEventId") REFERENCES "TrackingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EtaObservation" ADD CONSTRAINT "EtaObservation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EtaObservation" ADD CONSTRAINT "EtaObservation_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EtaObservation" ADD CONSTRAINT "EtaObservation_transportLegId_fkey" FOREIGN KEY ("transportLegId") REFERENCES "TransportLeg"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EtaObservation" ADD CONSTRAINT "EtaObservation_shipmentStopId_fkey" FOREIGN KEY ("shipmentStopId") REFERENCES "ShipmentStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackingSubscription" ADD CONSTRAINT "TrackingSubscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingSubscription" ADD CONSTRAINT "TrackingSubscription_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
