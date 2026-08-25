-- Additive only: composite indexes on ScreeningEntity for the
-- restrictedPartyRepository.ts reference-list query, and a truncation flag
-- on RestrictedPartyScreeningResult. Touches no existing rows.

CREATE INDEX IF NOT EXISTS "ScreeningEntity_publicationStatus_sourceList_idx"
  ON "ScreeningEntity" ("publicationStatus", "sourceList");

CREATE INDEX IF NOT EXISTS "ScreeningEntity_publicationStatus_provider_idx"
  ON "ScreeningEntity" ("publicationStatus", "provider");

ALTER TABLE "RestrictedPartyScreeningResult"
  ADD COLUMN IF NOT EXISTS "matchesTruncated" BOOLEAN;
