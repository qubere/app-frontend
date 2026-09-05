-- Issue #219 Phase A (U2, U7): FilerProfile + EntrySummaryDraft.
--
-- Hand-written (no live DB available to run `prisma migrate dev` in this
-- sandbox) — follows the style of the most recent migration folder
-- (20260905090000_search_index_and_trgm_completeness). MUST be verified
-- against a real `prisma migrate dev --create-only` diff before merging.

-- CreateTable
CREATE TABLE "FilerProfile" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filerCode" TEXT NOT NULL,
    "defaultPortCode" TEXT,
    "format" TEXT NOT NULL,
    "formatVersion" TEXT NOT NULL,
    "fieldMap" JSONB NOT NULL,
    "transport" TEXT NOT NULL,
    "transportConfig" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntrySummaryDraft" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "filingId" TEXT,
    "version" INTEGER NOT NULL,
    "draftData" JSONB NOT NULL,
    "validationData" JSONB NOT NULL,
    "isExportable" BOOLEAN NOT NULL,
    "blockingCount" INTEGER NOT NULL,
    "warningCount" INTEGER NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "inputHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntrySummaryDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FilerProfile_accountId_name_key" ON "FilerProfile"("accountId", "name");

-- CreateIndex
CREATE INDEX "FilerProfile_accountId_active_idx" ON "FilerProfile"("accountId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "EntrySummaryDraft_shipmentId_version_key" ON "EntrySummaryDraft"("shipmentId", "version");

-- CreateIndex
CREATE INDEX "EntrySummaryDraft_accountId_shipmentId_idx" ON "EntrySummaryDraft"("accountId", "shipmentId");

-- CreateIndex
CREATE INDEX "EntrySummaryDraft_filingId_idx" ON "EntrySummaryDraft"("filingId");

-- AddForeignKey
ALTER TABLE "FilerProfile" ADD CONSTRAINT "FilerProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntrySummaryDraft" ADD CONSTRAINT "EntrySummaryDraft_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
