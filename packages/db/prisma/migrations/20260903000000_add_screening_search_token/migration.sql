-- CreateEnum
CREATE TYPE "ScreeningSearchFieldType" AS ENUM ('NAME', 'ALIAS');

-- CreateTable
CREATE TABLE "ScreeningSearchToken" (
    "id" TEXT NOT NULL,
    "screeningEntityId" TEXT NOT NULL,
    "fieldType" "ScreeningSearchFieldType" NOT NULL,
    "originalToken" TEXT,
    "normalizedToken" TEXT NOT NULL,
    "metaphone" TEXT,
    "doubleMetaphonePrimary" TEXT,
    "doubleMetaphoneAlternate" TEXT,
    "tokenWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningSearchToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreeningSearchToken_normalizedToken_fieldType_idx" ON "ScreeningSearchToken"("normalizedToken", "fieldType");

-- CreateIndex
CREATE INDEX "ScreeningSearchToken_metaphone_fieldType_idx" ON "ScreeningSearchToken"("metaphone", "fieldType");

-- CreateIndex
CREATE INDEX "ScreeningSearchToken_doubleMetaphonePrimary_fieldType_idx" ON "ScreeningSearchToken"("doubleMetaphonePrimary", "fieldType");

-- CreateIndex
CREATE INDEX "ScreeningSearchToken_doubleMetaphoneAlternate_fieldType_idx" ON "ScreeningSearchToken"("doubleMetaphoneAlternate", "fieldType");

-- CreateIndex
CREATE INDEX "ScreeningSearchToken_screeningEntityId_idx" ON "ScreeningSearchToken"("screeningEntityId");

-- AddForeignKey
ALTER TABLE "ScreeningSearchToken" ADD CONSTRAINT "ScreeningSearchToken_screeningEntityId_fkey" FOREIGN KEY ("screeningEntityId") REFERENCES "ScreeningEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
