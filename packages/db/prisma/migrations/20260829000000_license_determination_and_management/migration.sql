-- License Determination & License Management: additive models only.
-- Reuses Country/CommerceControlList reference data and Product/
-- ProductClassification/Party for classification and party linkage --
-- no existing table is renamed, dropped, or repurposed.

-- CreateEnum
CREATE TYPE "LicenseDeterminationStatus" AS ENUM ('LICENSE_REQUIRED', 'NO_LICENSE_REQUIRED', 'LICENSE_EXCEPTION_APPLIES', 'REVIEW_REQUIRED', 'INCOMPLETE', 'INVALID_CLASSIFICATION', 'UNSUPPORTED_JURISDICTION', 'RULE_DATA_UNAVAILABLE', 'BLOCKED', 'ERROR');

-- CreateEnum
CREATE TYPE "LicenseOperationType" AS ENUM ('EXPORT', 'IMPORT');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LicenseEventType" AS ENUM ('ORDER_COMMITMENT', 'SHIPMENT', 'ASSIGNMENT', 'RELEASE', 'REVERSAL', 'RENEWAL', 'EXPIRATION', 'UPDATE', 'OPENING_BALANCE');

-- AlterEnum
ALTER TYPE "ComplianceExecutionType" ADD VALUE 'IMPORT_CONTROL_DETERMINATION';

-- CreateTable
CREATE TABLE "LicenseDeterminationResult" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "complianceExecutionId" TEXT,
    "shipmentId" TEXT,
    "lineItemId" TEXT,
    "productId" TEXT,
    "transactionId" TEXT,
    "transactionLineId" TEXT,
    "operationType" "LicenseOperationType" NOT NULL DEFAULT 'EXPORT',
    "complianceCountry" TEXT,
    "destinationCountry" TEXT,
    "originCountry" TEXT,
    "status" "LicenseDeterminationStatus" NOT NULL,
    "baseDecision" TEXT,
    "finalDecision" TEXT,
    "exceptionCode" TEXT,
    "exceptionDescription" TEXT,
    "reason" TEXT,
    "conditions" JSONB,
    "missingInputs" JSONB,
    "ruleSource" TEXT,
    "ruleVersion" TEXT,
    "evidence" JSONB,
    "automatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewerDisposition" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "overrideType" TEXT,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseDeterminationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseType" TEXT NOT NULL,
    "agency" TEXT,
    "jurisdiction" TEXT,
    "referenceNumber" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "originalExpirationDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "status" "LicenseStatus" NOT NULL DEFAULT 'DRAFT',
    "purchaserPartyId" TEXT,
    "description" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseLine" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productId" TEXT,
    "productDescription" TEXT,
    "classificationType" TEXT,
    "classificationNumber" TEXT,
    "licensedQuantity" DECIMAL(18,4),
    "licensedValue" DECIMAL(18,2),
    "uom" TEXT,
    "currency" TEXT,
    "committedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "committedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shippedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "shippedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "adjustedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "adjustedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "replacementIndicator" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseParty" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "lineId" TEXT,
    "partyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseDocument" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "extractedFields" JSONB,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "licenseLineId" TEXT NOT NULL,
    "eventType" "LicenseEventType" NOT NULL,
    "quantityDelta" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "valueDelta" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sourceSystem" TEXT,
    "sourceEventId" TEXT,
    "transactionId" TEXT,
    "transactionLineId" TEXT,
    "shipmentId" TEXT,
    "reason" TEXT,
    "postedByUserId" TEXT,
    "quantityAfter" DECIMAL(18,4),
    "valueAfter" DECIMAL(18,2),
    "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseAdjustment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "licenseLineId" TEXT NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "quantityDelta" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "valueDelta" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "relatedEventId" TEXT,
    "quantityBefore" DECIMAL(18,4),
    "quantityAfter" DECIMAL(18,4),
    "valueBefore" DECIMAL(18,2),
    "valueAfter" DECIMAL(18,2),
    "postedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseNote" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseAllocation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "licenseLineId" TEXT NOT NULL,
    "determinationId" TEXT,
    "shipmentId" TEXT,
    "lineItemId" TEXT,
    "quantity" DECIMAL(18,4),
    "value" DECIMAL(18,2),
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "reservedByUserId" TEXT,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "evidence" JSONB,

    CONSTRAINT "LicenseAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountLicenseConfig" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "licenseDeterminationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "importControlDeterminationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "genericExportLicenseDeterminationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "licenseManagementEnabled" BOOLEAN NOT NULL DEFAULT true,
    "licenseExpiryLeadDays" INTEGER NOT NULL DEFAULT 90,
    "remainingQuantityThresholdPct" INTEGER NOT NULL DEFAULT 20,
    "remainingValueThresholdPct" INTEGER NOT NULL DEFAULT 20,
    "committedButUnshippedQuantityThresholdPct" INTEGER NOT NULL DEFAULT 50,
    "committedButUnshippedValueThresholdPct" INTEGER NOT NULL DEFAULT 50,
    "licenseAlertRecipients" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountLicenseConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LicenseDeterminationResult_accountId_automatedAt_idx" ON "LicenseDeterminationResult"("accountId", "automatedAt");
