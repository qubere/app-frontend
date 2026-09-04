import { describe, it, expect } from "vitest";
import { encodeRecord } from "@/lib/abi/fixedWidth";
import { Decimal } from "@/lib/tariff/decimal";
import {
  ENTRY_SUMMARY_STATUS_INFO_SPEC,
  ENTRY_SUMMARY_STATUS_DETAIL_SPEC,
  LIQUIDATION_INFO_SPEC,
  ESTIMATED_REVENUE_INFO_SPEC,
  ENTRY_SUMMARY_FILING_INFO_SPEC,
  WAREHOUSE_AND_LINE_INFO_SPEC,
  FORM_REFERENCE_INFO_SPEC,
  BOND_SURETY_INFO_SPEC,
  QUERY_RETURNED_CONDITION_SPEC,
} from "@/lib/abi/entrySummaryQuery/recordSpecs";
import { parseQueryResponse } from "@/lib/abi/entrySummaryQuery/parse";
import {
  enrichQueryReturnedCondition,
  interpretQueryResponse,
  summarizeQueryResult,
} from "@/lib/abi/entrySummaryQuery/interpretResponse";

describe("Entry Summary Query interpretResponse & ACE Error Dictionary integration", () => {
  it("enriches single-match condition code with ACE Error Dictionary title and explanation", () => {
    const cond = {
      conditionCode: "861",
      narrativeText: "AUTO LICENSE INSUFFICIENT BALANCE",
      districtPortOfEntry: "2704",
    };

    const enriched = enrichQueryReturnedCondition(cond);

    expect(enriched.lookupCode).toBe("861");
    expect(enriched.matchedErrors).toHaveLength(1);
    expect(enriched.title).toBe("AUTO LICENSE INSUFFICIENT BALANCE");
    expect(enriched.description).toBe(
      "The submitted Automobile License for Importer's Additional Declaration Record Type '11' has a balance that is not sufficient to cover the submitted auto part duty."
    );
  });

  it("surfaces all matches for ambiguous multi-match condition code (014) without silently collapsing", () => {
    const cond = {
      conditionCode: "014",
      narrativeText: "QUERY / DATE RANGE LIMIT EXCEEDED",
      districtPortOfEntry: "2704",
    };

    const enriched = enrichQueryReturnedCondition(cond);

    expect(enriched.lookupCode).toBe("014");
    expect(enriched.matchedErrors).toHaveLength(3);
    expect(enriched.description).toContain(
      "[Match 1 - Date Range Exceeds Query Limit]"
    );
    expect(enriched.description).toContain(
      "[Match 2 - Query Complete No AD/CVD Cases Found]"
    );
    expect(enriched.description).toContain(
      "[Match 3 - Query Not Permitted for Entry Number]"
    );
  });

  it("interprets full built-then-parsed query response and populates separate structured liquidation/bond summary", () => {
    // 1. Build fixed-width response lines
    const lineJB = encodeRecord(ENTRY_SUMMARY_STATUS_INFO_SPEC, {
      entryFilerCode: "N01",
      entryNumber: "50000037",
      versionNumber: "00100",
      acceptDateTime: new Date(2026, 7, 20, 10, 15, 0),
      pscIndicator: " ",
      ownershipDataReturnedIndicator: "Y",
      liquidationStatusCode: "2", // Liquidated
      liquidationDate: new Date(2026, 7, 21, 0, 0, 0),
      centerId: "AP0101",
    });

    const lineJC = encodeRecord(ENTRY_SUMMARY_STATUS_DETAIL_SPEC, {
      entrySummaryControlStatus: "2",
      entrySummaryStatusCode: "1",
      entrySummaryStatusDate: new Date(2026, 7, 20),
      lateFilingStatusCode: "0",
      collectionStatusCode: "2",
      censusHeaderStatusCode: "0",
      invoiceStatusCode: " ",
      protestStatusCode: "NO",
      quotaStatusCode: " ",
      extensionSuspensionStatusCode1: "01",
    });

    const lineJD = encodeRecord(LIQUIDATION_INFO_SPEC, {
      cbpReviewIndicator: "2",
      entryDate: new Date(2026, 7, 15),
      liquidatedDuty: new Decimal("150.00"),
      liquidatedTax: new Decimal("0.00"),
      liquidatedFees: new Decimal("31.67"),
      liquidatedInterest: new Decimal("0.00"),
      liquidatedAdCvd: new Decimal("262.50"),
      liquidationReasonCode1: "01",
      immediateDeliveryIndicator: "N",
    });

    const lineJE = encodeRecord(ESTIMATED_REVENUE_INFO_SPEC, {
      estimatedDuty: new Decimal("150.00"),
      estimatedFees: new Decimal("31.67"),
      estimatedAdCvd: new Decimal("262.50"),
    });

    const lineJF = encodeRecord(ENTRY_SUMMARY_FILING_INFO_SPEC, {
      importerOfRecordNumber: "123456789012",
      entryTypeCode: "01",
      districtPortOfEntry: "2704",
      entrySummaryFilingDate: new Date(2026, 7, 20),
    });

    const lineJG = encodeRecord(WAREHOUSE_AND_LINE_INFO_SPEC, {
      numberOfLineItems: 1,
      centerId: "AP0101",
    });

    const lineJH = encodeRecord(FORM_REFERENCE_INFO_SPEC, {
      brokerReferenceNumber: "BRK-2026",
    });

    const lineJI1 = encodeRecord(BOND_SURETY_INFO_SPEC, {
      suretyCode: "001",
      primarySuretyIndicator: "Y",
      bondTypeCode: "8",
      bondDesignationTypeCode: "B",
      bondNumber: "BOND12345",
      suretyLiabilityAmount: new Decimal("50000.00"),
    });

    const lineJZ = encodeRecord(QUERY_RETURNED_CONDITION_SPEC, {
      conditionCode: "014",
      narrativeText: "QUERY NOT PERMITTED FOR ENTRY NUMBER",
      districtPortOfEntry: "2704",
      entryFilerCode: "N01",
      entryNumber: "50000037",
    });

    const rawLines = [
      lineJB,
      lineJC,
      lineJD,
      lineJE,
      lineJF,
      lineJG,
      lineJH,
      lineJI1,
      lineJZ,
    ];

    // 2. Parse using parseQueryResponse()
    const parsed = parseQueryResponse(rawLines);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.conditions).toHaveLength(1);

    // 3. Summarize query result object directly
    const summary = summarizeQueryResult(parsed.results[0]);
    expect(summary.entryFilerCode).toBe("N01");
    expect(summary.entryNumber).toBe("50000037");
    expect(summary.entrySummaryStatusCode).toBe("1");

    // Verify structured liquidation info
    expect(summary.liquidation?.statusCode).toBe("2");
    expect(summary.liquidation?.liquidatedDuty).toBe("150");
    expect(summary.liquidation?.liquidatedFees).toBe("31.67");
    expect(summary.liquidation?.liquidatedAdCvd).toBe("262.5");
    expect(summary.liquidation?.reasonCodes).toEqual(["01"]);

    // Verify structured estimated revenue info
    expect(summary.estimatedRevenue?.estimatedDuty).toBe("150");
    expect(summary.estimatedRevenue?.estimatedFees).toBe("31.67");

    // Verify structured filing info & bonds
    expect(summary.filing?.importerOfRecordNumber).toBe("123456789012");
    expect(summary.filing?.districtPortOfEntry).toBe("2704");
    expect(summary.bonds).toHaveLength(1);
    expect(summary.bonds[0].suretyCode).toBe("001");
    expect(summary.bonds[0].bondNumber).toBe("BOND12345");

    // 4. Interpret response and verify CustomsResponseRecordData[] array
    const interpreted = interpretQueryResponse(parsed, {
      accountId: "acc-test-1",
      filingIdMap: {
        "N01-50000037": "filing-7501-1",
      },
    });

    expect(interpreted.conditions).toHaveLength(1);
    expect(interpreted.summaries).toHaveLength(1);

    const dbRecords = interpreted.customsResponseRecords;
    expect(dbRecords).toHaveLength(2); // 1 condition + 1 summary status

    // Condition record in DB format
    expect(dbRecords[0]).toEqual({
      accountId: "acc-test-1",
      filingId: "filing-7501-1",
      code: "014",
      title: "QUERY NOT PERMITTED FOR ENTRY NUMBER",
      description: expect.stringContaining("[Match 1 - Date Range Exceeds Query Limit]"),
      status: "QUERY_CONDITION",
    });

    // Entry status summary in DB format
    expect(dbRecords[1].accountId).toBe("acc-test-1");
    expect(dbRecords[1].filingId).toBe("filing-7501-1");
    expect(dbRecords[1].code).toBe("1");
    expect(dbRecords[1].title).toBe("Entry Summary N01-50000037 Status (1)");
    expect(dbRecords[1].description).toContain("Liquidated Duty: $150.");
    expect(dbRecords[1].status).toBe("LIQUIDATED");
  });
});
