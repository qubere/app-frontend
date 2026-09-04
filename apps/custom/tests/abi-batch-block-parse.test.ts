import { describe, it, expect } from "vitest";
import { encodeRecord } from "@/lib/abi/fixedWidth";
import {
  A_OUTPUT_SPEC,
  B_OUTPUT_SPEC,
  Y_OUTPUT_SPEC,
  Z_OUTPUT_SPEC,
  B_ACE_GENERATED_SPEC,
  Y_ACE_GENERATED_SPEC,
  Z_ACE_GENERATED_SPEC,
  X0_BLOCK_SPEC,
  X0_TRNACT_SPEC,
  X1_SPEC,
} from "@/lib/abi/batchBlockControl/recordSpecs";
import {
  parseOutputARecord,
  parseOutputBRecord,
  parseOutputYRecord,
  parseOutputZRecord,
  parseAceGeneratedBRecord,
  parseAceGeneratedYRecord,
  parseAceGeneratedZRecord,
  parseX0Record,
  parseX1Record,
  classifyLine,
} from "@/lib/abi/batchBlockControl/parse";
import { lookupConditionNarrative } from "@/lib/abi/batchBlockControl/conditionCodes";

describe("classifyLine", () => {
  it.each([
    ["A" + " ".repeat(79), "A"],
    ["B" + " ".repeat(79), "B"],
    ["Y" + " ".repeat(79), "Y"],
    ["Z" + " ".repeat(79), "Z"],
    ["X0" + " ".repeat(78), "X0"],
    ["X1" + " ".repeat(78), "X1"],
    ["10" + " ".repeat(78), "UNKNOWN"], // e.g. an Entry Summary detail record
  ] as const)("classifies %j as %s", (line, expected) => {
    expect(classifyLine(line)).toBe(expected);
  });
});

describe("parseOutputARecord / parseOutputZRecord", () => {
  it("decodes a populated output A-Record", () => {
    const line = encodeRecord(A_OUTPUT_SPEC, {
      senderReceiverSiteCode: "1234",
      senderReceiverIdCode: "N01",
      applicationIdentifierCode: "AX",
    });
    const decoded = parseOutputARecord(line);
    expect(decoded.senderReceiverSiteCode).toBe("1234");
    expect(decoded.applicationIdentifierCode).toBe("AX");
  });

  it("decodes a populated output Z-Record", () => {
    const line = encodeRecord(Z_OUTPUT_SPEC, { senderReceiverSiteCode: "1234", senderReceiverIdCode: "N01" });
    expect(parseOutputZRecord(line).senderReceiverSiteCode).toBe("1234");
  });
});

describe("parseOutputBRecord / parseOutputYRecord", () => {
  it("decodes a populated output B-Record", () => {
    const line = encodeRecord(B_OUTPUT_SPEC, {
      processingDistrictPortCode: "1201",
      processingFilerCode: "N01",
      applicationIdentifierCode: "AX",
    });
    const decoded = parseOutputBRecord(line);
    expect(decoded.processingDistrictPortCode).toBe("1201");
  });

  it("extracts outputTransactionImageCount from an output Y-Record", () => {
    const line = encodeRecord(Y_OUTPUT_SPEC, {
      processingDistrictPortCode: "1201",
      processingFilerCode: "N01",
      applicationIdentifierCode: "AX",
      outputTransactionImageCount: 4,
    });
    expect(parseOutputYRecord(line).outputTransactionImageCount).toBe(4);
  });
});

describe("ACE-generated fallback records", () => {
  it("decodes the fallback B-Record's indicator", () => {
    const line = encodeRecord(B_ACE_GENERATED_SPEC, { recordIndicator: "B" });
    expect(parseAceGeneratedBRecord(line).recordIndicator).toBe("B");
    expect(line).toHaveLength(80);
    expect(line.slice(1, 79).trim()).toBe("");
  });

  it("decodes the fallback Y-Record's count and indicator", () => {
    const line = encodeRecord(Y_ACE_GENERATED_SPEC, { outputTransactionImageCount: 2, recordIndicator: "Y" });
    const decoded = parseAceGeneratedYRecord(line);
    expect(decoded.outputTransactionImageCount).toBe(2);
    expect(decoded.recordIndicator).toBe("Y");
  });

  it("decodes the fallback Z-Record's indicator", () => {
    const line = encodeRecord(Z_ACE_GENERATED_SPEC, { recordIndicator: "Z" });
    expect(parseAceGeneratedZRecord(line).recordIndicator).toBe("Z");
  });
});

