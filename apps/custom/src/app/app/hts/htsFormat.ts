/**
 * Pure formatting helpers for the HTS workspace. Split from the component so
 * the code-level and duty-rate display rules are unit-testable.
 */

export interface DutyRateLike {
  rateColumn: string;
  rawRateText: string;
  isFree?: boolean;
}

export interface HtsNodeLike {
  htsNumberDisplay: string;
  description: string;
  codeLevel: number;
  dutyRates?: DutyRateLike[];
}

const CODE_LEVEL_LABEL: Record<number, string> = {
  2: "Chapter",
  4: "Heading",
  6: "Subheading",
  8: "Tariff line",
  10: "Statistical suffix",
};

export function codeLevelLabel(codeLevel: number): string {
  return CODE_LEVEL_LABEL[codeLevel] ?? `Level ${codeLevel}`;
}

/** True once a code is specific enough to actually declare an entry against. */
export function isClassifiable(codeLevel: number): boolean {
  return codeLevel >= 8;
}

/**
 * The headline duty rate to show in a result row: the "General" (column 1)
 * rate, falling back to the first rate on the node. Returns "—" when a node
 * (a chapter/heading) carries no rates of its own.
 */
export function headlineRate(dutyRates: DutyRateLike[] | undefined): string {
  if (!dutyRates || dutyRates.length === 0) return "—";
  const general =
    dutyRates.find((r) => /general/i.test(r.rateColumn)) ??
    dutyRates.find((r) => /column 1/i.test(r.rateColumn)) ??
    dutyRates[0];
  if (general.isFree) return "Free";
  return general.rawRateText?.trim() || "—";
}

/** Normalize a user-typed code for the API path (digits only). */
export function normalizeHtsQuery(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/** Whether a search box value looks like an HTS number rather than keywords. */
export function looksLikeCode(raw: string): boolean {
  const digits = normalizeHtsQuery(raw);
  return digits.length >= 4 && digits.length === raw.replace(/[.\s]/g, "").length;
}
