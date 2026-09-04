import { describe, it, expect } from "vitest";
import { encodeRecord, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import { E0_SUMMARY_SPEC, E0_GENERIC_SPEC, E1_SPEC } from "@/lib/abi/entrySummary/recordSpecs";
import {
  classifyResponseLine,
  parseE0Record,
  parseE1Record,
  parseEntrySummaryResponse,
} from "@/lib/abi/entrySummary/parse";
import { isE0SummaryReference } from "@/lib/abi/entrySummary/types";

describe("classifyResponseLine", () => {
  it.each([
    ["E0" + " ".repeat(78), "E0"],
    ["E1" + " ".repeat(78), "E1"],
    ["10" + " ".repeat(78), "UNKNOWN"], // e.g. an Entry Summary input record, never a response line
  ] as const)("classifies %j as %s", (line, expected) => {
    expect(classifyResponseLine(line)).toBe(expected);
  });
});

describe("parseE0Record", () => {
  it("decodes a SUMMRY reference into its structured sub-fields", () => {
    const line = encodeRecord(E0_SUMMARY_SPEC, {
      referenceDataTypeCode: "SUMMRY",
      occurrencePosition: 1,
      entryFilerCode: "N01",
      entryNumber: "50000035",
      cbpTeamNumber: "123",
    });
    const decoded = parseE0Record(line);
    expect(decoded.referenceDataTypeCode).toBe("SUMMRY");
    if (isE0SummaryReference(decoded)) {
      expect(decoded.occurrencePosition).toBe(1);
      expect(decoded.entryFilerCode).toBe("N01");
      expect(decoded.entryNumber).toBe("50000035");
      expect(decoded.cbpTeamNumber).toBe("123");
    }
  });

  it("decodes an unmodeled reference type's data as raw, undecoded text", () => {
    const line = encodeRecord(E0_GENERIC_SPEC, {
      referenceDataTypeCode: "CARMAN",
      occurrencePosition: 2,
      referenceDataText: "SOME EXTRACTED FIELD DATA",
    });
    const decoded = parseE0Record(line);
    expect(decoded.referenceDataTypeCode).toBe("CARMAN");
    if (!isE0SummaryReference(decoded)) {
      expect(decoded.referenceDataText).toBe("SOME EXTRACTED FIELD DATA");
    }
  });

  it("includes the literal REF ID: constant in the encoded line", () => {
    const line = encodeRecord(E0_SUMMARY_SPEC, { referenceDataTypeCode: "SUMMRY", occurrencePosition: 0 });
    expect(line.slice(17, 24)).toBe("REF ID:");
  });
});

describe("parseE1Record", () => {
  it("derives isFinalDisposition=true for an ACCEPTED disposition", () => {
    const line = encodeRecord(E1_SPEC, {
      dispositionTypeCode: "A",
      severityCode: " ",
      conditionCode: "000",
      narrativeText: "SUMMARY HAS BEEN ADDED",
      entryNumber: "50000035",
      versionNumber: "00100",
    });
    const decoded = parseE1Record(line);
    expect(decoded.isFinalDisposition).toBe(true);
    expect(decoded.dispositionTypeCode).toBe("A");
    expect(decoded.versionNumber).toBe("00100");
  });

  it("derives isFinalDisposition=true for a REJECTED disposition", () => {
    const line = encodeRecord(E1_SPEC, {
      dispositionTypeCode: "R",
      severityCode: "F",
      conditionCode: "999",
      narrativeText: "TRANSACTION DATA REJECTED",
    });
    expect(parseE1Record(line).isFinalDisposition).toBe(true);
  });

  it("derives isFinalDisposition=false for a non-final condition", () => {
    const line = encodeRecord(E1_SPEC, {
      dispositionTypeCode: " ",
      severityCode: "F",
      conditionCode: "X01",
      narrativeText: "INVALID ENTRY FILER CODE",
    });
    expect(parseE1Record(line).isFinalDisposition).toBe(false);
  });

  it("leaves versionNumber undefined when the field is space-filled", () => {
    const line = encodeRecord(E1_SPEC, {
      dispositionTypeCode: "R",
      severityCode: "F",
      conditionCode: "999",
      narrativeText: "TRANSACTION DATA REJECTED",
    });
    expect(parseE1Record(line).versionNumber).toBeUndefined();
  });
});

describe("parseEntrySummaryResponse", () => {
  it("pairs a fatal condition with its preceding E0-Record, ending in the final disposition (REJECTED)", () => {
    const e0 = encodeRecord(E0_SUMMARY_SPEC, { referenceDataTypeCode: "SUMMRY", occurrencePosition: 1 });
    const condition = encodeRecord(E1_SPEC, {
      dispositionTypeCode: " ",
      severityCode: "F",
      conditionCode: "X01",
      narrativeText: "INVALID ENTRY FILER CODE",
    });
    const finalDisposition = encodeRecord(E1_SPEC, {
      dispositionTypeCode: "R",
      severityCode: "F",
      conditionCode: "999",
      narrativeText: "TRANSACTION DATA REJECTED",
    });

    const result = parseEntrySummaryResponse([e0, condition, finalDisposition]);

    expect(result.scenario).toBe("REJECTED");
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions[0].references).toHaveLength(1);
    expect(result.conditions[0].condition.conditionCode).toBe("X01");
    expect(result.finalDisposition.conditionCode).toBe("999");
  });

  it("parses a clean ACCEPTED response with no conditions", () => {
    const finalDisposition = encodeRecord(E1_SPEC, {
      dispositionTypeCode: "A",
      severityCode: " ",
      conditionCode: "000",
      narrativeText: "SUMMARY HAS BEEN ADDED",
      versionNumber: "00100",
    });

    const result = parseEntrySummaryResponse([finalDisposition]);

    expect(result.scenario).toBe("ACCEPTED");
    expect(result.conditions).toHaveLength(0);
    expect(result.finalDisposition.versionNumber).toBe("00100");
  });

  it("pairs a warning condition with multiple preceding E0-Records", () => {
    const e0a = encodeRecord(E0_SUMMARY_SPEC, { referenceDataTypeCode: "SUMMRY", occurrencePosition: 1 });
    const e0b = encodeRecord(E0_GENERIC_SPEC, {
      referenceDataTypeCode: "CARMAN",
      occurrencePosition: 1,
      referenceDataText: " ".repeat(55),
    });
    const condition = encodeRecord(E1_SPEC, {
      dispositionTypeCode: " ",
      severityCode: "W",
      conditionCode: "X20",
      narrativeText: "QUANTITY OUTSIDE EXPECTED CENSUS RANGE",
    });
    const finalDisposition = encodeRecord(E1_SPEC, {
      dispositionTypeCode: "A",
      severityCode: "W",
      conditionCode: "000",
      narrativeText: "SUMMARY HAS BEEN ADDED",
      versionNumber: "00100",
    });

    const result = parseEntrySummaryResponse([e0a, e0b, condition, finalDisposition]);

    expect(result.conditions[0].references).toHaveLength(2);
    expect(result.scenario).toBe("ACCEPTED");
  });

  it("throws when there is no final disposition record", () => {
    const e0 = encodeRecord(E0_SUMMARY_SPEC, { referenceDataTypeCode: "SUMMRY", occurrencePosition: 1 });
    expect(() => parseEntrySummaryResponse([e0])).toThrow(AbiFixedWidthError);
  });

  it("throws on an unrecognized response line", () => {
    expect(() => parseEntrySummaryResponse(["10" + " ".repeat(78)])).toThrow(AbiFixedWidthError);
  });
});
