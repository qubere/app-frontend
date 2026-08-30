-- Document intake improvements.
--
-- 1. DocumentShipmentCandidate: v2 weighted, multi-identifier matching --
--    record how a score was reached (matchMethod) and the per-signal
--    contribution breakdown (scoreBreakdown) so the "why did this match?" UI
--    can render it.
-- 2. ShipmentDocument: malware scan state for the immutable original, run
--    before any parsing. Fail-closed -- a non-CLEAN/non-SKIPPED status
--    quarantines the document.

ALTER TABLE "DocumentShipmentCandidate"
  ADD COLUMN IF NOT EXISTS "matchMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "scoreBreakdown" JSONB;

ALTER TABLE "ShipmentDocument"
  ADD COLUMN IF NOT EXISTS "malwareScanStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "malwareScanDetail" TEXT,
  ADD COLUMN IF NOT EXISTS "malwareScanAt" TIMESTAMP(3);

-- Existing rows predate scanning; leave them PENDING so a backfill job (or the
-- next reprocess) can scan them rather than silently marking them CLEAN.

CREATE INDEX IF NOT EXISTS "ShipmentDocument_accountId_malwareScanStatus_idx"
  ON "ShipmentDocument"("accountId", "malwareScanStatus");
