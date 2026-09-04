export type StatementLineType = "Q1" | "Q2" | "QA" | "Q3" | "Q4" | "QE" | "Q5" | "Q6" | "QJ" | "Q7" | "UNKNOWN";

const KNOWN_CODES: ReadonlySet<string> = new Set([
  "Q1", "Q2", "QA", "Q3", "Q4", "QE", "Q5", "Q6", "QJ", "Q7",
]);

/**
 * Classifies by control identifier only — Daily vs Periodic Monthly records
 * share the same 2-char codes but differ in field layout (see recordSpecs.ts);
 * the caller must know which flow it's parsing to pick the right RecordSpec.
 * "UNKNOWN" covers SU/RM/PN transactions and the Outstanding Action ES Query
 * Response grouping — not modeled this slice, see types.ts.
 */
export function classifyStatementLine(line: string): StatementLineType {
  const code = line.slice(0, 2);
  return KNOWN_CODES.has(code) ? (code as StatementLineType) : "UNKNOWN";
}
