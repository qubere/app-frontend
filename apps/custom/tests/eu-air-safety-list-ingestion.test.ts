import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  parseEuAirSafetyWorkbook,
  mapEuAirSafetyRow,
} from "@/modules/screening/euAirSafetyListIngestionService";

// Builds an in-memory workbook mirroring the real EU Air Safety List's shape
// (fetched 2026-09-03 from transport.ec.europa.eu): a title/disclaimer
// preamble before row 7's header, data from row 8, blanket-ban rows with
// richText exception clauses, and a duplicated trailing block (a known
// artifact of the EC's own published workbook, not a parsing bug).
function buildFixtureWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  // NOTE: ExcelJS's row.values SETTER is 0-indexed directly to column 1
  // (array[0] -> column 1) -- unlike its GETTER, which always prepends an
  // undefined placeholder at index 0 (values[0] is blank, values[1] ->
  // column 1). No leading placeholder belongs in these assignments.
  const annexA = workbook.addWorksheet("Annex A");
  for (let r = 1; r <= 6; r++) annexA.getRow(r).getCell(1).value = `Preamble row ${r}`;
  annexA.getRow(7).values = [
    "Name of the legal entity of the air carrier as indicated on its AOC",
    "AOC Number",
    "ICAO designator",
    "State of the Operator",
  ];
  // Standalone blanket ban (no individually-named carriers for this state).
  annexA.getRow(8).values = [
    "All air carriers certified by the authorities with responsibility for regulatory oversight of Liberia.",
    null,
    null,
    "Liberia",
  ];
  // Blanket ban WITH a bold exception clause via richText, heading a group.
  annexA.getRow(9).getCell(1).value = {
    richText: [
      { text: "All air carriers certified by the authorities with responsibility for regulatory oversight of Angola, with the exception of " },
      { text: "TAAG Angola Airlines", font: { bold: true } },
      { text: " and ", font: {} },
      { text: "Heli Malongo", font: { bold: true } },
      { text: "." },
    ],
  };
  annexA.getRow(9).getCell(4).value = "Angola";
  // Individually-named carrier under the Angola group.
  annexA.getRow(10).values = ["AEROJET", "AGCA-009", "unknown", "Angola"];
  // Duplicate of row 10, appended near the end of the sheet -- must collapse.
  annexA.getRow(11).values = ["AEROJET", "AGCA-009", "unknown", "Angola"];

  const annexB = workbook.addWorksheet("Annex B");
  for (let r = 1; r <= 6; r++) annexB.getRow(r).getCell(1).value = `Preamble row ${r}`;
  annexB.getRow(7).values = [
    "Name of the legal entity of the air carrier as indicated on its AOC",
    "AOC Number",
    "ICAO designator",
    "State of the Operator",
    "Aircraft type restricted",
    "Registration mark(s) and, where available, serial number(s)",
    "State of Registry",
  ];
  annexB.getRow(8).values = ["IRAN AIR", "FS100", "IRA", "Iran", "All aircraft except a specified fleet", "EP-IBA and others", "Iran"];
  // Exact duplicate row, as seen live -- must collapse to one entity.
  annexB.getRow(9).values = ["IRAN AIR", "FS100", "IRA", "Iran", "All aircraft except a specified fleet", "EP-IBA and others", "Iran"];
  annexB.getRow(10).values = ["AIR KORYO", "GAC-AOC/KOR-01", "KOR", "North Korea", "All fleet except", "P-632, P-633", "North Korea"];

  return workbook;
}

describe("parseEuAirSafetyWorkbook — fixture mirroring the real workbook shape", () => {
  it("skips preamble and header rows, parses only data rows", () => {
    const { rows } = parseEuAirSafetyWorkbook(buildFixtureWorkbook());
    expect(rows.every((r) => !r.name.startsWith("Preamble"))).toBe(true);
    expect(rows.every((r) => !/^Name of the legal entity/i.test(r.name))).toBe(true);
  });

  it("parses a standalone blanket-ban row with no AOC/ICAO value", () => {
    const { rows } = parseEuAirSafetyWorkbook(buildFixtureWorkbook());
    const row = rows.find((r) => r.name.includes("Liberia"))!;
    expect(row.annex).toBe("A");
    expect(row.aocNumber).toBe("");
    expect(row.stateOfOperator).toBe("Liberia");
  });

  it("flattens a richText blanket-ban cell into plain text, preserving the exception clause", () => {
    const { rows } = parseEuAirSafetyWorkbook(buildFixtureWorkbook());
    const row = rows.find((r) => r.name.includes("Angola"))!;
    expect(row.name).toBe(
      "All air carriers certified by the authorities with responsibility for regulatory oversight of Angola, with the exception of TAAG Angola Airlines and Heli Malongo."
    );
  });

  it("parses Annex B rows including the aircraft/registration restriction columns", () => {
    const { rows } = parseEuAirSafetyWorkbook(buildFixtureWorkbook());
    const koryo = rows.find((r) => r.name === "AIR KORYO")!;
    expect(koryo.annex).toBe("B");
    expect(koryo.aircraftTypeRestricted).toBe("All fleet except");
    expect(koryo.registrationMarks).toBe("P-632, P-633");
  });

  it("keeps the duplicated Iran Air row as two parsed rows (dedup happens at mapping time)", () => {
    const { rows } = parseEuAirSafetyWorkbook(buildFixtureWorkbook());
    expect(rows.filter((r) => r.name === "IRAN AIR")).toHaveLength(2);
  });
});

describe("mapEuAirSafetyRow", () => {
  it("maps a named Annex A carrier with country and AOC citation", () => {
    const { rows } = parseEuAirSafetyWorkbook(buildFixtureWorkbook());
    const row = rows.find((r) => r.name === "AEROJET")!;
    const mapped = mapEuAirSafetyRow(row);
    expect(mapped.name).toBe("AEROJET");
    expect(mapped.country).toBe("Angola");
    expect(mapped.citation).toBe("Regulation (EC) No 474/2006 Annex A -- AOC/Licence AGCA-009");
    expect(mapped.programCodes).toEqual(["Regulation (EC) No 474/2006 Annex A"]);
  });

  it("produces the same entityHash for the two duplicate Iran Air rows", () => {
    const { rows } = parseEuAirSafetyWorkbook(buildFixtureWorkbook());
    const [first, second] = rows.filter((r) => r.name === "IRAN AIR").map(mapEuAirSafetyRow);
    expect(first.entityHash).toBe(second.entityHash);
  });

  it("includes Annex B aircraft/registration restrictions in remarks", () => {
    const { rows } = parseEuAirSafetyWorkbook(buildFixtureWorkbook());
    const row = rows.find((r) => r.name === "AIR KORYO")!;
    const mapped = mapEuAirSafetyRow(row);
    expect(mapped.remarks).toContain("Aircraft type restricted: All fleet except");
    expect(mapped.remarks).toContain("Restricted aircraft: P-632, P-633");
  });
});
