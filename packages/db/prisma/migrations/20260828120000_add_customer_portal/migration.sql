-- Customer Portal schema (PR #97).
--
-- Adds the CustomerRequest / CustomerRequestMessage / CustomerRequestDocument
-- models plus the client-scoping and customer-visibility columns the portal
-- reads: ShipmentDocument.clientId/portalVisibility/tmsOrderId/tmsLoadId,
-- CustomsFiling.customerVisibleAt/customerPublishedByUserId,
-- Invitation.clientId/purpose/productScopes.
--
-- NOTE: this migration was authored by hand from the schema diff during review
-- (the PR shipped the schema change with no migration). `prisma migrate diff`
-- against the shared demo DB returns empty, i.e. those objects were already
-- applied there via `db push` during development — so on that database run
-- `prisma migrate resolve --applied 20260828120000_add_customer_portal` instead
-- of `migrate deploy`. On a fresh database `migrate deploy` runs it normally.
-- Regenerate against a shadow DB with `prisma migrate diff
-- --from-migrations ... --to-schema-datamodel ...` before relying on it in CI.

-- AlterTable: Invitation
ALTER TABLE "Invitation"
  ADD COLUMN "clientId" TEXT,
  ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'WORKBENCH',
  ADD COLUMN "productScopes" TEXT[] DEFAULT ARRAY['CUSTOMS']::TEXT[];

-- AlterTable: ShipmentDocument
ALTER TABLE "ShipmentDocument"
  ADD COLUMN "clientId" TEXT,
  ADD COLUMN "portalVisibility" TEXT NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN "tmsOrderId" TEXT,
  ADD COLUMN "tmsLoadId" TEXT;

-- AlterTable: CustomsFiling
ALTER TABLE "CustomsFiling"
  ADD COLUMN "customerVisibleAt" TIMESTAMP(3),
  ADD COLUMN "customerPublishedByUserId" TEXT;

-- CreateTable: CustomerRequest
CREATE TABLE "CustomerRequest" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "shipmentId" TEXT,
  "filingId" TEXT,
  "tmsOrderId" TEXT,
  "tmsLoadId" TEXT,
  "domain" TEXT NOT NULL DEFAULT 'CUSTOMS',
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "dueAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "assignedUserId" TEXT,
  "closedByUserId" TEXT,
  "closedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomerRequestMessage
CREATE TABLE "CustomerRequestMessage" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "authorType" TEXT NOT NULL DEFAULT 'CUSTOMER',
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerRequestMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomerRequestDocument
CREATE TABLE "CustomerRequestDocument" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerRequestDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Invitation
CREATE INDEX "Invitation_clientId_idx" ON "Invitation" ("clientId");

-- CreateIndex: ShipmentDocument
CREATE INDEX "ShipmentDocument_clientId_idx" ON "ShipmentDocument" ("clientId");
CREATE INDEX "ShipmentDocument_accountId_portalVisibility_idx" ON "ShipmentDocument" ("accountId", "portalVisibility");
CREATE INDEX "ShipmentDocument_accountId_clientId_portalVisibility_idx" ON "ShipmentDocument" ("accountId", "clientId", "portalVisibility");
CREATE INDEX "ShipmentDocument_accountId_portalVisibility_createdAt_idx" ON "ShipmentDocument" ("accountId", "portalVisibility", "createdAt");

-- CreateIndex: CustomerRequest
CREATE INDEX "CustomerRequest_accountId_idx" ON "CustomerRequest" ("accountId");
CREATE INDEX "CustomerRequest_clientId_idx" ON "CustomerRequest" ("clientId");
CREATE INDEX "CustomerRequest_shipmentId_idx" ON "CustomerRequest" ("shipmentId");
CREATE INDEX "CustomerRequest_assignedUserId_idx" ON "CustomerRequest" ("assignedUserId");
CREATE INDEX "CustomerRequest_status_idx" ON "CustomerRequest" ("status");
CREATE INDEX "CustomerRequest_dueAt_idx" ON "CustomerRequest" ("dueAt");
CREATE INDEX "CustomerRequest_accountId_clientId_status_idx" ON "CustomerRequest" ("accountId", "clientId", "status");
CREATE INDEX "CustomerRequest_accountId_createdAt_idx" ON "CustomerRequest" ("accountId", "createdAt");

-- CreateIndex: CustomerRequestMessage
CREATE INDEX "CustomerRequestMessage_requestId_idx" ON "CustomerRequestMessage" ("requestId");
CREATE INDEX "CustomerRequestMessage_accountId_idx" ON "CustomerRequestMessage" ("accountId");
CREATE INDEX "CustomerRequestMessage_clientId_idx" ON "CustomerRequestMessage" ("clientId");
CREATE INDEX "CustomerRequestMessage_requestId_createdAt_idx" ON "CustomerRequestMessage" ("requestId", "createdAt");

-- CreateIndex: CustomerRequestDocument
CREATE UNIQUE INDEX "CustomerRequestDocument_requestId_documentId_key" ON "CustomerRequestDocument" ("requestId", "documentId");
CREATE INDEX "CustomerRequestDocument_requestId_idx" ON "CustomerRequestDocument" ("requestId");
CREATE INDEX "CustomerRequestDocument_documentId_idx" ON "CustomerRequestDocument" ("documentId");

-- AddForeignKey: Invitation
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: ShipmentDocument
ALTER TABLE "ShipmentDocument" ADD CONSTRAINT "ShipmentDocument_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CustomsFiling
ALTER TABLE "CustomsFiling" ADD CONSTRAINT "CustomsFiling_customerPublishedByUserId_fkey"
  FOREIGN KEY ("customerPublishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CustomerRequest
ALTER TABLE "CustomerRequest" ADD CONSTRAINT "CustomerRequest_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerRequest" ADD CONSTRAINT "CustomerRequest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerRequest" ADD CONSTRAINT "CustomerRequest_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerRequest" ADD CONSTRAINT "CustomerRequest_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerRequest" ADD CONSTRAINT "CustomerRequest_assignedUserId_fkey"
  FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerRequest" ADD CONSTRAINT "CustomerRequest_closedByUserId_fkey"
  FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CustomerRequestMessage
ALTER TABLE "CustomerRequestMessage" ADD CONSTRAINT "CustomerRequestMessage_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "CustomerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerRequestMessage" ADD CONSTRAINT "CustomerRequestMessage_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerRequestMessage" ADD CONSTRAINT "CustomerRequestMessage_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CustomerRequestDocument
ALTER TABLE "CustomerRequestDocument" ADD CONSTRAINT "CustomerRequestDocument_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "CustomerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerRequestDocument" ADD CONSTRAINT "CustomerRequestDocument_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "ShipmentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
