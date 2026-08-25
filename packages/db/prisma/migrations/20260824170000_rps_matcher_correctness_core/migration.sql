-- CreateEnum
CREATE TYPE "RestrictedPartyPhoneticAlgorithm" AS ENUM ('DOUBLE_METAPHONE', 'METAPHONE2');

-- AlterEnum
ALTER TYPE "RestrictedPartyMatchMethod" ADD VALUE 'ALTERNATE_WHOLE_WORD';

-- CreateTable
CREATE TABLE "AccountScreeningConfig" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "nameThreshold" INTEGER,
    "addressThreshold" INTEGER,
    "countryMatchRequired" BOOLEAN,
    "redFlagCheckEnabled" BOOLEAN,
    "excludeMetaphone" BOOLEAN,
    "phoneticAlgorithm" "RestrictedPartyPhoneticAlgorithm",
    "continueOnExactMatch" BOOLEAN,
    "alternateScreeningEnabled" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountScreeningConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountScreeningConfig_accountId_key" ON "AccountScreeningConfig"("accountId");

-- AddForeignKey
ALTER TABLE "AccountScreeningConfig" ADD CONSTRAINT "AccountScreeningConfig_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: matcher-behavior evidence on RestrictedPartyScreeningResult (all nullable -- existing rows are unaffected)
ALTER TABLE "RestrictedPartyScreeningResult"
ADD COLUMN "excludeMetaphone" BOOLEAN,
ADD COLUMN "phoneticAlgorithm" "RestrictedPartyPhoneticAlgorithm",
ADD COLUMN "continueOnExactMatch" BOOLEAN,
ADD COLUMN "exactMatchFound" BOOLEAN,
ADD COLUMN "alternateScreeningEnabled" BOOLEAN,
ADD COLUMN "alternateScreeningRan" BOOLEAN,
ADD COLUMN "alternateScreeningReason" TEXT;
