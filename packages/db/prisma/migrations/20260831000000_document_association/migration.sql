-- CreateEnum
CREATE TYPE "DocumentEntityType" AS ENUM ('SHIPMENT', 'PARTY', 'PRODUCT', 'LICENSE', 'FILING');

-- CreateEnum
CREATE TYPE "DocumentRelationshipType" AS ENUM ('SOURCE_DOCUMENT', 'SUPPORTING_DOCUMENT', 'FILING_ATTACHMENT', 'LICENSE_EVIDENCE', 'ORIGIN_EVIDENCE', 'GENERAL');

-- CreateEnum
CREATE TYPE "DocumentAssociationSource" AS ENUM ('USER', 'DOCUMENT_INTELLIGENCE', 'INTEGRATION', 'SYSTEM', 'MIGRATION');

-- CreateTable
CREATE TABLE "DocumentAssociation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "entityType" "DocumentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityDisplayId" TEXT,
    "relationshipType" "DocumentRelationshipType" NOT NULL DEFAULT 'GENERAL',
    "source" "DocumentAssociationSource" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "linkedBy" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinkedBy" TEXT,
    "unlinkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAssociation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentAssociation_accountId_documentId_active_idx" ON "DocumentAssociation"("accountId", "documentId", "active");

-- CreateIndex
CREATE INDEX "DocumentAssociation_accountId_entityType_entityId_active_idx" ON "DocumentAssociation"("accountId", "entityType", "entityId", "active");

-- CreateIndex
CREATE INDEX "DocumentAssociation_accountId_linkedAt_idx" ON "DocumentAssociation"("accountId", "linkedAt");

-- AddForeignKey
ALTER TABLE "DocumentAssociation" ADD CONSTRAINT "DocumentAssociation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAssociation" ADD CONSTRAINT "DocumentAssociation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ShipmentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
