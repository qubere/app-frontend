-- Expands DocumentType with the remaining first-class trade/customs document
-- types from the document-intelligence catalog (transport instructions,
-- origin/preference evidence, government filings) so they can be classified
-- and schema-scoped instead of falling through to OTHER.

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'FORWARDING_INSTRUCTION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'BOOKING_REQUEST';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'ARRIVAL_NOTICE';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DELIVERY_NOTE';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SHIPPING_INSTRUCTION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CMR';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SEA_WAYBILL';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CUSTOMS_ENTRY';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'EUR1_CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'ATR_CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'EXPORT_DECLARATION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'IMPORT_DECLARATION';
