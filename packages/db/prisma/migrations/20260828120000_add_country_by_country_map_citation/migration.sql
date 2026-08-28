-- Adds an optional legal/regulatory citation field to country_by_country_maps
-- so embargo rules can carry a reference (CFR sections, Federal Register doc
-- numbers, etc.) alongside the existing embargo/sanction flags. Nullable and
-- additive only -- no legacy row is required to have one, and screening
-- findings only surface it when present.

-- AlterTable
ALTER TABLE "country_by_country_maps" ADD COLUMN IF NOT EXISTS "CITATION_TEXT" TEXT;
