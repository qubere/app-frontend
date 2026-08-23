-- A UI configuration is selected by country, procedure, message, message type,
-- and customs release. The old constraint omitted release, preventing the
-- per-release editor from storing more than one configuration.
ALTER TABLE "FilingUIConfig"
DROP CONSTRAINT IF EXISTS "FilingUIConfig_country_procedureCode_messageName_messageTyp_key";

DROP INDEX IF EXISTS "FilingUIConfig_country_procedureCode_messageName_messageTyp_key";
DROP INDEX IF EXISTS "FilingUIConfig_country_procedureCode_messageName_messageTyp_idx";
DROP INDEX IF EXISTS "FilingUIConfig_combo_draft_idx";

-- PostgreSQL treats NULL values as distinct in normal unique indexes. The
-- COALESCE expression gives the fallback (NULL-release) configuration one
-- stable key while retaining distinct rows for actual releases.
CREATE UNIQUE INDEX "FilingUIConfig_active_per_release_key"
ON "FilingUIConfig" (
  "country", "procedureCode", "messageName", "messageType", COALESCE("release", ''::text)
)
WHERE "isActive" = true;

CREATE UNIQUE INDEX "FilingUIConfig_draft_per_release_key"
ON "FilingUIConfig" (
  "country", "procedureCode", "messageName", "messageType", COALESCE("release", ''::text)
)
WHERE "isDraft" = true;

CREATE INDEX "FilingUIConfig_combo_release_status_idx"
ON "FilingUIConfig" ("country", "procedureCode", "messageName", "messageType", "release", "isActive", "isDraft");
