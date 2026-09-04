export type DrawbackLineType =
  | "10"
  | "31"
  | "40"
  | "41"
  | "42"
  | "43"
  | "50"
  | "51"
  | "52"
  | "53"
  | "60"
  | "61"
  | "62"
  | "63"
  | "64"
  | "70"
  | "71"
  | "72"
  | "73"
  | "89"
  | "90"
  | "E0"
  | "E1"
  | "UNKNOWN";

const KNOWN_CODES: ReadonlySet<string> = new Set([
  "10", "31", "40", "41", "42", "43", "50", "51", "52", "53",
  "60", "61", "62", "63", "64", "70", "71", "72", "73", "89", "90",
  "E0", "E1",
]);

/**
 * "UNKNOWN" covers anything outside this chapter's 21 input + 2 output records
 * — see types.ts's own scope note (the internal Drawback Matching/Claim Engine
 * and Trade Portal UI rendering are deferred, not modeled as wire records here).
 */
export function classifyDrawbackLine(line: string): DrawbackLineType {
  const code = line.slice(0, 2);
  return KNOWN_CODES.has(code) ? (code as DrawbackLineType) : "UNKNOWN";
}
