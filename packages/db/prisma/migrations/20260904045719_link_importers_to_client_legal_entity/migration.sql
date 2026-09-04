-- Phase 1 of the importer identity retrofit. Keep both links nullable until
-- the cleanup report is empty; a later gated migration can enforce clientId.
ALTER TABLE "ImporterOfRecord"
ADD COLUMN "legalEntityId" TEXT;

CREATE UNIQUE INDEX "ImporterOfRecord_legalEntityId_key"
ON "ImporterOfRecord"("legalEntityId");

ALTER TABLE "ImporterOfRecord"
ADD CONSTRAINT "ImporterOfRecord_legalEntityId_fkey"
FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Link only records with one unambiguous identifier match on both sides.
-- Names are intentionally excluded: a similar name is not filing authority.
WITH candidate_links AS (
  SELECT DISTINCT
    ior."id" AS importer_id,
    le."id" AS legal_entity_id
  FROM "ImporterOfRecord" ior
  JOIN "LegalEntity" le
    ON le."accountId" = ior."accountId"
  JOIN "CustomsProfile" profile
    ON profile."legalEntityId" = le."id"
  WHERE
    (
      ior."cbpImporterNumber" IS NOT NULL
      AND profile."cbpImporterNumber" IS NOT NULL
      AND regexp_replace(upper(ior."cbpImporterNumber"), '[^A-Z0-9]', '', 'g') =
          regexp_replace(upper(profile."cbpImporterNumber"), '[^A-Z0-9]', '', 'g')
    )
    OR
    (
      NULLIF(regexp_replace(ior."irsEin", '[^0-9]', '', 'g'), '') IS NOT NULL
      AND NULLIF(regexp_replace(profile."ein", '[^0-9]', '', 'g'), '') IS NOT NULL
      AND regexp_replace(ior."irsEin", '[^0-9]', '', 'g') =
          regexp_replace(profile."ein", '[^0-9]', '', 'g')
    )
), unambiguous_importers AS (
  SELECT importer_id, min(legal_entity_id) AS legal_entity_id
  FROM candidate_links
  GROUP BY importer_id
  HAVING count(*) = 1
), unambiguous_entities AS (
  SELECT legal_entity_id, min(importer_id) AS importer_id
  FROM candidate_links
  GROUP BY legal_entity_id
  HAVING count(*) = 1
), safe_links AS (
  SELECT importer.importer_id, importer.legal_entity_id
  FROM unambiguous_importers importer
  JOIN unambiguous_entities entity
    ON entity.legal_entity_id = importer.legal_entity_id
   AND entity.importer_id = importer.importer_id
)
UPDATE "ImporterOfRecord" ior
SET "legalEntityId" = safe.legal_entity_id
FROM safe_links safe
WHERE ior."id" = safe.importer_id
  AND ior."legalEntityId" IS NULL;

-- An explicit LegalEntity -> Client link is safe to inherit. Existing importer
-- assignments win and are never overwritten by this migration.
UPDATE "ImporterOfRecord" ior
SET "clientId" = le."clientId"
FROM "LegalEntity" le
WHERE ior."legalEntityId" = le."id"
  AND ior."clientId" IS NULL
  AND le."clientId" IS NOT NULL;

-- The primary importer on an onboarding case is another explicit link. Apply
-- it only when every linked case agrees on one client.
WITH case_clients AS (
  SELECT "primaryImporterId" AS importer_id, min("clientId") AS client_id
  FROM "OnboardingCase"
  WHERE "primaryImporterId" IS NOT NULL
    AND "clientId" IS NOT NULL
  GROUP BY "primaryImporterId"
  HAVING count(DISTINCT "clientId") = 1
)
UPDATE "ImporterOfRecord" ior
SET "clientId" = cases.client_id
FROM case_clients cases
WHERE ior."id" = cases.importer_id
  AND ior."clientId" IS NULL;
