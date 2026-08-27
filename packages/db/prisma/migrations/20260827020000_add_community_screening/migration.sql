-- AlterEnum
ALTER TYPE "RestrictedPartyScreeningSource" ADD VALUE 'COMMUNITY_SCREENING';

-- CreateEnum
CREATE TYPE "CommunityScreeningSource" AS ENUM ('UI', 'API');

-- CreateEnum
CREATE TYPE "CommunityScreeningInputMode" AS ENUM ('DIRECT_ENTRY', 'PARTY_MASTER', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "CommunityScreeningRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "CommunityScreeningPartyStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'INCOMPLETE', 'ERROR');

-- CreateTable
CREATE TABLE "CommunityScreeningRun" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "source" "CommunityScreeningSource" NOT NULL,
    "inputMode" "CommunityScreeningInputMode" NOT NULL,
    "status" "CommunityScreeningRunStatus" NOT NULL DEFAULT 'QUEUED',
    "transactionReference" TEXT,
    "complianceCountry" TEXT,
    "checksEnabled" JSONB NOT NULL,
    "overrides" JSONB,
    "fileName" TEXT,
    "fileType" TEXT,
    "requestedByUserId" TEXT,
    "totalParties" INTEGER NOT NULL DEFAULT 0,
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "incompleteCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "correlationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityScreeningRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityScreeningPartyResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "partyId" TEXT,
    "externalReference" TEXT,
    "snapshotName" TEXT NOT NULL,
    "snapshotCountry" TEXT,
    "snapshotAddress" TEXT,
    "snapshotCity" TEXT,
    "restrictedPartyEnabled" BOOLEAN NOT NULL,
    "embargoEnabled" BOOLEAN NOT NULL,
    "restrictedPartyStatus" TEXT,
    "restrictedPartyResultId" TEXT,
    "embargoStatus" TEXT,
    "embargoEvidence" JSONB,
    "aggregateStatus" "CommunityScreeningPartyStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "errorMessage" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityScreeningPartyResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityScreeningRun_accountId_createdAt_idx" ON "CommunityScreeningRun"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityScreeningRun_accountId_status_idx" ON "CommunityScreeningRun"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityScreeningPartyResult_runId_rowNumber_key" ON "CommunityScreeningPartyResult"("runId", "rowNumber");

-- CreateIndex
CREATE INDEX "CommunityScreeningPartyResult_runId_aggregateStatus_idx" ON "CommunityScreeningPartyResult"("runId", "aggregateStatus");

-- CreateIndex
CREATE INDEX "CommunityScreeningPartyResult_accountId_partyId_idx" ON "CommunityScreeningPartyResult"("accountId", "partyId");

-- AddForeignKey
ALTER TABLE "CommunityScreeningRun" ADD CONSTRAINT "CommunityScreeningRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityScreeningPartyResult" ADD CONSTRAINT "CommunityScreeningPartyResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CommunityScreeningRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityScreeningPartyResult" ADD CONSTRAINT "CommunityScreeningPartyResult_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityScreeningPartyResult" ADD CONSTRAINT "CommunityScreeningPartyResult_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
