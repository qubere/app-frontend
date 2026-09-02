-- Master catalog of filing status codes with a base description plus
-- optional per-locale (multi-language) description overrides stored as a
-- JSON key-value map (e.g. { "en": "Draft", "fr": "Brouillon" }).
CREATE TABLE "FilingStatusCatalog" (
    "id" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL,
    "defaultDescription" TEXT NOT NULL,
    "localeDescription" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "FilingStatusCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FilingStatusCatalog_statusCode_key" ON "FilingStatusCatalog"("statusCode");

CREATE INDEX "FilingStatusCatalog_statusCode_idx" ON "FilingStatusCatalog"("statusCode");
