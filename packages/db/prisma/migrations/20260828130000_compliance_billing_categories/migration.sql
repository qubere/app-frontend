-- Additive: extends BillingEventCategory so compliance-screening usage
-- events (RPS, embargo, community screening, RDPS) can be classified and
-- rated the same way as every other operational domain. Adding enum values
-- is non-destructive -- no existing rows, columns, or values are touched.
ALTER TYPE "BillingEventCategory" ADD VALUE IF NOT EXISTS 'RESTRICTED_PARTY_SCREENING';
ALTER TYPE "BillingEventCategory" ADD VALUE IF NOT EXISTS 'EMBARGO_SCREENING';
ALTER TYPE "BillingEventCategory" ADD VALUE IF NOT EXISTS 'COMMUNITY_SCREENING';
ALTER TYPE "BillingEventCategory" ADD VALUE IF NOT EXISTS 'RDPS_RESCREEN';
