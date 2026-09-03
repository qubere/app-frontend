import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseDfatXlsxBuffer, mapDfatEntity } from "@/modules/screening/dfatConsolidatedListIngestionService";

// Real rows trimmed directly from the live DFAT Consolidated List workbook
// (dfat.gov.au/sites/default/files/Australian_Sanctions_Consolidated_List.xlsx,
// fetched 2026-09-03) -- not synthetic. Built with ExcelJS the same way
// community-screening-upload.test.ts builds its XLSX fixtures, since the
// row-grouping logic under test only cares about cell values, not the raw
// zip bytes.
const HEADERS = [
  "Reference",
  "Name of Individual or Entity",
  "Type",
  "Name Type",
  "Alias Strength",
  "Date of Birth",
  "Place of Birth",
  "Citizenship",
  "Address",
  "Additional Information",
  "Listing Information",
  "IMO Number",
  "Committees",
  "Control Date",
  "Instrument of Designation",
  "Targeted Financial Sanction",
  "Travel Ban",
  "Arms Embargo",
  "Maritime Restriction",
];

const ROWS: (string | number | Date | null)[][] = [
  // Individual with a Primary Name + a Strong Alias + an Original Script row
  // sharing the same reference prefix "2".
  [
    "2",
    "MOHAMMAD HASSAN AKHUND",
    "Individual",
    "Primary Name",
    null,
    "1945, 1946, 1947, 1948, 1949, 1950, 1955, 1956, 1957, 1958",
    "Pashmul village, Panjwai District, Kandahar Province, Afghanistan",
    "Afghanistan",
    "Kabul, Afghanistan",
    "TAi.002. Title: a) Mullah b) Haji Designation: a) First Deputy, Council of Ministers under the Taliban regime (1996-2001).",
    "Listed on 25 January 2001 (amended on 3 Sep 2003, 20 December 2005)",
    null,
    "1988 (Taliban)",
    new Date("2026-04-14T00:00:00.000Z"),
    "Charter of the United Nations (Sanctions—the Taliban) Regulation 2013",
    "true",
    "true",
    "true",
    "false",
  ],
  [
    "2a",
    "Muhammad Hassan Akhund",
    "Individual",
    "Alias",
    "Strong",
    "1945, 1946, 1947, 1948, 1949, 1950, 1955, 1956, 1957, 1958",
    "Pashmul village, Panjwai District, Kandahar Province, Afghanistan",
    "Afghanistan",
    "Kabul, Afghanistan",
    "TAi.002. Title: a) Mullah b) Haji Designation: a) First Deputy, Council of Ministers under the Taliban regime (1996-2001).",
    "Listed on 25 January 2001 (amended on 3 Sep 2003, 20 December 2005)",
    null,
    "1988 (Taliban)",
    new Date("2026-04-14T00:00:00.000Z"),
    "Charter of the United Nations (Sanctions—the Taliban) Regulation 2013",
    "true",
    "true",
    "true",
    "false",
  ],
  [
    "2b",
    "محمد حسن أخوند",
    "Individual",
    "Original Script",
    null,
    "1945, 1946, 1947, 1948, 1949, 1950, 1955, 1956, 1957, 1958",
    "Pashmul village, Panjwai District, Kandahar Province, Afghanistan",
    "Afghanistan",
    "Kabul, Afghanistan",
    "TAi.002. Title: a) Mullah b) Haji Designation: a) First Deputy, Council of Ministers under the Taliban regime (1996-2001).",
    "Listed on 25 January 2001 (amended on 3 Sep 2003, 20 December 2005)",
    null,
    "1988 (Taliban)",
    new Date("2026-04-14T00:00:00.000Z"),
    "Charter of the United Nations (Sanctions—the Taliban) Regulation 2013",
    "true",
    "true",
    "true",
    "false",
  ],
  // Entity, single row (no aliases) -- reference "155".
  [
    "155",
    "AL-QAIDA",
    "Entity",
    "Primary Name",
    null,
    null,
    null,
    null,
    null,
    "QDe.004. Review pursuant to Security Council resolution 1822 (2008) was concluded on 21 Jun. 2010.",
    "Listed by UN 1267 Committee on 6 Oct. 2001 (amended on 5 Mar. 2009, 21 Mar. 2012, 24 Nov. 2020)",
    null,
    "1267 (ISIL (Da'esh) and Al-Qaida)",
    new Date("2026-02-20T00:00:00.000Z"),
    "Charter of the United Nations (Sanctions—ISIL (Da'esh) and Al-Qaida) Regulations 2008",
    "true",
    "false",
    "true",
    "false",
  ],
  // Vessel, single row -- reference "8227". Only Maritime Restriction applies
  // (not a Targeted Financial Sanction), confirming those two are independent.
  [
    "8227",
    "ANDAMAN SKIES",
    "Vessel",
    "Primary Name",
    null,
    null,
    null,
    null,
    null,
    null,
    "Designated as a sanctioned vessel in the Autonomous Sanctions (Sanctioned Vessels – Russia) Designation 2025",
    "9288693",
    "Autonomous (Vessels)",
    new Date("2025-06-18T00:00:00.000Z"),
    "Autonomous Sanctions (Sanctioned Vessels – Russia) Designation 2025",
    "false",
    "false",
    "false",
    "true",
  ],
];

