-- AlterEnum
ALTER TYPE "ComplianceNotificationType" ADD VALUE 'PORTAL_UPDATE';

-- AlterTable
ALTER TABLE "ComplianceDeadline" ADD COLUMN     "customerActionable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customerLabel" TEXT;

-- AlterTable
ALTER TABLE "CustomerRequest" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "ComplianceFinding" ADD COLUMN     "lineNumber" INTEGER,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "ComplianceNotification" ADD COLUMN     "portalEventKey" TEXT;

-- AlterTable
ALTER TABLE "ShipmentCharge" ADD COLUMN     "portalVisible" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EntryProof" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "clientId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scoreOverall" INTEGER NOT NULL,
    "scoreBand" TEXT NOT NULL,
    "linesTotal" INTEGER NOT NULL,
    "linesVerified" INTEGER NOT NULL,
    "linesReview" INTEGER NOT NULL,
    "linesAtRisk" INTEGER NOT NULL,
    "dutyAndFeesUsd" DECIMAL(16,2) NOT NULL,
    "dutySavingsIdentifiedUsd" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "openFindingsCount" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "htsReleaseId" TEXT,
    "referenceDataAsOf" TIMESTAMP(3),
    "generatedByUserId" TEXT,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntryProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryProofEvent" (
    "id" TEXT NOT NULL,
    "entryProofId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorType" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryProofEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientStakeholder" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT,
    "role" TEXT NOT NULL,
    "isSigner" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "invitationId" TEXT,
    "loginStatus" TEXT NOT NULL DEFAULT 'NOT_INVITED',
    "notifyPrefs" JSONB,
    "onboardingEntityId" TEXT,
    "sourceEvent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientStakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "portalVisible" BOOLEAN NOT NULL DEFAULT true,
    "sourceModel" TEXT,
    "sourceId" TEXT,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntryProof_accountId_idx" ON "EntryProof"("accountId");

-- CreateIndex
CREATE INDEX "EntryProof_filingId_idx" ON "EntryProof"("filingId");

-- CreateIndex
CREATE INDEX "EntryProof_clientId_status_idx" ON "EntryProof"("clientId", "status");

-- CreateIndex
CREATE INDEX "EntryProof_accountId_status_publishedAt_idx" ON "EntryProof"("accountId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EntryProof_filingId_version_key" ON "EntryProof"("filingId", "version");

-- CreateIndex
CREATE INDEX "EntryProofEvent_entryProofId_idx" ON "EntryProofEvent"("entryProofId");

-- CreateIndex
CREATE INDEX "EntryProofEvent_accountId_createdAt_idx" ON "EntryProofEvent"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientStakeholder_accountId_idx" ON "ClientStakeholder"("accountId");

-- CreateIndex
CREATE INDEX "ClientStakeholder_clientId_role_idx" ON "ClientStakeholder"("clientId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ClientStakeholder_clientId_email_key" ON "ClientStakeholder"("clientId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ClientDocument_supersededById_key" ON "ClientDocument"("supersededById");

-- CreateIndex
CREATE INDEX "ClientDocument_accountId_idx" ON "ClientDocument"("accountId");

-- CreateIndex
CREATE INDEX "ClientDocument_clientId_kind_status_idx" ON "ClientDocument"("clientId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientDocument_clientId_kind_sourceModel_sourceId_key" ON "ClientDocument"("clientId", "kind", "sourceModel", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceNotification_portalEventKey_key" ON "ComplianceNotification"("portalEventKey");

-- AddForeignKey
ALTER TABLE "EntryProof" ADD CONSTRAINT "EntryProof_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryProof" ADD CONSTRAINT "EntryProof_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "CustomsFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryProof" ADD CONSTRAINT "EntryProof_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryProof" ADD CONSTRAINT "EntryProof_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryProof" ADD CONSTRAINT "EntryProof_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "EntryProof"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryProofEvent" ADD CONSTRAINT "EntryProofEvent_entryProofId_fkey" FOREIGN KEY ("entryProofId") REFERENCES "EntryProof"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStakeholder" ADD CONSTRAINT "ClientStakeholder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStakeholder" ADD CONSTRAINT "ClientStakeholder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStakeholder" ADD CONSTRAINT "ClientStakeholder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Enforce one current draft and publication even outside the service's filing lock.
CREATE UNIQUE INDEX "EntryProof_current_draft_key" ON "EntryProof" ("filingId") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "EntryProof_current_published_key" ON "EntryProof" ("filingId") WHERE "status" = 'PUBLISHED';

-- Existing installations need the new grants without rerunning the demo seed.
INSERT INTO "Permission" ("id", "name", "description", "updatedAt") VALUES
('perm_portal_entries_comment', 'portal.entries.comment', 'Ask questions about a published entry proof.', CURRENT_TIMESTAMP),
('perm_portal_setup_read', 'portal.setup.read', 'View customer onboarding, documents, and stakeholders.', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE (
(p.name = 'portal.entries.comment' AND r.name IN ('CUSTOMER_ADMIN','CUSTOMER_USER','CUSTOMER_CUSTOMS_USER','BROKER_ADMIN','OWNER')) OR
(p.name = 'portal.setup.read' AND r.name IN ('CUSTOMER_ADMIN','CUSTOMER_USER','CUSTOMER_VIEWER','CUSTOMER_CUSTOMS_USER','BROKER_ADMIN','OWNER')))
ON CONFLICT DO NOTHING;
