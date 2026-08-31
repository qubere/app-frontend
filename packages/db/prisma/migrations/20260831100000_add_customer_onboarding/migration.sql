-- Customer Onboarding (F16): OnboardingCase, FiveOhSixRecord, BondVerification,
-- PoaEnvelope, PoaTemplate, BrokerComplianceProfile, BrokerPQO,
-- BrokerDistrictPermit, OnboardingEntity, OnboardingEvent.
-- Also extends Bond, PowerOfAttorney, ImporterOfRecord, Client.
-- Deploy before any code that SELECTs new columns.

-- ─── Extend existing: Bond ────────────────────────────────────────────────────
ALTER TABLE "Bond"
  ADD COLUMN IF NOT EXISTS "activityCode"                  TEXT,
  ADD COLUMN IF NOT EXISTS "continuousBondFormulaAmount"   DECIMAL(16,2),
  ADD COLUMN IF NOT EXISTS "lastVerifiedAt"                TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suretyCode"                    TEXT;

-- Normalise status values: "Active" → "verified" only where a verification
-- will eventually confirm it; "Unverified" → "unverified". Leave existing
-- "Expired"/"Revoked" as-is (mapped in application layer).
UPDATE "Bond" SET "status" = 'unverified' WHERE "status" = 'Unverified';

-- ─── Extend existing: PowerOfAttorney ────────────────────────────────────────
ALTER TABLE "PowerOfAttorney"
  ADD COLUMN IF NOT EXISTS "signerName"          TEXT,
  ADD COLUMN IF NOT EXISTS "signerTitle"         TEXT,
  ADD COLUMN IF NOT EXISTS "signerRole"          TEXT,
  ADD COLUMN IF NOT EXISTS "executionMethod"     TEXT,
  ADD COLUMN IF NOT EXISTS "executedDocumentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "templateId"          TEXT,
  ADD COLUMN IF NOT EXISTS "revokedAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedReason"       TEXT;

-- ─── Extend existing: ImporterOfRecord ───────────────────────────────────────
ALTER TABLE "ImporterOfRecord"
  ADD COLUMN IF NOT EXISTS "registrationStatus" TEXT NOT NULL DEFAULT 'unregistered';

-- cbpImporterNumber is currently @unique NOT NULL; allow null for pre-assigned window.
ALTER TABLE "ImporterOfRecord"
  ALTER COLUMN "cbpImporterNumber" DROP NOT NULL;

-- ─── Extend existing: Client ──────────────────────────────────────────────────
-- status already has "ACTIVE" | "INACTIVE"; add "ONBOARDING" (application layer only,
-- no enum constraint in Postgres for this column).

