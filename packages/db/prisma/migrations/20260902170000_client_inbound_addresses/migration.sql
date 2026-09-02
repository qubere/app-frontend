-- DropIndex
DROP INDEX "InboundSenderRoute_normalizedSenderEmail_key";

-- AlterTable
ALTER TABLE "InboundSenderRoute" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "scopeKey" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "InboundEmail" ADD COLUMN "autoReplyAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "autoReplySentAt" TIMESTAMP(3),
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "inboundAddressId" TEXT,
ADD COLUMN     "processingLeaseToken" TEXT,
ADD COLUMN     "processingLeaseUntil" TIMESTAMP(3),
ADD COLUMN     "recipientAddress" TEXT,
ADD COLUMN     "senderApprovedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InboundAttachment" ADD COLUMN     "reviewId" TEXT;

-- CreateTable
CREATE TABLE "InboundAddress" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT,
    "token" TEXT NOT NULL,
    "localPrefix" TEXT NOT NULL DEFAULT 'docs',
    "address" TEXT NOT NULL,
    "activeKey" TEXT,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "purpose" TEXT NOT NULL DEFAULT 'CLIENT_DOCUMENTS',
    "senderPolicy" TEXT NOT NULL DEFAULT 'REVIEW',
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultAssignedToUserId" TEXT,
    "createdByUserId" TEXT,
    "graceUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundDocumentReview" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT,
    "inboundEmailId" TEXT NOT NULL,
    "shipmentDocumentId" TEXT,
    "reviewKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "candidateSummary" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedByUserId" TEXT,
    "resolvedShipmentId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundDocumentReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundAddress_token_key" ON "InboundAddress"("token");

-- CreateIndex
CREATE UNIQUE INDEX "InboundAddress_address_key" ON "InboundAddress"("address");

-- CreateIndex
CREATE UNIQUE INDEX "InboundAddress_activeKey_key" ON "InboundAddress"("activeKey");

-- CreateIndex
CREATE INDEX "InboundAddress_accountId_clientId_idx" ON "InboundAddress"("accountId", "clientId");

-- CreateIndex
CREATE INDEX "InboundAddress_clientId_idx" ON "InboundAddress"("clientId");

-- CreateIndex
CREATE INDEX "InboundAddress_status_graceUntil_idx" ON "InboundAddress"("status", "graceUntil");

-- CreateIndex
CREATE UNIQUE INDEX "InboundDocumentReview_shipmentDocumentId_key" ON "InboundDocumentReview"("shipmentDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundDocumentReview_reviewKey_key" ON "InboundDocumentReview"("reviewKey");

-- CreateIndex
CREATE INDEX "InboundDocumentReview_accountId_status_createdAt_idx" ON "InboundDocumentReview"("accountId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "InboundDocumentReview_clientId_status_idx" ON "InboundDocumentReview"("clientId", "status");

-- CreateIndex
CREATE INDEX "InboundDocumentReview_inboundEmailId_idx" ON "InboundDocumentReview"("inboundEmailId");

-- CreateIndex
CREATE INDEX "InboundSenderRoute_normalizedSenderEmail_status_idx" ON "InboundSenderRoute"("normalizedSenderEmail", "status");

-- CreateIndex
CREATE INDEX "InboundSenderRoute_clientId_idx" ON "InboundSenderRoute"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundSenderRoute_accountId_scopeKey_normalizedSenderEmail_key" ON "InboundSenderRoute"("accountId", "scopeKey", "normalizedSenderEmail");

-- CreateIndex
CREATE INDEX "InboundEmail_clientId_idx" ON "InboundEmail"("clientId");

-- CreateIndex
CREATE INDEX "InboundEmail_inboundAddressId_receivedAt_idx" ON "InboundEmail"("inboundAddressId", "receivedAt");

-- CreateIndex
CREATE INDEX "InboundAttachment_reviewId_idx" ON "InboundAttachment"("reviewId");

-- AddForeignKey
ALTER TABLE "InboundSenderRoute" ADD CONSTRAINT "InboundSenderRoute_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_inboundAddressId_fkey" FOREIGN KEY ("inboundAddressId") REFERENCES "InboundAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundAttachment" ADD CONSTRAINT "InboundAttachment_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "InboundDocumentReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundAddress" ADD CONSTRAINT "InboundAddress_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundAddress" ADD CONSTRAINT "InboundAddress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundAddress" ADD CONSTRAINT "InboundAddress_defaultAssignedToUserId_fkey" FOREIGN KEY ("defaultAssignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDocumentReview" ADD CONSTRAINT "InboundDocumentReview_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDocumentReview" ADD CONSTRAINT "InboundDocumentReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDocumentReview" ADD CONSTRAINT "InboundDocumentReview_inboundEmailId_fkey" FOREIGN KEY ("inboundEmailId") REFERENCES "InboundEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundDocumentReview" ADD CONSTRAINT "InboundDocumentReview_shipmentDocumentId_fkey" FOREIGN KEY ("shipmentDocumentId") REFERENCES "ShipmentDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Keep the nullable relation and the uniqueness key in agreement.
ALTER TABLE "InboundSenderRoute" ADD CONSTRAINT "InboundSenderRoute_scope_matches_client"
CHECK ("scopeKey" = COALESCE("clientId", ''));
