export type EbondLineType = "10" | "12" | "20" | "30" | "35" | "36" | "40" | "45" | "46" | "90" | "UNKNOWN";

const KNOWN_CODES: ReadonlySet<string> = new Set([
  "10", "12", "20", "30", "35", "36", "40", "45", "46", "90",
]);

/** "UNKNOWN" covers interactive eBond Query transactions (QB/QX) — not modeled this slice. */
export function classifyEbondLine(line: string): EbondLineType {
  const code = line.slice(0, 2);
  return KNOWN_CODES.has(code) ? (code as EbondLineType) : "UNKNOWN";
}
