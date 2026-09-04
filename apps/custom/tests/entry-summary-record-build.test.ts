import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import { AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import { buildEntryNumber } from "@/lib/abi/entryNumber";
import {
  buildHeaderControl,
  buildHeaderContent,
  buildLineItemHeader,
  buildTariffDetail,
  buildFeeTotal,
  buildGrandTotals,
} from "@/lib/abi/entrySummary/build";

describe("buildHeaderControl (10-Record)", () => {
  const validEntryNumber = buildEntryNumber("N01", "5000003");
  const validInput = {
    summaryFilingActionRequestCode: "A" as const,
    entryFilerCode: "N01",
    entryNumber: validEntryNumber,
    districtPortOfEntry: "2704",
    entryTypeCode: "01",
  };

  it("produces an exact 80-char record starting with control identifier 10", () => {
    const line = buildHeaderControl(validInput);
    expect(line).toHaveLength(80);
    expect(line.slice(0, 2)).toBe("10");
  });

  it("places the action code, filer code, entry number, port, and entry type at their spec positions", () => {
    const line = buildHeaderControl(validInput);
    expect(line.slice(2, 3)).toBe("A");
    expect(line.slice(3, 6)).toBe("N01");
    expect(line.slice(8, 16)).toBe(validEntryNumber);
    expect(line.slice(17, 21)).toBe("2704");
    expect(line.slice(33, 35)).toBe("01");
  });

  it("throws on a missing mandatory field", () => {
    const { entryFilerCode: _entryFilerCode, ...rest } = validInput;
    expect(() => buildHeaderControl(rest as typeof validInput)).toThrow(AbiFixedWidthError);
  });

  it("throws when the entry number's check digit doesn't match Appendix E", () => {
    expect(() => buildHeaderControl({ ...validInput, entryNumber: "50000035" })).toThrow(AbiFixedWidthError);
  });

  it("encodes the optional preliminary statement print date as MMDDYY", () => {
    const line = buildHeaderControl({ ...validInput, preliminaryStatementPrintDate: new Date(2026, 5, 1) });
    expect(line.slice(51, 57)).toBe("060126");
  });
});

describe("buildHeaderContent (11-Record)", () => {
  const validInput = { importerOfRecordNumber: "123456789012" };

  it("produces an exact 80-char record starting with control identifier 11", () => {
    const line = buildHeaderContent(validInput);
    expect(line).toHaveLength(80);
    expect(line.slice(0, 2)).toBe("11");
  });

  it("places the importer of record number at its spec position", () => {
    const line = buildHeaderContent(validInput);
    expect(line.slice(2, 14)).toBe("123456789012");
  });

  it("encodes estimated entry date and date of importation independently", () => {
    const line = buildHeaderContent({
      ...validInput,
      estimatedEntryDate: new Date(2026, 0, 15),
      dateOfImportation: new Date(2026, 0, 20),
    });
    expect(line.slice(41, 47)).toBe("011526");
    expect(line.slice(47, 53)).toBe("012026");
  });

  it("throws on a missing mandatory field", () => {
    expect(() => buildHeaderContent({} as never)).toThrow(AbiFixedWidthError);
  });
});

describe("buildLineItemHeader (40-Record)", () => {
  const validInput = { lineItemIdentifier: "001", countryOfOriginCode: "CN" };

  it("produces an exact 80-char record starting with control identifier 40", () => {
    const line = buildLineItemHeader(validInput);
    expect(line).toHaveLength(80);
    expect(line.slice(0, 2)).toBe("40");
  });

  it("places the line item identifier and country of origin at their spec positions", () => {
    const line = buildLineItemHeader(validInput);
    expect(line.slice(4, 7)).toBe("001");
    expect(line.slice(8, 10)).toBe("CN");
  });

  it("accepts '**' for an unknown country of origin", () => {
    const line = buildLineItemHeader({ ...validInput, countryOfOriginCode: "**" });
    expect(line.slice(8, 10)).toBe("**");
  });
});

describe("buildTariffDetail (50-Record)", () => {
  const validInput = {
    htsNumber: "8481805090",
    dutyAmount: new Decimal("250.00"),
    valueOfGoodsAmount: new Decimal("10000"),
    unitOfMeasureCode1: "NO",
  };

  it("produces an exact 80-char record starting with control identifier 50", () => {
    const line = buildTariffDetail(validInput);
    expect(line).toHaveLength(80);
    expect(line.slice(0, 2)).toBe("50");
  });

  it("places the HTS number at its spec position", () => {
    const line = buildTariffDetail(validInput);
    expect(line.slice(2, 12)).toBe("8481805090");
  });

  it("encodes duty amount with 2 implied decimal places, zero-padded to 10 digits", () => {
    const line = buildTariffDetail(validInput);
    expect(line.slice(13, 23)).toBe("0000025000");
  });

  it("encodes value of goods as whole dollars (no implied decimals), zero-padded to 10 digits", () => {
    const line = buildTariffDetail(validInput);
    expect(line.slice(24, 34)).toBe("0000010000");
  });

  it("encodes an optional quantity with 2 implied decimal places, zero-padded to 12 digits", () => {
    const line = buildTariffDetail({ ...validInput, quantity1: new Decimal("42.5") });
    expect(line.slice(35, 47)).toBe("000000004250");
    expect(line.slice(47, 50)).toBe("NO ");
  });

  it("round-trips duty amount through decodeRecord as a Decimal, not a float", async () => {
    const { decodeRecord } = await import("@/lib/abi/fixedWidth");
    const { TARIFF_DETAIL_SPEC } = await import("@/lib/abi/entrySummary/recordSpecs");
    const line = buildTariffDetail(validInput);
    const decoded = decodeRecord(TARIFF_DETAIL_SPEC, line);
    expect((decoded.dutyAmount as InstanceType<typeof Decimal>).toString()).toBe("250");
  });

  it("throws on a missing mandatory field", () => {
    const { htsNumber: _htsNumber, ...rest } = validInput;
    expect(() => buildTariffDetail(rest as typeof validInput)).toThrow(AbiFixedWidthError);
  });
});

describe("buildFeeTotal (89-Record)", () => {
  it("produces an exact 80-char record starting with control identifier 89", () => {
    const line = buildFeeTotal([{ accountingClassCode: "499", totalFeeAmount: new Decimal("31.67") }]);
    expect(line).toHaveLength(80);
    expect(line.slice(0, 2)).toBe("89");
  });

  it("places a single fee entry at the first pair's positions", () => {
    const line = buildFeeTotal([{ accountingClassCode: "499", totalFeeAmount: new Decimal("31.67") }]);
    expect(line.slice(2, 5)).toBe("499");
    expect(line.slice(5, 16)).toBe("00000003167");
  });

  it("places multiple fee entries at their successive positional pairs", () => {
    const line = buildFeeTotal([
      { accountingClassCode: "499", totalFeeAmount: new Decimal("31.67") },
      { accountingClassCode: "056", totalFeeAmount: new Decimal("1.50") },
    ]);
    expect(line.slice(16, 19)).toBe("056");
    expect(line.slice(19, 30)).toBe("00000000150");
  });

  it("zero-pads a short accounting class code rather than space-padding it", () => {
    const line = buildFeeTotal([{ accountingClassCode: "5", totalFeeAmount: new Decimal("1.00") }]);
    expect(line.slice(2, 5)).toBe("005");
  });

  it("round-trips a leading-zero accounting class code as a string, not a number", async () => {
    const { decodeRecord } = await import("@/lib/abi/fixedWidth");
    const { FEE_TOTAL_SPEC } = await import("@/lib/abi/entrySummary/recordSpecs");
    const line = buildFeeTotal([{ accountingClassCode: "056", totalFeeAmount: new Decimal("1.50") }]);
    const decoded = decodeRecord(FEE_TOTAL_SPEC, line);
    expect(decoded.accountingClassCode1).toBe("056");
    expect(typeof decoded.accountingClassCode1).toBe("string");
  });

  it("throws when given zero fee entries", () => {
    expect(() => buildFeeTotal([])).toThrow(AbiFixedWidthError);
  });

  it("throws when given more than 5 fee entries", () => {
    const sixFees = Array.from({ length: 6 }, (_, i) => ({
      accountingClassCode: String(100 + i),
      totalFeeAmount: new Decimal("1.00"),
    }));
    expect(() => buildFeeTotal(sixFees)).toThrow(AbiFixedWidthError);
  });
});

describe("buildGrandTotals (90-Record)", () => {
  it("produces an exact 80-char record starting with control identifier 90", () => {
    const line = buildGrandTotals({ grandTotalDutyAmount: new Decimal("250.00") });
    expect(line).toHaveLength(80);
    expect(line.slice(0, 2)).toBe("90");
  });

  it("places grand total duty amount at its spec position", () => {
    const line = buildGrandTotals({ grandTotalDutyAmount: new Decimal("250.00") });
    expect(line.slice(2, 13)).toBe("00000025000");
  });

  it("leaves an unset conditional total blank rather than zero-filling it", () => {
    const line = buildGrandTotals({ grandTotalDutyAmount: new Decimal("250.00") });
    expect(line.slice(14, 25)).toBe(" ".repeat(11));
  });

  it("produces a fully blank record (except control id) when no totals are given", () => {
    const line = buildGrandTotals({});
    expect(line.slice(2)).toBe(" ".repeat(78));
  });
});
