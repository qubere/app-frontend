import { describe, it, expect } from "vitest";
import {
  enrichE1Record,
  interpretEntrySummaryResponse,
  buildCustomsResponseRecords,
} from "@/lib/abi/entrySummary/interpretResponse";
import type { ParsedEntrySummaryResponse, E1Record, E0Record } from "@/lib/abi/entrySummary/types";

describe("interpretEntrySummaryResponse & ACE Error Dictionary integration", () => {
  it("enriches single-match condition code (e.g. 861) with exact error dictionary title and explanation", () => {
    const e1: E1Record = {
      dispositionTypeCode: "",
      severityCode: "F",
      conditionCode: "861",
      narrativeText: "AUTO LICENSE INSUFFICIENT BALANCE",
      entryFilerCode: "N01",
      entryNumber: "50000037",
      isFinalDisposition: false,
    };

    const enriched = enrichE1Record(e1);

    expect(enriched.lookupCode).toBe("861");
    expect(enriched.matchedErrors).toHaveLength(1);
    expect(enriched.matchedErrors[0].conditionCode).toBe("861");
    expect(enriched.title).toBe("AUTO LICENSE INSUFFICIENT BALANCE");
    expect(enriched.description).toBe(
      "The submitted Automobile License for Importer's Additional Declaration Record Type '11' has a balance that is not sufficient to cover the submitted auto part duty."
    );
  });

  it("surfaces all matches for ambiguous multi-match condition code (e.g. 014) without silently collapsing", () => {
    const e1: E1Record = {
      dispositionTypeCode: "",
      severityCode: "F",
      conditionCode: "014",
      narrativeText: "QUERY / DATE RANGE LIMIT EXCEEDED",
      entryFilerCode: "N01",
      entryNumber: "50000037",
      isFinalDisposition: false,
    };

    const enriched = enrichE1Record(e1);

    expect(enriched.lookupCode).toBe("014");
    expect(enriched.matchedErrors).toHaveLength(3);
    expect(enriched.description).toContain(
      "[Match 1 - Date Range Exceeds Query Limit]: In a Census Warning Query, the date range being queried (the difference between the requested from date and the requested to date) exceeds 31 days."
    );
    expect(enriched.description).toContain(
      "[Match 2 - Query Complete No AD/CVD Cases Found]: In an AD/CVD query, there were no cases found for the tariff/country listed in the AD input record"
    );
    expect(enriched.description).toContain(
      "[Match 3 - Query Not Permitted for Entry Number]: In an Entry Summary Query, if the J1 record is used, at least one entry number being queried must be from the same filer code as transmitted in the B record for the query."
    );
  });

  it("interprets a full rejected ParsedEntrySummaryResponse and builds CustomsResponse records", () => {
    const e0Ref: E0Record = {
      referenceDataTypeCode: "SUMMRY",
      occurrencePosition: 1,
      entryFilerCode: "N01",
      entryNumber: "50000037",
    };

    const condition1: E1Record = {
      dispositionTypeCode: "",
      severityCode: "F",
      conditionCode: "861",
      narrativeText: "AUTO LICENSE INSUFFICIENT BALANCE",
      isFinalDisposition: false,
    };

    const condition2: E1Record = {
      dispositionTypeCode: "",
      severityCode: "W",
      conditionCode: "866",
      narrativeText: "AUTO LICENSE PRESENT - DUTY NOT ALLOWED",
      isFinalDisposition: false,
    };

    const finalDisposition: E1Record = {
      dispositionTypeCode: "R",
      severityCode: "F",
      conditionCode: "E01",
      narrativeText: "ENTRY SUMMARY REJECTED",
      isFinalDisposition: true,
    };

    const parsed: ParsedEntrySummaryResponse = {
      scenario: "REJECTED",
      conditions: [
        { references: [e0Ref], condition: condition1 },
        { references: [e0Ref], condition: condition2 },
      ],
      finalDisposition,
    };

    const result = interpretEntrySummaryResponse(parsed);

    expect(result.scenario).toBe("REJECTED");
    expect(result.hasFatalErrors).toBe(true);
    expect(result.summaryCounts).toEqual({
      fatal: 1,
      warning: 1,
      informational: 0,
      total: 2,
    });

    expect(result.conditions).toHaveLength(2);
    expect(result.conditions[0].title).toBe("AUTO LICENSE INSUFFICIENT BALANCE");
    expect(result.conditions[0].description).toBe(
      "The submitted Automobile License for Importer's Additional Declaration Record Type '11' has a balance that is not sufficient to cover the submitted auto part duty."
    );
    expect(result.conditions[1].title).toBe("AUTO LICENSE PRESENT - DUTY NOT ALLOWED");
    expect(result.conditions[1].description).toBe(
      "An Automobile License for Importer's Additional Declaration Record Type '11' is submitted on a line, yet duty is present on the corresponding auto part ch.99 HTS number."
    );

    // Verify conversion to CustomsResponse database records
    const dbRecords = buildCustomsResponseRecords(
      result,
      "acc-123",
      "filing-456"
    );

    expect(dbRecords).toHaveLength(3); // 2 conditions + 1 final disposition
    expect(dbRecords[0]).toEqual({
      accountId: "acc-123",
      filingId: "filing-456",
      code: "861",
      title: "AUTO LICENSE INSUFFICIENT BALANCE",
      description:
        "The submitted Automobile License for Importer's Additional Declaration Record Type '11' has a balance that is not sufficient to cover the submitted auto part duty.",
      status: "REJECTED",
    });
    expect(dbRecords[1]).toEqual({
      accountId: "acc-123",
      filingId: "filing-456",
      code: "866",
      title: "AUTO LICENSE PRESENT - DUTY NOT ALLOWED",
      description:
        "An Automobile License for Importer's Additional Declaration Record Type '11' is submitted on a line, yet duty is present on the corresponding auto part ch.99 HTS number.",
      status: "WARNING",
    });
    expect(dbRecords[2]).toEqual({
      accountId: "acc-123",
      filingId: "filing-456",
      code: "E01",
      title: "Entry Summary Rejected by CBP",
      description: "ENTRY SUMMARY REJECTED",
      status: "REJECTED",
    });
  });
});
