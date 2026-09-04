// Community Screening -- lazily-read env config, same convention as
// modules/email/emailConfig.ts. No secrets; all values have safe defaults.
function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getCommunityScreeningSyncMaxParties(): number {
  return readIntEnv("COMMUNITY_SCREENING_SYNC_MAX_PARTIES", 25);
}

export function getCommunityScreeningBatchSize(): number {
  return readIntEnv("COMMUNITY_SCREENING_BATCH_SIZE", 50);
}

export function getCommunityScreeningMaxParties(): number {
  return readIntEnv("COMMUNITY_SCREENING_MAX_PARTIES", 5000);
}

export function getCommunityScreeningMaxFileSizeMb(): number {
  return readIntEnv("COMMUNITY_SCREENING_MAX_FILE_SIZE_MB", 10);
}
