-- Recreated to reconcile local migration history with a live database where
-- this migration (and the two below it) were originally applied out-of-band
-- via `prisma migrate dev` without the generated SQL ever being committed.
-- Baselined via `prisma migrate resolve --applied` rather than re-run.

CREATE TABLE IF NOT EXISTS "FilingCountryCustomsVersion" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "procedureCode" TEXT NOT NULL,
    "release" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilingCountryCustomsVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FilingCountryCustomsVersion_country_procedureCode_release_key"
  ON "FilingCountryCustomsVersion"("country", "procedureCode", "release");

CREATE INDEX IF NOT EXISTS "FilingCountryCustomsVersion_country_procedureCode_idx"
  ON "FilingCountryCustomsVersion"("country", "procedureCode");

CREATE INDEX IF NOT EXISTS "FilingCountryCustomsVersion_isActive_idx"
  ON "FilingCountryCustomsVersion"("isActive");

CREATE TABLE IF NOT EXISTS "FilingCustomerCustomsVersion" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "filingCountryCustomsId" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilingCustomerCustomsVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FilingCustomerCustomsVersion_customerId_idx"
  ON "FilingCustomerCustomsVersion"("customerId");

CREATE INDEX IF NOT EXISTS "FilingCustomerCustomsVersion_filingCountryCustomsId_idx"
  ON "FilingCustomerCustomsVersion"("filingCountryCustomsId");

CREATE INDEX IF NOT EXISTS "FilingCustomerCustomsVersion_isActive_idx"
  ON "FilingCustomerCustomsVersion"("isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FilingCustomerCustomsVersion_filingCountryCustomsId_fkey'
  ) THEN
    ALTER TABLE "FilingCustomerCustomsVersion"
      ADD CONSTRAINT "FilingCustomerCustomsVersion_filingCountryCustomsId_fkey"
      FOREIGN KEY ("filingCountryCustomsId") REFERENCES "FilingCountryCustomsVersion"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
