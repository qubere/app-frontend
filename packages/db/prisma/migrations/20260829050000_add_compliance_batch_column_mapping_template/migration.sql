-- CreateTable
CREATE TABLE "ComplianceBatchColumnMappingTemplate" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "name" TEXT NOT NULL,
    "fieldMappings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceBatchColumnMappingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceBatchColumnMappingTemplate_accountId_name_key" ON "ComplianceBatchColumnMappingTemplate"("accountId", "name");

-- CreateIndex
CREATE INDEX "ComplianceBatchColumnMappingTemplate_accountId_idx" ON "ComplianceBatchColumnMappingTemplate"("accountId");

-- AddForeignKey
ALTER TABLE "ComplianceBatchColumnMappingTemplate" ADD CONSTRAINT "ComplianceBatchColumnMappingTemplate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
