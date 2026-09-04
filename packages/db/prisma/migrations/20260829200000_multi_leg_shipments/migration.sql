-- CreateEnum
CREATE TYPE "LegMode" AS ENUM ('OCEAN', 'AIR', 'RAIL', 'TRUCK', 'BARGE', 'COURIER');

-- CreateEnum
CREATE TYPE "LegType" AS ENUM ('EXPORT_HAULAGE', 'MAIN_CARRIAGE', 'TRANSSHIPMENT', 'IMPORT_HAULAGE', 'ON_CARRIAGE');

-- CreateEnum
CREATE TYPE "LegStatus" AS ENUM ('PLANNED', 'BOOKED', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'ARRIVED', 'COMPLETED', 'EXCEPTION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LegDocumentRequirement" AS ENUM ('REQUIRED', 'CONDITIONAL', 'OPTIONAL', 'INFO_ONLY');

-- AlterTable
ALTER TABLE "ShipmentStop" ADD COLUMN     "role" TEXT;

-- AlterTable
ALTER TABLE "TrackingEvent" ADD COLUMN     "legId" TEXT;

-- AlterTable
ALTER TABLE "EtaObservation" ADD COLUMN     "legId" TEXT;

-- CreateTable
CREATE TABLE "ShipmentLeg" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "legType" "LegType" NOT NULL,
    "mode" "LegMode" NOT NULL,
    "originStopId" TEXT NOT NULL,
    "destinationStopId" TEXT NOT NULL,
    "carrierName" TEXT,
    "carrierScac" TEXT,
    "carrierPartyId" TEXT,
    "vesselName" TEXT,
    "imoNumber" TEXT,
    "voyageNumber" TEXT,
    "flightNumber" TEXT,
    "trainNumber" TEXT,
    "tripNumber" TEXT,
    "billOfLadingNumber" TEXT,
    "billOfLadingType" TEXT,
    "bookingNumber" TEXT,
    "plannedDeparture" TIMESTAMP(3),
    "estimatedDeparture" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "plannedArrival" TIMESTAMP(3),
    "estimatedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "status" "LegStatus" NOT NULL DEFAULT 'PLANNED',
    "statusReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'INFERRED',
    "inferredFromRunId" TEXT,
    "confidence" DOUBLE PRECISION,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentLegDocument" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "legId" TEXT NOT NULL,
    "documentId" TEXT,
    "slotKey" TEXT NOT NULL,
    "slotLabel" TEXT NOT NULL,
    "expectedDocType" "DocumentType" NOT NULL,
    "requirement" "LegDocumentRequirement" NOT NULL DEFAULT 'REQUIRED',
    "requirementReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'INFERRED',
    "inferredFromRunId" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentLegDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegInferenceRun" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "inputsHash" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'rules-v1',
    "overallConfidence" DOUBLE PRECISION NOT NULL,
    "legCount" INTEGER NOT NULL,
    "proposal" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "appliedAt" TIMESTAMP(3),
    "appliedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegInferenceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentLegEquipment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "legId" TEXT,
    "equipmentType" TEXT NOT NULL,
    "equipmentNumber" TEXT NOT NULL,
    "sealNumber" TEXT,
    "tareWeightKg" DECIMAL(10,2),
    "grossWeightKg" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentLegEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentLeg_accountId_shipmentId_idx" ON "ShipmentLeg"("accountId", "shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentLeg_shipmentId_status_idx" ON "ShipmentLeg"("shipmentId", "status");

-- CreateIndex
CREATE INDEX "ShipmentLeg_mode_status_idx" ON "ShipmentLeg"("mode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentLeg_shipmentId_sequence_key" ON "ShipmentLeg"("shipmentId", "sequence");

-- CreateIndex
CREATE INDEX "ShipmentLegDocument_accountId_legId_idx" ON "ShipmentLegDocument"("accountId", "legId");

-- CreateIndex
CREATE INDEX "ShipmentLegDocument_documentId_idx" ON "ShipmentLegDocument"("documentId");

-- CreateIndex
CREATE INDEX "ShipmentLegDocument_inferredFromRunId_idx" ON "ShipmentLegDocument"("inferredFromRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentLegDocument_legId_slotKey_key" ON "ShipmentLegDocument"("legId", "slotKey");

-- CreateIndex
CREATE INDEX "LegInferenceRun_accountId_shipmentId_idx" ON "LegInferenceRun"("accountId", "shipmentId");

-- CreateIndex
CREATE INDEX "LegInferenceRun_shipmentId_status_idx" ON "LegInferenceRun"("shipmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LegInferenceRun_shipmentId_inputsHash_key" ON "LegInferenceRun"("shipmentId", "inputsHash");

-- CreateIndex
CREATE INDEX "ShipmentLegEquipment_accountId_shipmentId_idx" ON "ShipmentLegEquipment"("accountId", "shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentLegEquipment_legId_idx" ON "ShipmentLegEquipment"("legId");

-- CreateIndex
CREATE INDEX "TrackingEvent_legId_idx" ON "TrackingEvent"("legId");

-- CreateIndex
CREATE INDEX "EtaObservation_legId_idx" ON "EtaObservation"("legId");

-- AddForeignKey
ALTER TABLE "ShipmentLeg" ADD CONSTRAINT "ShipmentLeg_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLeg" ADD CONSTRAINT "ShipmentLeg_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLeg" ADD CONSTRAINT "ShipmentLeg_originStopId_fkey" FOREIGN KEY ("originStopId") REFERENCES "ShipmentStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLeg" ADD CONSTRAINT "ShipmentLeg_destinationStopId_fkey" FOREIGN KEY ("destinationStopId") REFERENCES "ShipmentStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLeg" ADD CONSTRAINT "ShipmentLeg_carrierPartyId_fkey" FOREIGN KEY ("carrierPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLeg" ADD CONSTRAINT "ShipmentLeg_inferredFromRunId_fkey" FOREIGN KEY ("inferredFromRunId") REFERENCES "LegInferenceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLegDocument" ADD CONSTRAINT "ShipmentLegDocument_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLegDocument" ADD CONSTRAINT "ShipmentLegDocument_legId_fkey" FOREIGN KEY ("legId") REFERENCES "ShipmentLeg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLegDocument" ADD CONSTRAINT "ShipmentLegDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ShipmentDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLegDocument" ADD CONSTRAINT "ShipmentLegDocument_inferredFromRunId_fkey" FOREIGN KEY ("inferredFromRunId") REFERENCES "LegInferenceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegInferenceRun" ADD CONSTRAINT "LegInferenceRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegInferenceRun" ADD CONSTRAINT "LegInferenceRun_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLegEquipment" ADD CONSTRAINT "ShipmentLegEquipment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLegEquipment" ADD CONSTRAINT "ShipmentLegEquipment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLegEquipment" ADD CONSTRAINT "ShipmentLegEquipment_legId_fkey" FOREIGN KEY ("legId") REFERENCES "ShipmentLeg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_legId_fkey" FOREIGN KEY ("legId") REFERENCES "ShipmentLeg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtaObservation" ADD CONSTRAINT "EtaObservation_legId_fkey" FOREIGN KEY ("legId") REFERENCES "ShipmentLeg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

