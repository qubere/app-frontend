-- Tenant-isolation backstop: EntryProofEvent carries accountId but had no
-- `account` relation, so the automatic Prisma isolation extension in
-- src/lib/db.ts (which scans the DMMF for a field literally named "account")
-- never applied its DataMode filter to this model. Adding a real FK relation
-- makes it visible to that extension with no query-site changes, matching the
-- Phase 0 fix for WorkMetricSnapshot/DrawbackLot/DrawbackClaimSequence
-- (see 20260814020000_tenant_account_relation_backstop).
--
-- Guard table/constraint existence so this can still be deployed to a clean
-- CI/shadow database where EntryProofEvent may not exist yet.

DO $$
BEGIN
  IF to_regclass('"EntryProofEvent"') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EntryProofEvent_accountId_fkey') THEN
    ALTER TABLE "EntryProofEvent"
      ADD CONSTRAINT "EntryProofEvent_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
