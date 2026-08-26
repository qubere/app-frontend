-- Additive only: introduces PartyScreeningApproval, an explicit, reviewer-
-- granted permission to reuse a Party's already-satisfied Restricted Party
-- Screening obligation for its exact approved identity snapshot, in eligible
-- reuse contexts only (see preApproval.ts / shipmentScreening.ts). Strictly
-- distinct from RestrictedPartyDisposition, which is untouched by this
-- migration. No existing table is altered, no existing row is touched, no
-- data is cleared. No legacy SUBSCRIBER_PARTY_LIST table or second Party
-- Master is introduced.

CREATE TABLE IF NOT EXISTS "PartyScreeningApproval" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRE_APPROVED',
    "partyVersion" INTEGER NOT NULL,
    "screeningInputHash" TEXT NOT NULL,
    "sourceScreeningResultId" TEXT,
    "approvedByUserId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "reason" TEXT,
    "referenceDataAsOf" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyScreeningApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartyScreeningApproval_accountId_partyId_idx"
    ON "PartyScreeningApproval"("accountId", "partyId");

CREATE INDEX IF NOT EXISTS "PartyScreeningApproval_partyId_status_idx"
    ON "PartyScreeningApproval"("partyId", "status");

CREATE INDEX IF NOT EXISTS "PartyScreeningApproval_expiresAt_idx"
    ON "PartyScreeningApproval"("expiresAt");

CREATE INDEX IF NOT EXISTS "PartyScreeningApproval_sourceScreeningResultId_idx"
    ON "PartyScreeningApproval"("sourceScreeningResultId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PartyScreeningApproval_accountId_fkey'
    ) THEN
        ALTER TABLE "PartyScreeningApproval"
            ADD CONSTRAINT "PartyScreeningApproval_accountId_fkey"
            FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PartyScreeningApproval_partyId_fkey'
    ) THEN
        ALTER TABLE "PartyScreeningApproval"
            ADD CONSTRAINT "PartyScreeningApproval_partyId_fkey"
            FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PartyScreeningApproval_sourceScreeningResultId_fkey'
    ) THEN
        ALTER TABLE "PartyScreeningApproval"
            ADD CONSTRAINT "PartyScreeningApproval_sourceScreeningResultId_fkey"
            FOREIGN KEY ("sourceScreeningResultId") REFERENCES "RestrictedPartyScreeningResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
