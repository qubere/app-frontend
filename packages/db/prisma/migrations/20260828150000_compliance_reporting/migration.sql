-- Compliance Reporting & Analytics: additive models only.
-- ReportRun/ReportArtifact are derived export views over existing
-- authoritative compliance tables; nothing here alters existing data.

-- CreateEnum
CREATE TYPE "ReportGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportDeliveryStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'DELIVERED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ReportScheduleFrequency" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "ReportDefinition" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "columns" JSONB,
    "sort" JSONB,
    "defaultFormat" TEXT NOT NULL DEFAULT 'CSV',
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRun" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "reportDefinitionId" TEXT,
    "scheduleId" TEXT,
    "reportType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "generationStatus" "ReportGenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "deliveryStatus" "ReportDeliveryStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "filterSnapshot" JSONB NOT NULL,
    "columnSnapshot" JSONB,
    "sortSnapshot" JSONB,
    "rowCount" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportArtifact" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "reportRunId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "retentionHold" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ReportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "reportDefinitionId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "frequency" "ReportScheduleFrequency" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "scheduleConfig" JSONB NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'CSV',
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "deliveryConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportDefinition_accountId_reportType_idx" ON "ReportDefinition"("accountId", "reportType");
CREATE INDEX "ReportDefinition_accountId_ownerUserId_idx" ON "ReportDefinition"("accountId", "ownerUserId");

CREATE INDEX "ReportRun_accountId_requestedAt_idx" ON "ReportRun"("accountId", "requestedAt");
CREATE INDEX "ReportRun_accountId_reportType_idx" ON "ReportRun"("accountId", "reportType");
CREATE INDEX "ReportRun_generationStatus_idx" ON "ReportRun"("generationStatus");
CREATE INDEX "ReportRun_scheduleId_idx" ON "ReportRun"("scheduleId");

CREATE INDEX "ReportArtifact_accountId_createdAt_idx" ON "ReportArtifact"("accountId", "createdAt");
CREATE INDEX "ReportArtifact_reportRunId_idx" ON "ReportArtifact"("reportRunId");
CREATE INDEX "ReportArtifact_expiresAt_idx" ON "ReportArtifact"("expiresAt");

CREATE INDEX "ReportSchedule_accountId_nextRunAt_idx" ON "ReportSchedule"("accountId", "nextRunAt");
CREATE INDEX "ReportSchedule_reportDefinitionId_idx" ON "ReportSchedule"("reportDefinitionId");

-- AddForeignKey
ALTER TABLE "ReportDefinition" ADD CONSTRAINT "ReportDefinition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_reportDefinitionId_fkey" FOREIGN KEY ("reportDefinitionId") REFERENCES "ReportDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ReportSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReportArtifact" ADD CONSTRAINT "ReportArtifact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportArtifact" ADD CONSTRAINT "ReportArtifact_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_reportDefinitionId_fkey" FOREIGN KEY ("reportDefinitionId") REFERENCES "ReportDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
