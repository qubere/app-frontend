-- AlterTable Shipment
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "customsRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable CustomsFiling
ALTER TABLE "CustomsFiling" ADD COLUMN IF NOT EXISTS "customsCaseId" TEXT;

-- CreateTable AccountProductEntitlement
CREATE TABLE IF NOT EXISTS "AccountProductEntitlement" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    "plan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountProductEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable ShipmentProductWorkspace
CREATE TABLE IF NOT EXISTS "ShipmentProductWorkspace" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentProductWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable CustomsCase
CREATE TABLE IF NOT EXISTS "CustomsCase" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "importerOfRecordId" TEXT,
    "assignedBrokerId" TEXT,
    "entryType" TEXT,
    "customsValue" DECIMAL(12,2),
    "countryOfOrigin" TEXT,
    "destinationCountry" TEXT,
    "copiedFromShipmentId" TEXT,
    "copiedAtVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomsCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable CustomsCaseShipment
CREATE TABLE IF NOT EXISTS "CustomsCaseShipment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "customsCaseId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomsCaseShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable CustomsCaseDocument
CREATE TABLE IF NOT EXISTS "CustomsCaseDocument" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "customsCaseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "documentRole" TEXT,
    "relevanceReason" TEXT,
    "relevanceConfidence" DOUBLE PRECISION,
    "includedAt" TIMESTAMP(3),
    "includedByUserId" TEXT,
    "excludedAt" TIMESTAMP(3),
    "excludedByUserId" TEXT,
    "sourceChecksum" TEXT,
    "documentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomsCaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AccountProductEntitlement_accountId_product_key" ON "AccountProductEntitlement"("accountId", "product");
