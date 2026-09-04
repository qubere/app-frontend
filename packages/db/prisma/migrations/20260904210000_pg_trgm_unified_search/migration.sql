-- Create extension pg_trgm if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes on searchable columns for unified search.
-- Every column unifiedSearchService.ts filters with `contains`/`startsWith`
-- inside a party/product OR predicate needs a matching index here -- Postgres
-- cannot use a bitmap-OR across a mix of indexed and unindexed branches, so a
-- single missing column forces a sequential scan for the whole OR clause.
CREATE INDEX IF NOT EXISTS "idx_party_name_raw_name_trgm" ON "PartyName" USING gin ("rawName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_party_internal_party_code_trgm" ON "Party" USING gin ("internalPartyCode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_party_identifier_normalized_value_trgm" ON "PartyIdentifier" USING gin ("normalizedValue" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_product_name_trgm" ON "Product" USING gin ("productName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_internal_sku_trgm" ON "Product" USING gin ("internalSku" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_commercial_desc_trgm" ON "Product" USING gin ("commercialDescription" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_brand_trgm" ON "Product" USING gin ("brand" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_model_trgm" ON "Product" USING gin ("model" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_customs_desc_trgm" ON "Product" USING gin ("customsDescription" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_identifier_normalized_value_trgm" ON "ProductIdentifier" USING gin ("normalizedValue" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_classification_normalized_code_trgm" ON "ProductClassification" USING gin ("normalizedCode" gin_trgm_ops);
