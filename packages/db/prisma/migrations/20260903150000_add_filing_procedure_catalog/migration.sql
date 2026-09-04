-- FilingTransactionType is being superseded by FilingProcedureCatalog (see
-- schema.prisma for the deprecation note). This is a shared database, so the
-- old table cannot be renamed or dropped in place: instead, this migration
-- creates a new table with the same identity/audit columns, renames the old
-- business code column from "code" to "procedureCode", and copies every
-- existing row into it (same ids), then application code switches over
-- entirely.
-- FilingTransactionType itself is left completely untouched by this
-- migration -- no ALTER, no data change, no drop.

-- CreateTable
CREATE TABLE "FilingProcedureCatalog" (
    "id" TEXT NOT NULL,
    "procedureCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "FilingProcedureCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FilingProcedureCatalog_procedureCode_key" ON "FilingProcedureCatalog"("procedureCode");

CREATE INDEX "FilingProcedureCatalog_procedureCode_idx" ON "FilingProcedureCatalog"("procedureCode");

CREATE INDEX "FilingProcedureCatalog_isActive_idx" ON "FilingProcedureCatalog"("isActive");

-- Copy existing FilingTransactionType rows into the new table, preserving
-- ids and audit data. Only the business code column is renamed:
-- FilingTransactionType.code -> FilingProcedureCatalog.procedureCode.
INSERT INTO "FilingProcedureCatalog" ("id", "procedureCode", "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT "id", "code", "isActive", "createdAt", "updatedAt", "createdBy", "updatedBy"
FROM "FilingTransactionType"
ON CONFLICT DO NOTHING;
