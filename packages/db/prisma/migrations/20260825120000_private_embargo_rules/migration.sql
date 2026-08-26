-- Additive only: introduces PrivateEmbargoRule, tenant-scoped account-owned
-- country-pair embargo/watch-list rules evaluated before public/system
-- embargo screening (see privateEmbargoMatcher.ts / doEmbargoCheck.ts).
-- No existing table is altered, no existing row is touched, no data is
-- cleared. AccountEmbargoConfig.privateEmbargoEnabled already existed and
-- is untouched by this migration.

CREATE TABLE IF NOT EXISTS "PrivateEmbargoRule" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fromCountryCode" TEXT,
    "appliesToAllFromCountries" BOOLEAN NOT NULL DEFAULT false,
    "toCountryCode" TEXT NOT NULL,
    "embargoed" BOOLEAN NOT NULL DEFAULT true,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "reason" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateEmbargoRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrivateEmbargoRule_accountId_toCountryCode_idx"
    ON "PrivateEmbargoRule"("accountId", "toCountryCode");

CREATE INDEX IF NOT EXISTS "PrivateEmbargoRule_fromCountryCode_toCountryCode_idx"
    ON "PrivateEmbargoRule"("fromCountryCode", "toCountryCode");

CREATE INDEX IF NOT EXISTS "PrivateEmbargoRule_effectiveDate_expirationDate_idx"
    ON "PrivateEmbargoRule"("effectiveDate", "expirationDate");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PrivateEmbargoRule_accountId_fkey'
    ) THEN
        ALTER TABLE "PrivateEmbargoRule"
            ADD CONSTRAINT "PrivateEmbargoRule_accountId_fkey"
            FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
