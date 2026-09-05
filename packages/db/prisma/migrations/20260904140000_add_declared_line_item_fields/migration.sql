-- Source-document evidence for HS code / country of origin / export-control
-- code on a line item, kept separate from the existing countryOfOrigin /
-- htsCode / eccnCode columns (which are working values an agent may fill and
-- a human then reviews/approves). These three simply preserve what the
-- source document said, so it is never lost or conflated with an approved
-- classification/origin/export-control decision reached elsewhere.

ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "declaredHsCode" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "declaredCountryOfOrigin" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "declaredExportControlCode" TEXT;
