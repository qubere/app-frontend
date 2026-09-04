-- Dangerous-goods / transport-property facts, captured where present on a
-- line item from any document type. Source facts only, not a compliance
-- determination.

ALTER TABLE "ShipmentLineItem" ADD COLUMN "dangerousGoodsIndicator" BOOLEAN;
ALTER TABLE "ShipmentLineItem" ADD COLUMN "unNumber" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN "unProperShippingName" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN "dangerousGoodsClass" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN "subsidiaryRisk" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN "packingGroup" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN "marinePollutantIndicator" BOOLEAN;
ALTER TABLE "ShipmentLineItem" ADD COLUMN "minimumTransportTemperature" DECIMAL(65,30);
ALTER TABLE "ShipmentLineItem" ADD COLUMN "maximumTransportTemperature" DECIMAL(65,30);
ALTER TABLE "ShipmentLineItem" ADD COLUMN "temperatureUom" TEXT;
ALTER TABLE "ShipmentLineItem" ADD COLUMN "handlingInstructions" TEXT[];
ALTER TABLE "ShipmentLineItem" ADD COLUMN "productProperties" TEXT[];
