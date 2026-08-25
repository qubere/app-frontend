-- AlterTable
ALTER TABLE "InboundAttachment" ADD COLUMN "quarantinedFileUrl" TEXT;

-- CreateIndex
CREATE INDEX "InboundEmail_routingStatus_idx" ON "InboundEmail"("routingStatus");
