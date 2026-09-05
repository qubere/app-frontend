-- Dangerous-goods / transport-property facts, captured where present on a
-- line item from any document type. Source facts only, not a compliance
-- determination.

ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "dangerousGoodsIndicator" BOOLEAN;
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "unNumber" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "unProperShippingName" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "dangerousGoodsClass" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "subsidiaryRisk" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "packingGroup" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "marinePollutantIndicator" BOOLEAN;
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "minimumTransportTemperature" DECIMAL(65,30);
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "maximumTransportTemperature" DECIMAL(65,30);
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "temperatureUom" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "handlingInstructions" TEXT[];
ALTER TABLE "ShipmentLineItem" ADD COLUMN IF NOT EXISTS "productProperties" TEXT[];
