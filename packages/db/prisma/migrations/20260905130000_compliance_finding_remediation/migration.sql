-- Issue #177 P2: finding → remediation tracking.
--
-- Adds SLA / remediation fields to ComplianceFinding, matching the schema
-- change in cd0d7202 (which shipped the resolve-route + UI wiring but no
-- migration, so the columns did not exist and the route threw P2022).
--
-- Hand-written (no live DB available to run `prisma migrate dev` in this
-- sandbox) — follows the style of the most recent migration folders. MUST be
-- verified against a real `prisma migrate dev --create-only` diff before merge.

-- AlterTable
ALTER TABLE "ComplianceFinding" ADD COLUMN "dueAt" TIMESTAMP(3);
ALTER TABLE "ComplianceFinding" ADD COLUMN "remediationNotes" TEXT;
ALTER TABLE "ComplianceFinding" ADD COLUMN "remediationRef" TEXT;
