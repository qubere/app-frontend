-- Actions read-path indexes for the exception list (see
-- docs/performance/ACTIONS-PERFORMANCE.md).
--
-- Query shapes served (all ordered `createdAt DESC, id DESC`, keyset-paged):
--   1. Default list:      WHERE "accountId" = $1
--                         -> ExceptionItem_accountId_createdAt_idx
--   2. "Assigned to me":  WHERE "accountId" = $1 AND "assignedToUserId" = $2
--                         -> ExceptionItem_accountId_assignedToUserId_createdAt_idx
--
-- Status-filtered lists are already covered by the existing
-- ExceptionItem_accountId_status_createdAt_idx (added 20260826210000).
--
-- Plain CREATE INDEX (matching migration 20260826210000). It takes a brief
-- ACCESS EXCLUSIVE lock while the index builds; on a large production table,
-- run the CONCURRENTLY form out-of-band and `INSERT` a row into
-- "_prisma_migrations" to mark this migration applied instead:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "..." ON "ExceptionItem" (...);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExceptionItem_accountId_createdAt_idx"
  ON "ExceptionItem" ("accountId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExceptionItem_accountId_assignedToUserId_createdAt_idx"
  ON "ExceptionItem" ("accountId", "assignedToUserId", "createdAt");
