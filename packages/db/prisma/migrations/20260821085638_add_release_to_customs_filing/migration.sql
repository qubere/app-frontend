-- Recreated to reconcile local migration history with a live database where
-- this migration was originally applied out-of-band via `prisma migrate dev`
-- without the generated SQL ever being committed. Baselined via
-- `prisma migrate resolve --applied` rather than re-run.

ALTER TABLE "CustomsFiling" ADD COLUMN IF NOT EXISTS "release" TEXT DEFAULT '1.0';
