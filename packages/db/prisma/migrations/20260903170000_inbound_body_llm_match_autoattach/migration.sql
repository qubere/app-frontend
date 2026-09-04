-- Inbound email body (for shipment matching + reviewer context)
ALTER TABLE "InboundEmail" ADD COLUMN "bodyText" TEXT;

-- LLM matcher "why this shipment" explanation on a persisted candidate
ALTER TABLE "DocumentShipmentCandidate" ADD COLUMN "reasoning" TEXT;

-- Per-inbound-address auto-attach aggressiveness. Existing rows adopt the new
-- default ("CONFIDENT") so a confidently-matched document is attached without a
-- manual review.
ALTER TABLE "InboundAddress" ADD COLUMN "autoAttachPolicy" TEXT NOT NULL DEFAULT 'CONFIDENT';
