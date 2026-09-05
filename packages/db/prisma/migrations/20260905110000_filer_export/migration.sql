-- Issue #219 Phase B (U11): FilerExport.
--
-- Hand-written (no live DB available to run `prisma migrate dev` in this
-- sandbox) — follows the style of 20260905100000_entry_summary_filer_profile_and_draft.
-- MUST be verified against a real `prisma migrate dev --create-only` diff
-- before merging.

-- CreateTable
CREATE TABLE "FilerExport" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "filerProfileId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payloadSize" INTEGER NOT NULL,
    "storageUrl" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "requestedBy" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilerExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FilerExport_accountId_idempotencyKey_key" ON "FilerExport"("accountId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FilerExport_draftId_idx" ON "FilerExport"("draftId");

-- CreateIndex
CREATE INDEX "FilerExport_accountId_status_idx" ON "FilerExport"("accountId", "status");

-- AddForeignKey
ALTER TABLE "FilerExport" ADD CONSTRAINT "FilerExport_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilerExport" ADD CONSTRAINT "FilerExport_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "EntrySummaryDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilerExport" ADD CONSTRAINT "FilerExport_filerProfileId_fkey" FOREIGN KEY ("filerProfileId") REFERENCES "FilerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
