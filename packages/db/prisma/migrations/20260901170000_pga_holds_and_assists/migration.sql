-- Actual agency holds and account-level assist ledgers. Draft decisions never debit balances.

CREATE TABLE "PgaHold" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "externalKey" TEXT NOT NULL,
  "agencyCode" TEXT NOT NULL,
  "holdCode" TEXT NOT NULL,
  "reasonText" TEXT NOT NULL,
  "rawNotice" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Open',
  "commodityLineRef" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "draftFormInput" JSONB,
  "draftUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PgaHold_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PgaHoldSubmission" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "pgaHoldId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "messageSetText" TEXT NOT NULL,
  "formInputJson" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Sent',
  "transmissionMode" TEXT NOT NULL DEFAULT 'MANUAL',
  "externalReference" TEXT NOT NULL,
  "rejectionCode" TEXT,
  "rejectionReason" TEXT,
  "rejectedFields" JSONB,
  "rawResponse" TEXT,
  "operatorUserId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responseAt" TIMESTAMP(3),
  CONSTRAINT "PgaHoldSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Assist" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "importerOfRecordId" TEXT,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "totalValue" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "remainingValue" DECIMAL(18,2) NOT NULL,
  "allocationMethod" TEXT NOT NULL,
  "allocationBasis" TEXT NOT NULL DEFAULT 'entries',
  "estimatedVolume" DECIMAL(18,6),
  "estimatedImportValue" DECIMAL(18,2),
  "skuPattern" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "warningEpoch" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Assist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistParty" (
  "id" TEXT NOT NULL,
  "assistId" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  CONSTRAINT "AssistParty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistHtsScope" (
  "id" TEXT NOT NULL,
  "assistId" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  CONSTRAINT "AssistHtsScope_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistDecision" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "assistId" TEXT NOT NULL,
  "filingId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "customsAmount" DECIMAL(18,2) NOT NULL,
  "exchangeRate" DECIMAL(24,12) NOT NULL,
  "basisHash" TEXT NOT NULL,
  "assistVersion" INTEGER NOT NULL,
  "overrideReasonCode" TEXT,
  "operatorUserId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistDeclaration" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "assistId" TEXT NOT NULL,
  "filingId" TEXT NOT NULL,
  "amountDeclared" DECIMAL(18,2) NOT NULL,
  "customsAmount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "customsCurrency" TEXT NOT NULL,
  "exchangeRate" DECIMAL(24,12) NOT NULL,
  "lineAmounts" JSONB NOT NULL,
  "wasOverride" BOOLEAN NOT NULL DEFAULT false,
  "overrideReasonCode" TEXT,
  "operatorUserId" TEXT NOT NULL,
  "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistDeclaration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PgaHold_accountId_externalKey_key" ON "PgaHold"("accountId", "externalKey");
CREATE INDEX "PgaHold_accountId_status_issuedAt_idx" ON "PgaHold"("accountId", "status", "issuedAt");
CREATE INDEX "PgaHold_accountId_agencyCode_issuedAt_idx" ON "PgaHold"("accountId", "agencyCode", "issuedAt");
CREATE INDEX "PgaHold_shipmentId_idx" ON "PgaHold"("shipmentId");
CREATE UNIQUE INDEX "PgaHoldSubmission_idempotencyKey_key" ON "PgaHoldSubmission"("idempotencyKey");
CREATE UNIQUE INDEX "PgaHoldSubmission_accountId_requestKey_key" ON "PgaHoldSubmission"("accountId", "requestKey");
CREATE UNIQUE INDEX "PgaHoldSubmission_pgaHoldId_attemptNumber_key" ON "PgaHoldSubmission"("pgaHoldId", "attemptNumber");
CREATE INDEX "PgaHoldSubmission_accountId_pgaHoldId_submittedAt_idx" ON "PgaHoldSubmission"("accountId", "pgaHoldId", "submittedAt");
CREATE INDEX "Assist_accountId_status_effectiveTo_idx" ON "Assist"("accountId", "status", "effectiveTo");
CREATE INDEX "Assist_accountId_importerOfRecordId_status_idx" ON "Assist"("accountId", "importerOfRecordId", "status");
CREATE UNIQUE INDEX "AssistParty_assistId_partyId_role_key" ON "AssistParty"("assistId", "partyId", "role");
CREATE INDEX "AssistParty_partyId_idx" ON "AssistParty"("partyId");
CREATE UNIQUE INDEX "AssistHtsScope_assistId_prefix_key" ON "AssistHtsScope"("assistId", "prefix");
CREATE UNIQUE INDEX "AssistDecision_assistId_filingId_key" ON "AssistDecision"("assistId", "filingId");
CREATE INDEX "AssistDecision_accountId_filingId_idx" ON "AssistDecision"("accountId", "filingId");
CREATE UNIQUE INDEX "AssistDeclaration_assistId_filingId_key" ON "AssistDeclaration"("assistId", "filingId");
CREATE INDEX "AssistDeclaration_accountId_filingId_idx" ON "AssistDeclaration"("accountId", "filingId");

ALTER TABLE "PgaHold" ADD CONSTRAINT "PgaHold_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PgaHold" ADD CONSTRAINT "PgaHold_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PgaHoldSubmission" ADD CONSTRAINT "PgaHoldSubmission_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PgaHoldSubmission" ADD CONSTRAINT "PgaHoldSubmission_pgaHoldId_fkey" FOREIGN KEY ("pgaHoldId") REFERENCES "PgaHold"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assist" ADD CONSTRAINT "Assist_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assist" ADD CONSTRAINT "Assist_importerOfRecordId_fkey" FOREIGN KEY ("importerOfRecordId") REFERENCES "ImporterOfRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssistParty" ADD CONSTRAINT "AssistParty_assistId_fkey" FOREIGN KEY ("assistId") REFERENCES "Assist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistParty" ADD CONSTRAINT "AssistParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssistHtsScope" ADD CONSTRAINT "AssistHtsScope_assistId_fkey" FOREIGN KEY ("assistId") REFERENCES "Assist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistDecision" ADD CONSTRAINT "AssistDecision_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistDecision" ADD CONSTRAINT "AssistDecision_assistId_fkey" FOREIGN KEY ("assistId") REFERENCES "Assist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssistDecision" ADD CONSTRAINT "AssistDecision_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "CustomsFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistDeclaration" ADD CONSTRAINT "AssistDeclaration_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssistDeclaration" ADD CONSTRAINT "AssistDeclaration_assistId_fkey" FOREIGN KEY ("assistId") REFERENCES "Assist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssistDeclaration" ADD CONSTRAINT "AssistDeclaration_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "CustomsFiling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assist" ADD CONSTRAINT "Assist_nonnegative_balance" CHECK ("remainingValue" >= 0 AND "remainingValue" <= "totalValue" AND "totalValue" > 0);
ALTER TABLE "AssistDeclaration" ADD CONSTRAINT "AssistDeclaration_positive_amount" CHECK ("amountDeclared" > 0 AND "customsAmount" > 0 AND "exchangeRate" > 0);
