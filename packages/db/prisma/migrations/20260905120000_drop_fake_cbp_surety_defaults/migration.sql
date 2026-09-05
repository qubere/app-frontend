-- Drop placeholder defaults so future direct-create paths can't silently rely on fake CBP/surety data
ALTER TABLE "DrawbackClaim" ALTER COLUMN "cbpClaimNumber" DROP DEFAULT;
ALTER TABLE "Bond" ALTER COLUMN "suretyName" DROP DEFAULT;
ALTER TABLE "Bond" ALTER COLUMN "bondAmount" DROP DEFAULT;
