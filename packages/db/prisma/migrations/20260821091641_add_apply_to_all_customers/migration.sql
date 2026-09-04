-- Recreated to reconcile local migration history with a live database where
-- this migration was originally applied out-of-band via `prisma migrate dev`
-- without the generated SQL ever being committed. Baselined via
-- `prisma migrate resolve --applied` rather than re-run.

ALTER TABLE "FilingCustomerCustomsVersion" ADD COLUMN IF NOT EXISTS "applyToAllCustomers" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "FilingCustomerCustomsVersion_applyToAllCustomers_idx"
  ON "FilingCustomerCustomsVersion"("applyToAllCustomers");
