-- Expands DocumentType with the remaining first-class trade/customs document
-- types from the document-intelligence catalog (transport instructions,
-- origin/preference evidence, government filings) so they can be classified
-- and schema-scoped instead of falling through to OTHER.

ALTER TYPE "DocumentType" ADD VALUE 'FORWARDING_INSTRUCTION';
ALTER TYPE "DocumentType" ADD VALUE 'BOOKING_REQUEST';
ALTER TYPE "DocumentType" ADD VALUE 'ARRIVAL_NOTICE';
ALTER TYPE "DocumentType" ADD VALUE 'PURCHASE_ORDER';
ALTER TYPE "DocumentType" ADD VALUE 'DELIVERY_NOTE';
ALTER TYPE "DocumentType" ADD VALUE 'SHIPPING_INSTRUCTION';
ALTER TYPE "DocumentType" ADD VALUE 'CMR';
ALTER TYPE "DocumentType" ADD VALUE 'SEA_WAYBILL';
ALTER TYPE "DocumentType" ADD VALUE 'CUSTOMS_ENTRY';
ALTER TYPE "DocumentType" ADD VALUE 'EUR1_CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE 'ATR_CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE 'EXPORT_DECLARATION';
ALTER TYPE "DocumentType" ADD VALUE 'IMPORT_DECLARATION';
