-- Additive: closes gaps identified against the "Reference Data Changes" spec.
--
-- 1. ReferenceDataChangeType gains EXPIRED, distinct from SUPERSEDED, for
--    entities superseded by referenceDataExpirySweep.ts because their own
--    expirationDate passed (as opposed to sweep-by-omission or an explicit
--    source delist). Adding an enum value is non-destructive.
ALTER TYPE "ReferenceDataChangeType" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- 2. Composite index matching referenceDataExpirySweep.ts's
--    WHERE publicationStatus = 'PUBLISHED' AND expirationDate <= now() scan.
CREATE INDEX IF NOT EXISTS "ScreeningEntity_publicationStatus_expirationDate_idx"
  ON "ScreeningEntity" ("publicationStatus", "expirationDate");

-- 3. RdpsPartyOutcome gains:
--    - transitionType: deterministic previous->new classification
--      (classifyRdpsTransition in outcomeRecorder.ts), nullable so existing
--      rows are left as-is.
--    - triggeringChangeSetIds: ReferenceDataChangeSet ids that contributed
--      this party as a DELTA_IMPACT candidate, enabling a per-change-set
--      Impacted Parties view. Defaults to '{}' so existing rows and every
--      non-DELTA_IMPACT run type remain valid with no triggering changes.
ALTER TABLE "RdpsPartyOutcome" ADD COLUMN IF NOT EXISTS "transitionType" TEXT;
ALTER TABLE "RdpsPartyOutcome" ADD COLUMN IF NOT EXISTS "triggeringChangeSetIds" TEXT[] NOT NULL DEFAULT '{}';
