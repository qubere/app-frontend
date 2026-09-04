export type CargoReleaseLineType =
  | "SE10"
  | "SE11"
  | "SE13"
  | "SE15"
  | "SE16"
  | "SE17"
  | "SE20"
  | "SE30"
  | "SE31"
  | "SE35"
  | "SE36"
  | "SE40"
  | "SE41"
  | "SE50"
  | "SE51"
  | "SE55"
  | "SE56"
  | "SE60"
  | "SE61"
  | "SE90"
  | "UNKNOWN";

const KNOWN_CODES: ReadonlySet<string> = new Set([
  "SE10", "SE11", "SE13", "SE15", "SE16", "SE17", "SE20", "SE30", "SE31",
  "SE35", "SE36", "SE40", "SE41", "SE50", "SE51", "SE55", "SE56", "SE60",
  "SE61", "SE90",
]);

/**
 * "UNKNOWN" covers the PGA grouping (OI, PG01-PG35 — reused from
 * src/lib/abi/pgaMessageSet/, not redefined here, see types.ts) and the ISF
 * grouping (SF10-SF36 — genuinely unique to this chapter but not modeled this
 * slice, see types.ts).
 */
export function classifyCargoReleaseLine(line: string): CargoReleaseLineType {
  const code = line.slice(0, 4);
  return KNOWN_CODES.has(code) ? (code as CargoReleaseLineType) : "UNKNOWN";
}

export * from "./parseResponse";

