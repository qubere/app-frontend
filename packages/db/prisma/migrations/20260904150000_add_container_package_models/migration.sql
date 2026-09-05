-- CreateTable
CREATE TABLE IF NOT EXISTS "ShipmentContainer" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "containerNumber" TEXT NOT NULL,
    "sealNumbers" TEXT[],
    "containerType" TEXT,
    "containerSize" TEXT,
    "containerHeight" TEXT,
    "packageCount" INTEGER,
    "packageType" TEXT,
    "descriptionOfGoods" TEXT,
    "pieceQuantity" INTEGER,
    "quantityUom" TEXT,
    "grossWeight" DECIMAL(65,30),
    "netWeight" DECIMAL(65,30),
    "weightUom" TEXT,
    "volume" DECIMAL(65,30),
    "volumeUom" TEXT,
    "marksAndNumbers" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Unreviewed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentContainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ShipmentPackage" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "packageNumber" TEXT NOT NULL,
    "containerNumber" TEXT,
    "packageType" TEXT,
    "cartonNumber" TEXT,
    "packageCount" INTEGER,
    "marksAndNumbers" TEXT,
    "grossWeight" DECIMAL(65,30),
    "netWeight" DECIMAL(65,30),
    "weightUom" TEXT,
    "dimensions" TEXT,
    "volume" DECIMAL(65,30),
    "volumeUom" TEXT,
    "containedItems" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'Unreviewed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShipmentContainer_shipmentId_idx" ON "ShipmentContainer"("shipmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShipmentContainer_accountId_idx" ON "ShipmentContainer"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShipmentPackage_shipmentId_idx" ON "ShipmentPackage"("shipmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShipmentPackage_accountId_idx" ON "ShipmentPackage"("accountId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ShipmentContainer" ADD CONSTRAINT "ShipmentContainer_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShipmentContainer" ADD CONSTRAINT "ShipmentContainer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShipmentPackage" ADD CONSTRAINT "ShipmentPackage_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShipmentPackage" ADD CONSTRAINT "ShipmentPackage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
