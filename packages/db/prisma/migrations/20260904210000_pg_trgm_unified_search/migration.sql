-- Create extension pg_trgm if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes on searchable columns for unified search
CREATE INDEX IF NOT EXISTS "idx_party_name_raw_name_trgm" ON "PartyName" USING gin ("rawName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_product_name_trgm" ON "Product" USING gin ("productName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_internal_sku_trgm" ON "Product" USING gin ("internalSku" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_commercial_desc_trgm" ON "Product" USING gin ("commercialDescription" gin_trgm_ops);
