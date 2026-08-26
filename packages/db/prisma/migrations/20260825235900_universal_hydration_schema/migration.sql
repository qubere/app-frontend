-- Universal field hydration persistence.
-- This migration intentionally contains only the schema introduced by PR #83.

ALTER TABLE "Fact"
  ADD COLUMN "candidateId" TEXT,
  ADD COLUMN "definitionVersion" TEXT,
  ADD COLUMN "entityRef" TEXT,
  ADD COLUMN "hydrationRunId" TEXT,
  ADD COLUMN "isHumanLocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supersededAt" TIMESTAMP(3);

CREATE TABLE "HydrationRun" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "shipmentId" TEXT,
  "documentId" TEXT NOT NULL,
  "activeParseVersionId" TEXT NOT NULL,
  "fieldSchemaVersion" TEXT NOT NULL,
  "extractionSchemaVersion" TEXT NOT NULL,
  "mapperModelVersion" TEXT NOT NULL,
  "mapperPromptVersion" TEXT NOT NULL,
  "normalizationPolicyVersion" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "metrics" JSONB,
  "errorCode" TEXT,
  "dataMode" "DataMode" NOT NULL DEFAULT 'PRODUCTION',
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "HydrationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HydrationCandidate" (
  "id" TEXT NOT NULL,
  "hydrationRunId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "shipmentId" TEXT,
  "documentId" TEXT NOT NULL,
  "fieldDefinitionKey" TEXT NOT NULL,
  "targetEntityRef" TEXT NOT NULL DEFAULT '',
  "rawValue" JSONB NOT NULL,
  "normalizedValue" JSONB,
  "extractionConfidence" DOUBLE PRECISION,
  "mappingConfidence" DOUBLE PRECISION,
  "validationScore" DOUBLE PRECISION,
  "corroborationScore" DOUBLE PRECISION,
  "calibratedDecisionScore" DOUBLE PRECISION,
  "status" TEXT NOT NULL,
  "reasonCodes" TEXT[],
  "sourceExtractionFieldIds" TEXT[],
  "supersedesCandidateId" TEXT,
  "dataMode" "DataMode" NOT NULL DEFAULT 'PRODUCTION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HydrationCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HydrationRun_idempotencyKey_key"
  ON "HydrationRun"("idempotencyKey");
CREATE INDEX "HydrationRun_accountId_idx" ON "HydrationRun"("accountId");
CREATE INDEX "HydrationRun_shipmentId_idx" ON "HydrationRun"("shipmentId");
CREATE INDEX "HydrationRun_documentId_idx" ON "HydrationRun"("documentId");

CREATE UNIQUE INDEX "HydrationCandidate_hydrationRunId_fieldDefinitionKey_target_key"
  ON "HydrationCandidate"("hydrationRunId", "fieldDefinitionKey", "targetEntityRef");
CREATE INDEX "HydrationCandidate_hydrationRunId_idx" ON "HydrationCandidate"("hydrationRunId");
CREATE INDEX "HydrationCandidate_accountId_idx" ON "HydrationCandidate"("accountId");
CREATE INDEX "HydrationCandidate_shipmentId_idx" ON "HydrationCandidate"("shipmentId");
CREATE INDEX "HydrationCandidate_documentId_idx" ON "HydrationCandidate"("documentId");
CREATE INDEX "HydrationCandidate_fieldDefinitionKey_idx" ON "HydrationCandidate"("fieldDefinitionKey");

CREATE UNIQUE INDEX "Fact_shipmentId_field_candidateId_key"
  ON "Fact"("shipmentId", "field", "candidateId");

ALTER TABLE "HydrationRun"
  ADD CONSTRAINT "HydrationRun_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HydrationRun"
  ADD CONSTRAINT "HydrationRun_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HydrationRun"
  ADD CONSTRAINT "HydrationRun_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "ShipmentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HydrationCandidate"
  ADD CONSTRAINT "HydrationCandidate_hydrationRunId_fkey"
  FOREIGN KEY ("hydrationRunId") REFERENCES "HydrationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HydrationCandidate"
  ADD CONSTRAINT "HydrationCandidate_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HydrationCandidate"
  ADD CONSTRAINT "HydrationCandidate_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HydrationCandidate"
  ADD CONSTRAINT "HydrationCandidate_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "ShipmentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
