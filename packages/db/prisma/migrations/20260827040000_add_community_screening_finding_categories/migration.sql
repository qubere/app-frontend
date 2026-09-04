-- AlterEnum
ALTER TYPE "CommunityScreeningPartyStatus" ADD VALUE 'NOT_EVALUATED';

-- AlterTable
ALTER TABLE "CommunityScreeningPartyResult" ADD COLUMN "restrictedPartyMatchFound" BOOLEAN,
ADD COLUMN "restrictedPartyRedFlagFound" BOOLEAN,
ADD COLUMN "restrictedPartyFindingCategory" TEXT;
