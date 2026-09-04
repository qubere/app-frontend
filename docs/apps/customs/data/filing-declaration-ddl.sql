-- Phase 1: register the committed canonical JSON Schema files.
--
-- Design only. This script has not been executed against the database.
-- Schema content remains source-controlled on disk; this table stores only
-- the immutable path/version identity used to locate it.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "FilingSchemas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schemaPath" TEXT NOT NULL,
    "schemaVersion" VARCHAR(50) NOT NULL,

    CONSTRAINT "FilingSchemas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FilingSchemas_schemaPath_schemaVersion_key"
        UNIQUE ("schemaPath", "schemaVersion"),
    CONSTRAINT "FilingSchemas_schemaPath_not_blank_check"
        CHECK (length(btrim("schemaPath")) > 0),
    CONSTRAINT "FilingSchemas_schemaVersion_not_blank_check"
        CHECK (length(btrim("schemaVersion")) > 0)
);

CREATE INDEX "FilingSchemas_schemaVersion_idx"
    ON "FilingSchemas" ("schemaVersion");

-- Release is deliberately not duplicated here. Release selection is driven by
-- FilingCountryCustomsVersion and connected through filing configuration.
