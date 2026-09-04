-- DropIndex
DROP INDEX IF EXISTS "FilingCountryCustomsVersion_validFrom_validTo_idx";

-- DropIndex
DROP INDEX IF EXISTS "FilingCustomerCustomsVersion_customerId_filingCountryCustoms_ke";

-- AlterTable
ALTER TABLE "AccountEmbargoConfig" ALTER COLUMN "audited" SET DEFAULT true,
ALTER COLUMN "generalAuditLogEnabled" SET DEFAULT true;

-- AlterTable
ALTER TABLE "CustomsFiling" ADD COLUMN     "actionCode" TEXT,
ADD COLUMN     "bondWaiverIndicator" TEXT,
ADD COLUMN     "bondWaiverReasonCode" TEXT,
ADD COLUMN     "brokerReferenceNumber" TEXT,
ADD COLUMN     "consolidatedSummaryIndicator" TEXT,
ADD COLUMN     "dateOfImportation" TIMESTAMP(3),
ADD COLUMN     "designatedNotifyPartyNumber" TEXT,
ADD COLUMN     "estimatedEntryDate" TIMESTAMP(3),
ADD COLUMN     "estimatedEntryValue" DECIMAL(16,2),
ADD COLUMN     "foreignTradeZoneIdentifier" TEXT,
ADD COLUMN     "grandTotalAdDutyAmount" DECIMAL(16,2),
ADD COLUMN     "grandTotalCvDutyAmount" DECIMAL(16,2),
ADD COLUMN     "grandTotalDutyAmount" DECIMAL(16,2),
ADD COLUMN     "grandTotalIrTaxAmount" DECIMAL(16,2),
ADD COLUMN     "grandTotalOtherRevenueAmount" DECIMAL(16,2),
ADD COLUMN     "grandTotalUserFeeAmount" DECIMAL(16,2),
ADD COLUMN     "importerOfRecordType" TEXT,
ADD COLUMN     "liveEntryIndicator" TEXT,
ADD COLUMN     "modeOfTransportationCode" TEXT,
ADD COLUMN     "paymentTypeCode" TEXT,
ADD COLUMN     "pgaDataIncludedIndicator" TEXT,
ADD COLUMN     "splitShipmentReleaseCode" TEXT,
ADD COLUMN     "usStateOfDestinationCode" TEXT;

-- AlterTable
ALTER TABLE "DrawbackClaim" ADD COLUMN     "acceleratedPaymentRequestIndicator" BOOLEAN DEFAULT false,
ADD COLUMN     "billOfMaterialsFormulaCertification" BOOLEAN DEFAULT false,
ADD COLUMN     "bondWaiverIndicator" BOOLEAN DEFAULT false,
ADD COLUMN     "bondWaiverReasonCode" TEXT,
ADD COLUMN     "brokerReferenceNumber" TEXT,
ADD COLUMN     "designatedNotifyPartyNumber" TEXT,
ADD COLUMN     "electronicPetroleumCertification" BOOLEAN DEFAULT false,
ADD COLUMN     "naftaDrawbackClaimIndicator" BOOLEAN DEFAULT false,
ADD COLUMN     "oilSpillTaxCertification" BOOLEAN DEFAULT false,
ADD COLUMN     "oneTimeWaiverIndicator" BOOLEAN DEFAULT false,
ADD COLUMN     "retailSalesSubstitutionIndicator" BOOLEAN DEFAULT false,
ADD COLUMN     "superfundTaxCertification" BOOLEAN DEFAULT false,
ADD COLUMN     "usmcaDrawbackClaimIndicator" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "DrawbackLot" ADD COLUMN     "allowableQuantity" DECIMAL(18,6),
ADD COLUMN     "basisOfClaim" TEXT,
ADD COLUMN     "cbpEsLineNumber" INTEGER,
ADD COLUMN     "drawbackAccountingMethodCode" TEXT,
ADD COLUMN     "drawbackEligibleIndicator" BOOLEAN DEFAULT true,
ADD COLUMN     "manufDateReceived" TIMESTAMP(3),
ADD COLUMN     "manufDateUsed" TIMESTAMP(3),
ADD COLUMN     "manufactureRulingNumber" TEXT,
ADD COLUMN     "substitutedValuePerUnit" DECIMAL(18,6);

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN     "lineRange1Begin" INTEGER,
ADD COLUMN     "lineRange1End" INTEGER,
ADD COLUMN     "lineRange2Begin" INTEGER,
ADD COLUMN     "lineRange2End" INTEGER,
ADD COLUMN     "lineRange3Begin" INTEGER,
ADD COLUMN     "lineRange3End" INTEGER,
ADD COLUMN     "lineRange4Begin" INTEGER,
ADD COLUMN     "lineRange4End" INTEGER,
ADD COLUMN     "supplierIdCode" TEXT;

