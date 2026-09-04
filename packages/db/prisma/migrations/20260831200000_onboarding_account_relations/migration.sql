-- Add account FK constraints to OnboardingEntity and OnboardingEvent so they
-- satisfy the tenant-isolation backstop (every model with accountId must have
-- an explicit account relation). These tables were created in the previous
-- migration without the account FK; this migration adds it idempotently.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OnboardingEntity_accountId_fkey'
  ) THEN
    ALTER TABLE "OnboardingEntity"
      ADD CONSTRAINT "OnboardingEntity_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'OnboardingEvent_accountId_fkey'
  ) THEN
    ALTER TABLE "OnboardingEvent"
      ADD CONSTRAINT "OnboardingEvent_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE;
  END IF;
END $$;
