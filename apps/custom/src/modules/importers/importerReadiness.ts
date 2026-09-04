export type ImporterBlockerCode = "FIVE_OH_SIX" | "POA" | "BOND" | "SCREENING" | "CLIENT";

export interface ImporterReadinessBlocker {
  code: ImporterBlockerCode;
  label: string;
  href: string;
}

export interface ImporterReadinessResult {
  ready: boolean;
  blockers: ImporterReadinessBlocker[];
  completed: number;
  total: number;
  label: string;
}

export interface ImporterReadinessInput {
  id: string;
  clientId: string | null;
  registrationStatus: string;
  bond: {
    status: string;
    expirationDate: Date | string | null;
    bondAmount?: unknown;
    continuousBondFormulaAmount?: unknown;
  } | null;
  powersOfAttorney: Array<{
    status: string;
    expirationDate: Date | string | null;
    revokedAt?: Date | string | null;
  }>;
  onboardingEntities: Array<{
    screeningStatus: string;
    bondCoverage: string;
  }>;
}

function isFuture(value: Date | string | null | undefined, now: Date) {
  if (!value) return true;
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > now.getTime();
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Pure filing-readiness rule shared by lists, records, and transmit gates. */
export function importerReadiness(importer: ImporterReadinessInput, now = new Date()): ImporterReadinessResult {
  const blockers: ImporterReadinessBlocker[] = [];
  const href = (tab: string) => `/app/importers/${importer.id}?tab=${tab}`;

  if (!importer.clientId) {
    blockers.push({ code: "CLIENT", label: "Assign this importer to a client", href: href("overview") });
  }

  if (importer.registrationStatus.toLowerCase() !== "registered") {
    blockers.push({ code: "FIVE_OH_SIX", label: "CBP registration is not complete", href: href("5106") });
  }

  const validPoa = importer.powersOfAttorney.some((poa) =>
    poa.status.toLowerCase() === "executed" && !poa.revokedAt && isFuture(poa.expirationDate, now),
  );
  if (!validPoa) {
    const awaitingSignature = importer.powersOfAttorney.some((poa) => poa.status.toLowerCase() === "out_for_signature");
    blockers.push({
      code: "POA",
      label: awaitingSignature ? "Power of Attorney is awaiting signature" : "Valid Power of Attorney is missing",
      href: href("poa"),
    });
  }

  const acceptedAlternateCoverage = importer.onboardingEntities.some((entity) =>
    entity.bondCoverage === "single_transaction" || entity.bondCoverage === "broker_bond",
  );
  const amount = toNumber(importer.bond?.bondAmount);
  const requiredAmount = toNumber(importer.bond?.continuousBondFormulaAmount);
  const amountSufficient = requiredAmount === null || (amount !== null && amount >= requiredAmount);
  const ownBondReady = Boolean(
    importer.bond
      && ["verified", "attested"].includes(importer.bond.status.toLowerCase())
      && isFuture(importer.bond.expirationDate, now)
      && amountSufficient,
  );
  if (!acceptedAlternateCoverage && !ownBondReady) {
    blockers.push({
      code: "BOND",
      label: importer.bond && !amountSufficient ? "Customs bond increase is required" : "Verified customs bond coverage is missing",
      href: href("bond"),
    });
  }

  const screeningClear = importer.onboardingEntities.some((entity) =>
    ["passed", "overridden"].includes(entity.screeningStatus.toLowerCase()),
  );
  if (!screeningClear) {
    const blocked = importer.onboardingEntities.some((entity) => entity.screeningStatus.toLowerCase() === "blocked");
    blockers.push({
      code: "SCREENING",
      label: blocked ? "Screening is blocked; compliance authority is required" : "Denied-party screening is not cleared",
      href: href("screening"),
    });
  }

  const total = 5;
  const completed = total - blockers.length;
  return {
    ready: blockers.length === 0,
    blockers,
    completed,
    total,
    label: blockers.length === 0 ? "Ready to file" : `${blockers.length} blocking`,
  };
}
