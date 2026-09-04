-- Baselined for the same reason as 20260821000000_add_customs_version_tables:
-- this schema change (AbiFilerCredential + its two enums) was applied
-- out-of-band via `prisma db push` without a migration file ever being
-- generated. Recreated here so migration history matches the live schema,
-- and guarded with IF NOT EXISTS / DO blocks so it's safe both to baseline
-- via `prisma migrate resolve --applied` on a database that already has it,
-- and to actually run via `prisma migrate deploy` on one that doesn't.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FilerCredentialStatus') THEN
    CREATE TYPE "FilerCredentialStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AceEnvironment') THEN
    CREATE TYPE "AceEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AbiFilerCredential" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "filerCode" TEXT NOT NULL,
    "secretRef" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://ace.cbp.dhs.gov/abi',
    "environment" "AceEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "status" "FilerCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbiFilerCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AbiFilerCredential_accountId_key" ON "AbiFilerCredential"("accountId");

CREATE INDEX IF NOT EXISTS "AbiFilerCredential_accountId_idx" ON "AbiFilerCredential"("accountId");

CREATE INDEX IF NOT EXISTS "AbiFilerCredential_filerCode_idx" ON "AbiFilerCredential"("filerCode");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AbiFilerCredential_accountId_fkey'
  ) THEN
    ALTER TABLE "AbiFilerCredential" ADD CONSTRAINT "AbiFilerCredential_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
