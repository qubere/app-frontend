import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import { buildEntryNumber } from "@/lib/abi/entryNumber";
import { assembleTransaction } from "@/lib/abi/entrySummary/assembleTransaction";
import type { EntrySummaryTransactionInput, LineItemInput } from "@/lib/abi/entrySummary/types";

function headerControl() {
  return {
    summaryFilingActionRequestCode: "A" as const,
    entryFilerCode: "N01",
    entryNumber: buildEntryNumber("N01", "5000003"),
    districtPortOfEntry: "2704",
    entryTypeCode: "01",
  };
}

function lineItem(id: string, htsNumbers: string[]): LineItemInput {
  return {
    header: { lineItemIdentifier: id, countryOfOriginCode: "CN" },
    tariffDetails: htsNumbers.map((hts) => ({
      htsNumber: hts,
      dutyAmount: new Decimal("100.00"),
      valueOfGoodsAmount: new Decimal("1000"),
      unitOfMeasureCode1: "NO",
    })),
  };
}

function assertAll80Chars(records: string[]) {
  records.forEach((r, i) => expect(r, `record ${i}`).toHaveLength(80));
}

function getRecordPrefixes(records: string[]): string[] {
  return records.map((r) => {
    if (r.startsWith("SE")) return r.slice(0, 4);
    return r.slice(0, 2);
  });
}

describe("assembleTransaction — single line, single tariff detail", () => {
  const input: EntrySummaryTransactionInput = {
    headerControl: headerControl(),
    lineItems: [lineItem("001", ["8481805090"])],
  };

  it("emits 10, 40, 50 in order", () => {
    const records = assembleTransaction(input);
    assertAll80Chars(records);
    expect(getRecordPrefixes(records)).toEqual(["10", "40", "50"]);
  });

  it("does not emit an 11-Record when headerContent is omitted", () => {
    const records = assembleTransaction(input);
    expect(records.some((r) => r.slice(0, 2) === "11")).toBe(false);
  });
});

describe("assembleTransaction — multi-line, multi-tariff nesting", () => {
  const input: EntrySummaryTransactionInput = {
    headerControl: headerControl(),
    headerContent: { importerOfRecordNumber: "123456789012" },
    lineItems: [lineItem("001", ["8481805090", "8481806000"]), lineItem("002", ["9018903000"])],
  };

  it("emits 10, 11, then each line's 40 immediately followed by its 50s", () => {
    const records = assembleTransaction(input);
    assertAll80Chars(records);
    expect(getRecordPrefixes(records)).toEqual(["10", "11", "40", "50", "50", "40", "50"]);
  });

  it("each line item's 40-Record carries its own line identifier", () => {
    const records = assembleTransaction(input);
    const fortyRecords = records.filter((r) => r.slice(0, 2) === "40");
    expect(fortyRecords[0].slice(4, 7)).toBe("001");
    expect(fortyRecords[1].slice(4, 7)).toBe("002");
  });

  it("each 50-Record carries the correct line's HTS numbers in order", () => {
    const records = assembleTransaction(input);
    const fiftyRecords = records.filter((r) => r.slice(0, 2) === "50");
    expect(fiftyRecords.map((r) => r.slice(2, 12))).toEqual(["8481805090", "8481806000", "9018903000"]);
  });
});

describe("assembleTransaction — fee totals and grand totals", () => {
  const base: EntrySummaryTransactionInput = {
    headerControl: headerControl(),
    lineItems: [lineItem("001", ["8481805090"])],
  };

  it("omits 89/90-Records entirely when neither is provided", () => {
    const records = assembleTransaction(base);
    expect(records.some((r) => r.slice(0, 2) === "89")).toBe(false);
    expect(records.some((r) => r.slice(0, 2) === "90")).toBe(false);
  });

  it("emits an 89-Record for fee totals and a 90-Record for grand totals, after the line items", () => {
    const input: EntrySummaryTransactionInput = {
      ...base,
      feeTotals: [{ accountingClassCode: "499", totalFeeAmount: new Decimal("31.67") }],
      grandTotals: { grandTotalDutyAmount: new Decimal("100.00") },
    };
    const records = assembleTransaction(input);
    assertAll80Chars(records);
    expect(getRecordPrefixes(records)).toEqual(["10", "40", "50", "89", "90"]);
  });

  it("chunks more than 5 fee entries across multiple 89-Records", () => {
    const sevenFees = Array.from({ length: 7 }, (_, i) => ({
      accountingClassCode: String(100 + i),
      totalFeeAmount: new Decimal("1.00"),
    }));
    const records = assembleTransaction({ ...base, feeTotals: sevenFees });
    const feeRecords = records.filter((r) => r.slice(0, 2) === "89");
    expect(feeRecords).toHaveLength(2);
    expect(feeRecords[0].slice(2, 5)).toBe("100");
    expect(feeRecords[1].slice(2, 5)).toBe("105");
  });

  it("throws when fee entries would exceed the spec's 9-record limit", () => {
    const tooManyFees = Array.from({ length: 46 }, (_, i) => ({
      accountingClassCode: String(100 + i).padStart(3, "0"),
      totalFeeAmount: new Decimal("1.00"),
    }));
    expect(() => assembleTransaction({ ...base, feeTotals: tooManyFees })).toThrow();
  });
});

