ALTER TABLE "ShipmentDocument"
ADD COLUMN IF NOT EXISTS "parsedSearchText" TEXT;

-- pg_trgm is already installed by 20260904210000_pg_trgm_unified_search.
-- Keep this migration independently safe for partially-applied environments.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "idx_shipment_document_parsed_search_trgm"
ON "ShipmentDocument" USING gin ("parsedSearchText" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_shipment_document_extracted_json_trgm"
ON "ShipmentDocument" USING gin ("extractedJson" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_shipment_document_raw_content_trgm"
ON "ShipmentDocument" USING gin ("rawContent" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_extraction_field_value_trgm"
ON "ExtractionField" USING gin ("value" gin_trgm_ops);

-- Bring legacy rows into the same client-attribution contract as new capture.
-- The direct document field is canonical; the shipment/inbound destination are
-- deterministic sources and are never inferred from document prose.
UPDATE "ShipmentDocument" AS document
SET "clientId" = shipment."clientId"
FROM "Shipment" AS shipment
WHERE document."shipmentId" = shipment."id"
  AND document."accountId" = shipment."accountId"
  AND document."clientId" IS NULL
  AND shipment."clientId" IS NOT NULL;

UPDATE "ShipmentDocument" AS document
SET "clientId" = inbound_email."clientId"
FROM "InboundAttachment" AS attachment
JOIN "InboundEmail" AS inbound_email
  ON inbound_email."id" = attachment."inboundEmailId"
WHERE attachment."shipmentDocumentId" = document."id"
  AND document."accountId" = inbound_email."accountId"
  AND document."clientId" IS NULL
  AND inbound_email."clientId" IS NOT NULL;