-- AlterTable
ALTER TABLE "PgaRequirement" ADD COLUMN     "agencyData" JSONB,
ADD COLUMN     "aocCode" TEXT,
ADD COLUMN     "firmsCode" TEXT,
ADD COLUMN     "inspectionLocation" TEXT,
ADD COLUMN     "issuerCode" TEXT,
ADD COLUMN     "lpcoNumber" TEXT,
ADD COLUMN     "lpcoTypeCode" TEXT,
ADD COLUMN     "permitTypeCode" TEXT;

-- AlterTable
ALTER TABLE "ShipmentParty" ADD COLUMN     "partyTypeCode" TEXT;

-- CreateTable
CREATE TABLE "CensusWarningOverride" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "conditionCode" TEXT NOT NULL,
    "overrideCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CensusWarningOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilingFeeLine" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "accountingClassCode" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilingFeeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FtzDetail" (
    "id" TEXT NOT NULL,
    "filingId" TEXT,
    "shipmentLineItemId" TEXT,
    "ftzAdmissionNumber" TEXT,
    "zoneId" TEXT,
    "privilegedStatusDate" TIMESTAMP(3),
    "merchandiseStatusCode" TEXT,
    "lineItemQuantity" DECIMAL(18,6),
    "currentHtsNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FtzDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdcvdLineDetail" (
    "id" TEXT NOT NULL,
    "shipmentLineItemId" TEXT NOT NULL,
    "adcvdOrderId" TEXT,
    "caseDepositRate" DECIMAL(12,6),
    "rateTypeQualifierCode" TEXT,
    "bondCashClaimCode" TEXT,
    "valueOfGoodsAmount" DECIMAL(16,2),
    "nonReimbursementDeclarationIdentifier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdcvdLineDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawbackImportLink" (
    "id" TEXT NOT NULL,
    "drawbackClaimId" TEXT NOT NULL,
    "importTrackingIdNumber" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawbackImportLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawbackExportDestroy" (
    "id" TEXT NOT NULL,
    "drawbackClaimId" TEXT NOT NULL,
    "noticeOfIntentIndicator" BOOLEAN DEFAULT false,
    "waiverToDrawbackClaimRightsIndicator" BOOLEAN DEFAULT false,
    "countryOfUltimateDestination" TEXT,
    "billOfLadingIndicator" TEXT,
    "billOfLadingCarrierCode" TEXT,
    "intendedPortOfExport" TEXT,
    "examinationWitnessIndicator" BOOLEAN DEFAULT false,
    "locationOfDestruction" TEXT,
    "resultsOfExamination" TEXT,
    "examinerName" TEXT,
    "examinerBadgeNumber" TEXT,
    "examinerPhone" TEXT,
    "processingExaminationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawbackExportDestroy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawbackTfteaLine" (
    "id" TEXT NOT NULL,
    "drawbackClaimId" TEXT NOT NULL,
    "htsNumber" TEXT,
    "exportOrDestroyIndicator" TEXT,
    "quantity" DECIMAL(18,6),
    "unitOfMeasureCode" TEXT,
    "date" TIMESTAMP(3),
    "noticeOfIntentIndicator" BOOLEAN DEFAULT false,
    "waiverIndicator" BOOLEAN DEFAULT false,
    "exporterOrDestroyerName" TEXT,
    "countryOfUltimateDestination" TEXT,
    "billOfLadingIndicator" TEXT,
    "billOfLadingCarrierCode" TEXT,
    "scheduleBCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawbackTfteaLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawbackNaftaUsmcaLine" (
    "id" TEXT NOT NULL,
    "drawbackClaimId" TEXT NOT NULL,
    "entryNumber" TEXT,
    "entryDate" TIMESTAMP(3),
    "dutyPaidToForeignGovtLocalCurrency" DECIMAL(16,2),
    "exchangeRate" DECIMAL(18,8),
    "tariffNumber1" TEXT,
    "tariffNumber2" TEXT,
    "tariffNumber3" TEXT,
    "countryOfExport" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawbackNaftaUsmcaLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoReleaseBillOfLading" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "billTypeIndicator" TEXT,
    "issuerCode" TEXT,
    "billOfLadingNumber" TEXT NOT NULL,
    "quantity" DECIMAL(16,4),
    "nonAmsIndicator" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargoReleaseBillOfLading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BondParty" (
    "id" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "idNumberType" TEXT,
    "idNumber" TEXT,
    "name" TEXT,
    "liabilityAmount" DECIMAL(16,2),
    "agentIdNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BondParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InBondRecord" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "inBondNumber" TEXT NOT NULL,
    "inBondEntryType" TEXT NOT NULL,
    "carrierCode" TEXT,
    "bondedCarrierId" TEXT,
    "usPortOfDest" TEXT,
    "portOfForeignDest" TEXT,
    "value" DECIMAL(16,2),
    "ftzWarehouseInd" TEXT,
    "masterBOLNumber" TEXT,
    "masterBOLIssuerCode" TEXT,
    "houseBillNumber" TEXT,
    "houseBillIssuerCode" TEXT,
    "subHouseBillNumber" TEXT,
    "subHouseBillIssuerCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InBondRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InBondEvent" (
    "id" TEXT NOT NULL,
    "inBondRecordId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventTime" TEXT,
    "portOfArrival" TEXT,
    "carrierCode" TEXT,
    "cityName" TEXT,
    "stateCode" TEXT,
    "exportMOT" TEXT,
    "exportConveyance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InBondEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManifestRecord" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transportationIndicator" TEXT,
    "countryCode" TEXT,
    "conveyanceName" TEXT,
    "manifestSequenceNumber" TEXT,
    "billOfLading" TEXT,
    "foreignPortOfLading" TEXT,
    "manifestQuantity" DECIMAL(16,4),
    "manifestUnits" TEXT,
    "weight" DECIMAL(16,4),
    "weightUnit" TEXT,
    "houseBillNumber" TEXT,
    "equipmentNumber" TEXT,
    "sealNumbers" TEXT[],
    "dimensions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManifestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementRecord" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "statementType" TEXT NOT NULL,
    "statementNumber" TEXT NOT NULL,
    "districtPort" TEXT,
    "filerCode" TEXT,
    "importerNumber" TEXT,
    "printDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "entryType" TEXT,
    "totalDuty" DECIMAL(16,2),
    "totalTax" DECIMAL(16,2),
    "totalFee" DECIMAL(16,2),
    "totalAmount" DECIMAL(16,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementFeeLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "accountingClassCode" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementFeeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CensusWarningOverride_filingId_idx" ON "CensusWarningOverride"("filingId");

-- CreateIndex
CREATE INDEX "FilingFeeLine_filingId_idx" ON "FilingFeeLine"("filingId");

-- CreateIndex
CREATE INDEX "FtzDetail_filingId_idx" ON "FtzDetail"("filingId");

-- CreateIndex
CREATE INDEX "FtzDetail_shipmentLineItemId_idx" ON "FtzDetail"("shipmentLineItemId");

-- CreateIndex
CREATE INDEX "AdcvdLineDetail_shipmentLineItemId_idx" ON "AdcvdLineDetail"("shipmentLineItemId");

-- CreateIndex
CREATE INDEX "AdcvdLineDetail_adcvdOrderId_idx" ON "AdcvdLineDetail"("adcvdOrderId");

-- CreateIndex
CREATE INDEX "DrawbackImportLink_drawbackClaimId_idx" ON "DrawbackImportLink"("drawbackClaimId");

-- CreateIndex
CREATE INDEX "DrawbackExportDestroy_drawbackClaimId_idx" ON "DrawbackExportDestroy"("drawbackClaimId");

-- CreateIndex
CREATE INDEX "DrawbackTfteaLine_drawbackClaimId_idx" ON "DrawbackTfteaLine"("drawbackClaimId");

-- CreateIndex
CREATE INDEX "DrawbackNaftaUsmcaLine_drawbackClaimId_idx" ON "DrawbackNaftaUsmcaLine"("drawbackClaimId");

-- CreateIndex
CREATE INDEX "CargoReleaseBillOfLading_filingId_idx" ON "CargoReleaseBillOfLading"("filingId");

-- CreateIndex
CREATE INDEX "BondParty_bondId_idx" ON "BondParty"("bondId");

-- CreateIndex
CREATE INDEX "BondParty_bondId_role_idx" ON "BondParty"("bondId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "InBondRecord_inBondNumber_key" ON "InBondRecord"("inBondNumber");

-- CreateIndex
CREATE INDEX "InBondRecord_accountId_idx" ON "InBondRecord"("accountId");

-- CreateIndex
CREATE INDEX "InBondEvent_inBondRecordId_idx" ON "InBondEvent"("inBondRecordId");

-- CreateIndex
CREATE INDEX "ManifestRecord_accountId_idx" ON "ManifestRecord"("accountId");

-- CreateIndex
CREATE INDEX "StatementRecord_accountId_idx" ON "StatementRecord"("accountId");

-- CreateIndex
CREATE INDEX "StatementRecord_statementNumber_idx" ON "StatementRecord"("statementNumber");

-- CreateIndex
CREATE INDEX "StatementFeeLine_statementId_idx" ON "StatementFeeLine"("statementId");



-- AddForeignKey
ALTER TABLE "CensusWarningOverride" ADD CONSTRAINT "CensusWarningOverride_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "CustomsFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingFeeLine" ADD CONSTRAINT "FilingFeeLine_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "CustomsFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FtzDetail" ADD CONSTRAINT "FtzDetail_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "CustomsFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FtzDetail" ADD CONSTRAINT "FtzDetail_shipmentLineItemId_fkey" FOREIGN KEY ("shipmentLineItemId") REFERENCES "ShipmentLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdcvdLineDetail" ADD CONSTRAINT "AdcvdLineDetail_shipmentLineItemId_fkey" FOREIGN KEY ("shipmentLineItemId") REFERENCES "ShipmentLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdcvdLineDetail" ADD CONSTRAINT "AdcvdLineDetail_adcvdOrderId_fkey" FOREIGN KEY ("adcvdOrderId") REFERENCES "AdcvdOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawbackImportLink" ADD CONSTRAINT "DrawbackImportLink_drawbackClaimId_fkey" FOREIGN KEY ("drawbackClaimId") REFERENCES "DrawbackClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawbackExportDestroy" ADD CONSTRAINT "DrawbackExportDestroy_drawbackClaimId_fkey" FOREIGN KEY ("drawbackClaimId") REFERENCES "DrawbackClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawbackTfteaLine" ADD CONSTRAINT "DrawbackTfteaLine_drawbackClaimId_fkey" FOREIGN KEY ("drawbackClaimId") REFERENCES "DrawbackClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawbackNaftaUsmcaLine" ADD CONSTRAINT "DrawbackNaftaUsmcaLine_drawbackClaimId_fkey" FOREIGN KEY ("drawbackClaimId") REFERENCES "DrawbackClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoReleaseBillOfLading" ADD CONSTRAINT "CargoReleaseBillOfLading_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "CustomsFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondParty" ADD CONSTRAINT "BondParty_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "Bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InBondRecord" ADD CONSTRAINT "InBondRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InBondEvent" ADD CONSTRAINT "InBondEvent_inBondRecordId_fkey" FOREIGN KEY ("inBondRecordId") REFERENCES "InBondRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestRecord" ADD CONSTRAINT "ManifestRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementRecord" ADD CONSTRAINT "StatementRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementFeeLine" ADD CONSTRAINT "StatementFeeLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "StatementRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
