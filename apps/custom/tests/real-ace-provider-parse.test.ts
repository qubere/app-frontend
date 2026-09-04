import { describe, it, expect } from "vitest";
import { RealAceProvider } from "@/lib/filing/transmissionProvider";
import { encodeRecord } from "@/lib/abi/fixedWidth";
import { A_OUTPUT_SPEC, Z_ACE_GENERATED_SPEC, X0_BLOCK_SPEC, X1_SPEC } from "@/lib/abi/batchBlockControl/recordSpecs";
import { E0_SUMMARY_SPEC, E1_SPEC } from "@/lib/abi/entrySummary/recordSpecs";
import { getAllAbiErrors } from "@/lib/abi/errorDictionary";

/**
 * Test suite for P3: RealAceProvider.parseAcknowledgment wiring to
 * batchBlockControl and entrySummary parsers + error dictionary enrichment.
 */

function createTestProvider(): RealAceProvider {
  return new RealAceProvider({
    credential: {
      filerCode: "TEST_FILER",
      secretRef: "TEST_SECRET_REF",
    },
  });
}

describe("P3 RealAceProvider.parseAcknowledgment Tests", () => {
  describe("Batch / Block Level Rejection Parsing (X0 / X1 records)", () => {
    it("parses batch-level rejection output and enriches X1 condition codes via errorDictionary", () => {
      const provider = createTestProvider();

      // Construct a valid 80-char A output line
      const lineA = encodeRecord(A_OUTPUT_SPEC, {
        senderReceiverSiteCode: "SITE",
        senderReceiverIdCode: "XYZ",
        transmissionDate: new Date("2026-08-21T00:00:00Z"),
        applicationIdentifierCode: "AE",
        senderReceiverOfficeCode: "01",
        transmitterUserDataText: "BATCH_TEST_REF_123",
      });

      // Construct X0 block reference line
      const lineX0 = encodeRecord(X0_BLOCK_SPEC, {
        referenceDataTypeCode: "BLOCK",
        occurrencePosition: 1,
        processingDistrictPortCode: "3501",
        processingFilerCode: "9XY",
        processingFilerOfficeCode: "01",
        applicationIdentifierCode: "AE",
        filerPreparerUserDataText: "BLOCK_REF",
        preparerDistrictPortCode: "3501",
        preparerFilerCode: "9XY",
        preparerOfficeCode: "01",
        preparerIndicator: "1",
      });

      // Construct X1 condition line with condition code 439 ("QUANTITY/UOM(S) MISSING"), disposition C (condition)
      const lineX1_439 = encodeRecord(X1_SPEC, {
        dispositionTypeCode: "C",
        severityCode: "F",
        conditionCode: "439",
        reasonCode: "1",
        narrativeText: "QUANTITY UOM MISSING",
      });

      // Construct X1 final disposition line with condition code 999 ("BATCH REJECTED"), disposition R (rejection)
      const lineX1_999 = encodeRecord(X1_SPEC, {
        dispositionTypeCode: "R",
        severityCode: "F",
        conditionCode: "999",
        reasonCode: "9",
        narrativeText: "BATCH REJECTED SYNTAX ERROR",
      });

      // Construct Z ACE-generated trailer
      const lineZ = encodeRecord(Z_ACE_GENERATED_SPEC, {
        recordIndicator: "Z",
      });

      const rawPayload = [lineA, lineX0, lineX1_439, lineX1_999, lineZ].join("\n");

      const result = provider.parseAcknowledgment(rawPayload);

      expect(result.accepted).toBe(false);
      expect(result.responseCode).toBe("999");
      expect(result.referenceNumber).toBe("BATCH_TEST_REF_123");
      expect(result.rejectionReasons).toBeDefined();
      expect(result.rejectionReasons?.length).toBeGreaterThanOrEqual(2);
      expect(result.rejectionReasons?.[0]).toContain("[Code 439]");
      expect(result.raw).toBe(rawPayload);
    });
  });

  describe("Entry Summary Response Parsing (E0 / E1 records)", () => {
    it("parses entry-summary-level accept output (E1 disposition A)", () => {
      const provider = createTestProvider();

      const lineE0 = encodeRecord(E0_SUMMARY_SPEC, {
        referenceDataTypeCode: "SUMMRY",
        occurrencePosition: 1,
        entryFilerCode: "9XY",
        entryNumber: "45678901",
        brokerReferenceNumber: "BROKER_REF_1",
        cbpTeamNumber: "001",
      });

      const lineE1_Accept = encodeRecord(E1_SPEC, {
        dispositionTypeCode: "A",
        severityCode: "I",
        conditionCode: "000",
        reasonCode: "0",
        narrativeText: "ENTRY SUMMARY ACCEPTED BY CBP",
      });

      const rawPayload = [lineE0, lineE1_Accept].join("\n");
      const result = provider.parseAcknowledgment(rawPayload);

      expect(result.accepted).toBe(true);
      expect(result.responseCode).toBe("000");
      expect(result.referenceNumber).toBe("9XY-45678901");
      expect(result.rejectionReasons).toBeUndefined();
      expect(result.raw).toBe(rawPayload);
    });

    it("parses entry-summary-level reject with multiple E1 condition records", () => {
      const provider = createTestProvider();

      const lineE0_1 = encodeRecord(E0_SUMMARY_SPEC, {
        referenceDataTypeCode: "SUMMRY",
        occurrencePosition: 1,
        entryFilerCode: "9XY",
        entryNumber: "98765432",
        brokerReferenceNumber: "BROKER_REF_2",
        cbpTeamNumber: "001",
      });

      const lineE1_Cond1 = encodeRecord(E1_SPEC, {
        dispositionTypeCode: "C",
        severityCode: "F",
        conditionCode: "861",
        reasonCode: "1",
        narrativeText: "AUTO LICENSE INSUFFICIENT BALANCE",
      });

      const lineE1_Cond2 = encodeRecord(E1_SPEC, {
        dispositionTypeCode: "C",
        severityCode: "F",
        conditionCode: "60D",
        reasonCode: "2",
        narrativeText: "LIC CERT PERM FOR HTS MISSING",
      });

      const lineE1_FinalReject = encodeRecord(E1_SPEC, {
        dispositionTypeCode: "R",
        severityCode: "F",
        conditionCode: "700",
        reasonCode: "9",
        narrativeText: "ENTRY SUMMARY REJECTED BY CBP",
      });

      const rawPayload = [lineE0_1, lineE1_Cond1, lineE0_1, lineE1_Cond2, lineE1_FinalReject].join("\n");
      const result = provider.parseAcknowledgment(rawPayload);

      expect(result.accepted).toBe(false);
      expect(result.responseCode).toBe("700");
      expect(result.referenceNumber).toBe("9XY-98765432");
      expect(result.rejectionReasons).toBeDefined();
      expect(result.rejectionReasons?.length).toBe(2);
      expect(result.rejectionReasons?.[0]).toContain("[Code 861]");
      expect(result.rejectionReasons?.[1]).toContain("[Code 60D]");
    });
  });

  describe("Ambiguous Condition Code Multi-Match Verification", () => {
    it("preserves and surfaces all explanations for code 014 (3 multi-context matches)", () => {
      // First verify getAllAbiErrors behavior directly on code "014"
      const matched = getAllAbiErrors("014");
      expect(matched.length).toBe(3);
      expect(matched[0].narrativeText).toBe("Date Range Exceeds Query Limit");
      expect(matched[1].narrativeText).toBe("Query Complete No AD/CVD Cases Found");
      expect(matched[2].narrativeText).toBe("Query Not Permitted for Entry Number");

      // Verify parseAcknowledgment enriches condition 014 with multi-match explanations cleanly
      const provider = createTestProvider();

      const lineE0 = encodeRecord(E0_SUMMARY_SPEC, {
        referenceDataTypeCode: "SUMMRY",
        occurrencePosition: 1,
        entryFilerCode: "9XY",
        entryNumber: "11111113",
        brokerReferenceNumber: "BROKER_REF_3",
        cbpTeamNumber: "001",
      });

      const lineE1_Ambiguous = encodeRecord(E1_SPEC, {
        dispositionTypeCode: "C",
        severityCode: "F",
        conditionCode: "014",
        reasonCode: "1",
        narrativeText: "AMBIGUOUS QUERY CONDITION",
      });

      const lineE1_Final = encodeRecord(E1_SPEC, {
        dispositionTypeCode: "R",
        severityCode: "F",
        conditionCode: "700",
        reasonCode: "9",
        narrativeText: "TRANSACTION REJECTED",
      });

      const rawPayload = [lineE0, lineE1_Ambiguous, lineE1_Final].join("\n");
      const result = provider.parseAcknowledgment(rawPayload);

      expect(result.accepted).toBe(false);
      expect(result.rejectionReasons).toBeDefined();
      expect(result.rejectionReasons?.length).toBe(1);
      expect(result.rejectionReasons?.[0]).toContain("[Match 1 - Date Range Exceeds Query Limit]");
      expect(result.rejectionReasons?.[0]).toContain("[Match 2 - Query Complete No AD/CVD Cases Found]");
      expect(result.rejectionReasons?.[0]).toContain("[Match 3 - Query Not Permitted for Entry Number]");
    });
  });
});
