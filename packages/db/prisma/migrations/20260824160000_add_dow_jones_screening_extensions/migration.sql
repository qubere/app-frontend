-- AlterTable
ALTER TABLE "ScreeningEntity" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerMetadata" JSONB,
ADD COLUMN     "providerRecordId" TEXT,
ADD COLUMN     "providerUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "sourceAuthority" TEXT,
ADD COLUMN     "sourceFileDate" TIMESTAMP(3),
ADD COLUMN     "sourceFileType" TEXT;

-- CreateTable
CREATE TABLE "ScreeningEntityAlias" (
    "id" TEXT NOT NULL,
    "screeningEntityId" TEXT NOT NULL,
    "providerSubId" TEXT,
    "name" TEXT NOT NULL,
    "aliasType" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningEntityAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningEntityAddress" (
    "id" TEXT NOT NULL,
    "screeningEntityId" TEXT NOT NULL,
    "providerSubId" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "stateOrProvince" TEXT,
    "countryCode" TEXT,
    "countryName" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningEntityAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningEntityIdentifier" (
    "id" TEXT NOT NULL,
    "screeningEntityId" TEXT NOT NULL,
    "identifierType" TEXT NOT NULL,
    "identifierValue" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningEntityIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningEntityReference" (
    "id" TEXT NOT NULL,
    "screeningEntityId" TEXT NOT NULL,
    "providerSubId" TEXT,
    "sourceAuthority" TEXT NOT NULL,
    "sourceList" TEXT NOT NULL,
    "sourceListName" TEXT NOT NULL,
    "sourceStatus" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "programCode" TEXT,
    "citation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningEntityReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreeningEntityAlias_screeningEntityId_idx" ON "ScreeningEntityAlias"("screeningEntityId");

-- CreateIndex
CREATE INDEX "ScreeningEntityAddress_screeningEntityId_idx" ON "ScreeningEntityAddress"("screeningEntityId");

-- CreateIndex
CREATE INDEX "ScreeningEntityIdentifier_screeningEntityId_idx" ON "ScreeningEntityIdentifier"("screeningEntityId");

-- CreateIndex
CREATE INDEX "ScreeningEntityIdentifier_identifierType_identifierValue_idx" ON "ScreeningEntityIdentifier"("identifierType", "identifierValue");

-- CreateIndex
CREATE INDEX "ScreeningEntityReference_screeningEntityId_idx" ON "ScreeningEntityReference"("screeningEntityId");

-- CreateIndex
CREATE INDEX "ScreeningEntityReference_sourceAuthority_sourceList_idx" ON "ScreeningEntityReference"("sourceAuthority", "sourceList");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningEntity_provider_providerRecordId_key" ON "ScreeningEntity"("provider", "providerRecordId");

-- AddForeignKey
ALTER TABLE "ScreeningEntityAlias" ADD CONSTRAINT "ScreeningEntityAlias_screeningEntityId_fkey" FOREIGN KEY ("screeningEntityId") REFERENCES "ScreeningEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningEntityAddress" ADD CONSTRAINT "ScreeningEntityAddress_screeningEntityId_fkey" FOREIGN KEY ("screeningEntityId") REFERENCES "ScreeningEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningEntityIdentifier" ADD CONSTRAINT "ScreeningEntityIdentifier_screeningEntityId_fkey" FOREIGN KEY ("screeningEntityId") REFERENCES "ScreeningEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningEntityReference" ADD CONSTRAINT "ScreeningEntityReference_screeningEntityId_fkey" FOREIGN KEY ("screeningEntityId") REFERENCES "ScreeningEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

