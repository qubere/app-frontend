-- AlterTable
ALTER TABLE "CarrierInvoice" ADD COLUMN "settlementStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "settledAt" TIMESTAMP(3);