CREATE INDEX "LicenseDeterminationResult_shipmentId_idx" ON "LicenseDeterminationResult"("shipmentId");
CREATE INDEX "LicenseDeterminationResult_lineItemId_idx" ON "LicenseDeterminationResult"("lineItemId");

-- CreateIndex
CREATE UNIQUE INDEX "License_accountId_licenseNumber_key" ON "License"("accountId", "licenseNumber");
CREATE INDEX "License_accountId_status_idx" ON "License"("accountId", "status");
CREATE INDEX "License_accountId_expirationDate_idx" ON "License"("accountId", "expirationDate");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseLine_licenseId_lineNumber_key" ON "LicenseLine"("licenseId", "lineNumber");
CREATE INDEX "LicenseLine_accountId_idx" ON "LicenseLine"("accountId");
CREATE INDEX "LicenseLine_productId_idx" ON "LicenseLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseParty_licenseId_lineId_partyId_role_key" ON "LicenseParty"("licenseId", "lineId", "partyId", "role");
CREATE INDEX "LicenseParty_accountId_idx" ON "LicenseParty"("accountId");
CREATE INDEX "LicenseParty_partyId_idx" ON "LicenseParty"("partyId");

-- CreateIndex
CREATE INDEX "LicenseDocument_accountId_idx" ON "LicenseDocument"("accountId");
CREATE INDEX "LicenseDocument_licenseId_idx" ON "LicenseDocument"("licenseId");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseEvent_dedupe_key" ON "LicenseEvent"("accountId", "licenseLineId", "eventType", "transactionId", "transactionLineId");
CREATE INDEX "LicenseEvent_licenseLineId_eventAt_idx" ON "LicenseEvent"("licenseLineId", "eventAt");
CREATE INDEX "LicenseEvent_accountId_idx" ON "LicenseEvent"("accountId");

-- CreateIndex
CREATE INDEX "LicenseAdjustment_licenseLineId_idx" ON "LicenseAdjustment"("licenseLineId");
CREATE INDEX "LicenseAdjustment_accountId_idx" ON "LicenseAdjustment"("accountId");

-- CreateIndex
CREATE INDEX "LicenseNote_licenseId_idx" ON "LicenseNote"("licenseId");
CREATE INDEX "LicenseNote_accountId_idx" ON "LicenseNote"("accountId");

-- CreateIndex
CREATE INDEX "LicenseAllocation_licenseLineId_idx" ON "LicenseAllocation"("licenseLineId");
CREATE INDEX "LicenseAllocation_accountId_idx" ON "LicenseAllocation"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountLicenseConfig_accountId_key" ON "AccountLicenseConfig"("accountId");

-- AddForeignKey
ALTER TABLE "LicenseDeterminationResult" ADD CONSTRAINT "LicenseDeterminationResult_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseDeterminationResult" ADD CONSTRAINT "LicenseDeterminationResult_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LicenseDeterminationResult" ADD CONSTRAINT "LicenseDeterminationResult_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "ShipmentLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LicenseDeterminationResult" ADD CONSTRAINT "LicenseDeterminationResult_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "License" ADD CONSTRAINT "License_purchaserPartyId_fkey" FOREIGN KEY ("purchaserPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseLine" ADD CONSTRAINT "LicenseLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseLine" ADD CONSTRAINT "LicenseLine_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseLine" ADD CONSTRAINT "LicenseLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseParty" ADD CONSTRAINT "LicenseParty_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseParty" ADD CONSTRAINT "LicenseParty_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseParty" ADD CONSTRAINT "LicenseParty_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "LicenseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseParty" ADD CONSTRAINT "LicenseParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseDocument" ADD CONSTRAINT "LicenseDocument_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseDocument" ADD CONSTRAINT "LicenseDocument_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseEvent" ADD CONSTRAINT "LicenseEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseEvent" ADD CONSTRAINT "LicenseEvent_licenseLineId_fkey" FOREIGN KEY ("licenseLineId") REFERENCES "LicenseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseEvent" ADD CONSTRAINT "LicenseEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseAdjustment" ADD CONSTRAINT "LicenseAdjustment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseAdjustment" ADD CONSTRAINT "LicenseAdjustment_licenseLineId_fkey" FOREIGN KEY ("licenseLineId") REFERENCES "LicenseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseAdjustment" ADD CONSTRAINT "LicenseAdjustment_relatedEventId_fkey" FOREIGN KEY ("relatedEventId") REFERENCES "LicenseEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseNote" ADD CONSTRAINT "LicenseNote_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseNote" ADD CONSTRAINT "LicenseNote_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseAllocation" ADD CONSTRAINT "LicenseAllocation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseAllocation" ADD CONSTRAINT "LicenseAllocation_licenseLineId_fkey" FOREIGN KEY ("licenseLineId") REFERENCES "LicenseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseAllocation" ADD CONSTRAINT "LicenseAllocation_determinationId_fkey" FOREIGN KEY ("determinationId") REFERENCES "LicenseDeterminationResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LicenseAllocation" ADD CONSTRAINT "LicenseAllocation_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLicenseConfig" ADD CONSTRAINT "AccountLicenseConfig_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