CREATE INDEX IF NOT EXISTS "AccountProductEntitlement_accountId_product_status_idx" ON "AccountProductEntitlement"("accountId", "product", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "ShipmentProductWorkspace_shipmentId_product_key" ON "ShipmentProductWorkspace"("shipmentId", "product");
CREATE INDEX IF NOT EXISTS "ShipmentProductWorkspace_accountId_product_status_idx" ON "ShipmentProductWorkspace"("accountId", "product", "status");
CREATE INDEX IF NOT EXISTS "ShipmentProductWorkspace_shipmentId_idx" ON "ShipmentProductWorkspace"("shipmentId");

CREATE UNIQUE INDEX IF NOT EXISTS "CustomsCase_accountId_caseNumber_key" ON "CustomsCase"("accountId", "caseNumber");
CREATE INDEX IF NOT EXISTS "CustomsCase_accountId_status_idx" ON "CustomsCase"("accountId", "status");
CREATE INDEX IF NOT EXISTS "CustomsCase_deletedAt_idx" ON "CustomsCase"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CustomsCaseShipment_customsCaseId_shipmentId_key" ON "CustomsCaseShipment"("customsCaseId", "shipmentId");
CREATE INDEX IF NOT EXISTS "CustomsCaseShipment_accountId_idx" ON "CustomsCaseShipment"("accountId");
CREATE INDEX IF NOT EXISTS "CustomsCaseShipment_shipmentId_idx" ON "CustomsCaseShipment"("shipmentId");

CREATE UNIQUE INDEX IF NOT EXISTS "CustomsCaseDocument_customsCaseId_documentId_key" ON "CustomsCaseDocument"("customsCaseId", "documentId");
CREATE INDEX IF NOT EXISTS "CustomsCaseDocument_accountId_idx" ON "CustomsCaseDocument"("accountId");
CREATE INDEX IF NOT EXISTS "CustomsCaseDocument_customsCaseId_status_idx" ON "CustomsCaseDocument"("customsCaseId", "status");

CREATE INDEX IF NOT EXISTS "CustomsFiling_customsCaseId_idx" ON "CustomsFiling"("customsCaseId");

-- AddForeignKey
ALTER TABLE "AccountProductEntitlement" ADD CONSTRAINT "AccountProductEntitlement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShipmentProductWorkspace" ADD CONSTRAINT "ShipmentProductWorkspace_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentProductWorkspace" ADD CONSTRAINT "ShipmentProductWorkspace_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomsCase" ADD CONSTRAINT "CustomsCase_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomsCase" ADD CONSTRAINT "CustomsCase_importerOfRecordId_fkey" FOREIGN KEY ("importerOfRecordId") REFERENCES "ImporterOfRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomsCase" ADD CONSTRAINT "CustomsCase_assignedBrokerId_fkey" FOREIGN KEY ("assignedBrokerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomsCaseShipment" ADD CONSTRAINT "CustomsCaseShipment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomsCaseShipment" ADD CONSTRAINT "CustomsCaseShipment_customsCaseId_fkey" FOREIGN KEY ("customsCaseId") REFERENCES "CustomsCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomsCaseShipment" ADD CONSTRAINT "CustomsCaseShipment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomsCaseDocument" ADD CONSTRAINT "CustomsCaseDocument_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomsCaseDocument" ADD CONSTRAINT "CustomsCaseDocument_customsCaseId_fkey" FOREIGN KEY ("customsCaseId") REFERENCES "CustomsCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomsCaseDocument" ADD CONSTRAINT "CustomsCaseDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ShipmentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomsFiling" ADD CONSTRAINT "CustomsFiling_customsCaseId_fkey" FOREIGN KEY ("customsCaseId") REFERENCES "CustomsCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DATA BACKFILL MIGRATION
-- 0. Backfill ACTIVE TMS and CUSTOMS entitlements for existing Accounts
INSERT INTO "AccountProductEntitlement" ("id", "accountId", "product", "status", "enabledAt", "createdAt", "updatedAt")
SELECT
    'ape_' || md5(a."id" || '_TMS'),
    a."id",
    'TMS',
    'ACTIVE',
    a."createdAt",
    a."createdAt",
    NOW()
FROM "Account" a
WHERE NOT EXISTS (
    SELECT 1 FROM "AccountProductEntitlement" ape WHERE ape."accountId" = a."id" AND ape."product" = 'TMS'
);

INSERT INTO "AccountProductEntitlement" ("id", "accountId", "product", "status", "enabledAt", "createdAt", "updatedAt")
SELECT
    'ape_' || md5(a."id" || '_CUSTOMS'),
    a."id",
    'CUSTOMS',
    'ACTIVE',
    a."createdAt",
    a."createdAt",
    NOW()
FROM "Account" a
WHERE NOT EXISTS (
    SELECT 1 FROM "AccountProductEntitlement" ape WHERE ape."accountId" = a."id" AND ape."product" = 'CUSTOMS'
);

-- 1. Backfill TMS Product Workspace for shipments that have TMS-side signals (TransportationOrder, ShipmentMovement, Tender, FreightQuote)
INSERT INTO "ShipmentProductWorkspace" ("id", "accountId", "shipmentId", "product", "status", "source", "activatedAt", "createdAt", "updatedAt")
SELECT
    'spw_' || md5(s."id" || '_TMS'),
    s."accountId",
    s."id",
    'TMS',
    'ACTIVE',
    'MIGRATION',
    s."createdAt",
    s."createdAt",
    NOW()
FROM "Shipment" s
WHERE NOT EXISTS (
    SELECT 1 FROM "ShipmentProductWorkspace" spw WHERE spw."shipmentId" = s."id" AND spw."product" = 'TMS'
)
AND (
    EXISTS (SELECT 1 FROM "TransportationOrder" tor WHERE tor."shipmentId" = s."id")
    OR EXISTS (SELECT 1 FROM "ShipmentMovement" sm WHERE sm."shipmentId" = s."id")
    OR EXISTS (SELECT 1 FROM "Tender" t WHERE t."shipmentId" = s."id")
    OR EXISTS (SELECT 1 FROM "FreightQuote" fq WHERE fq."shipmentId" = s."id")
);

-- 2. Backfill CUSTOMS Product Workspace for shipments that have CustomsFilings
INSERT INTO "ShipmentProductWorkspace" ("id", "accountId", "shipmentId", "product", "status", "source", "activatedAt", "createdAt", "updatedAt")
SELECT DISTINCT
    'spw_' || md5(s."id" || '_CUSTOMS'),
    s."accountId",
    s."id",
    'CUSTOMS',
    'ACTIVE',
    'MIGRATION',
    s."createdAt",
    s."createdAt",
    NOW()
FROM "Shipment" s
INNER JOIN "CustomsFiling" cf ON cf."shipmentId" = s."id"
WHERE NOT EXISTS (
    SELECT 1 FROM "ShipmentProductWorkspace" spw WHERE spw."shipmentId" = s."id" AND spw."product" = 'CUSTOMS'
);

-- 3. Backfill CustomsCase and CustomsCaseShipment for shipments with CustomsFilings
INSERT INTO "CustomsCase" ("id", "accountId", "caseNumber", "status", "importerOfRecordId", "entryType", "countryOfOrigin", "destinationCountry", "copiedFromShipmentId", "copiedAtVersion", "createdAt", "updatedAt")
SELECT DISTINCT
    'cc_' || md5(s."id"),
    s."accountId",
    'CC-' || UPPER(SUBSTRING(s."shipmentNumber" FROM 5)),
    'OPEN',
    s."importerOfRecordId",
    s."entryType",
    s."countryOfOrigin",
    s."destinationCountry",
    s."id",
    s."version",
    s."createdAt",
    NOW()
FROM "Shipment" s
INNER JOIN "CustomsFiling" cf ON cf."shipmentId" = s."id"
WHERE NOT EXISTS (
    SELECT 1 FROM "CustomsCase" cc WHERE cc."id" = 'cc_' || md5(s."id")
);

INSERT INTO "CustomsCaseShipment" ("id", "accountId", "customsCaseId", "shipmentId", "createdAt", "updatedAt")
SELECT DISTINCT
    'ccs_' || md5(s."id"),
    s."accountId",
    'cc_' || md5(s."id"),
    s."id",
    s."createdAt",
    NOW()
FROM "Shipment" s
INNER JOIN "CustomsFiling" cf ON cf."shipmentId" = s."id"
WHERE NOT EXISTS (
    SELECT 1 FROM "CustomsCaseShipment" ccs WHERE ccs."shipmentId" = s."id" AND ccs."customsCaseId" = 'cc_' || md5(s."id")
);

-- 4. Link existing CustomsFilings to their CustomsCase
UPDATE "CustomsFiling" cf
SET "customsCaseId" = 'cc_' || md5(cf."shipmentId")
WHERE cf."shipmentId" IS NOT NULL
  AND cf."customsCaseId" IS NULL
  AND EXISTS (SELECT 1 FROM "CustomsCase" cc WHERE cc."id" = 'cc_' || md5(cf."shipmentId"));

