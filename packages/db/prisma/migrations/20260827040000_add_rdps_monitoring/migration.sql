-- CreateEnum
CREATE TYPE "ReferenceDataChangeType" AS ENUM ('ADDED', 'UPDATED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "RdpsRunType" AS ENUM ('FULL_POPULATION', 'DELTA_IMPACT', 'TARGETED', 'MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "RdpsRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "ReferenceDataChangeSet" (
    "id" TEXT NOT NULL,
    "provider" TEXT,
    "sourceList" TEXT NOT NULL,
    "screeningEntityId" TEXT NOT NULL,
    "changeType" "ReferenceDataChangeType" NOT NULL,
    "ingestionRunId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "consumedByRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceDataChangeSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RdpsRun" (
    "id" TEXT NOT NULL,
    "runType" "RdpsRunType" NOT NULL,
    "status" "RdpsRunStatus" NOT NULL DEFAULT 'QUEUED',
    "triggeredBy" TEXT NOT NULL,
    "changeSetRangeStart" TIMESTAMP(3),
    "changeSetRangeEnd" TIMESTAMP(3),
    "changeSetCount" INTEGER,
    "cursorPartyId" TEXT,
    "candidatePartyCount" INTEGER NOT NULL DEFAULT 0,
    "screenedCount" INTEGER NOT NULL DEFAULT 0,
    "worsenedCount" INTEGER NOT NULL DEFAULT 0,
    "erroredCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RdpsRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RdpsPartyOutcome" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "candidateReasons" TEXT[],
    "previousStatus" "RestrictedPartyScreeningStatus",
    "newStatus" "RestrictedPartyScreeningStatus" NOT NULL,
    "isWorsening" BOOLEAN NOT NULL DEFAULT false,
    "hadActivePreApproval" BOOLEAN NOT NULL DEFAULT false,
    "screeningResultId" TEXT,
    "exceptionItemId" TEXT,
    "complianceNotificationId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RdpsPartyOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferenceDataChangeSet_consumedAt_idx" ON "ReferenceDataChangeSet"("consumedAt");

-- CreateIndex
CREATE INDEX "ReferenceDataChangeSet_screeningEntityId_idx" ON "ReferenceDataChangeSet"("screeningEntityId");

-- CreateIndex
CREATE INDEX "ReferenceDataChangeSet_ingestionRunId_idx" ON "ReferenceDataChangeSet"("ingestionRunId");

-- CreateIndex
CREATE INDEX "ReferenceDataChangeSet_occurredAt_idx" ON "ReferenceDataChangeSet"("occurredAt");

-- CreateIndex
CREATE INDEX "RdpsRun_runType_status_idx" ON "RdpsRun"("runType", "status");

-- CreateIndex
CREATE INDEX "RdpsRun_status_idx" ON "RdpsRun"("status");

-- CreateIndex
CREATE INDEX "RdpsRun_startedAt_idx" ON "RdpsRun"("startedAt");

-- CreateIndex
CREATE INDEX "RdpsPartyOutcome_runId_idx" ON "RdpsPartyOutcome"("runId");

-- CreateIndex
CREATE INDEX "RdpsPartyOutcome_accountId_partyId_idx" ON "RdpsPartyOutcome"("accountId", "partyId");

-- CreateIndex
CREATE INDEX "RdpsPartyOutcome_partyId_isWorsening_idx" ON "RdpsPartyOutcome"("partyId", "isWorsening");

-- CreateIndex
CREATE INDEX "RdpsPartyOutcome_isWorsening_idx" ON "RdpsPartyOutcome"("isWorsening");

-- AddForeignKey
ALTER TABLE "ReferenceDataChangeSet" ADD CONSTRAINT "ReferenceDataChangeSet_screeningEntityId_fkey" FOREIGN KEY ("screeningEntityId") REFERENCES "ScreeningEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RdpsPartyOutcome" ADD CONSTRAINT "RdpsPartyOutcome_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RdpsRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RdpsPartyOutcome" ADD CONSTRAINT "RdpsPartyOutcome_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RdpsPartyOutcome" ADD CONSTRAINT "RdpsPartyOutcome_screeningResultId_fkey" FOREIGN KEY ("screeningResultId") REFERENCES "RestrictedPartyScreeningResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