-- ─── New: OnboardingCase ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "OnboardingCase" (
    "id"                          TEXT          NOT NULL,
    "accountId"                   TEXT          NOT NULL,
    "clientId"                    TEXT,
    "primaryImporterId"           TEXT,
    "path"                        TEXT          NOT NULL,
    "status"                      TEXT          NOT NULL DEFAULT 'draft',
    "currentStep"                 INTEGER       NOT NULL DEFAULT 1,
    "stepStatus"                  JSONB         NOT NULL DEFAULT '{}',
    "blockers"                    JSONB         NOT NULL DEFAULT '[]',
    "projectedAnnualDutyTaxFee"   DECIMAL(16,2),
    "activatedAt"                 TIMESTAMP(3),
    "activatedByUserId"           TEXT,
    "withdrawnReason"             TEXT,
    "assignedUserId"              TEXT,
    "source"                      TEXT          NOT NULL DEFAULT 'UI',
    "createdAt"                   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                   TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "OnboardingCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OnboardingCase_accountId_status_idx"
  ON "OnboardingCase"("accountId", "status");
CREATE INDEX IF NOT EXISTS "OnboardingCase_accountId_clientId_idx"
  ON "OnboardingCase"("accountId", "clientId");
CREATE INDEX IF NOT EXISTS "OnboardingCase_assignedUserId_idx"
  ON "OnboardingCase"("assignedUserId");

ALTER TABLE "OnboardingCase"
  ADD CONSTRAINT "OnboardingCase_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE;
ALTER TABLE "OnboardingCase"
  ADD CONSTRAINT "OnboardingCase_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL;
ALTER TABLE "OnboardingCase"
  ADD CONSTRAINT "OnboardingCase_primaryImporterId_fkey"
    FOREIGN KEY ("primaryImporterId") REFERENCES "ImporterOfRecord"("id") ON DELETE SET NULL;

-- ─── New: OnboardingEntity ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "OnboardingEntity" (
    "id"                   TEXT         NOT NULL,
    "accountId"            TEXT         NOT NULL,
    "caseId"               TEXT         NOT NULL,
    "legalEntityId"        TEXT,
    "importerOfRecordId"   TEXT,
    "importerNumberType"   TEXT         NOT NULL DEFAULT 'EIN',
    "importerNumber"       TEXT,
    "residentAgent"        JSONB,
    "officers"             JSONB        NOT NULL DEFAULT '[]',
    "poaId"                TEXT,
    "bondId"               TEXT,
    "bondCoverage"         TEXT         NOT NULL DEFAULT 'own',
    "screeningStatus"      TEXT         NOT NULL DEFAULT 'pending',
    "screeningDisposition" JSONB,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnboardingEntity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OnboardingEntity_accountId_idx"
  ON "OnboardingEntity"("accountId");
CREATE INDEX IF NOT EXISTS "OnboardingEntity_caseId_idx"
  ON "OnboardingEntity"("caseId");

ALTER TABLE "OnboardingEntity"
  ADD CONSTRAINT "OnboardingEntity_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "OnboardingCase"("id") ON DELETE CASCADE;
ALTER TABLE "OnboardingEntity"
  ADD CONSTRAINT "OnboardingEntity_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL;
ALTER TABLE "OnboardingEntity"
  ADD CONSTRAINT "OnboardingEntity_importerOfRecordId_fkey"
    FOREIGN KEY ("importerOfRecordId") REFERENCES "ImporterOfRecord"("id") ON DELETE SET NULL;
ALTER TABLE "OnboardingEntity"
  ADD CONSTRAINT "OnboardingEntity_poaId_fkey"
    FOREIGN KEY ("poaId") REFERENCES "PowerOfAttorney"("id") ON DELETE SET NULL;
ALTER TABLE "OnboardingEntity"
  ADD CONSTRAINT "OnboardingEntity_bondId_fkey"
    FOREIGN KEY ("bondId") REFERENCES "Bond"("id") ON DELETE SET NULL;

-- ─── New: FiveOhSixRecord ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FiveOhSixRecord" (
    "id"                   TEXT         NOT NULL,
    "accountId"            TEXT         NOT NULL,
    "caseId"               TEXT,
    "onboardingEntityId"   TEXT,
    "legalEntityId"        TEXT,
    "action"               TEXT         NOT NULL,
    "importerNumberType"   TEXT         NOT NULL,
    "importerNumber"       TEXT,
    "payload"              JSONB        NOT NULL DEFAULT '{}',
    "provenance"           JSONB        NOT NULL DEFAULT '{}',
    "status"               TEXT         NOT NULL DEFAULT 'draft',
    "deliveryMethod"       TEXT,
    "pdfDocumentUrl"       TEXT,
    "transmissionRef"      TEXT,
    "cbpResponseRaw"       TEXT,
    "cbpAssignedNumber"    TEXT,
    "rejectionReasons"     JSONB,
    "submittedAt"          TIMESTAMP(3),
    "acceptedAt"           TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiveOhSixRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FiveOhSixRecord_accountId_status_idx"
  ON "FiveOhSixRecord"("accountId", "status");
CREATE INDEX IF NOT EXISTS "FiveOhSixRecord_caseId_idx"
  ON "FiveOhSixRecord"("caseId");

ALTER TABLE "FiveOhSixRecord"
  ADD CONSTRAINT "FiveOhSixRecord_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE;
ALTER TABLE "FiveOhSixRecord"
  ADD CONSTRAINT "FiveOhSixRecord_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "OnboardingCase"("id") ON DELETE SET NULL;

-- ─── New: BondVerification ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BondVerification" (
    "id"                    TEXT         NOT NULL,
    "accountId"             TEXT         NOT NULL,
    "bondId"                TEXT         NOT NULL,
    "method"                TEXT         NOT NULL,
    "result"                TEXT         NOT NULL,
    "queriedImporterNumber" TEXT,
    "requestRaw"            TEXT,
    "responseRaw"           TEXT,
    "discrepancies"         JSONB,
    "suretyCode"            TEXT,
    "suretyName"            TEXT,
    "attestedByUserId"      TEXT,
    "attestationNote"       TEXT,
    "performedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BondVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BondVerification_accountId_idx"
  ON "BondVerification"("accountId");
CREATE INDEX IF NOT EXISTS "BondVerification_bondId_performedAt_idx"
  ON "BondVerification"("bondId", "performedAt");

ALTER TABLE "BondVerification"
  ADD CONSTRAINT "BondVerification_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE;
ALTER TABLE "BondVerification"
  ADD CONSTRAINT "BondVerification_bondId_fkey"
    FOREIGN KEY ("bondId") REFERENCES "Bond"("id") ON DELETE CASCADE;

-- ─── New: PoaTemplate ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PoaTemplate" (
    "id"                    TEXT         NOT NULL,
    "accountId"             TEXT         NOT NULL,
    "name"                  TEXT         NOT NULL,
    "version"               INTEGER      NOT NULL DEFAULT 1,
    "entityTypes"           TEXT[]       NOT NULL DEFAULT '{}',
    "bodyStorageUrl"        TEXT         NOT NULL,
    "termMonths"            INTEGER,
    "requiresNotarization"  BOOLEAN      NOT NULL DEFAULT false,
    "isDefault"             BOOLEAN      NOT NULL DEFAULT false,
    "active"                BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PoaTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PoaTemplate_accountId_name_version_key" UNIQUE ("accountId", "name", "version")
);

CREATE INDEX IF NOT EXISTS "PoaTemplate_accountId_active_idx"
  ON "PoaTemplate"("accountId", "active");

ALTER TABLE "PoaTemplate"
  ADD CONSTRAINT "PoaTemplate_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE;

-- ─── New: PoaEnvelope ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PoaEnvelope" (
    "id"                   TEXT         NOT NULL,
    "accountId"            TEXT         NOT NULL,
    "powerOfAttorneyId"    TEXT         NOT NULL,
    "provider"             TEXT         NOT NULL,
    "providerEnvelopeId"   TEXT,
    "templateId"           TEXT,
    "status"               TEXT         NOT NULL,
    "signerName"           TEXT         NOT NULL,
    "signerEmail"          TEXT         NOT NULL,
    "signerTitle"          TEXT,
    "signerRole"           TEXT         NOT NULL,
    "sentAt"               TIMESTAMP(3),
    "completedAt"          TIMESTAMP(3),
    "executedDocumentUrl"  TEXT,
    "auditTrailUrl"        TEXT,
    "webhookEventsRaw"     JSONB        NOT NULL DEFAULT '[]',
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PoaEnvelope_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PoaEnvelope_powerOfAttorneyId_key" UNIQUE ("powerOfAttorneyId")
);