describe("assembleTransaction — comprehensive transaction with all optional records present", () => {
  it("assembles every in-scope header, line item, entity, tariff, detail, and totals record in exact PDF sequence", () => {
    const input: EntrySummaryTransactionInput = {
      headerControl: {
        summaryFilingActionRequestCode: "A",
        entryFilerCode: "N01",
        entryNumber: buildEntryNumber("N01", "5000003"),
        districtPortOfEntry: "2704",
        entryTypeCode: "06",
      },
      headerContent: {
        importerOfRecordNumber: "123456789012",
        consigneeNumber: "987654321000",
      },
      bonds: [
        {
          bondTypeCode: "8",
          bondDesignationTypeCode: "B",
          suretyCompanyCode: "123",
        },
      ],
      headerFees: {
        accountingClassCode1: "499",
        headerFeeAmount1: new Decimal("31.67"),
      },
      pscHeaderReasons: {
        reasonCode1: "01",
      },
      pscFilingExplanations: [
        { explanationText: "CORRECTED CLASSIFICATION AND VALUE" },
      ],
      lineItems: [
        {
          header: {
            lineItemIdentifier: "001",
            countryOfOriginCode: "CN",
          },
          ftzStatus: {
            ftzMerchandiseStatusCode: "P",
            ftzLineItemQuantity: new Decimal("100"),
          },
          eipInvoices: [
            {
              invoice: {
                supplierIdCode: "CHNSUPP123456",
                invoiceNumber: "INV-2026-001",
                invoiceLineRange1Begin: 1,
                invoiceLineRange1End: 5,
              },
              ruling: {
                rulingTypeCode: "R",
                rulingNumber: "123456",
              },
              commercialDescriptions: [
                { commercialDescriptionText: "INDUSTRIAL STEEL BALL BEARINGS" },
              ],
            },
          ],
          entities: [
            {
              entity: { entityCode: "MF", entityName: "ACME MANUFACTURING CO" },
              gbiIdentifiers: [{ gbiIdentifierQualifier: "LEI", identifier: "12345678901234567890" }],
              streetAddresses: [{ addressComponentQualifier1: "01", addressInformation1: "123 MAIN ST" }],
              geographicArea: { cityName: "BEIJING", countryCode: "CN" },
            },
          ],
          tariffDetails: [
            {
              htsNumber: "8481805090",
              dutyAmount: new Decimal("50.00"),
              valueOfGoodsAmount: new Decimal("1000"),
              unitOfMeasureCode1: "NO",
              ftzPrivilegedStatusDetail: {
                currentHtsNumber: "8481806000",
              },
            },
          ],
          licenseCertificatePermit: {
            licenseCertificatePermitTypeCode: "01",
            licenseCertificatePermitNumber: "STL1234567",
          },
          adcvdCases: [
            {
              caseNumber: "A570801000",
              bondCashClaimCode: "C",
              caseDepositRate: new Decimal("12.50"),
              caseRateTypeQualifierCode: "A",
              dutyAmount: new Decimal("125.00"),
            },
          ],
          importersAdditionalDeclarations: [
            {
              declarationTypeCode: "01",
              declarationInformation: "DEC-INFO-SOFWOOD-LUMBER-PAYLOAD-STRING-76-CHARS-FILL-SPACE-00000000000000000",
            },
          ],
          irTax: {
            accountingClassCode: "017",
            irTaxAmount: new Decimal("10.00"),
          },
          otherRevenue: {
            accountingClassCode: "001",
            otherRevenueAmount: new Decimal("5.00"),
          },
          userFees: [
            {
              accountingClassCode: "499",
              userFeeAmount: new Decimal("31.67"),
            },
          ],
          pscLineReasons: {
            reasonCode1: "02",
          },
        },
      ],
      adcvdDutyTotals: {
        totalCashDepositAdDutyAmount: new Decimal("125.00"),
      },
      feeTotals: [
        { accountingClassCode: "499", totalFeeAmount: new Decimal("31.67") },
      ],
      grandTotals: {
        grandTotalDutyAmount: new Decimal("50.00"),
        grandTotalUserFeeAmount: new Decimal("31.67"),
        grandTotalAdDutyAmount: new Decimal("125.00"),
      },
    };

    const records = assembleTransaction(input);
    assertAll80Chars(records);

    const prefixes = getRecordPrefixes(records);
    expect(prefixes).toEqual([
      "10",   // Header Control
      "11",   // Header Content
      "31",   // Bond Detail
      "34",   // Header Fees
      "35",   // PSC Header Reasons
      "36",   // PSC Filing Explanation
      "40",   // Line Item Header
      "41",   // FTZ Status Information
      "42",   // Invoice Line Reference
      "43",   // Rulings Detail
      "44",   // Commercial Description
      "SE50", // Line Entity
      "SE51", // Line Entity GBI
      "SE55", // Line Entity Street Address
      "SE56", // Line Entity Geographic Area
      "50",   // Tariff Detail
      "SE61", // FTZ Privileged Foreign Status Detail
      "52",   // License/Certificate/Permit
      "53",   // AD/CVD Case Detail
      "54",   // Importer's Additional Declaration
      "60",   // IR Tax
      "61",   // Other Revenue
      "62",   // Line User Fee
      "63",   // PSC Line Reasons
      "88",   // AD/CVD Duty Totals
      "89",   // Fee Total Detail
      "90",   // Grand Totals
    ]);
  });
});

