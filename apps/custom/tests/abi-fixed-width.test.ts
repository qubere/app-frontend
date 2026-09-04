import { describe, it, expect } from "vitest";
import {
  encodeRecord,
  decodeRecord,
  splitFixedWidthLines,
  AbiFixedWidthError,
  type RecordSpec,
} from "@/lib/abi/fixedWidth";

interface TestRecord {
  alpha: string;
  numeric: number;
  spaceNumeric: number;
  alphanumeric: string;
  freeText: string;
}

// A synthetic 20-char record exercising every FieldClass: 1 filler + 4A alpha +
// 3N numeric + 3SN space-numeric + 4AN alphanumeric + 5X free text = 20.
const TEST_SPEC: RecordSpec<TestRecord> = {
  recordType: "Test-Record",
  length: 20,
  fields: [
    { key: null, start: 1, length: 1, class: "S", designation: "M" },
    { key: "alpha", start: 2, length: 4, class: "A", designation: "M" },
    { key: "numeric", start: 6, length: 3, class: "N", designation: "M" },
    { key: "spaceNumeric", start: 9, length: 3, class: "SN", designation: "O" },
    { key: "alphanumeric", start: 12, length: 4, class: "AN", designation: "C" },
    { key: "freeText", start: 16, length: 5, class: "X", designation: "O" },
  ],
};

function validValues(): TestRecord {
  return { alpha: "ABCD", numeric: 7, spaceNumeric: 42, alphanumeric: "AB1", freeText: "HI!!!" };
}

describe("encodeRecord / decodeRecord field classes", () => {
  it("encodes and decodes class A (alpha, space-padded left-justified)", () => {
    const line = encodeRecord(TEST_SPEC, { alpha: "AB", numeric: 1 });
    expect(line.slice(1, 5)).toBe("AB  ");
    expect(decodeRecord(TEST_SPEC, line).alpha).toBe("AB");
  });

  it("encodes and decodes class N (numeric, zero-padded right-justified)", () => {
    const line = encodeRecord(TEST_SPEC, { alpha: "AB", numeric: 7 });
    expect(line.slice(5, 8)).toBe("007");
    expect(decodeRecord(TEST_SPEC, line).numeric).toBe(7);
  });

  it("encodes and decodes class SN (numeric, zero-padded like N by default)", () => {
    const line = encodeRecord(TEST_SPEC, { alpha: "AB", numeric: 1, spaceNumeric: 5 });
    expect(line.slice(8, 11)).toBe("005");
    expect(decodeRecord(TEST_SPEC, line).spaceNumeric).toBe(5);
  });

  it("encodes and decodes class AN (alphanumeric, space-padded left-justified)", () => {
    const line = encodeRecord(TEST_SPEC, { alpha: "AB", numeric: 1, alphanumeric: "X9" });
    expect(line.slice(11, 15)).toBe("X9  ");
    expect(decodeRecord(TEST_SPEC, line).alphanumeric).toBe("X9");
  });

  it("encodes and decodes class X (free text, space-padded left-justified)", () => {
    const line = encodeRecord(TEST_SPEC, { alpha: "AB", numeric: 1, freeText: "A/B" });
    expect(line.slice(15, 20)).toBe("A/B  ");
    expect(decodeRecord(TEST_SPEC, line).freeText).toBe("A/B");
  });

  it("leaves a filler column space-filled and omits it from the decoded object", () => {
    const line = encodeRecord(TEST_SPEC, { alpha: "AB", numeric: 1 });
    expect(line[0]).toBe(" ");
    expect(decodeRecord(TEST_SPEC, line)).not.toHaveProperty("filler");
  });

  it("produces an exact-length record", () => {
    const line = encodeRecord(TEST_SPEC, validValues());
    expect(line).toHaveLength(20);
  });

  it("round-trips decode(encode(values))", () => {
    const values = validValues();
    const decoded = decodeRecord(TEST_SPEC, encodeRecord(TEST_SPEC, values));
    expect(decoded.alpha).toBe(values.alpha);
    expect(decoded.numeric).toBe(values.numeric);
    expect(decoded.alphanumeric).toBe(values.alphanumeric);
  });
});

describe("encodeRecord validation — never truncates", () => {
  it("throws on a value longer than its field's declared length", () => {
    expect(() => encodeRecord(TEST_SPEC, { alpha: "ABCDE" })).toThrow(AbiFixedWidthError);
  });

  it("does not return a partial/truncated line when overflow is thrown", () => {
    try {
      encodeRecord(TEST_SPEC, { alpha: "ABCDE" });
      expect.fail("expected encodeRecord to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AbiFixedWidthError);
    }
  });

  it("throws on a missing mandatory field", () => {
    expect(() => encodeRecord(TEST_SPEC, { numeric: 1 })).toThrow(/mandatory field "alpha" is missing/);
  });

  it("throws on lowercase input (envelope is uppercase-only)", () => {
    expect(() => encodeRecord(TEST_SPEC, { alpha: "ab" })).toThrow(AbiFixedWidthError);
  });

  it("throws on non-numeric content in a numeric-class field", () => {
    expect(() => encodeRecord(TEST_SPEC, { alpha: "AB", numeric: NaN })).toThrow();
  });
});

describe("decodeRecord validation", () => {
  it("throws if the line length doesn't match the spec length", () => {
    expect(() => decodeRecord(TEST_SPEC, "TOO SHORT")).toThrow(AbiFixedWidthError);
  });
});

describe("splitFixedWidthLines", () => {
  it("splits on newlines and drops a single trailing blank line", () => {
    const raw = "A".repeat(20) + "\n" + "B".repeat(20) + "\n";
    expect(splitFixedWidthLines(raw, 20)).toEqual(["A".repeat(20), "B".repeat(20)]);
  });

  it("handles CRLF line endings", () => {
    const raw = "A".repeat(20) + "\r\n" + "B".repeat(20);
    expect(splitFixedWidthLines(raw, 20)).toEqual(["A".repeat(20), "B".repeat(20)]);
  });

  it("throws naming the offending 1-based line number for a wrong-length line", () => {
    const raw = "A".repeat(20) + "\n" + "TOO SHORT" + "\n" + "B".repeat(20);
    expect(() => splitFixedWidthLines(raw, 20)).toThrow(/Line 2 is 9 chars/);
  });
});
