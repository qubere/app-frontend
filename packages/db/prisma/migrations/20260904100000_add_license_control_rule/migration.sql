-- LicenseControlRule: jurisdiction-specific export/import control rule
-- lookup table for License Determination (see schema.prisma's comment
-- above LicenseOperationType/LicenseControlRule). Ships empty -- no real
-- rule content may be fabricated; rows may only be ingested from an
-- authoritative regulatory source. The CHECK constraint below enforces at
-- the DB layer that this table can only ever assert a controlled/
-- not-controlled outcome, never any other LicenseDeterminationStatus value.

-- CreateTable
CREATE TABLE IF NOT EXISTS "LicenseControlRule" (
    "id" TEXT NOT NULL,
    "operationType" "LicenseOperationType" NOT NULL,
    "classificationType" TEXT NOT NULL,
    "classificationValue" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "decision" "LicenseDeterminationStatus" NOT NULL,
    "authority" TEXT,
    "citation" TEXT,
    "ruleVersion" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseControlRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LicenseControlRule_decision_check" CHECK ("decision" IN ('LICENSE_REQUIRED', 'NO_LICENSE_REQUIRED'))
);

CREATE INDEX IF NOT EXISTS "LicenseControlRule_operationType_classificationType_countr_idx" ON "LicenseControlRule"("operationType", "classificationType", "country");
