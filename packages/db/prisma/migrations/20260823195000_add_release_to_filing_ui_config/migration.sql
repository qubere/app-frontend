-- The UI Configuration dashboard and API select this column for
-- release-specific customs filing configurations. Existing rows remain
-- valid with a NULL release, which represents the all-releases fallback.
ALTER TABLE "FilingUIConfig"
ADD COLUMN IF NOT EXISTS "release" TEXT;
