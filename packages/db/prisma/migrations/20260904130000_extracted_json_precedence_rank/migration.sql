-- Real version-sequence precedence for ShipmentDocument.extractedJson writes.
-- Replaces the old "has any parse been accepted yet" existence check
-- (activeParseVersionId: null) with a numeric rank so two same-tier runs
-- racing (e.g. concurrent reprocess attempts) are ordered by their actual
-- DocumentParseVersion.version instead of by arrival order.

ALTER TABLE "ShipmentDocument" ADD COLUMN "extractedJsonPrecedenceRank" INTEGER;
