import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  serializeCatair,
  createSequence,
  UnsupportedCharacterError,
  FieldOverflowError,
  toCatairAlpha,
  transliterateToAscii,
} from "@/modules/entrySummary/serializers/catair";
import { encodeRecord, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import { CATAIR_LINE_SPEC } from "@/modules/entrySummary/serializers/catairLayouts";
import { Decimal } from "@/lib/tariff/decimal";
import { buildDraft, buildFilerProfile, buildLine, money } from "./helpers/entrySummaryFixtures";

const CATAIR_FIELD_MAP = { layout: "catair-ae-2024.1" };

function profile() {
  return buildFilerProfile({ format: "CATAIR_AE", fieldMap: CATAIR_FIELD_MAP });
}

function baseDraft(overrides: Parameters<typeof buildDraft>[1] = {}) {
  return buildDraft(
    [
      buildLine(1, {
        B29A_HTSUS_NUMBER: "8501.10.4000",
        B10_COUNTRY_OF_ORIGIN: "CN",
        B28_DESCRIPTION: "Widget",
        B32A_ENTERED_VALUE: money("1000.00"),
        B34_DUTY_TAX: money("50.00"),
      }),
    ],
    {
      B01_FILER_ENTRY_NUMBER: "12345678901",
      B02_ENTRY_TYPE: "01",
      B06_PORT_CODE: "2704",
      B23_IMPORTER_NUMBER: "IMPORTER00001",
      B03_SUMMARY_DATE: "2026-03-04",
      B07_ENTRY_DATE: "2026-03-01",
      B35_TOTAL_ENTERED_VALUE: money("1000.00"),
      ...overrides,
    }
  );
}

describe("serializeCatair", () => {
  it("1. every emitted record's length equals the layout's declared length", () => {
    const { body } = serializeCatair(baseDraft(), profile(), { sequence: createSequence() });
    const records = body.split("\n").filter((l) => l.length > 0);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.length).toBe(80);
    }
  });

  it("2. alpha field left-justified space-padded and uppercased", () => {
    const values = encodeRecord(CATAIR_LINE_SPEC, {
      sequenceNumber: 1,
      lineNumber: 1,
      htsNumber: "ACME",
      description: "X",
      enteredValue: new Decimal(1),
    });
    // htsNumber field: start 11, length 10
    const htsField = values.slice(10, 20);
    expect(htsField).toBe("ACME      ");
  });

  it("3. numeric implied-2-decimal field: 1234.56 in a 9-wide-equivalent (12-wide here) field", () => {
    const record = encodeRecord(CATAIR_LINE_SPEC, {
      sequenceNumber: 1,
      lineNumber: 1,
      htsNumber: "X",
      description: "X",
      enteredValue: new Decimal("1234.56"),
    });
    const enteredValueField = record.slice(57, 69); // start 58, length 12
    expect(enteredValueField).toBe("000000123456");
  });

  it("4. numeric 0 -> all zeros, not spaces", () => {
    const record = encodeRecord(CATAIR_LINE_SPEC, {
      sequenceNumber: 1,
      lineNumber: 1,
      htsNumber: "X",
      description: "X",
      enteredValue: new Decimal(0),
    });
    const enteredValueField = record.slice(57, 69);
    expect(enteredValueField).toBe("000000000000");
  });

  it("5. value too long for its field throws naming the field and lengths; no partial output", () => {
    expect(() =>
      encodeRecord(CATAIR_LINE_SPEC, {
        sequenceNumber: 1,
        lineNumber: 1,
        htsNumber: "THISVALUEISFARTOOLONGFORTENCHARS",
        description: "X",
        enteredValue: new Decimal(1),
      })
    ).toThrow(AbiFixedWidthError);
    try {
      encodeRecord(CATAIR_LINE_SPEC, {
        sequenceNumber: 1,
        lineNumber: 1,
        htsNumber: "THISVALUEISFARTOOLONGFORTENCHARS",
        description: "X",
        enteredValue: new Decimal(1),
      });
    } catch (err) {
      expect(String((err as Error).message)).toMatch(/htsNumber/);
      expect(String((err as Error).message)).toMatch(/10/);
    }
  });

  it("5b. an over-length money value throws FieldOverflowError naming block/value/max length", () => {
    expect(() =>
      encodeRecord(CATAIR_LINE_SPEC, {
        sequenceNumber: 1,
        lineNumber: 1,
        htsNumber: "X",
        description: "X",
        enteredValue: new Decimal("999999999999.99"), // way over 12 digits incl. cents
      })
    ).toThrow(FieldOverflowError);
  });

  it("6. null value on a conditional numeric field -> zeros (explicit null policy)", () => {
    const draft = baseDraft({}); // dutyTax left MISSING on the line by not overriding it -> null
    const draftNoDuty = buildDraft(
      [
        buildLine(1, {
          B29A_HTSUS_NUMBER: "8501104000",
          B10_COUNTRY_OF_ORIGIN: "CN",
          B28_DESCRIPTION: "Widget",
          B32A_ENTERED_VALUE: money("1000.00"),
          // B34_DUTY_TAX intentionally omitted -> MISSING/null
        }),
      ],
      {
        B01_FILER_ENTRY_NUMBER: "12345678901",
        B02_ENTRY_TYPE: "01",
        B06_PORT_CODE: "2704",
        B07_ENTRY_DATE: "2026-03-01",
        B35_TOTAL_ENTERED_VALUE: money("1000.00"),
      }
    );
    const { body } = serializeCatair(draftNoDuty, profile(), { sequence: createSequence() });
    const lineRecord = body.split("\n").find((l) => l.startsWith("L01"))!;
    const dutyField = lineRecord.slice(69, 79); // start 70, length 10
    expect(dutyField).toBe("0000000000");
    void draft;
  });

  it("7. trailer record count equals actual emitted record count", () => {
    const draft = buildDraft(
      [
        buildLine(1, { B29A_HTSUS_NUMBER: "1", B28_DESCRIPTION: "A", B32A_ENTERED_VALUE: money("10.00") }),
        buildLine(2, { B29A_HTSUS_NUMBER: "2", B28_DESCRIPTION: "B", B32A_ENTERED_VALUE: money("20.00") }),
        buildLine(3, { B29A_HTSUS_NUMBER: "3", B28_DESCRIPTION: "C", B32A_ENTERED_VALUE: money("30.00") }),
      ],
      {
        B01_FILER_ENTRY_NUMBER: "1",
        B02_ENTRY_TYPE: "01",
        B06_PORT_CODE: "2704",
        B07_ENTRY_DATE: "2026-03-01",
        B35_TOTAL_ENTERED_VALUE: money("60.00"),
      }
    );
    const { body } = serializeCatair(draft, profile(), { sequence: createSequence() });
    const records = body.split("\n").filter((l) => l.length > 0);
    const trailer = records.find((r) => r.startsWith("T01"))!;
    const recordCount = parseInt(trailer.slice(7, 13), 10); // start 8, length 6
    expect(recordCount).toBe(records.length);
    expect(recordCount).toBe(5); // 1 header + 3 lines + 1 trailer
  });

  it("8. trailer control sum equals B35 to the cent", () => {
    const draft = baseDraft({ B35_TOTAL_ENTERED_VALUE: money("1234.56") });
    const { body } = serializeCatair(draft, profile(), { sequence: createSequence() });
    const trailer = body.split("\n").find((l) => l.startsWith("T01"))!;
    const controlSumField = trailer.slice(13, 25); // start 14, length 12
    expect(controlSumField).toBe("000000123456");
  });

  it("9. sequence numbers 1..N with no gaps, using an injected counter", () => {
    const draft = buildDraft(
      [
        buildLine(1, { B29A_HTSUS_NUMBER: "1", B28_DESCRIPTION: "A", B32A_ENTERED_VALUE: money("10.00") }),
        buildLine(2, { B29A_HTSUS_NUMBER: "2", B28_DESCRIPTION: "B", B32A_ENTERED_VALUE: money("20.00") }),
      ],
      {
        B01_FILER_ENTRY_NUMBER: "1",
        B02_ENTRY_TYPE: "01",
        B06_PORT_CODE: "2704",
        B07_ENTRY_DATE: "2026-03-01",
        B35_TOTAL_ENTERED_VALUE: money("30.00"),
      }
    );
    const { body } = serializeCatair(draft, profile(), { sequence: createSequence() });
    const records = body.split("\n").filter((l) => l.length > 0);
    const seqs = records.map((r) => parseInt(r.slice(3, 7), 10));
    expect(seqs).toEqual([1, 2, 3, 4]);
  });

  it("10. transliteration: Müller GmbH -> MULLER GMBH; emoji throws UnsupportedCharacter", () => {
    expect(toCatairAlpha("Müller GmbH")).toBe("MULLER GMBH");
    expect(() => transliterateToAscii("Widget 🎉")).toThrow(UnsupportedCharacterError);
  });

  it("11. golden file: fixture draft serializes byte-identically to the checked-in golden file", () => {
    const goldenPath = join(__dirname, "fixtures", "7501", "catair-ae-golden.txt");
    const { body } = serializeCatair(baseDraft(), profile(), { sequence: createSequence() });
    if (!existsSync(goldenPath)) {
      writeFileSync(goldenPath, body, "utf8");
    }
    const golden = readFileSync(goldenPath, "utf8");
    expect(body).toBe(golden);
  });

  it("12. determinism across 10 runs with a fixed sequence port", () => {
    const draft = baseDraft();
    const first = serializeCatair(draft, profile(), { sequence: createSequence() }).body;
    for (let i = 0; i < 10; i++) {
      const again = serializeCatair(draft, profile(), { sequence: createSequence() }).body;
      expect(again).toBe(first);
    }
  });
});
