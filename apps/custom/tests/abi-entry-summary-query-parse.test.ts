import { describe, it, expect } from "vitest";
import { encodeRecord, decodeRecord, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
import {
  CRITERIA_QUERY_RESPONSE_HEADER_SPEC,
  ENTRY_SUMMARY_STATUS_INFO_SPEC,
  QUERY_RETURNED_CONDITION_SPEC,
  ENTRY_SUMMARY_STATUS_DETAIL_SPEC,
  LIQUIDATION_INFO_SPEC,
  ESTIMATED_REVENUE_INFO_SPEC,
  ENTRY_SUMMARY_FILING_INFO_SPEC,
  WAREHOUSE_AND_LINE_INFO_SPEC,
  FORM_REFERENCE_INFO_SPEC,
  BOND_SURETY_INFO_SPEC,
} from "@/lib/abi/entrySummaryQuery/recordSpecs";
import {
  classifyOutputLine,
  parseCriteriaQueryResponseHeader,
  parseEntrySummaryStatusInfo,
  parseQueryReturnedCondition,
  parseLiquidationInfo,
  parseQueryResponse,
} from "@/lib/abi/entrySummaryQuery/parse";
import { lookupConditionNarrative } from "@/lib/abi/entrySummaryQuery/conditionCodes";

const validJb = () =>
  encodeRecord(ENTRY_SUMMARY_STATUS_INFO_SPEC, {
    entryFilerCode: "N01",
    entryNumber: "03245278",
    versionNumber: "00100",
    acceptDateTime: new Date(2026, 0, 1, 9, 30, 0),
    pscIndicator: " ",
    ownershipDataReturnedIndicator: "Y",
    centerId: "AP0101",
  });

const validJc = () =>
  encodeRecord(ENTRY_SUMMARY_STATUS_DETAIL_SPEC, {
    entrySummaryControlStatus: "2",
    entrySummaryStatusCode: "1",
    entrySummaryStatusDate: new Date(2026, 0, 1),
    lateFilingStatusCode: "0",
    collectionStatusCode: "2",
    censusHeaderStatusCode: "0",
    invoiceStatusCode: " ",
    protestStatusCode: "NO",
    quotaStatusCode: " ",
  });

const validJd = () =>
  encodeRecord(LIQUIDATION_INFO_SPEC, { cbpReviewIndicator: "2", immediateDeliveryIndicator: "N" });

const validJe = () => encodeRecord(ESTIMATED_REVENUE_INFO_SPEC, {});

const validJf = () => encodeRecord(ENTRY_SUMMARY_FILING_INFO_SPEC, { districtPortOfEntry: "2704" });

const validJg = () => encodeRecord(WAREHOUSE_AND_LINE_INFO_SPEC, {});

const validJh = () => encodeRecord(FORM_REFERENCE_INFO_SPEC, {});

function fullResultGroup(): string[] {
  return [validJb(), validJc(), validJd(), validJe(), validJf(), validJg(), validJh()];
}

describe("classifyOutputLine", () => {
  it.each([
    ["JA" + " ".repeat(78), "JA"],
    ["JB" + " ".repeat(78), "JB"],
    ["JZ" + " ".repeat(78), "JZ"],
    ["JC" + " ".repeat(78), "JC"],
    ["JI" + " ".repeat(78), "JI"],
    ["JJ" + " ".repeat(78), "UNKNOWN"], // protest detail — not modeled this slice
    ["JK" + " ".repeat(78), "JK"],
    ["JL" + " ".repeat(78), "JL"],
    ["JM" + " ".repeat(78), "JM"],
    ["JN" + " ".repeat(78), "JN"],
    ["10" + " ".repeat(78), "10"], // Entry Summary Details Grouping, reused from entrySummary/
    ["4A" + " ".repeat(78), "4A"],
  ] as const)("classifies %j as %s", (line, expected) => {
    expect(classifyOutputLine(line)).toBe(expected);
  });
});

describe("date/time field decode — CBP's own literal example strings", () => {
  // J2-Record Note 2 gives these exact literal values for "all applicable entry
  // summaries" in a day. Decoding the literal text (not a round-trip of our own
  // encoder) catches a decode-only bug the build tests' round-trips would miss.
  it("decodes '120000AM' as midnight and '115959PM' as 23:59:59", () => {
    const line = encodeRecord(CRITERIA_QUERY_RESPONSE_HEADER_SPEC, {
      criteriaQueryTypeCode: "EES",
      requestedFromDateTime: new Date(2026, 0, 1, 0, 0, 0),
      requestedToDateTime: new Date(2026, 0, 1, 23, 59, 59),
    });
    // Directly overwrite the encoded date/time fields with CBP's literal example
    // text to decode it independently of what our own encoder would have produced.
    const withLiteralTimes = line.slice(0, 7) + "010126120000AM" + "010126115959PM" + line.slice(35);
    const decoded = decodeRecord(CRITERIA_QUERY_RESPONSE_HEADER_SPEC, withLiteralTimes);
    expect(decoded.requestedFromDateTime?.getHours()).toBe(0);
    expect(decoded.requestedFromDateTime?.getMinutes()).toBe(0);
    expect(decoded.requestedToDateTime?.getHours()).toBe(23);
    expect(decoded.requestedToDateTime?.getMinutes()).toBe(59);
    expect(decoded.requestedToDateTime?.getSeconds()).toBe(59);
  });
});

describe("parseCriteriaQueryResponseHeader (JA-Record)", () => {
  it("decodes the criteria type code and date range", () => {
    const line = encodeRecord(CRITERIA_QUERY_RESPONSE_HEADER_SPEC, {
      criteriaQueryTypeCode: "LIQ",
      requestedFromDateTime: new Date(2026, 0, 1, 12, 0, 0),
      requestedToDateTime: new Date(2026, 0, 5, 12, 0, 0),
    });
    const decoded = parseCriteriaQueryResponseHeader(line);
    expect(decoded.criteriaQueryTypeCode).toBe("LIQ");
    expect(decoded.requestedFromDateTime?.getDate()).toBe(1);
    expect(decoded.requestedToDateTime?.getDate()).toBe(5);
  });
});

describe("parseEntrySummaryStatusInfo (JB-Record)", () => {
  it("decodes the core identifying and liquidation status fields", () => {
    const line = encodeRecord(ENTRY_SUMMARY_STATUS_INFO_SPEC, {
      entryFilerCode: "N01",
      entryNumber: "03245278",
      versionNumber: "00100",
      acceptDateTime: new Date(2026, 0, 1, 9, 30, 0),
      pscIndicator: " ",
      ownershipDataReturnedIndicator: "Y",
      liquidationStatusCode: "2",
      centerId: "AP0101",
    });
    const decoded = parseEntrySummaryStatusInfo(line);
    expect(decoded.entryFilerCode).toBe("N01");
    expect(decoded.entryNumber).toBe("03245278");
    expect(decoded.versionNumber).toBe("00100");
    expect(decoded.liquidationStatusCode).toBe("2");
    expect(decoded.centerId).toBe("AP0101");
    expect(decoded.acceptDateTime?.getHours()).toBe(9);
  });
});

describe("parseQueryReturnedCondition (JZ-Record) + conditionCodes reference table", () => {
  it("decodes the condition/reason/narrative fields", () => {
    const line = encodeRecord(QUERY_RETURNED_CONDITION_SPEC, {
      conditionCode: "013",
      narrativeText: "ENTRY SUMMARY NOT FOUND FOR QUERY",
      districtPortOfEntry: "2704",
    });
    const decoded = parseQueryReturnedCondition(line);
    expect(decoded.conditionCode).toBe("013");
    expect(decoded.narrativeText).toBe("ENTRY SUMMARY NOT FOUND FOR QUERY");
    expect(lookupConditionNarrative(decoded.conditionCode)).toBe(decoded.narrativeText);
  });
});

describe("numericCodeField — leading zeros are preserved as a string, not lost to int parsing", () => {
  it("decodes JI's Surety Code with a leading zero intact", () => {
    const line = encodeRecord(BOND_SURETY_INFO_SPEC, { suretyCode: "037" });
    const decoded = decodeRecord(BOND_SURETY_INFO_SPEC, line);
    expect(decoded.suretyCode).toBe("037");
    expect(typeof decoded.suretyCode).toBe("string");
  });

  it("decodes JF's Entry Type Code with a leading zero intact", () => {
    const line = encodeRecord(ENTRY_SUMMARY_FILING_INFO_SPEC, { districtPortOfEntry: "2704", entryTypeCode: "01" });
    expect(decodeRecord(ENTRY_SUMMARY_FILING_INFO_SPEC, line).entryTypeCode).toBe("01");
  });
});

describe("signed implied-decimal amount fields (JD/JE) — negative-value wire encoding", () => {
  // Both records' own usage notes: a negative value is right-justified,
  // space-padded (not zero-padded), with '-' immediately preceding the digits.
  it("zero-pads a non-negative liquidated duty amount", () => {
    const line = encodeRecord(LIQUIDATION_INFO_SPEC, {
      cbpReviewIndicator: "2",
      immediateDeliveryIndicator: "N",
      liquidatedDuty: new Decimal("250.00"),
    });
    expect(line.slice(9, 21)).toBe("000000025000");
  });

  it("space-pads a negative liquidated duty amount with the sign adjacent to the digits", () => {
    const line = encodeRecord(LIQUIDATION_INFO_SPEC, {
      cbpReviewIndicator: "2",
      immediateDeliveryIndicator: "N",
      liquidatedDuty: new Decimal("-40.00"),
    });
    expect(line.slice(9, 21)).toBe(" ".repeat(12 - 5) + "-4000");
  });

  it("round-trips a negative amount back to a Decimal via decode", () => {
    const line = encodeRecord(LIQUIDATION_INFO_SPEC, {
      cbpReviewIndicator: "2",
      immediateDeliveryIndicator: "N",
      liquidatedDuty: new Decimal("-40.00"),
    });
    expect(parseLiquidationInfo(line).liquidatedDuty?.toString()).toBe("-40");
  });

  it("decodes CBP's literal negative-amount wire format directly (not a round-trip)", () => {
    const line = encodeRecord(LIQUIDATION_INFO_SPEC, { cbpReviewIndicator: "2", immediateDeliveryIndicator: "N" });
    const withLiteralAmount = line.slice(0, 9) + " ".repeat(12 - 5) + "-4000" + line.slice(21);
    expect(parseLiquidationInfo(withLiteralAmount).liquidatedDuty?.toString()).toBe("-40");
  });
});

describe("parseQueryResponse", () => {
  it("groups a JB with its following JC-JH detail records", () => {
    const result = parseQueryResponse(fullResultGroup());

    expect(result.results).toHaveLength(1);
    const r = result.results[0];
    expect(r.status.entryNumber).toBe("03245278");
    expect(r.detail.protestStatusCode).toBe("NO");
    expect(r.liquidation.immediateDeliveryIndicator).toBe("N");
    expect(r.filing.districtPortOfEntry).toBe("2704");
    expect(r.bonds).toEqual([]);
  });

  it("collects repeating JI bond records under the current JB group", () => {
    const bond1 = encodeRecord(BOND_SURETY_INFO_SPEC, { suretyCode: "891" });
    const bond2 = encodeRecord(BOND_SURETY_INFO_SPEC, { suretyCode: "037" });
    const result = parseQueryResponse([...fullResultGroup(), bond1, bond2]);

    expect(result.results[0].bonds).toHaveLength(2);
    expect(result.results[0].bonds.map((b) => b.suretyCode)).toEqual(["891", "037"]);
  });

  it("handles multiple entry summaries in one response, each with its own group", () => {
    const group1 = fullResultGroup();
    const group2 = fullResultGroup();
    const result = parseQueryResponse([...group1, ...group2]);
    expect(result.results).toHaveLength(2);
  });

  it("decodes a leading JA and trailing JZ around the entry summary groups", () => {
    const ja = encodeRecord(CRITERIA_QUERY_RESPONSE_HEADER_SPEC, {
      criteriaQueryTypeCode: "EES",
      requestedFromDateTime: new Date(2026, 0, 1),
      requestedToDateTime: new Date(2026, 0, 5),
    });
    const jz = encodeRecord(QUERY_RETURNED_CONDITION_SPEC, {
      conditionCode: "016",
      // Real CBP narrative text contains punctuation (";") that our class-AN
      // validation rejects on encode — this field is decode-only in practice
      // (CBP sends it, we never build it), so the test fixture uses
      // punctuation-free text; see signedImpliedDecimalField's doc comment for
      // the same class-vs-real-content mismatch pattern.
      narrativeText: "OUTPUT LIMIT REACHED ADDTNL ES FOUND",
      districtPortOfEntry: "2704",
    });

    const result = parseQueryResponse([ja, ...fullResultGroup(), jz]);

    expect(result.criteriaHeader?.criteriaQueryTypeCode).toBe("EES");
    expect(result.results).toHaveLength(1);
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions[0].conditionCode).toBe("016");
  });

  it("preserves unmodeled lines (JJ — protest detail) verbatim without dropping or misgrouping them", () => {
    const jj = "JJ" + " ".repeat(78); // protest detail — not modeled
    const result = parseQueryResponse([...fullResultGroup(), jj]);
    expect(result.unrecognizedLines).toEqual([jj]);
    expect(result.results).toHaveLength(1);
  });

  it("throws when a JB group is missing a mandatory JC-JH record", () => {
    const incomplete = fullResultGroup().slice(0, 4); // JB, JC, JD, JE only
    expect(() => parseQueryResponse(incomplete)).toThrow(AbiFixedWidthError);
  });

  it("throws when JC (or any JC-JH/JI type) appears with no preceding JB", () => {
    expect(() => parseQueryResponse([validJc()])).toThrow(AbiFixedWidthError);
  });
});
