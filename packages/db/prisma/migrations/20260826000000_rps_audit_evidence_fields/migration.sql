-- AlterTable: audit-evidence snapshot on RestrictedPartyScreeningResult (all nullable -- existing rows are unaffected)
ALTER TABLE "RestrictedPartyScreeningResult"
ADD COLUMN "normalizedScreenedName" TEXT,
ADD COLUMN "matcherVersion" TEXT,
ADD COLUMN "referenceDataAsOf" TIMESTAMP(3);

-- AlterTable: audit-evidence detail on RestrictedPartyMatch (nullable/defaulted -- existing rows are unaffected)
ALTER TABLE "RestrictedPartyMatch"
ADD COLUMN "normalizedMatchedName" TEXT,
ADD COLUMN "matchedTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
