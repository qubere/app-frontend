-- Customs code list masters: FilingCodeListType (lookup) -> FilingCodeListHeader
-- (one per country+procedure+listType+version) -> FilingCodeListItem (codes)
-- -> FilingCodeListItemTranslation (per-language display text).
-- pgcrypto is already enabled on this database (provides gen_random_uuid()).

-- 1. Master List Types
CREATE TABLE "filingcodelisttype" (
    "listtype"          VARCHAR(50) NOT NULL,
    "listtypename"      VARCHAR(150) NOT NULL,
    "description"       TEXT,
    "isactive"          BOOLEAN NOT NULL DEFAULT TRUE,
    "createdby"         VARCHAR(100) NOT NULL,
    "updatedby"         VARCHAR(100) NOT NULL,
    "createdat"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedat"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filingcodelisttype_pkey" PRIMARY KEY ("listtype")
);

-- 2. CodeList Header (Manages Validity Period, Country, Procedure Code, and Version)
CREATE TABLE "filingcodelistheader" (
    "codelistid"        UUID NOT NULL DEFAULT gen_random_uuid(),
    "countryiso2"       CHAR(2) NOT NULL,
    "procedurecode"     VARCHAR(20) NOT NULL,
    "listtype"          VARCHAR(50) NOT NULL,
    "version"           VARCHAR(30) NOT NULL,
    "effectivefrom"     TIMESTAMPTZ NOT NULL,
    "effectiveto"       TIMESTAMPTZ,
    "isactive"          BOOLEAN NOT NULL DEFAULT TRUE,
    "createdby"         VARCHAR(100) NOT NULL,
    "updatedby"         VARCHAR(100) NOT NULL,
    "createdat"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedat"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filingcodelistheader_pkey" PRIMARY KEY ("codelistid"),
    CONSTRAINT "uq_filingheader_country_proc_type_ver" UNIQUE ("countryiso2", "procedurecode", "listtype", "version"),
    CONSTRAINT "chk_filingheader_dates" CHECK ("effectiveto" IS NULL OR "effectiveto" > "effectivefrom"),
    CONSTRAINT "filingcodelistheader_listtype_fkey" FOREIGN KEY ("listtype") REFERENCES "filingcodelisttype"("listtype") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "filingcodelistheader_listtype_idx" ON "filingcodelistheader"("listtype");
CREATE INDEX "filingcodelistheader_isactive_idx" ON "filingcodelistheader"("isactive");

-- 3. CodeList Item (Inherits Validity Lifecycle from filingcodelistheader)
CREATE TABLE "filingcodelistitem" (
    "itemid"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "codelistid"        UUID NOT NULL,
    "code"              VARCHAR(50) NOT NULL,
    "attributes"        JSONB NOT NULL DEFAULT '{}'::jsonb,
    "isdeprecated"       BOOLEAN NOT NULL DEFAULT FALSE,
    "createdby"         VARCHAR(100) NOT NULL,
    "updatedby"         VARCHAR(100) NOT NULL,
    "createdat"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedat"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filingcodelistitem_pkey" PRIMARY KEY ("itemid"),
    CONSTRAINT "uq_filingitem_code" UNIQUE ("codelistid", "code"),
    CONSTRAINT "filingcodelistitem_codelistid_fkey" FOREIGN KEY ("codelistid") REFERENCES "filingcodelistheader"("codelistid") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "filingcodelistitem_codelistid_idx" ON "filingcodelistitem"("codelistid");

-- 4. Item Translation (multi-language Display Names and Descriptions)
CREATE TABLE "filingcodelistitemtranslation" (
    "translationid"     UUID NOT NULL DEFAULT gen_random_uuid(),
    "itemid"            UUID NOT NULL,
    "languagecode"      VARCHAR(10) NOT NULL,
    "displayname"       VARCHAR(255) NOT NULL,
    "description"       TEXT,
    "createdby"         VARCHAR(100) NOT NULL,
    "updatedby"         VARCHAR(100) NOT NULL,
    "createdat"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedat"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filingcodelistitemtranslation_pkey" PRIMARY KEY ("translationid"),
    CONSTRAINT "uq_filingitem_language" UNIQUE ("itemid", "languagecode"),
    CONSTRAINT "filingcodelistitemtranslation_itemid_fkey" FOREIGN KEY ("itemid") REFERENCES "filingcodelistitem"("itemid") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "filingcodelistitemtranslation_itemid_idx" ON "filingcodelistitemtranslation"("itemid");
