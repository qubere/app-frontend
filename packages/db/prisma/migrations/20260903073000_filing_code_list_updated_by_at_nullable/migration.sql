-- updatedby/updatedat on the filing code list masters should reflect an
-- actual edit, not the creation event: make them nullable (previously
-- NOT NULL per the original DDL, which required initializing them to the
-- creator/creation-time on insert) so they stay empty until the row is
-- genuinely updated for the first time.
ALTER TABLE "filingcodelisttype" ALTER COLUMN "updatedby" DROP NOT NULL;
ALTER TABLE "filingcodelisttype" ALTER COLUMN "updatedat" DROP NOT NULL;
ALTER TABLE "filingcodelisttype" ALTER COLUMN "updatedat" DROP DEFAULT;

ALTER TABLE "filingcodelistheader" ALTER COLUMN "updatedby" DROP NOT NULL;
ALTER TABLE "filingcodelistheader" ALTER COLUMN "updatedat" DROP NOT NULL;
ALTER TABLE "filingcodelistheader" ALTER COLUMN "updatedat" DROP DEFAULT;

ALTER TABLE "filingcodelistitem" ALTER COLUMN "updatedby" DROP NOT NULL;
ALTER TABLE "filingcodelistitem" ALTER COLUMN "updatedat" DROP NOT NULL;
ALTER TABLE "filingcodelistitem" ALTER COLUMN "updatedat" DROP DEFAULT;

ALTER TABLE "filingcodelistitemtranslation" ALTER COLUMN "updatedby" DROP NOT NULL;
ALTER TABLE "filingcodelistitemtranslation" ALTER COLUMN "updatedat" DROP NOT NULL;
ALTER TABLE "filingcodelistitemtranslation" ALTER COLUMN "updatedat" DROP DEFAULT;

-- Existing rows currently have updatedby/updatedat equal to createdby/
-- createdat from creation-time initialization; clear that back to null so
-- they correctly read as "never updated" for anything written before this
-- migration.
UPDATE "filingcodelisttype" SET "updatedby" = NULL, "updatedat" = NULL WHERE "updatedby" = "createdby" AND "updatedat" = "createdat";
UPDATE "filingcodelistheader" SET "updatedby" = NULL, "updatedat" = NULL WHERE "updatedby" = "createdby" AND "updatedat" = "createdat";
UPDATE "filingcodelistitem" SET "updatedby" = NULL, "updatedat" = NULL WHERE "updatedby" = "createdby" AND "updatedat" = "createdat";
UPDATE "filingcodelistitemtranslation" SET "updatedby" = NULL, "updatedat" = NULL WHERE "updatedby" = "createdby" AND "updatedat" = "createdat";
