-- Additive only: regulatory action/order/citation metadata on
-- ScreeningEntityReference, closing the legacy tables_of_denial_orders /
-- citations gap (PartyScreening_Tables.sql: tdo_type_of_denial, tdo_no_tdo,
-- tdo_dt_tdo, tdo_dt_fr_cit, cit_url). All columns nullable; no backfill,
-- no existing rows touched, no data cleared.

ALTER TABLE "ScreeningEntityReference"
  ADD COLUMN IF NOT EXISTS "restrictionType" TEXT,
  ADD COLUMN IF NOT EXISTS "orderNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "orderDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publicationDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "citationUrl" TEXT;
