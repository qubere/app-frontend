-- Decision rejection reason code (issue #202, 1.3.4).
--
-- humanNotes on a REJECT is already mandatory. Add a structured code beside it
-- so rejections are analysable ("why are specialists rejecting HTS proposals?")
-- without NLP over free text. The code is validated in the API against the
-- versioned picklist in src/modules/decisions/rejectionReasons.ts; the column
-- itself is a plain nullable string so older rows and re-evaluations are fine.

ALTER TABLE "AgentDecision"
  ADD COLUMN IF NOT EXISTS "rejectionReasonCode" TEXT;
