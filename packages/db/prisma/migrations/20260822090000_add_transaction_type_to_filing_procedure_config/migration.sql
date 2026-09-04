-- Restores FilingProcedureConfig.transactionType, dropped by
-- 20260819084952_drop_transaction_type_columns, per the code-level fix in
-- prisma/schema.prisma (bb8ad90 / addendum 2026-08-21).
ALTER TABLE "FilingProcedureConfig" ADD COLUMN "transactionType" TEXT;
