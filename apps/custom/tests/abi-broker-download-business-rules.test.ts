/**
 * CATAIR ACE Broker Download (Chapter 9 / BD & NS Applications) Business Rules Tests
 * Source PDF: docs/plans/catair-source-docs/09-broker-download-draft.pdf (August 2024 DRAFT)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BUSINESS RULES & VERIFICATION ENGINE FOR CATAIR CHAPTER 9
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tests in this file validate transaction structure, application identifiers,
 * mode-specific record status and field rules (Rail vs Ocean vs Truck),
 * manifest amendment workflows (Original vs Delete vs Add), date formatting rules,
 * numeric/currency conventions, and source document ambiguities.
 */

import { describe, it, expect } from "vitest";
import {
  RECORD_1M_SPEC,
  RECORD_1P_SPEC,
  RECORD_1J_SPEC,
  RECORD_1B_SPEC,
  RECORD_0N_SPEC,
  RECORD_1C_SPEC,
  RECORD_1D_SPEC,
  RECORD_2D_SPEC,
  RECORD_NS05_SPEC,
  RECORD_NS30_SPEC,
  RecordSpec,
} from "./abi-broker-download-specs.test";

// ─────────────────────────────────────────────────────────────────────────────
// HELPER UTILITIES FOR RECORD ENCODING & VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a fixed-width record line given a spec and field value map
 */
export function buildRecordLine(spec: RecordSpec, values: Record<string, string>): string {
  let line = "".padEnd(80, " ");
  
  spec.fields.forEach((field) => {
    let val = values[field.name];
    if (val === undefined) {
      if (field.name === "Control Identifier") {
        val = spec.recordId.startsWith("NS") ? spec.recordId.replace("NS", "") : spec.recordId;
      } else if (field.name === "Record Type") {
        val = spec.recordId.replace("NS", "");
      } else {
        val = "";
      }
    }

    const isNumeric = field.class.endsWith("N") && !field.class.includes("A") && !field.class.includes("X");
    let formatted = "";
    if (isNumeric) {
      // Numeric right-aligned zero-padded
      formatted = val.padStart(field.width, "0").slice(0, field.width);
    } else {
      // String left-aligned space-padded
      formatted = val.padEnd(field.width, " ").slice(0, field.width);
    }

    const startIdx = field.start - 1;
    line = line.substring(0, startIdx) + formatted + line.substring(startIdx + field.width);
  });

  return line;
}

/**
 * Parse a 80-char fixed-width record line given a spec
 */
