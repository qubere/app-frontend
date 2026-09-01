/**
 * Deterministic fuzzy name-match scorer.
 *
 * Shared across every compliance screening engine that needs to compare a
 * party/target name against a reference list entry: Restricted Party
 * Screening (restrictedParty/scoring.ts), Military End-Use, Forced Labor,
 * and End-User screening. There is exactly one scoring algorithm in the
 * codebase; each engine wraps it with its own thresholds and gates rather
 * than reimplementing matching.
 */

export type DpsMatchStatus = "PASSED" | "FLAGGED" | "BLOCKED" | "INDETERMINATE";

/**
 * Returns a score 0–100 representing how closely `target` matches `entry`:
 * - 100: exact match (case-insensitive)
 * - 85: one string contains the other
 * - 1-75: word-overlap score, capped at 75
 * - 0: no meaningful match
 */
export function scoreDpsMatch(target: string, entry: string): number {
  const cleanTarget = target.trim().toLowerCase();
  const cleanEntry = entry.trim().toLowerCase();

  if (cleanTarget === cleanEntry) return 100;

  // Containment is only strong evidence when the *contained* (shorter) side
  // is itself a multi-word phrase. A caller-side name/alias that reduces to
  // a single generic word after upstream common-word/legal-form stripping
  // (e.g. an alias like "Global Trading Group" normalizing down to just
  // "global") would otherwise be treated as a substring "contains" hit and
  // score 85 -- outranking the word-overlap branch below, which correctly
  // caps a genuine single-shared-word overlap at 30/75.
  if (cleanTarget.includes(cleanEntry) || cleanEntry.includes(cleanTarget)) {
    const contained = cleanTarget.includes(cleanEntry) ? cleanEntry : cleanTarget;
    if (contained.includes(" ")) return 85;
  }

  const words = cleanTarget.split(" ");
  const matched = words.filter((w) => w.length > 3 && cleanEntry.includes(w));
  return matched.length > 0 ? Math.min(75, matched.length * 30) : 0;
}

export function scoreToMatchStatus(maxScore: number): DpsMatchStatus {
  if (maxScore >= 80) return "BLOCKED";
  if (maxScore >= 50) return "FLAGGED";
  return "PASSED";
}
