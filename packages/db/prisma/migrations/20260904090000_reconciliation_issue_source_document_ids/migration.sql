-- Per-document linking for reconciliation issues: lets the document review
-- screen show conflicts that touch a specific ShipmentDocument, not just the
-- doc-type labels already in sourceDocuments. Additive, backfills to '{}' so
-- existing rows are unaffected (UI falls back to label matching for them).
ALTER TABLE "ReconciliationIssue" ADD COLUMN "sourceDocumentIds" TEXT[] NOT NULL DEFAULT '{}';
