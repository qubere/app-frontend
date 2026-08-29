-- Bulk Compliance Screening: additive models only. No existing table is
-- renamed, dropped, or repurposed. CommunityScreeningRun/PartyResult are
-- untouched -- Party-file screening keeps using that path for now.

-- AlterEnum
ALTER TYPE "RestrictedPartyScreeningSource" ADD VALUE 'BULK_COMPLIANCE_SCREENING';

-- CreateEnum
CREATE TYPE "ComplianceBatchType" AS ENUM ('TRANSACTION_COMPLIANCE', 'PARTY_SCREENING', 'PRODUCT_CLASSIFICATION', 'PRE_APPROVED_PARTY_IMPORT');

-- CreateEnum
CREATE TYPE "ComplianceBatchFormat" AS ENUM ('CSV', 'XLSX', 'JSON', 'XML');

-- CreateEnum
CREATE TYPE "ComplianceBatchProcessingStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'VALIDATION_FAILED', 'READY', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ComplianceBatchComplianceStatus" AS ENUM ('NOT_EVALUATED', 'PASSED', 'COMPLETED_WITH_FINDINGS', 'COMPLETED_WITH_ERRORS');

-- CreateEnum
CREATE TYPE "BatchRecordParseStatus" AS ENUM ('VALID', 'INVALID');

-- CreateEnum
CREATE TYPE "BatchRecordProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "BatchRecordComplianceStatus" AS ENUM ('NOT_EVALUATED', 'PASSED', 'FAILED', 'REVIEW_REQUIRED', 'INCOMPLETE', 'ERROR');

-- CreateEnum
CREATE TYPE "BatchArtifactType" AS ENUM ('INPUT', 'RESULTS', 'VALIDATION_ERRORS', 'REJECTED_RECORDS', 'PROCESSING_SUMMARY');

-- CreateTable
CREATE TABLE "ComplianceBatch" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "batchType" "ComplianceBatchType" NOT NULL,
    "format" "ComplianceBatchFormat" NOT NULL,
    "processingStatus" "ComplianceBatchProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
    "complianceStatus" "ComplianceBatchComplianceStatus" NOT NULL DEFAULT 'NOT_EVALUATED',
    "originalFileName" TEXT NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "servicesEnabled" JSONB NOT NULL,
    "correlationId" TEXT NOT NULL,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "validRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "passedRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "reviewRecords" INTEGER NOT NULL DEFAULT 0,
    "errorRecords" INTEGER NOT NULL DEFAULT 0,
    "incompleteRecords" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchRecord" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "recordNumber" INTEGER NOT NULL,
    "sourceRowNumber" INTEGER,
    "transactionId" TEXT,
    "transactionLineId" TEXT,
    "partyId" TEXT,
    "productId" TEXT,
    "correlationId" TEXT NOT NULL,
    "parseStatus" "BatchRecordParseStatus" NOT NULL DEFAULT 'VALID',
    "processingStatus" "BatchRecordProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "complianceStatus" "BatchRecordComplianceStatus" NOT NULL DEFAULT 'NOT_EVALUATED',
    "normalizedInput" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "rpsResultId" TEXT,
    "licenseDeterminationResultId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchArtifact" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "artifactType" "BatchArtifactType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "BatchArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceBatch_correlationId_key" ON "ComplianceBatch"("correlationId");

-- CreateIndex
CREATE INDEX "ComplianceBatch_accountId_createdAt_idx" ON "ComplianceBatch"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ComplianceBatch_accountId_processingStatus_idx" ON "ComplianceBatch"("accountId", "processingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "BatchRecord_batchId_recordNumber_key" ON "BatchRecord"("batchId", "recordNumber");

-- CreateIndex
CREATE INDEX "BatchRecord_accountId_batchId_processingStatus_idx" ON "BatchRecord"("accountId", "batchId", "processingStatus");

-- CreateIndex
CREATE INDEX "BatchRecord_accountId_batchId_complianceStatus_idx" ON "BatchRecord"("accountId", "batchId", "complianceStatus");

-- CreateIndex
CREATE INDEX "BatchArtifact_accountId_batchId_idx" ON "BatchArtifact"("accountId", "batchId");

-- AddForeignKey
ALTER TABLE "ComplianceBatch" ADD CONSTRAINT "ComplianceBatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRecord" ADD CONSTRAINT "BatchRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRecord" ADD CONSTRAINT "BatchRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ComplianceBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchArtifact" ADD CONSTRAINT "BatchArtifact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchArtifact" ADD CONSTRAINT "BatchArtifact_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ComplianceBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
