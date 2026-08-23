-- Align migration-built databases with AuditLog fields present in schema.prisma.
-- These columns are nullable so existing audit rows remain valid.

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "effectiveUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "impersonationSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "resourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "resourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "clientId" TEXT,
  ADD COLUMN IF NOT EXISTS "oldValue" JSONB,
  ADD COLUMN IF NOT EXISTS "newValue" JSONB;

CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_effectiveUserId_idx" ON "AuditLog"("effectiveUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_impersonationSessionId_idx" ON "AuditLog"("impersonationSessionId");

