-- CreateTable
CREATE TABLE "ImporterSecurityFiling" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "billOfLadingNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "ladingDate" TIMESTAMP(3),
    "filingDeadline" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "elements" JSONB NOT NULL DEFAULT '{}',
    "missingElements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bondOnFile" BOOLEAN NOT NULL DEFAULT false,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "penaltyExposureUsd" DECIMAL(12,2),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImporterSecurityFiling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorDisclosure" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "filingId" TEXT,
    "entryNumber" TEXT,
    "description" TEXT NOT NULL,
    "culpability" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "actualDutyLoss" DECIMAL(14,2) NOT NULL,
    "enteredValue" DECIMAL(14,2) NOT NULL,
    "interestAmount" DECIMAL(14,2) NOT NULL,
    "tenderAmount" DECIMAL(14,2) NOT NULL,
    "statutoryMaxPenalty" DECIMAL(14,2) NOT NULL,
    "estimatedPenaltyWithDisclosure" DECIMAL(14,2) NOT NULL,
    "savingsFromDisclosure" DECIMAL(14,2) NOT NULL,
    "disclosedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriorDisclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbpReconciliationFlag" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "filingId" TEXT,
    "entryNumber" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "issues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedDutyDifference" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deadlineDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FLAGGED',
    "reconciliationEntryId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbpReconciliationFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbpReconciliationEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "reconciliationEntryNumber" TEXT NOT NULL,
    "issuesCovered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deadlineDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "dutyDeltaTotal" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "transmittedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbpReconciliationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DutyPaymentInstruction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "statementRecordId" TEXT,
    "statementNumber" TEXT NOT NULL,
    "statementType" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "filerCode" TEXT,
    "totalDutyAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalFeeAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalAmountDue" DECIMAL(16,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'ACH_DEBIT',
    "payerAccountLast4" TEXT,
    "paymentDeadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "achTrackingId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyPaymentInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImporterSecurityFiling_accountId_status_idx" ON "ImporterSecurityFiling"("accountId", "status");

-- CreateIndex
CREATE INDEX "ImporterSecurityFiling_shipmentId_idx" ON "ImporterSecurityFiling"("shipmentId");

-- CreateIndex
CREATE INDEX "PriorDisclosure_accountId_status_idx" ON "PriorDisclosure"("accountId", "status");

-- CreateIndex
CREATE INDEX "PriorDisclosure_filingId_idx" ON "PriorDisclosure"("filingId");

-- CreateIndex
CREATE INDEX "CbpReconciliationFlag_accountId_status_idx" ON "CbpReconciliationFlag"("accountId", "status");

-- CreateIndex
CREATE INDEX "CbpReconciliationFlag_reconciliationEntryId_idx" ON "CbpReconciliationFlag"("reconciliationEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "CbpReconciliationFlag_accountId_entryNumber_key" ON "CbpReconciliationFlag"("accountId", "entryNumber");

-- CreateIndex
CREATE INDEX "CbpReconciliationEntry_accountId_status_idx" ON "CbpReconciliationEntry"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CbpReconciliationEntry_accountId_reconciliationEntryNumber_key" ON "CbpReconciliationEntry"("accountId", "reconciliationEntryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DutyPaymentInstruction_achTrackingId_key" ON "DutyPaymentInstruction"("achTrackingId");

-- CreateIndex
CREATE INDEX "DutyPaymentInstruction_accountId_status_idx" ON "DutyPaymentInstruction"("accountId", "status");

-- CreateIndex
CREATE INDEX "DutyPaymentInstruction_statementRecordId_idx" ON "DutyPaymentInstruction"("statementRecordId");

-- AddForeignKey
ALTER TABLE "ImporterSecurityFiling" ADD CONSTRAINT "ImporterSecurityFiling_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorDisclosure" ADD CONSTRAINT "PriorDisclosure_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbpReconciliationFlag" ADD CONSTRAINT "CbpReconciliationFlag_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbpReconciliationFlag" ADD CONSTRAINT "CbpReconciliationFlag_reconciliationEntryId_fkey" FOREIGN KEY ("reconciliationEntryId") REFERENCES "CbpReconciliationEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbpReconciliationEntry" ADD CONSTRAINT "CbpReconciliationEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyPaymentInstruction" ADD CONSTRAINT "DutyPaymentInstruction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

