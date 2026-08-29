import type { ReportColumnDef } from "../catalog";

const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/** Neutralizes CSV formula injection by prefixing risky leading characters with a single quote. */
function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = typeof value === "string" ? value : String(value);
  if (FORMULA_PREFIXES.some((p) => str.startsWith(p))) {
    str = `'${str}`;
  }
  const needsQuoting = /[",\n\r]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

/** Generates a UTF-8 CSV buffer with a BOM, stable headers, and CSV-injection protection. */
export function generateCsv(columns: ReportColumnDef[], rows: Record<string, unknown>[]): Buffer {
  const header = columns.map((c) => sanitizeCsvCell(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => sanitizeCsvCell(row[c.key])).join(","));
  const content = [header, ...lines].join("\r\n");
  return Buffer.concat([Buffer.from("\uFEFF", "utf-8"), Buffer.from(content, "utf-8")]);
}