describe("parseX0Record", () => {
  it("decodes a BLOCK reference into its structured sub-fields", () => {
    const line = encodeRecord(X0_BLOCK_SPEC, {
      referenceDataTypeCode: "BLOCK",
      occurrencePosition: 1,
      processingDistrictPortCode: "1201",
      processingFilerCode: "N01",
      applicationIdentifierCode: "AE",
    });
    const decoded = parseX0Record(line);
    expect(decoded.referenceDataTypeCode).toBe("BLOCK");
    if (decoded.referenceDataTypeCode === "BLOCK") {
      expect(decoded.occurrencePosition).toBe(1);
      expect(decoded.processingDistrictPortCode).toBe("1201");
      expect(decoded.processingFilerCode).toBe("N01");
      expect(decoded.applicationIdentifierCode).toBe("AE");
    }
  });

  it("decodes a TRNACT reference into its structured sub-fields", () => {
    const line = encodeRecord(X0_TRNACT_SPEC, {
      referenceDataTypeCode: "TRNACT",
      occurrencePosition: 1,
      recordPositionInBatch: 5,
      positionOfProblemInRecord: 0,
    });
    const decoded = parseX0Record(line);
    expect(decoded.referenceDataTypeCode).toBe("TRNACT");
    if (decoded.referenceDataTypeCode === "TRNACT") {
      expect(decoded.recordPositionInBatch).toBe(5);
      expect(decoded.positionOfProblemInRecord).toBe(0);
    }
  });

  it("includes the literal REF ID: constant in the encoded line", () => {
    const line = encodeRecord(X0_BLOCK_SPEC, {
      referenceDataTypeCode: "BLOCK",
      occurrencePosition: 1,
      processingDistrictPortCode: "1201",
      processingFilerCode: "N01",
      applicationIdentifierCode: "AE",
    });
    expect(line.slice(17, 24)).toBe("REF ID:");
  });
});

describe("parseX1Record", () => {
  it("derives isFinalDisposition=true for the 999 condition code", () => {
    const line = encodeRecord(X1_SPEC, {
      dispositionTypeCode: "R",
      severityCode: "F",
      conditionCode: "999",
      narrativeText: "BATCH REJECTED",
    });
    const decoded = parseX1Record(line);
    expect(decoded.isFinalDisposition).toBe(true);
    expect(decoded.conditionCode).toBe("999");
  });

  it("derives isFinalDisposition=true for dispositionTypeCode R even on a non-999 code", () => {
    const line = encodeRecord(X1_SPEC, {
      dispositionTypeCode: "R",
      severityCode: "F",
      conditionCode: "X12",
      narrativeText: "NOT A KNOWN ACE APPLICATION ID CODE",
    });
    expect(parseX1Record(line).isFinalDisposition).toBe(true);
  });

  it("derives isFinalDisposition=false for a non-final condition", () => {
    const line = encodeRecord(X1_SPEC, {
      dispositionTypeCode: " ",
      severityCode: "F",
      conditionCode: "X12",
      narrativeText: "NOT A KNOWN ACE APPLICATION ID CODE",
    });
    expect(parseX1Record(line).isFinalDisposition).toBe(false);
  });
});

describe("lookupConditionNarrative", () => {
  it.each([
    ["X12", "NOT A KNOWN ACE APPLICATION ID CODE"],
    ["X31", "PREPARER NOT AUTHRZD FOR PORT"],
    ["X34", "UNKNOWN RECORD ID FOUND IN GROUPING"],
    ["999", "BATCH REJECTED"],
  ])("resolves %s to its narrative text", (code, expected) => {
    expect(lookupConditionNarrative(code)).toBe(expected);
  });

  it("returns undefined for an unknown code", () => {
    expect(lookupConditionNarrative("X99")).toBeUndefined();
  });
});
