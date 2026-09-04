/**
 * Pure display helpers for the Trade Intelligence panels. Split from the
 * component so the risk banding + number formatting rules are testable.
 */

export type RiskTone = "low" | "medium" | "high" | "critical";

/** SupplierRiskScore.riskLevel is a free string ("Low" | "Medium" | "High" | "Critical"). */
export function riskTone(riskLevel: string | null | undefined): RiskTone {
  switch ((riskLevel ?? "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    default:
      return "low";
  }
}

/** Broker accuracy: green ≥ 98, amber ≥ 95, red below. */
export function accuracyTone(accuracyPct: number): RiskTone {
  if (accuracyPct >= 98) return "low";
  if (accuracyPct >= 95) return "medium";
  return "high";
}

/** Override rate: green ≤ 3%, amber ≤ 8%, red above. */
export function overrideTone(overrideRatePct: number): RiskTone {
  if (overrideRatePct <= 3) return "low";
  if (overrideRatePct <= 8) return "medium";
  return "high";
}

export function compactUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function pct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}
