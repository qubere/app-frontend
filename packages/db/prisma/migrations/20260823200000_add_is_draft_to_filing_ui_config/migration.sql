-- The UI configuration API distinguishes draft and active configurations.
-- Existing active configurations predate this column and must remain non-drafts.
ALTER TABLE "FilingUIConfig"
ADD COLUMN IF NOT EXISTS "isDraft" BOOLEAN NOT NULL DEFAULT true;

UPDATE "FilingUIConfig"
SET "isDraft" = false
WHERE "isActive" = true
  AND "isDraft" = true;

CREATE INDEX IF NOT EXISTS "FilingUIConfig_combo_draft_idx"
ON "FilingUIConfig"("country", "procedureCode", "messageName", "messageType", "isDraft");