describe("assembleTransaction — SE61 per-50-Record cardinality rule", () => {
  it("places SE61 immediately after its associated 50-Record inside multi-tariff line items (PDF p.91 / ESF-92)", () => {
    // PDF Page 92 (ESF-92): "The SE61 record may be reported only once per Tariff/Value/Quantity Detail (Input 50-Record)."
    // PDF Page 23 (ESF-23) Tariff Grouping: 50 (M) -> SE61 (C).
    const input: EntrySummaryTransactionInput = {
      headerControl: headerControl(),
      lineItems: [
        {
          header: { lineItemIdentifier: "001", countryOfOriginCode: "CN" },
          tariffDetails: [
            {
              // Tariff 1: active HTS, no SE61 needed
              htsNumber: "8481805090",
              dutyAmount: new Decimal("10.00"),
              valueOfGoodsAmount: new Decimal("500"),
              unitOfMeasureCode1: "NO",
            },
            {
              // Tariff 2: obsolete HTS, SE61 attached for current PGA HTS
              htsNumber: "8481806000",
              dutyAmount: new Decimal("20.00"),
              valueOfGoodsAmount: new Decimal("1000"),
              unitOfMeasureCode1: "NO",
              ftzPrivilegedStatusDetail: {
                currentHtsNumber: "8481809000",
              },
            },
            {
              // Tariff 3: active HTS, no SE61
              htsNumber: "9018903000",
              dutyAmount: new Decimal("15.00"),
              valueOfGoodsAmount: new Decimal("750"),
              unitOfMeasureCode1: "NO",
            },
          ],
        },
      ],
    };

    const records = assembleTransaction(input);
    assertAll80Chars(records);

    const prefixes = getRecordPrefixes(records);
    // Verified against PDF ESF-23: Tariff Grouping repeats per 50, so SE61 must appear immediately after 50 #2.
    // If SE61 were improperly modeled as a line-level 32x array placed after all 50s, the order would be 50, 50, 50, SE61.
    expect(prefixes).toEqual(["10", "40", "50", "50", "SE61", "50"]);

    // Index 2 is 50 (#1), Index 3 is 50 (#2), Index 4 is SE61 (#2's detail), Index 5 is 50 (#3)
    expect(records[3].slice(0, 2)).toBe("50");
    expect(records[3].slice(2, 12)).toBe("8481806000");

    expect(records[4].slice(0, 4)).toBe("SE61");
    expect(records[4].slice(4, 14)).toBe("8481809000");

    expect(records[5].slice(0, 2)).toBe("50");
    expect(records[5].slice(2, 12)).toBe("9018903000");
  });
});

