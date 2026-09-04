-- MANUAL-ONLY DROP SCRIPT - DO NOT RUN DURING BUILD OR PR DEPLOYMENT.
--
-- FilingTransactionType is superseded by FilingProcedureCatalog. The automatic
-- Prisma migration creates FilingProcedureCatalog and copies
-- FilingTransactionType.code into FilingProcedureCatalog.procedureCode, but it
-- intentionally leaves the shared legacy table untouched.
--
-- Run this script only after every environment has:
--   1. deployed the migration that creates and backfills FilingProcedureCatalog,
--   2. deployed application code that no longer reads/writes FilingTransactionType,
--   3. confirmed no downstream/reporting/manual processes still depend on it.

BEGIN;

DROP TABLE IF EXISTS "FilingTransactionType";

COMMIT;