CREATE INDEX IF NOT EXISTS "PoaEnvelope_accountId_idx"
  ON "PoaEnvelope"("accountId");
CREATE INDEX IF NOT EXISTS "PoaEnvelope_status_idx"
  ON "PoaEnvelope"("status");

ALTER TABLE "PoaEnvelope"
  ADD CONSTRAINT "PoaEnvelope_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE;
ALTER TABLE "PoaEnvelope"
  ADD CONSTRAINT "PoaEnvelope_powerOfAttorneyId_fkey"
    FOREIGN KEY ("powerOfAttorneyId") REFERENCES "PowerOfAttorney"("id") ON DELETE CASCADE;

-- ─── New: BrokerComplianceProfile ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BrokerComplianceProfile" (
    "id"                                        TEXT         NOT NULL,
    "accountId"                                 TEXT         NOT NULL,
    "licenseType"                               TEXT         NOT NULL DEFAULT 'CORPORATE',
    "brokerLicenseNumber"                       TEXT,
    "licenseIssueDate"                          TIMESTAMP(3),
    "nationalPermitNumber"                      TEXT,
    "nationalPermitStatus"                      TEXT         NOT NULL DEFAULT 'none',
    "filerCode"                                 TEXT,
    "triennialStatusReportDueOn"               TIMESTAMP(3),
    "responsibleSupervisionAttestedByUserId"   TEXT,
    "responsibleSupervisionAttestedAt"         TIMESTAMP(3),
    "status"                                    TEXT         NOT NULL DEFAULT 'incomplete',
    "createdAt"                                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                                 TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrokerComplianceProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BrokerComplianceProfile_accountId_key" UNIQUE ("accountId")
);

