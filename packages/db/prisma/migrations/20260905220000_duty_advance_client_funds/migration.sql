-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "DutyDisbursementAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "FundsLedgerEntryType" AS ENUM ('ADVANCE_DEPOSIT', 'DUTY_DISBURSEMENT', 'FEE_DISBURSEMENT', 'TAX_DISBURSEMENT', 'REPLENISHMENT_RECEIPT', 'REFUND_TO_CLIENT', 'WRITE_OFF', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'REVERSAL', 'INTEREST_OR_PENALTY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DutyDisbursementStatus" AS ENUM ('ESTIMATED', 'AUTHORIZED', 'SCHEDULED', 'PAID_TO_CBP', 'BILLED_TO_CLIENT', 'SETTLED', 'CANCELLED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReplenishmentState" AS ENUM ('REQUESTED', 'NOTIFIED', 'SATISFIED', 'CANCELLED', 'OVERDUE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReconciliationStatus" AS ENUM ('IN_PROGRESS', 'NEEDS_REVIEW', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReconLineStatus" AS ENUM ('MATCHED', 'VARIANCE', 'MISSING_IN_QUBERE', 'MISSING_ON_STATEMENT', 'UNMATCHED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DutyPaymentMode" AS ENUM ('BROKER_DISBURSES', 'DUTY_DIRECT_PAY', 'PMS_BROKER', 'PMS_IMPORTER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable ShipmentCharge
ALTER TABLE "ShipmentCharge" ADD COLUMN IF NOT EXISTS "disbursementId" TEXT;

-- CreateTable DutyDisbursementAccount
CREATE TABLE IF NOT EXISTS "DutyDisbursementAccount" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "importerId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "currentBalance" DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    "minimumBalance" DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    "targetBalance" DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    "autoRequestReplenishment" BOOLEAN NOT NULL DEFAULT false,
    "autoAuthorizeUnder" DECIMAL(16,2),
    "status" "DutyDisbursementAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastReconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyDisbursementAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable FundsLedgerEntry
CREATE TABLE IF NOT EXISTS "FundsLedgerEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "disbursementAccountId" TEXT NOT NULL,
    "type" "FundsLedgerEntryType" NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "runningBalance" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disbursementId" TEXT,
    "depositId" TEXT,
    "replenishmentRequestId" TEXT,
    "invoiceId" TEXT,
    "reversesEntryId" TEXT,
    "createdById" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundsLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable DutyDisbursement
CREATE TABLE IF NOT EXISTS "DutyDisbursement" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "disbursementAccountId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "importerId" TEXT,
    "shipmentId" TEXT,
    "filingId" TEXT,
    "entryNumber" TEXT,
    "status" "DutyDisbursementStatus" NOT NULL DEFAULT 'ESTIMATED',
    "estimatedAmount" DECIMAL(16,2) NOT NULL,
    "actualAmount" DECIMAL(16,2),
    "dutyAmount" DECIMAL(16,2),
    "taxAmount" DECIMAL(16,2),
    "feeAmount" DECIMAL(16,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" TEXT,
    "statementDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cbpPaymentRef" TEXT,
    "statementRecordId" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "varianceAmount" DECIMAL(16,2),
    "recoveryChargeId" TEXT,
    "recoveryInvoiceLineId" TEXT,
    "billedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable DutyDisbursementFeeLine
CREATE TABLE IF NOT EXISTS "DutyDisbursementFeeLine" (
    "id" TEXT NOT NULL,
    "disbursementId" TEXT NOT NULL,
    "accountingClassCode" TEXT NOT NULL,
    "estimatedAmount" DECIMAL(16,2) NOT NULL,
    "actualAmount" DECIMAL(16,2),
    "statementFeeLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DutyDisbursementFeeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable ReplenishmentRequest
CREATE TABLE IF NOT EXISTS "ReplenishmentRequest" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "disbursementAccountId" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "state" "ReplenishmentState" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "satisfiedByDepositId" TEXT,
    "satisfiedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable StatementReconciliation
CREATE TABLE IF NOT EXISTS "StatementReconciliation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "statementRecordId" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "varianceCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedCount" INTEGER NOT NULL DEFAULT 0,
    "totalVarianceAmount" DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "StatementReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable StatementReconciliationLine
CREATE TABLE IF NOT EXISTS "StatementReconciliationLine" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "statementFeeLineId" TEXT,
    "disbursementId" TEXT,
    "entryNumber" TEXT,
    "accountingClassCode" TEXT,
    "statementAmount" DECIMAL(16,2),
    "qubereAmount" DECIMAL(16,2),
    "varianceAmount" DECIMAL(16,2),
    "matchStatus" "ReconLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "billingExceptionId" TEXT,

    CONSTRAINT "StatementReconciliationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable DutyPaymentSetup
CREATE TABLE IF NOT EXISTS "DutyPaymentSetup" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "importerId" TEXT,
    "mode" "DutyPaymentMode" NOT NULL DEFAULT 'BROKER_DISBURSES',
    "statementSchedule" TEXT NOT NULL DEFAULT 'DAILY',
    "achAccountRef" TEXT,
    "pmsPayerUnitNumber" TEXT,
    "recoveryMode" TEXT NOT NULL DEFAULT 'INVOICE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyPaymentSetup_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "DutyDisbursementAccount_accountId_clientId_importerId_key" ON "DutyDisbursementAccount"("accountId", "clientId", "importerId");
CREATE INDEX IF NOT EXISTS "DutyDisbursementAccount_accountId_idx" ON "DutyDisbursementAccount"("accountId");
CREATE INDEX IF NOT EXISTS "DutyDisbursementAccount_accountId_status_idx" ON "DutyDisbursementAccount"("accountId", "status");
CREATE INDEX IF NOT EXISTS "DutyDisbursementAccount_clientId_idx" ON "DutyDisbursementAccount"("clientId");

CREATE UNIQUE INDEX IF NOT EXISTS "FundsLedgerEntry_reversesEntryId_key" ON "FundsLedgerEntry"("reversesEntryId");
CREATE UNIQUE INDEX IF NOT EXISTS "FundsLedgerEntry_idempotencyKey_key" ON "FundsLedgerEntry"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "FundsLedgerEntry_accountId_idx" ON "FundsLedgerEntry"("accountId");
CREATE INDEX IF NOT EXISTS "FundsLedgerEntry_disbursementAccountId_effectiveAt_idx" ON "FundsLedgerEntry"("disbursementAccountId", "effectiveAt");
CREATE INDEX IF NOT EXISTS "FundsLedgerEntry_disbursementId_idx" ON "FundsLedgerEntry"("disbursementId");
CREATE INDEX IF NOT EXISTS "FundsLedgerEntry_type_idx" ON "FundsLedgerEntry"("type");

CREATE UNIQUE INDEX IF NOT EXISTS "DutyDisbursement_filingId_key" ON "DutyDisbursement"("filingId");
CREATE INDEX IF NOT EXISTS "DutyDisbursement_accountId_idx" ON "DutyDisbursement"("accountId");
CREATE INDEX IF NOT EXISTS "DutyDisbursement_disbursementAccountId_status_idx" ON "DutyDisbursement"("disbursementAccountId", "status");
CREATE INDEX IF NOT EXISTS "DutyDisbursement_clientId_idx" ON "DutyDisbursement"("clientId");
CREATE INDEX IF NOT EXISTS "DutyDisbursement_shipmentId_idx" ON "DutyDisbursement"("shipmentId");
CREATE INDEX IF NOT EXISTS "DutyDisbursement_entryNumber_idx" ON "DutyDisbursement"("entryNumber");
CREATE INDEX IF NOT EXISTS "DutyDisbursement_statementRecordId_idx" ON "DutyDisbursement"("statementRecordId");

CREATE INDEX IF NOT EXISTS "DutyDisbursementFeeLine_disbursementId_idx" ON "DutyDisbursementFeeLine"("disbursementId");

CREATE INDEX IF NOT EXISTS "ReplenishmentRequest_accountId_idx" ON "ReplenishmentRequest"("accountId");
CREATE INDEX IF NOT EXISTS "ReplenishmentRequest_disbursementAccountId_state_idx" ON "ReplenishmentRequest"("disbursementAccountId", "state");

CREATE UNIQUE INDEX IF NOT EXISTS "StatementReconciliation_statementRecordId_key" ON "StatementReconciliation"("statementRecordId");
CREATE INDEX IF NOT EXISTS "StatementReconciliation_accountId_status_idx" ON "StatementReconciliation"("accountId", "status");

CREATE INDEX IF NOT EXISTS "StatementReconciliationLine_reconciliationId_matchStatus_idx" ON "StatementReconciliationLine"("reconciliationId", "matchStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "DutyPaymentSetup_accountId_clientId_importerId_key" ON "DutyPaymentSetup"("accountId", "clientId", "importerId");
CREATE INDEX IF NOT EXISTS "DutyPaymentSetup_accountId_idx" ON "DutyPaymentSetup"("accountId");

CREATE INDEX IF NOT EXISTS "ShipmentCharge_disbursementId_idx" ON "ShipmentCharge"("disbursementId");
