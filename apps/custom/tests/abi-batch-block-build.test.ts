import { describe, it, expect } from "vitest";
import { buildARecord, buildBRecord, buildYRecord, buildZRecord, wrapBlock, wrapBatch } from "@/lib/abi/batchBlockControl/build";
import { AbiFixedWidthError } from "@/lib/abi/fixedWidth";

describe("buildARecord", () => {
  const validInput = {
    senderReceiverSiteCode: "2704",
    senderReceiverIdCode: "EEE",
    communicationPassword: "PASSWD",
    applicationIdentifierCode: "AE",
  };

  it("produces an exact 80-char record starting with control identifier A", () => {
    const line = buildARecord(validInput);
    expect(line).toHaveLength(80);
    expect(line[0]).toBe("A");
  });

  it("places Site Code, ID Code, Password, and App ID Code at their spec positions", () => {
    const line = buildARecord(validInput);
    expect(line.slice(1, 5)).toBe("2704");
    expect(line.slice(5, 8)).toBe("EEE");
    expect(line.slice(8, 14)).toBe("PASSWD");
    expect(line.slice(25, 27)).toBe("AE");
  });

  it("space-fills filler columns", () => {
    const line = buildARecord(validInput);
    expect(line.slice(20, 25)).toBe("     "); // 21-25 filler
    expect(line.slice(39, 59)).toBe(" ".repeat(20)); // 40-59 filler
  });

  it("throws on a missing mandatory field", () => {
    const { senderReceiverSiteCode, ...rest } = validInput;
    void senderReceiverSiteCode;
    expect(() => buildARecord(rest as typeof validInput)).toThrow(AbiFixedWidthError);
  });

  it("throws on lowercase input", () => {
    expect(() => buildARecord({ ...validInput, senderReceiverIdCode: "eee" })).toThrow(AbiFixedWidthError);
  });

  it("encodes the optional transmission date as MMDDYY", () => {
    const line = buildARecord({ ...validInput, transmissionDate: new Date(2026, 3, 1) });
    expect(line.slice(14, 20)).toBe("040126");
  });
});

describe("buildBRecord", () => {
  const validInput = {
    processingDistrictPortCode: "2704",
    processingFilerCode: "EEE",
    applicationIdentifierCode: "AE",
  };

  it("produces an exact 80-char record starting with control identifier B", () => {
    const line = buildBRecord(validInput);
    expect(line).toHaveLength(80);
    expect(line[0]).toBe("B");
  });

  it("places Processing District/Port, Filer Code, and App ID Code at their spec positions", () => {
    const line = buildBRecord(validInput);
    expect(line.slice(3, 7)).toBe("2704");
    expect(line.slice(7, 10)).toBe("EEE");
    expect(line.slice(10, 12)).toBe("AE");
  });

  it("throws on a missing mandatory field", () => {
    expect(() => buildBRecord({ processingFilerCode: "EEE", applicationIdentifierCode: "AE" } as never)).toThrow(
      AbiFixedWidthError
    );
  });
});

describe("buildYRecord / buildZRecord", () => {
  it("buildYRecord produces an exact 80-char record starting with Y", () => {
    const line = buildYRecord({
      processingDistrictPortCode: "2704",
      processingFilerCode: "EEE",
      applicationIdentifierCode: "AE",
    });
    expect(line).toHaveLength(80);
    expect(line[0]).toBe("Y");
  });

  it("buildZRecord produces an exact 80-char record starting with Z", () => {
    const line = buildZRecord({ senderReceiverSiteCode: "2704", senderReceiverIdCode: "EEE" });
    expect(line).toHaveLength(80);
    expect(line[0]).toBe("Z");
  });
});

describe("wrapBlock", () => {
  const header = {
    processingDistrictPortCode: "2704",
    processingFilerCode: "EEE",
    applicationIdentifierCode: "AE",
  };

  it("wraps detail records with B...Y and auto-derives Y's fields from the header", () => {
    const detail = "1".repeat(80);
    const lines = wrapBlock(header, [detail]);
    expect(lines).toHaveLength(3);
    expect(lines[0][0]).toBe("B");
    expect(lines[1]).toBe(detail);
    expect(lines[2][0]).toBe("Y");
    // Y's district/port/filer/app-id must equal B's, even though the caller
    // never constructed a YRecordInput directly.
    expect(lines[2].slice(3, 7)).toBe(lines[0].slice(3, 7));
    expect(lines[2].slice(7, 10)).toBe(lines[0].slice(7, 10));
    expect(lines[2].slice(10, 12)).toBe(lines[0].slice(10, 12));
  });

  it("throws if a detail record is not exactly 80 characters", () => {
    expect(() => wrapBlock(header, ["too short"])).toThrow(AbiFixedWidthError);
  });
});

describe("wrapBatch", () => {
  const aHeader = {
    senderReceiverSiteCode: "2704",
    senderReceiverIdCode: "EEE",
    communicationPassword: "PASSWD",
    applicationIdentifierCode: "AE",
  };
  const bHeader = {
    processingDistrictPortCode: "2704",
    processingFilerCode: "EEE",
    applicationIdentifierCode: "AE",
  };

  it("wraps one or more blocks with A...Z and auto-derives Z's fields from the header", () => {
    const block = wrapBlock(bHeader, ["1".repeat(80)]);
    const lines = wrapBatch(aHeader, [block]);
    expect(lines[0][0]).toBe("A");
    expect(lines[lines.length - 1][0]).toBe("Z");
    expect(lines[lines.length - 1].slice(1, 5)).toBe(lines[0].slice(1, 5));
    expect(lines[lines.length - 1].slice(5, 8)).toBe(lines[0].slice(5, 8));
  });

  it("supports multiple blocks in one batch", () => {
    const blockA = wrapBlock(bHeader, ["1".repeat(80)]);
    const blockB = wrapBlock({ ...bHeader, processingDistrictPortCode: "3801" }, ["2".repeat(80)]);
    const lines = wrapBatch(aHeader, [blockA, blockB]);
    // A + 3 (block A) + 3 (block B) + Z = 8
    expect(lines).toHaveLength(8);
  });

  it("throws when given zero blocks", () => {
    expect(() => wrapBatch(aHeader, [])).toThrow(AbiFixedWidthError);
  });
});
