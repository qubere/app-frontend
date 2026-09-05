-- Part 1: trigram completeness fix.
--
-- The 20260904210000/20260904220000 migrations indexed most, but not all, of
-- the columns unifiedSearchService.ts / buildDocumentWhereWithOptions OR
-- together. Per the reasoning already written into 20260904210000: Postgres
-- cannot use a bitmap-OR across a mix of indexed and unindexed branches, so
-- every unindexed column in an OR clause forces a sequential scan for the
-- WHOLE clause, silently erasing the benefit of every index next to it.
-- These were the columns still missing an index.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "idx_shipment_document_file_name_trgm"
ON "ShipmentDocument" USING gin ("fileName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_shipment_document_doc_type_trgm"
ON "ShipmentDocument" USING gin ("docType" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_shipment_document_uploaded_by_name_trgm"
ON "ShipmentDocument" USING gin ("uploadedByName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_shipment_document_uploaded_by_email_trgm"
ON "ShipmentDocument" USING gin ("uploadedByEmail" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_extraction_field_field_name_trgm"
ON "ExtractionField" USING gin ("fieldName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_client_name_trgm"
ON "Client" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_shipment_shipment_number_trgm"
ON "Shipment" USING gin ("shipmentNumber" gin_trgm_ops);

-- Part 2: new entity kinds the omnibox is being extended to cover
-- (shipment, client, importer, person) each need the same treatment.
CREATE INDEX IF NOT EXISTS "idx_importer_of_record_name_trgm"
ON "ImporterOfRecord" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_importer_of_record_cbp_number_trgm"
ON "ImporterOfRecord" USING gin ("cbpImporterNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_user_first_name_trgm"
ON "User" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_user_last_name_trgm"
ON "User" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_user_email_trgm"
ON "User" USING gin ("email" gin_trgm_ops);

-- Part 3: reference-data kinds folded into the same search surface as
-- "suggested" (semantic) results -- see SearchIndexEntry below. These trgm
-- indexes back a lexical fallback / admin lookup path independent of the
-- vector index, same rationale as everywhere else in this file.
CREATE INDEX IF NOT EXISTS "idx_ruling_ruling_number_trgm"
ON "Ruling" USING gin ("rulingNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_ruling_title_trgm"
ON "Ruling" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_hts_node_number_normalized_trgm"
ON "HtsNode" USING gin ("htsNumberNormalized" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_hts_node_description_trgm"
ON "HtsNode" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_denied_party_entity_name_trgm"
ON "DeniedPartyWatchlist" USING gin ("entityName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_adcvd_order_case_number_trgm"
ON "AdcvdOrder" USING gin ("caseNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_adcvd_order_title_trgm"
ON "AdcvdOrder" USING gin ("title" gin_trgm_ops);

-- Part 4: SearchIndexEntry -- the generic cross-entity semantic index.
-- Mirrors the AccountMemory / ProductHelpArticle pgvector pattern already in
-- this schema (see 20260819120000_account_memory_pgvector and
-- 20260901090000_product_help_search).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "SearchIndexEntry" (
  "id" TEXT NOT NULL,
  "accountId" TEXT,
  "kind" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "href" TEXT NOT NULL,
  "searchText" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "embeddingVector" vector(768),
  "contentTsv" tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', "searchText")
  ) STORED,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchIndexEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SearchIndexEntry_kind_entityId_key" ON "SearchIndexEntry"("kind", "entityId");
CREATE INDEX IF NOT EXISTS "SearchIndexEntry_accountId_idx" ON "SearchIndexEntry"("accountId");
CREATE INDEX IF NOT EXISTS "SearchIndexEntry_kind_idx" ON "SearchIndexEntry"("kind");
CREATE INDEX IF NOT EXISTS "SearchIndexEntry_contentTsv_gin_idx" ON "SearchIndexEntry" USING gin ("contentTsv");
CREATE INDEX IF NOT EXISTS "SearchIndexEntry_embeddingVector_hnsw_idx"
ON "SearchIndexEntry" USING hnsw ("embeddingVector" vector_cosine_ops);