CREATE INDEX IF NOT EXISTS "BrokerComplianceProfile_accountId_idx"
  ON "BrokerComplianceProfile"("accountId");

ALTER TABLE "BrokerComplianceProfile"
  ADD CONSTRAINT "BrokerComplianceProfile_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE;

-- ─── New: BrokerPQO ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BrokerPQO" (
    "id"                       TEXT         NOT NULL,
    "profileId"                TEXT         NOT NULL,
    "userId"                   TEXT,
    "name"                     TEXT         NOT NULL,
    "individualLicenseNumber"  TEXT         NOT NULL,
    "districts"                TEXT[]       NOT NULL DEFAULT '{}',
    "active"                   BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrokerPQO_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BrokerPQO_profileId_idx"
  ON "BrokerPQO"("profileId");

ALTER TABLE "BrokerPQO"
  ADD CONSTRAINT "BrokerPQO_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "BrokerComplianceProfile"("id") ON DELETE CASCADE;

-- ─── New: BrokerDistrictPermit ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BrokerDistrictPermit" (
    "id"            TEXT         NOT NULL,
    "profileId"     TEXT         NOT NULL,
    "districtCode"  TEXT         NOT NULL,
    "permitNumber"  TEXT,
    "status"        TEXT         NOT NULL DEFAULT 'active',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrokerDistrictPermit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BrokerDistrictPermit_profileId_districtCode_key" UNIQUE ("profileId", "districtCode")
);

ALTER TABLE "BrokerDistrictPermit"
  ADD CONSTRAINT "BrokerDistrictPermit_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "BrokerComplianceProfile"("id") ON DELETE CASCADE;

-- ─── New: OnboardingEvent ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "OnboardingEvent" (
    "id"          TEXT         NOT NULL,
    "accountId"   TEXT         NOT NULL,
    "caseId"      TEXT         NOT NULL,
    "type"        TEXT         NOT NULL,
    "step"        INTEGER,
    "actorUserId" TEXT,
    "actorType"   TEXT         NOT NULL DEFAULT 'USER',
    "detail"      JSONB        NOT NULL DEFAULT '{}',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnboardingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OnboardingEvent_caseId_createdAt_idx"
  ON "OnboardingEvent"("caseId", "createdAt");

ALTER TABLE "OnboardingEvent"
  ADD CONSTRAINT "OnboardingEvent_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "OnboardingCase"("id") ON DELETE CASCADE;
