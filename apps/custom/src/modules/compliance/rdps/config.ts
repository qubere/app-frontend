// Continuous Party Monitoring (RDPS) -- lazily-read env config, same
// convention as communityScreening/config.ts and emailConfig.ts. No secrets;
// all values have safe defaults.
function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Max ReferenceDataChangeSet rows claimed per DELTA_IMPACT dispatcher tick. */
export function getRdpsDeltaImpactBatchSize(): number {
  return readIntEnv("RDPS_DELTA_IMPACT_BATCH_SIZE", 200);
}

/** Max Parties rescreened per FULL_POPULATION dispatcher tick (keyset-paginated, so a long sweep resumes across many ticks). */
export function getRdpsFullPopulationBatchSize(): number {
  return readIntEnv("RDPS_FULL_POPULATION_BATCH_SIZE", 100);
}

/** Bounded sample size for the daily scheduled recall-validation job (the post-FULL_POPULATION validation is exhaustive and ignores this). */
export function getRdpsRecallValidationSampleSize(): number {
  return readIntEnv("RDPS_RECALL_VALIDATION_SAMPLE_SIZE", 500);
}