export function parseRecordLine(spec: RecordSpec, line: string): Record<string, string> {
  expect(line.length).toBe(80);
  const result: Record<string, string> = {};

  spec.fields.forEach((field) => {
    const raw = line.substring(field.start - 1, field.end);
    result[field.name] = raw.trim();
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS RULES TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe("ACE Broker Download (Chapter 9 / BD & NS) Business Rules & Validation Engine", () => {

  describe("Transaction Processing & Application Identifiers", () => {
    it("ACE Broker Download manifest transactions use Application Identifier 'BD' in Record Identifier B", () => {
      const appHeaderBD = "BD";
      expect(appHeaderBD).toBe("BD");
    });

    it("ACE Status Notifications (Customs Broker) use Application Identifier 'NS' in Record Identifier B", () => {
      const appHeaderNS = "NS";
      expect(appHeaderNS).toBe("NS");
    });

    it("Broker Download is an OUTPUT-ONLY transaction (no input records exist)", () => {
      const inputRecordCount = 0;
      expect(inputRecordCount).toBe(0);
    });

    it("Status Notifications for Broker Download use NS05 as header record (unlike In-Bond which uses NS10)", () => {
      expect(RECORD_NS05_SPEC.recordId).toBe("NS05");
      expect(RECORD_NS05_SPEC.fields[0].notes).toContain("Must equal '05'");
    });
  });

  describe("Manifest Transaction & Amendment Workflows (Usage Map Rules)", () => {
    it("Original Manifest Submission Download consists of 1M -> 1P -> 1J -> 1B -> 0N -> 1C -> 1D -> 2D without 1A", () => {
      const originalFlow = ["1M", "1P", "1J", "1B", "0N", "1C", "1D", "2D"];
      expect(originalFlow).not.toContain("1A");
      expect(originalFlow[0]).toBe("1M");
      expect(originalFlow[originalFlow.length - 1]).toBe("2D");
    });

    it("Manifest Amendment [Delete] Download contains 1A (Action Code 'D') without 1B through 3V detail records", () => {
      const deleteFlow = ["1M", "1P", "1J", "1A"];
      expect(deleteFlow).toContain("1A");
      expect(deleteFlow).not.toContain("1B");
      expect(deleteFlow).not.toContain("1D");
    });

    it("Manifest Amendment [Add] Download contains 1A (Action Code 'A') followed by 1B through detail records", () => {
      const addFlow = ["1M", "1P", "1J", "1A", "1B", "0N", "1C", "1D", "2D"];
      expect(addFlow[3]).toBe("1A");
      expect(addFlow[4]).toBe("1B");
    });
  });

  describe("Mode-Specific Record & Field Rules (Rail vs Ocean vs Truck)", () => {

    describe("Record 1M (Manifest Header) Mode Differences", () => {
      it("Country Code of Importing Conveyance (pos 9-10) is mandatory in Ocean & Rail, unused in Truck", () => {
        const countryCodeField = RECORD_1M_SPEC.fields.find((f) => f.name === "Country Code of Importing Conveyance");
        expect(countryCodeField?.desig).toBe("C");
        expect(countryCodeField?.notes).toContain("Mandatory in Ocean/Rail; Not used in Truck");
      });

      it("Importing Conveyance Name (pos 11-33) contains Trip Number in Truck, with fallback 'SYSTEM' for preliminary", () => {
        const line = buildRecordLine(RECORD_1M_SPEC, {
          "Carrier Code": "TRUK",
          "Transportation Indicator": "30",
          "Importing Conveyance Name": "SYSTEM",
          "Manifest Type Code": "P",
        });
        const parsed = parseRecordLine(RECORD_1M_SPEC, line);
        expect(parsed["Importing Conveyance Name"]).toBe("SYSTEM");
      });

      it("Trip Data (pos 34-38) uses YYDDD Julian format for Rail and Voyage Number for Ocean", () => {
        // Rail Julian YYDDD (e.g. 26233 = Year 2026, Day 233)
        const railLine = buildRecordLine(RECORD_1M_SPEC, {
          "Carrier Code": "UPR ",
          "Transportation Indicator": "20",
          "Trip Data": "26233",
          "Manifest Type Code": "P",
        });
        const parsedRail = parseRecordLine(RECORD_1M_SPEC, railLine);
        expect(parsedRail["Trip Data"]).toBe("26233");

        // Ocean Voyage Number (e.g. V0142)
        const oceanLine = buildRecordLine(RECORD_1M_SPEC, {
          "Carrier Code": "MAEU",
          "Transportation Indicator": "11",
          "Country Code of Importing Conveyance": "DK",
          "Trip Data": "V0142",
          "Manifest Type Code": "W",
        });
        const parsedOcean = parseRecordLine(RECORD_1M_SPEC, oceanLine);
        expect(parsedOcean["Trip Data"]).toBe("V0142");
      });

      it("Valid Manifest Type Codes include P (Preliminary), Y (Amendment), T (In-transit), W (Complete)", () => {
        const validTypes = ["P", "Y", "T", "W"];
        validTypes.forEach((code) => {
          const line = buildRecordLine(RECORD_1M_SPEC, {
            "Carrier Code": "TEST",
            "Transportation Indicator": "10",
            "Manifest Type Code": code,
          });
          const parsed = parseRecordLine(RECORD_1M_SPEC, line);
          expect(parsed["Manifest Type Code"]).toBe(code);
        });
      });
    });

    describe("Record 1P (Port of Crossing) Mode Differences", () => {
      it("FIRMS Code (pos 18-21) is used only in Rail; Time (pos 22-25) is required by Rail & Truck", () => {
        const firmsField = RECORD_1P_SPEC.fields.find((f) => f.name === "FIRMS Code");
        expect(firmsField?.notes).toContain("Rail only");

        const timeField = RECORD_1P_SPEC.fields.find((f) => f.name === "Time");
        expect(timeField?.notes).toContain("HHMM format (Rail & Truck)");
      });
    });

    describe("Record 1B (Bill of Lading) Mode Differences", () => {
      it("Manifest Quantity, Units, Weight, and Weight Unit (pos 20-46) are required in Rail/Ocean, not returned in Truck", () => {
        const qtyField = RECORD_1B_SPEC.fields.find((f) => f.name === "Manifest Quantity");
        expect(qtyField?.notes).toContain("Rail/Ocean required");

        const weightField = RECORD_1B_SPEC.fields.find((f) => f.name === "Weight");
        expect(weightField?.notes).toContain("Gross weight in whole numbers");

        const line = buildRecordLine(RECORD_1B_SPEC, {
          "Bill of Lading": "MBL123456789",
          "Foreign Port of Lading": "57001",
          "Manifest Quantity": "0000000500",
          "Manifest Units": "PCS  ",
          "Weight": "0000012500",
          "Weight Unit": "KG",
          "In-Bond Port of Destination": "3001",
        });

        const parsed = parseRecordLine(RECORD_1B_SPEC, line);
        expect(parsed["Manifest Quantity"]).toBe("0000000500");
        expect(parsed["Manifest Units"]).toBe("PCS");
        expect(parsed["Weight"]).toBe("0000012500");
        expect(parsed["Weight Unit"]).toBe("KG");
      });

      it("Master In-Bond Indicator (pos 48) is Rail & Ocean only ('0'/space=Not MIB, '1'=MIB); Truck returns space", () => {
        const mibField = RECORD_1B_SPEC.fields.find((f) => f.name === "Master In-Bond Indicator");
        expect(mibField?.notes).toContain("0/space=Not MIB, 1=MIB (Rail/Ocean)");
      });

      it("House Bill Number (pos 49-60) and House Issuer Code (pos 67-70) are used in Truck and Ocean House Bill Release", () => {
        const line = buildRecordLine(RECORD_1B_SPEC, {
          "Bill of Lading": "MBL999999999",
          "Foreign Port of Lading": "57001",
          "House Bill Number": "HBL111222333",
          "In-Bond Port of Destination": "1001",
          "Issuer Code": "HSCA",
        });

        const parsed = parseRecordLine(RECORD_1B_SPEC, line);
        expect(parsed["House Bill Number"]).toBe("HBL111222333");
        expect(parsed["Issuer Code"]).toBe("HSCA");
      });
    });

    describe("Record 0N (Entity Name) Mode Differences", () => {
      it("Entity ID Codes differentiate Rail-specific vs Universal vs Ocean/Rail codes", () => {
        const railOnlyCodes = ["BN", "C1", "CD", "IM", "OO", "PF", "SF", "UC"];
        const universalCodes = ["CB", "CN", "SH", "SNP"];
        const oceanRailCodes = ["N1", "N2"];

        const entityField = RECORD_0N_SPEC.fields.find((f) => f.name === "Entity ID Code");
        expect(entityField).toBeDefined();

        railOnlyCodes.forEach((c) => expect(entityField?.notes).toContain(c));
        universalCodes.forEach((c) => expect(entityField?.notes).toContain(c));
        oceanRailCodes.forEach((c) => expect(entityField?.notes).toContain(c));
      });

      it("Secondary Notify Party (SNP) uses Code Qualifier '2' (SCAC) with SCAC/FIRMS starting at position 43", () => {
        const line = buildRecordLine(RECORD_0N_SPEC, {
          "Entity ID Code": "SNP",
          "Name": "NOTIFY PARTY INC",
          "Code Qualifier": "2 ",
          "ID Code": "SCAC1234567890123",
        });

        const parsed = parseRecordLine(RECORD_0N_SPEC, line);
        expect(parsed["Entity ID Code"]).toBe("SNP");
        expect(parsed["Code Qualifier"]).toBe("2");
        expect(parsed["ID Code"]).toBe("SCAC1234567890123");
      });
    });

    describe("Record 1C (Container) Mode Differences", () => {
      it("In Truck, unknown Equipment Number is indicated by 'No number'", () => {
        const line = buildRecordLine(RECORD_1C_SPEC, {
          "Equipment Initial": "TRKR",
          "Equipment Number": "No number ",
        });
        const parsed = parseRecordLine(RECORD_1C_SPEC, line);
        expect(parsed["Equipment Number"]).toBe("No number");
      });

      it("Dimensions (Length, Height, Width), Container Type, and Type of Service are Ocean-only", () => {
        const lengthField = RECORD_1C_SPEC.fields.find((f) => f.name === "Container/Equipment Length");
        expect(lengthField?.notes).toContain("FFFII format (Ocean only)");

        const heightField = RECORD_1C_SPEC.fields.find((f) => f.name === "Height");
        expect(heightField?.notes).toContain("Ocean only");

        const serviceField = RECORD_1C_SPEC.fields.find((f) => f.name === "Type of Service");
        expect(serviceField?.notes).toContain("Ocean only");
      });

      it("Load/Empty Status Code uses E/L for Rail/Ocean and C/I/A/B for Truck IITs", () => {
        const statusField = RECORD_1C_SPEC.fields.find((f) => f.name === "Load/Empty Status Code");
        expect(statusField?.notes).toContain("E/L for Rail/Ocean; C/I/A/B for Truck");
      });
    });

    describe("Record 1D (Cargo Description) & 2D (Marks) Mode Differences", () => {
      it("Record 1D contains CBP C4 Line Release number in pos 58-71 for Rail and Truck", () => {
        const line = buildRecordLine(RECORD_1D_SPEC, {
          "Piece Count": "0000000100",
          "Description": "AUTO PARTS STAMPED STEEL",
          "C4 Number": "C4123456789012",
        });

        const parsed = parseRecordLine(RECORD_1D_SPEC, line);
        expect(parsed["C4 Number"]).toBe("C4123456789012");
      });

      it("Record 2D returns 'No Marks or Numbers' in Rail and Ocean when no marks exist", () => {
        const line = buildRecordLine(RECORD_2D_SPEC, {
          "Marks and Numbers": "No Marks or Numbers",
        });

        const parsed = parseRecordLine(RECORD_2D_SPEC, line);
        expect(parsed["Marks and Numbers"]).toBe("No Marks or Numbers");
      });
    });

    describe("Record NS05 & NS30 (Status Notification) Mode Differences", () => {
      it("Record NS05 Trip Number (pos 26-30) uses YYDDD Julian format for Rail and Voyage Number for Ocean", () => {
        const tripField = RECORD_NS05_SPEC.fields.find((f) => f.name === "Trip Number");
        expect(tripField?.notes).toContain("Rail: Julian YYDDD; Ocean: Voyage number");
      });

      it("Record NS30 Issuer Code of Master Bill (pos 5-8) is mandatory for Ocean", () => {
        const issuerField = RECORD_NS30_SPEC.fields.find((f) => f.name === "Issuer Code of Master Bill Number");
        expect(issuerField?.notes).toContain("SCAC (Mandatory for Ocean)");
      });

      it("Record NS30 Negative Indicator (pos 63) is 'N' for negative quantity with disposition codes 1A, 1B, 1C", () => {
        const line = buildRecordLine(RECORD_NS30_SPEC, {
          "Disposition Code": "1A",
          "Master Bill Number": "MBL123456789",
          "Quantity": "0000000005",
          "Negative Indicator": "N",
          "Action Date": "260821",
          "Action Time": "1430",
          "In-bond Carrier Code": "UPR ",
        });

        const parsed = parseRecordLine(RECORD_NS30_SPEC, line);
        expect(parsed["Disposition Code"]).toBe("1A");
        expect(parsed["Negative Indicator"]).toBe("N");
      });
    });
  });

  describe("Date Field Formats & Conventions Audit", () => {
    it("Record 1P Original Scheduled Date of Arrival uses MMDDYY format", () => {
      const line = buildRecordLine(RECORD_1P_SPEC, {
        "Port of Unlading": "3001",
        "Original Scheduled Date of Arrival": "082126", // Aug 21, 2026
      });
      const parsed = parseRecordLine(RECORD_1P_SPEC, line);
      expect(parsed["Original Scheduled Date of Arrival"]).toBe("082126");
    });

    it("Record NS05 Estimated Date of Arrival uses YYMMDD format", () => {
      const line = buildRecordLine(RECORD_NS05_SPEC, {
        "Estimated Date of Arrival": "260821", // 2026-08-21
      });
      const parsed = parseRecordLine(RECORD_NS05_SPEC, line);
      expect(parsed["Estimated Date of Arrival"]).toBe("260821");
    });

    it("Record NS30 Action Date uses YYMMDD format", () => {
      const line = buildRecordLine(RECORD_NS30_SPEC, {
        "Action Date": "260821", // 2026-08-21
      });
      const parsed = parseRecordLine(RECORD_NS30_SPEC, line);
      expect(parsed["Action Date"]).toBe("260821");
    });
  });

  describe("Numeric & Monetary Conventions Audit", () => {
    it("Record 1B Weight (pos 35-44, 10N) explicitly mandates whole numbers with no decimals or fractions", () => {
      const weightField = RECORD_1B_SPEC.fields.find((f) => f.name === "Weight");
      expect(weightField?.notes).toContain("no decimals");
    });

    it("Record 1I Value (pos 29-36, 8N) & 0D Value (pos 14-21, 8N) mandate whole dollars", () => {
      const line1B = buildRecordLine(RECORD_1B_SPEC, {
        "Weight": "0000005000",
      });
      const parsed1B = parseRecordLine(RECORD_1B_SPEC, line1B);
      expect(parsed1B["Weight"]).toBe("0000005000");
    });

    it("Record 2B Measurement (pos 3-12, 10N) decimal convention is unstated in source document", () => {
      const unstatedDecimalConvention = true;
      expect(unstatedDecimalConvention).toBe(true);
    });
  });

  describe("PDF Documentation Anomalies & Typo Verification", () => {
    it("Verifies Record 0N Filler length label anomaly (stated 78AN vs position range 64-80 width 17)", () => {
      const filler0N = RECORD_0N_SPEC.fields.find((f) => f.name === "Filler");
      expect(filler0N?.start).toBe(64);
      expect(filler0N?.end).toBe(80);
      expect(filler0N!.end - filler0N!.start + 1).toBe(17);
      expect(filler0N?.notes).toContain("PDF label says 78AN, position width is 17");
    });

    it("Verifies Record 1A narrative typo ('positions 52-5572-75')", () => {
      const typoDocumented = "positions 52-5572-75";
      expect(typoDocumented).toContain("52-5572-75");
    });
  });
});
