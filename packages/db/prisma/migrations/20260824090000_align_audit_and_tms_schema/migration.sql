-- Align fresh migration-built databases with schema.prisma after the
-- upstream TMS schema additions and the AuditLog impersonation fields.
--
-- All new scalar columns are nullable/additive, except existing documentId
-- on ProofOfDelivery is relaxed to nullable to match the Prisma relation.
-- The IF/DO guards keep this migration safe for databases that were already
-- partially aligned by an earlier manual/db-push step.

-- AuditLog fields used by auth/impersonation-aware audit writes.
CREATE TABLE IF NOT EXISTS "ImpersonationSession" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "effectiveUserId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ImpersonationSession_actorUserId_idx" ON "ImpersonationSession"("actorUserId");
CREATE INDEX IF NOT EXISTS "ImpersonationSession_effectiveUserId_idx" ON "ImpersonationSession"("effectiveUserId");
CREATE INDEX IF NOT EXISTS "ImpersonationSession_accountId_idx" ON "ImpersonationSession"("accountId");
CREATE INDEX IF NOT EXISTS "ImpersonationSession_expiresAt_idx" ON "ImpersonationSession"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ImpersonationSession_actorUserId_fkey') THEN
    ALTER TABLE "ImpersonationSession"
      ADD CONSTRAINT "ImpersonationSession_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ImpersonationSession_effectiveUserId_fkey') THEN
    ALTER TABLE "ImpersonationSession"
      ADD CONSTRAINT "ImpersonationSession_effectiveUserId_fkey"
      FOREIGN KEY ("effectiveUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ImpersonationSession_accountId_fkey') THEN
    ALTER TABLE "ImpersonationSession"
      ADD CONSTRAINT "ImpersonationSession_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "effectiveUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "impersonationSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "resourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "resourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "clientId" TEXT,
  ADD COLUMN IF NOT EXISTS "oldValue" JSONB,
  ADD COLUMN IF NOT EXISTS "newValue" JSONB;

CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_effectiveUserId_idx" ON "AuditLog"("effectiveUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_impersonationSessionId_idx" ON "AuditLog"("impersonationSessionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_actorUserId_fkey') THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_effectiveUserId_fkey') THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_effectiveUserId_fkey"
      FOREIGN KEY ("effectiveUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_impersonationSessionId_fkey') THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_impersonationSessionId_fkey"
      FOREIGN KEY ("impersonationSessionId") REFERENCES "ImpersonationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- TMS event/doc relations added in upstream schema.prisma.
ALTER TABLE "TransportationEvent"
  ADD COLUMN IF NOT EXISTS "freightQuoteId" TEXT,
  ADD COLUMN IF NOT EXISTS "tenderId" TEXT,
  ADD COLUMN IF NOT EXISTS "carrierInvoiceId" TEXT;

ALTER TABLE "ProofOfDelivery"
  ALTER COLUMN "documentId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "TransportationEvent_accountId_freightQuoteId_idx" ON "TransportationEvent"("accountId", "freightQuoteId");
CREATE INDEX IF NOT EXISTS "TransportationEvent_accountId_tenderId_idx" ON "TransportationEvent"("accountId", "tenderId");
CREATE INDEX IF NOT EXISTS "TransportationEvent_accountId_carrierInvoiceId_idx" ON "TransportationEvent"("accountId", "carrierInvoiceId");

CREATE INDEX IF NOT EXISTS "ProofOfDelivery_accountId_idx" ON "ProofOfDelivery"("accountId");
CREATE INDEX IF NOT EXISTS "ProofOfDelivery_shipmentId_idx" ON "ProofOfDelivery"("shipmentId");
CREATE INDEX IF NOT EXISTS "ProofOfDelivery_documentId_idx" ON "ProofOfDelivery"("documentId");

CREATE INDEX IF NOT EXISTS "CarrierInvoice_accountId_idx" ON "CarrierInvoice"("accountId");
CREATE INDEX IF NOT EXISTS "CarrierInvoice_shipmentId_idx" ON "CarrierInvoice"("shipmentId");
CREATE INDEX IF NOT EXISTS "CarrierInvoice_carrierId_idx" ON "CarrierInvoice"("carrierId");
CREATE INDEX IF NOT EXISTS "CarrierInvoice_documentId_idx" ON "CarrierInvoice"("documentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TransportationEvent_freightQuoteId_fkey') THEN
    ALTER TABLE "TransportationEvent"
      ADD CONSTRAINT "TransportationEvent_freightQuoteId_fkey"
      FOREIGN KEY ("freightQuoteId") REFERENCES "FreightQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TransportationEvent_tenderId_fkey') THEN
    ALTER TABLE "TransportationEvent"
      ADD CONSTRAINT "TransportationEvent_tenderId_fkey"
      FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TransportationEvent_carrierInvoiceId_fkey') THEN
    ALTER TABLE "TransportationEvent"
      ADD CONSTRAINT "TransportationEvent_carrierInvoiceId_fkey"
      FOREIGN KEY ("carrierInvoiceId") REFERENCES "CarrierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProofOfDelivery_documentId_fkey') THEN
    ALTER TABLE "ProofOfDelivery"
      ADD CONSTRAINT "ProofOfDelivery_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "ShipmentDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CarrierInvoice_documentId_fkey') THEN
    ALTER TABLE "CarrierInvoice"
      ADD CONSTRAINT "CarrierInvoice_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "ShipmentDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
