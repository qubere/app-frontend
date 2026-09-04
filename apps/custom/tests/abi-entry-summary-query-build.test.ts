import { describe, it, expect } from "vitest";
import { AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import { buildEntryNumber } from "@/lib/abi/entryNumber";
import {
  buildDetailReturnRequest,
  buildEntryNumberQueryRequest,
  buildEntryNumberQueryRequests,
  buildCriteriaQueryRequest,
} from "@/lib/abi/entrySummaryQuery/build";
import { assembleEntryNumberQuery, assembleCriteriaQuery } from "@/lib/abi/entrySummaryQuery/assembleQuery";

const entry1 = { entryFilerCode: "N01", entryNumber: buildEntryNumber("N01", "5000003") };
const entry2 = { entryFilerCode: "B76", entryNumber: buildEntryNumber("B76", "0324527") };

describe("buildDetailReturnRequest (J0-Record)", () => {
  it("produces a constant 80-char record", () => {
    const line = buildDetailReturnRequest();
    expect(line).toHaveLength(80);
    expect(line.slice(0, 2)).toBe("J0");
    expect(line.slice(2, 3)).toBe("Y");
  });
});

describe("buildEntryNumberQueryRequest (J1-Record)", () => {
  it("places a single entry reference at the first pair's positions", () => {
    const line = buildEntryNumberQueryRequest([entry1]);
    expect(line).toHaveLength(80);
    expect(line.slice(0, 2)).toBe("J1");
    expect(line.slice(5, 8)).toBe("N01");
    expect(line.slice(10, 18)).toBe(entry1.entryNumber);
  });

  it("places multiple entry references at their successive positional pairs", () => {
    const line = buildEntryNumberQueryRequest([entry1, entry2]);
    expect(line.slice(18, 21)).toBe("B76");
    expect(line.slice(23, 31)).toBe(entry2.entryNumber);
  });

  it("throws when given zero or more than 5 entry references", () => {
    expect(() => buildEntryNumberQueryRequest([])).toThrow(AbiFixedWidthError);
    expect(() => buildEntryNumberQueryRequest(Array(6).fill(entry1))).toThrow(AbiFixedWidthError);
  });

  it("throws when an entry number's check digit is invalid", () => {
    expect(() =>
      buildEntryNumberQueryRequest([{ entryFilerCode: "N01", entryNumber: "50000035" }])
    ).toThrow(AbiFixedWidthError);
  });
});

describe("buildEntryNumberQueryRequests (chunking)", () => {
  it("chunks more than 5 entries across multiple J1-Records", () => {
    const sevenEntries = Array.from({ length: 7 }, (_, i) => ({
      entryFilerCode: "N01",
      entryNumber: buildEntryNumber("N01", 5000000 + i),
    }));
    const records = buildEntryNumberQueryRequests(sevenEntries);
    expect(records).toHaveLength(2);
    expect(records[0].slice(10, 18)).toBe(sevenEntries[0].entryNumber);
    expect(records[1].slice(10, 18)).toBe(sevenEntries[5].entryNumber);
  });

  it("throws on an empty list", () => {
    expect(() => buildEntryNumberQueryRequests([])).toThrow(AbiFixedWidthError);
  });
});

describe("buildCriteriaQueryRequest (J2-Record)", () => {
  const validInput = {
    criteriaQueryTypeCode: "EES" as const,
    requestedFromDateTime: new Date(2026, 0, 1, 0, 0, 0),
    requestedToDateTime: new Date(2026, 0, 15, 23, 59, 59),
  };

  it("produces an exact 80-char record with the encoded date/time range", () => {
    const line = buildCriteriaQueryRequest(validInput);
    expect(line).toHaveLength(80);
    expect(line.slice(0, 2)).toBe("J2");
    expect(line.slice(3, 6)).toBe("EES");
    expect(line.slice(7, 21)).toBe("010126120000AM");
    expect(line.slice(21, 35)).toBe("011526115959PM");
  });

  it("encodes optional entry-type flags at their spec positions", () => {
    const line = buildCriteriaQueryRequest({ ...validInput, ftaReconSummariesFlag: "Y", otherReconSummariesFlag: "Y" });
    expect(line.slice(37, 38)).toBe("Y");
    expect(line.slice(38, 39)).toBe("Y");
  });

  it("throws when Requested To Date/Time precedes Requested From Date/Time", () => {
    expect(() =>
      buildCriteriaQueryRequest({ ...validInput, requestedToDateTime: new Date(2025, 11, 31) })
    ).toThrow(AbiFixedWidthError);
  });

  it("throws when the date range exceeds CBP's 31-day limit", () => {
    expect(() =>
      buildCriteriaQueryRequest({ ...validInput, requestedToDateTime: new Date(2026, 2, 1) })
    ).toThrow(AbiFixedWidthError);
  });
});

describe("assembleEntryNumberQuery / assembleCriteriaQuery", () => {
  it("omits J0 by default and includes it when detail is requested", () => {
    const withoutDetail = assembleEntryNumberQuery([entry1]);
    expect(withoutDetail.map((r) => r.slice(0, 2))).toEqual(["J1"]);

    const withDetail = assembleEntryNumberQuery([entry1], { includeDetail: true });
    expect(withDetail.map((r) => r.slice(0, 2))).toEqual(["J0", "J1"]);
  });

  it("assembles a criteria query as J0? + single J2", () => {
    const records = assembleCriteriaQuery(
      {
        criteriaQueryTypeCode: "LIQ",
        requestedFromDateTime: new Date(2026, 0, 1),
        requestedToDateTime: new Date(2026, 0, 5),
      },
      { includeDetail: true }
    );
    expect(records.map((r) => r.slice(0, 2))).toEqual(["J0", "J2"]);
  });
});