describe("assembleTransaction — repeat limit validation", () => {
  const base: EntrySummaryTransactionInput = {
    headerControl: headerControl(),
    lineItems: [lineItem("001", ["8481805090"])],
  };

  it("throws when bond count exceeds 2", () => {
    const input: EntrySummaryTransactionInput = {
      ...base,
      bonds: [
        { bondTypeCode: "8", bondDesignationTypeCode: "B", suretyCompanyCode: "1" },
        { bondTypeCode: "8", bondDesignationTypeCode: "A", suretyCompanyCode: "2" },
        { bondTypeCode: "9", bondDesignationTypeCode: "U", suretyCompanyCode: "3" },
      ],
    };
    expect(() => assembleTransaction(input)).toThrow(/Bond Grouping/);
  });

  it("throws when PSC filing explanations exceed 99", () => {
    const explanations = Array.from({ length: 100 }, (_, i) => ({
      explanationText: `Explanation ${i}`,
    }));
    const input: EntrySummaryTransactionInput = {
      ...base,
      pscFilingExplanations: explanations,
    };
    expect(() => assembleTransaction(input)).toThrow(/PSC Filing Explanation Grouping/);
  });

  it("throws when tariff details per line exceed 32", () => {
    const tariffs = Array.from({ length: 33 }, () => ({
      htsNumber: "8481805090",
      dutyAmount: new Decimal("10.00"),
      valueOfGoodsAmount: new Decimal("100"),
      unitOfMeasureCode1: "NO",
    }));
    const input: EntrySummaryTransactionInput = {
      headerControl: headerControl(),
      lineItems: [
        {
          header: { lineItemIdentifier: "001", countryOfOriginCode: "CN" },
          tariffDetails: tariffs,
        },
      ],
    };
    expect(() => assembleTransaction(input)).toThrow(/Tariff Grouping/);
  });

  it("throws when AD/CVD cases per line exceed 2", () => {
    const input: EntrySummaryTransactionInput = {
      headerControl: headerControl(),
      lineItems: [
        {
          header: { lineItemIdentifier: "001", countryOfOriginCode: "CN" },
          tariffDetails: lineItem("001", ["8481805090"]).tariffDetails,
          adcvdCases: [
            { caseNumber: "A570801000", bondCashClaimCode: "C", caseDepositRate: new Decimal("1.0"), caseRateTypeQualifierCode: "A", dutyAmount: new Decimal("10") },
            { caseNumber: "A570801001", bondCashClaimCode: "C", caseDepositRate: new Decimal("1.0"), caseRateTypeQualifierCode: "A", dutyAmount: new Decimal("10") },
            { caseNumber: "A570801002", bondCashClaimCode: "C", caseDepositRate: new Decimal("1.0"), caseRateTypeQualifierCode: "A", dutyAmount: new Decimal("10") },
          ],
        },
      ],
    };
    expect(() => assembleTransaction(input)).toThrow(/AD\/CVD Case Grouping/);
  });

  it("throws when Importer's Additional Declarations per line exceed 9", () => {
    const decls = Array.from({ length: 10 }, () => ({
      declarationTypeCode: "01" as const,
      declarationInformation: "DEC-INFO-SAMPLE".padEnd(76, " "),
    }));
    const input: EntrySummaryTransactionInput = {
      headerControl: headerControl(),
      lineItems: [
        {
          header: { lineItemIdentifier: "001", countryOfOriginCode: "CN" },
          tariffDetails: lineItem("001", ["8481805090"]).tariffDetails,
          importersAdditionalDeclarations: decls,
        },
      ],
    };
    expect(() => assembleTransaction(input)).toThrow(/Importer's Additional Declaration Grouping/);
  });

  it("throws when line user fees exceed 9", () => {
    const fees = Array.from({ length: 10 }, () => ({
      accountingClassCode: "499",
      userFeeAmount: new Decimal("1.00"),
    }));
    const input: EntrySummaryTransactionInput = {
      headerControl: headerControl(),
      lineItems: [
        {
          header: { lineItemIdentifier: "001", countryOfOriginCode: "CN" },
          tariffDetails: lineItem("001", ["8481805090"]).tariffDetails,
          userFees: fees,
        },
      ],
    };
    expect(() => assembleTransaction(input)).toThrow(/Line User Fee Grouping/);
  });
});