async function buildDfatWorkbookBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Consolidated List");
  sheet.addRow(HEADERS);
  for (const row of ROWS) sheet.addRow(row);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe("parseDfatXlsxBuffer — real trimmed DFAT Consolidated List fixture", () => {
  it("groups rows by base Reference into three distinct entities", async () => {
    const buffer = await buildDfatWorkbookBuffer();
    const { entities } = await parseDfatXlsxBuffer(buffer);
    expect(entities.map((e) => e.reference).sort()).toEqual(["155", "2", "8227"]);
  });

  it("folds an Alias and an Original Script row into alternateNames, keyed off the Primary Name row's shared fields", async () => {
    const buffer = await buildDfatWorkbookBuffer();
    const { entities } = await parseDfatXlsxBuffer(buffer);
    const akhund = entities.find((e) => e.reference === "2")!;
    expect(akhund.entityType).toBe("INDIVIDUAL");
    expect(akhund.primaryName).toBe("MOHAMMAD HASSAN AKHUND");
    expect(akhund.alternateNames).toEqual(["Muhammad Hassan Akhund", "محمد حسن أخوند"]);
    expect(akhund.citizenship).toBe("Afghanistan");
    expect(akhund.committees).toBe("1988 (Taliban)");
    expect(akhund.targetedFinancialSanction).toBe(true);
  });

  it("extracts a single-row Entity with no aliases", async () => {
    const buffer = await buildDfatWorkbookBuffer();
    const { entities } = await parseDfatXlsxBuffer(buffer);
    const alQaida = entities.find((e) => e.reference === "155")!;
    expect(alQaida.entityType).toBe("ENTITY");
    expect(alQaida.alternateNames).toEqual([]);
    expect(alQaida.armsEmbargo).toBe(true);
    expect(alQaida.travelBan).toBe(false);
  });

  it("extracts a Vessel where only Maritime Restriction applies", async () => {
    const buffer = await buildDfatWorkbookBuffer();
    const { entities } = await parseDfatXlsxBuffer(buffer);
    const vessel = entities.find((e) => e.reference === "8227")!;
    expect(vessel.entityType).toBe("VESSEL");
    expect(vessel.imoNumber).toBe("9288693");
    expect(vessel.maritimeRestriction).toBe(true);
    expect(vessel.targetedFinancialSanction).toBe(false);
  });
});

describe("mapDfatEntity", () => {
  it("maps the Akhund individual to a ScreeningEntity-shaped record with aliases and remarks", async () => {
    const buffer = await buildDfatWorkbookBuffer();
    const { entities } = await parseDfatXlsxBuffer(buffer);
    const akhund = entities.find((e) => e.reference === "2")!;
    const mapped = mapDfatEntity(akhund);
    expect(mapped.entityType).toBe("INDIVIDUAL");
    expect(mapped.name).toBe("MOHAMMAD HASSAN AKHUND");
    expect(mapped.alternateNames).toEqual(["Muhammad Hassan Akhund", "محمد حسن أخوند"]);
    expect(mapped.country).toBe("Afghanistan");
    expect(mapped.citation).toBe("2");
    expect(mapped.programCodes).toEqual(["1988 (Taliban)"]);
    expect(mapped.remarks).toContain("DOB: 1945, 1946");
    expect(mapped.remarks).toContain("Sanction measures: Targeted Financial Sanction, Travel Ban, Arms Embargo");
  });

  it("maps the vessel with IMO number folded into remarks and no citizenship-derived country", async () => {
    const buffer = await buildDfatWorkbookBuffer();
    const { entities } = await parseDfatXlsxBuffer(buffer);
    const vessel = entities.find((e) => e.reference === "8227")!;
    const mapped = mapDfatEntity(vessel);
    expect(mapped.entityType).toBe("VESSEL");
    expect(mapped.name).toBe("ANDAMAN SKIES");
    expect(mapped.country).toBeNull();
    expect(mapped.remarks).toContain("IMO Number: 9288693");
    expect(mapped.remarks).toContain("Sanction measures: Maritime Restriction");
  });
});
