-- AlterTable: per-locale display descriptions for the Procedure Catalog and
-- Action Catalog masters, so their dropdowns can show a localized label
-- instead of the bare code.
ALTER TABLE "FilingProcedureCatalog" ADD COLUMN "descriptions" JSONB;

ALTER TABLE "FilingActionCatalog" ADD COLUMN "descriptions" JSONB;

-- CreateTable: FilingMessageCatalog
CREATE TABLE "FilingMessageCatalog" (
    "id" TEXT NOT NULL,
    "messageName" TEXT NOT NULL,
    "descriptions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "FilingMessageCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FilingMessageCatalog_messageName_key" ON "FilingMessageCatalog"("messageName");

CREATE INDEX "FilingMessageCatalog_messageName_idx" ON "FilingMessageCatalog"("messageName");

CREATE INDEX "FilingMessageCatalog_isActive_idx" ON "FilingMessageCatalog"("isActive");

-- CreateTable: FilingSchema
CREATE TABLE "FilingSchema" (
    "id" TEXT NOT NULL,
    "schemaPath" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "FilingSchema_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FilingSchema_schemaVersion_idx" ON "FilingSchema"("schemaVersion");

CREATE INDEX "FilingSchema_isActive_idx" ON "FilingSchema"("isActive");

-- AlterTable: FilingProcedureConfig -- replace the transactionType string
-- column with a real filingSchemaId reference into FilingSchema. The
-- import/export wrapper is now derived from the referenced schema's
-- schemaPath (see resolveMessageContext.ts) instead of a separately
-- maintained string.
ALTER TABLE "FilingProcedureConfig" ADD COLUMN "filingSchemaId" TEXT;

ALTER TABLE "FilingProcedureConfig" DROP COLUMN "transactionType";

CREATE INDEX "FilingProcedureConfig_filingSchemaId_idx" ON "FilingProcedureConfig"("filingSchemaId");

ALTER TABLE "FilingProcedureConfig" ADD CONSTRAINT "FilingProcedureConfig_filingSchemaId_fkey" FOREIGN KEY ("filingSchemaId") REFERENCES "FilingSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;
