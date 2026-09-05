-- Records which FieldReviewAction (APPROVE/EDIT/REJECT/MARK_NOT_APPLICABLE/
-- SELECT_ALTERNATE) produced each FieldApproval row, so a reader can tell a
-- human confirming a value as-is apart from a human correcting it -- an EDIT
-- overwrites the field's stored value in place, so `value` alone can't tell
-- the two apart once persisted.

ALTER TABLE "FieldApproval" ADD COLUMN IF NOT EXISTS "action" TEXT;
