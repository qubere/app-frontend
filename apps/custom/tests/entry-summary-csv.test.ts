import { describe, expect, it } from "vitest";
import { parse as parseCsv } from "csv-parse/sync";
import { serializeCsv } from "@/modules/entrySummary/serializers/csv";
import type { CsvFieldMap } from "@/modules/entrySummary/serializers/csv";
import { buildDraft, buildFilerProfile, buildLine, money } from "./helpers/entrySummaryFixtures";

const BASIC_FIELD_MAP: CsvFieldMap = {
  columns: [
    { blockId: "B27_LINE_NUMBER", header: "Line No" },
    { blockId: "B28_DESCRIPTION", header: "Description" },
    { blockId: "B32A_ENTERED_VALUE", header: "Entered Value" },
  ],
};

function profileWith(fieldMap: unknown) {
  return buildFilerProfile({ fieldMap });
}

describe("serializeCsv", () => {
  it("1. header row matches fieldMap order exactly", () => {
    const draft = buildDraft([]);
    const { body } = serializeCsv(draft, profileWith(BASIC_FIELD_MAP));
    const firstLine = body.split("\r\n")[0];
    expect(firstLine).toBe("Line No,Description,Entered Value");
  });

  it('2. description with comma and quote is quoted and doubled: `Valve, 1/2" NPT`', () => {
    const draft = buildDraft([buildLine(1, { B28_DESCRIPTION: 'Valve, 1/2" NPT' })]);
    const { body } = serializeCsv(draft, profileWith(BASIC_FIELD_MAP));
    const dataLine = body.split("\r\n")[1];
    expect(dataLine).toContain('"Valve, 1/2"" NPT"');
  });

  it("3. multiline description stays one CSV record and parses back to one row", () => {
    const desc = "Line one\nLine two";
    const draft = buildDraft([buildLine(1, { B28_DESCRIPTION: desc })]);
    const { body } = serializeCsv(draft, profileWith(BASIC_FIELD_MAP));
    const parsed = parseCsv(body, { columns: false }) as string[][];
    // header + 1 data row, no matter how many literal newlines are embedded
    expect(parsed).toHaveLength(2);
    expect(parsed[1][1]).toBe(desc);
  });

  it("4. injection: description starting with = is escaped with a leading apostrophe", () => {
    const draft = buildDraft([buildLine(1, { B28_DESCRIPTION: "=cmd|'/c calc'!A1" })]);
    const { body } = serializeCsv(draft, profileWith(BASIC_FIELD_MAP));
    const dataLine = body.split("\r\n")[1];
    const cells = dataLine.split(",");
    expect(cells[1].startsWith("'=cmd")).toBe(true);
  });

  it("5. injection guard covers +, -, @, and a leading tab", () => {
    for (const prefix of ["+SUM(1,1)", "-2+3", "@SUM(1,1)", "\tdanger"]) {
      const draft = buildDraft([buildLine(1, { B28_DESCRIPTION: prefix })]);
      const { body } = serializeCsv(draft, profileWith(BASIC_FIELD_MAP));
      const dataLine = body.split("\r\n")[1];
      const cells = parseCsv(body, { columns: false })[1] as string[];
      expect(cells[1].startsWith("'")).toBe(true);
      void dataLine;
    }
  });

  it("6. null renders as empty field; no null/undefined/N/A literals ever appear", () => {
    const draft = buildDraft([buildLine(1, {})]);
    const { body } = serializeCsv(draft, profileWith(BASIC_FIELD_MAP));
    expect(body).not.toMatch(/\bnull\b/i);
    expect(body).not.toMatch(/\bundefined\b/i);
    expect(body).not.toMatch(/N\/A/);
    const rows = parseCsv(body, { columns: false }) as string[][];
    expect(rows[1][1]).toBe("");
    expect(rows[1][2]).toBe("");
  });

  it("7. money renders with exactly 2 decimals, no separators, no currency symbol", () => {
    const draft = buildDraft([
      buildLine(1, { B32A_ENTERED_VALUE: money("1234.5") }),
      buildLine(2, { B32A_ENTERED_VALUE: money("1234567.891") }),
    ]);
    const { body } = serializeCsv(draft, profileWith(BASIC_FIELD_MAP));
    const rows = parseCsv(body, { columns: false }) as string[][];
    expect(rows[1][2]).toBe("1234.50");
    expect(rows[2][2]).toBe("1234567.89");
  });

  it("8. 3 lines + 1 chapter-99 child -> 4 line records, child immediately after its parent", () => {
    const draft = buildDraft([
      buildLine(1, { B28_DESCRIPTION: "Parent 1" }),
      buildLine(2, { B28_DESCRIPTION: "Chapter 99 child of 1" }, { parentLineNumber: 1 }),
      buildLine(3, { B28_DESCRIPTION: "Parent 2" }),
      buildLine(4, { B28_DESCRIPTION: "Parent 3" }),
    ]);
    const { body } = serializeCsv(draft, profileWith(BASIC_FIELD_MAP));
    const rows = parseCsv(body, { columns: false }) as string[][];
    expect(rows).toHaveLength(5); // header + 4 lines
    expect(rows[1][1]).toBe("Parent 1");
    expect(rows[2][1]).toBe("Chapter 99 child of 1");
    expect(rows[3][1]).toBe("Parent 2");
    expect(rows[4][1]).toBe("Parent 3");
  });

  it("9. zero lines -> header row only, no trailing blank record", () => {
    const draft = buildDraft([]);
    const { body } = serializeCsv(draft, profileWith(BASIC_FIELD_MAP));
    expect(body).toBe("Line No,Description,Entered Value\r\n");
    const rows = parseCsv(body, { columns: false }) as string[][];
    expect(rows).toHaveLength(1);
  });

  it("10. filename pattern default renders filer/shipment/version", () => {
    const draft = buildDraft([]);
    const { filename } = serializeCsv(draft, profileWith(BASIC_FIELD_MAP), {
      shipmentNumber: "SHP-2026-004872",
      version: 3,
    });
    expect(filename).toBe("ABC_SHP-2026-004872_v3.csv");
  });

  it("11. determinism: byte-identical body across 10 runs", () => {
    const draft = buildDraft([
      buildLine(1, { B28_DESCRIPTION: "Widget", B32A_ENTERED_VALUE: money("100.00") }),
      buildLine(2, { B28_DESCRIPTION: "Gadget", B32A_ENTERED_VALUE: money("250.75") }),
    ]);
    const profile = profileWith(BASIC_FIELD_MAP);
    const first = serializeCsv(draft, profile, { shipmentNumber: "SHP-1", version: 1 }).body;
    for (let i = 0; i < 10; i++) {
      const again = serializeCsv(draft, profile, { shipmentNumber: "SHP-1", version: 1 }).body;
      expect(again).toBe(first);
    }
  });

  it("a block not listed in fieldMap is not emitted", () => {
    const fieldMap: CsvFieldMap = { columns: [{ blockId: "B28_DESCRIPTION", header: "Description" }] };
    const draft = buildDraft([buildLine(1, { B28_DESCRIPTION: "Widget", B32A_ENTERED_VALUE: money("5.00") })]);
    const { body } = serializeCsv(draft, profileWith(fieldMap));
    const rows = parseCsv(body, { columns: false }) as string[][];
    expect(rows[0]).toEqual(["Description"]);
    expect(rows[1]).toEqual(["Widget"]);
  });

  it("a header-block column repeats its value on every data row", () => {
    const fieldMap: CsvFieldMap = {
      columns: [
        { blockId: "B06_PORT_CODE", header: "Port" },
        { blockId: "B28_DESCRIPTION", header: "Description" },
      ],
    };
    const draft = buildDraft(
      [buildLine(1, { B28_DESCRIPTION: "Widget" }), buildLine(2, { B28_DESCRIPTION: "Gadget" })],
      { B06_PORT_CODE: "2704" }
    );
    const { body } = serializeCsv(draft, profileWith(fieldMap));
    const rows = parseCsv(body, { columns: false }) as string[][];
    expect(rows[1][0]).toBe("2704");
    expect(rows[2][0]).toBe("2704");
  });

  it("date fields render per fieldMap.dateFormat (default MMDDYYYY)", () => {
    const fieldMap: CsvFieldMap = { columns: [{ blockId: "B07_ENTRY_DATE", header: "Entry Date" }] };
    const draft = buildDraft([buildLine(1, {})], { B07_ENTRY_DATE: "2026-03-04" });
    const { body: defaultBody } = serializeCsv(draft, profileWith(fieldMap));
    expect(parseCsv(defaultBody, { columns: false })[1][0]).toBe("03042026");

    const isoFieldMap: CsvFieldMap = { ...fieldMap, dateFormat: "YYYY-MM-DD" };
    const { body: isoBody } = serializeCsv(draft, profileWith(isoFieldMap));
    expect(parseCsv(isoBody, { columns: false })[1][0]).toBe("2026-03-04");
  });
});
