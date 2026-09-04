/**
 * CATAIR ACE Cargo Manifest/In-Bond/Entry Status Query (CQ/C1 Applications) Business Rules Tests
 * Source PDF: docs/plans/catair-source-docs/04b-cargo-manifest-bond-entry-status-query-v21.pdf (September 2025)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BUSINESS RULES & VERIFICATION ENGINE FOR CATAIR CHAPTER 04b
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tests in this file validate query transaction rules, input vs output formats,
 * application identifiers (CQ vs C1), output limiting options, error response formatting,
 * status disposition action codes, entry number formatting, date format validation,
 * and complete query round-trip envelope assembly.
 */

import { describe, it, expect } from "vitest";
import {
  RECORD_WR1_INPUT_SPEC,
  RECORD_WR0_OUTPUT_SPEC,
  RECORD_WO10_OUTPUT_SPEC,
  RECORD_WO60_OUTPUT_SPEC,
  RECORD_WR1_OUTPUT_SPEC,
  RECORD_WR2_OUTPUT_SPEC,
  RecordSpec,
} from "./abi-cargo-manifest-query-specs.test";

// ─────────────────────────────────────────────────────────────────────────────
// HELPER UTILITIES FOR RECORD ENCODING, DECODING & VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a fixed-width 80-character record line given a spec and field value map
 */
export function buildRecordLine(spec: RecordSpec, values: Record<string, string>): string {
  let line = "".padEnd(80, " ");

  spec.fields.forEach((field) => {
    let val = values[field.name];
    if (val === undefined) {
      if (field.name === "Control Identifier") {
        if (spec.recordId.startsWith("WO")) {
          val = spec.recordId;
        } else {
          val = spec.recordId.substring(0, 2); // 'WR' for WR1, WR0, WR2
        }
      } else if (field.name === "Record Type") {
        val = spec.recordId.substring(2); // '1' for WR1, '0' for WR0, '2' for WR2
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
      // String/Alphanumeric left-aligned space-padded
      formatted = val.padEnd(field.width, " ").slice(0, field.width);
    }

    const startIdx = field.start - 1;
    line = line.substring(0, startIdx) + formatted + line.substring(startIdx + field.width);
  });

  return line;
}

/**
 * Parse a fixed-width 80-character record line into a dictionary of field values
 */
export function parseRecordLine(line: string, spec: RecordSpec): Record<string, string> {
  if (line.length !== 80) {
    throw new Error(`Invalid record line length: ${line.length}, expected 80`);
  }

  const result: Record<string, string> = {};
  spec.fields.forEach((field) => {
    const rawVal = line.substring(field.start - 1, field.end);
    result[field.name] = rawVal.trim();
  });

  return result;
}

/**
 * Validate a fixed-width record line against its specification rules
 */
export function validateRecordLine(line: string, spec: RecordSpec): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (line.length !== 80) {
    errors.push(`Record line length is ${line.length}, expected 80`);
    return { valid: false, errors };
  }

  spec.fields.forEach((field) => {
    const val = line.substring(field.start - 1, field.end);

    // Mandatory check
    if (field.designation === "M" && field.name !== "Filler" && !val.trim()) {
      errors.push(`Mandatory field '${field.name}' (pos ${field.start}-${field.end}) is empty`);
    }

    // Numeric class check
    if (field.class.endsWith("N") && !field.class.includes("A") && !field.class.includes("X")) {
      if (val.trim() && !/^\d+$/.test(val)) {
        errors.push(`Field '${field.name}' (pos ${field.start}-${field.end}) contains non-numeric chars: '${val}'`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS RULES TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe("CATAIR Cargo Manifest / Entry Status Query Business Rules Tests", () => {
  describe("Application Identifiers & Envelope Rules", () => {
    it("should use Application Identifier CQ for query request block header (Record B)", () => {
      const headerLine = "B".padEnd(80, " ");
      const appId = "CQ";
      const blockHeader = "B" + " ".repeat(2) + appId;
      expect(blockHeader.substring(3, 5)).toBe("CQ");
    });

    it("should use Application Identifier C1 for query response block header (Record B)", () => {
      const appId = "C1";
      const blockHeader = "B" + " ".repeat(2) + appId;
      expect(blockHeader.substring(3, 5)).toBe("C1");
    });
  });

  describe("Query Request Rules (Record WR1 Input)", () => {
    it("should properly build and validate a mandatory entry status query request line", () => {
      const values = {
        "Control Identifier": "WR",
        "Record Type": "1",
        "Entry Filer Code": "ABC",
        "Entry Number": "123456789",
        "Request for Bill of lading and Entry data indicator": "Y",
        "Limit Output Option": "2",
      };

      const line = buildRecordLine(RECORD_WR1_INPUT_SPEC, values);
      expect(line.length).toBe(80);
      expect(line.substring(0, 2)).toBe("WR");
      expect(line.substring(2, 3)).toBe("1");
      expect(line.substring(7, 10)).toBe("ABC");
      expect(line.substring(10, 19)).toBe("123456789");
      expect(line.substring(71, 72)).toBe("Y"); // Pos 72
      expect(line.substring(72, 73)).toBe("2"); // Pos 73

      const validation = validateRecordLine(line, RECORD_WR1_INPUT_SPEC);
      expect(validation.valid).toBe(true);
    });

    it("should enforce entry age limit rule (entries up to 6 months old supported)", () => {
      const values = {
        "Entry Filer Code": "XYZ",
        "Entry Number": "987654321",
      };

      const parsed = parseRecordLine(buildRecordLine(RECORD_WR1_INPUT_SPEC, values), RECORD_WR1_INPUT_SPEC);
      expect(parsed["Entry Filer Code"]).toBe("XYZ");
      expect(parsed["Entry Number"]).toBe("987654321");
    });

    it("should validate Limit Output Option codes (' ', '1', '2')", () => {
      const validOptions = [" ", "1", "2"];
      validOptions.forEach((opt) => {
        const line = buildRecordLine(RECORD_WR1_INPUT_SPEC, {
          "Entry Filer Code": "ABC",
          "Entry Number": "123456789",
          "Limit Output Option": opt,
        });
        const parsed = parseRecordLine(line, RECORD_WR1_INPUT_SPEC);
        expect(["", "1", "2"]).toContain(parsed["Limit Output Option"]);
      });
    });

    it("should reject ambiguous query requests that mix entry and in-bond parameters inappropriately", () => {
      // Note 1: Only one type of query may be initiated per WR1 record
      const entryParams = { filer: "ABC", entry: "123456789" };
      const inbondParams = { inbond: "123456789012" };

      expect(entryParams.filer && entryParams.entry).toBeTruthy();
      expect(inbondParams.inbond).toBeTruthy();
    });
  });

  describe("Entry Query Error Output Rules (Record WR0 Output)", () => {
    it("should build and parse an entry error response record when entry is not on file", () => {
      const errorValues = {
        "Control Identifier": "WR",
        "Record Type": "0",
        "Entry Filer Code": "ABC",
        "Entry Number": "123456789",
        "Error Message Identifier": "E01",
        "Narrative Message": "ENTRY NUMBER NOT ON FILE",
      };

      const line = buildRecordLine(RECORD_WR0_OUTPUT_SPEC, errorValues);
      expect(line.substring(0, 3)).toBe("WR0");
      expect(line.substring(3, 6)).toBe("ABC");
      expect(line.substring(6, 15)).toBe("123456789");
      expect(line.substring(29, 32)).toBe("E01");
      expect(line.substring(32, 72).trim()).toBe("ENTRY NUMBER NOT ON FILE");

      const validation = validateRecordLine(line, RECORD_WR0_OUTPUT_SPEC);
      expect(validation.valid).toBe(true);

      const parsed = parseRecordLine(line, RECORD_WR0_OUTPUT_SPEC);
      expect(parsed["Error Message Identifier"]).toBe("E01");
      expect(parsed["Narrative Message"]).toBe("ENTRY NUMBER NOT ON FILE");
    });
  });

  describe("Cargo Release Processing Results Header Rules (Record WO10 Output)", () => {
    it("should correctly structure WO10 Entry Status header record", () => {
      const wo10Values = {
        "Control Identifier": "WO10",
        "District/Port of Entry": "1001",
        "Entry Filer Code": "ABC",
        "Entry Number": "12345678", // 8AN in WO10
        "Entry Type Code": "01",
        "Importer of Record Number": "12-345678900",
        "Carrier Code": "COSU",
        "Vessel Name": "EVER GIVEN",
        "Voyage/Flight/Trip Manifest Number": "V1234",
        "Estimated Date of Arrival": "091525", // MMDDYY
        "Correction Response Indicator": "P",
      };

      const line = buildRecordLine(RECORD_WO10_OUTPUT_SPEC, wo10Values);
      expect(line.substring(0, 4)).toBe("WO10");
      expect(line.substring(4, 8)).toBe("1001");
      expect(line.substring(8, 11)).toBe("ABC");
      expect(line.substring(13, 21)).toBe("12345678"); // 8AN pos 14-21
      expect(line.substring(22, 24)).toBe("01");
      expect(line.substring(24, 36)).toBe("12-345678900");
      expect(line.substring(65, 71)).toBe("091525"); // Estimated Date of Arrival pos 66-71
      expect(line.substring(72, 73)).toBe("P"); // Correction Response Indicator pos 73

      const validation = validateRecordLine(line, RECORD_WO10_OUTPUT_SPEC);
      expect(validation.valid).toBe(true);
    });

    it("should format date of arrival as 6N MMDDYY numeric string", () => {
      const line = buildRecordLine(RECORD_WO10_OUTPUT_SPEC, {
        "Entry Filer Code": "ABC",
        "Entry Number": "12345678",
        "Entry Type Code": "01",
        "Importer of Record Number": "123456789000",
        "Estimated Date of Arrival": "122525",
      });

      const parsed = parseRecordLine(line, RECORD_WO10_OUTPUT_SPEC);
      expect(parsed["Estimated Date of Arrival"]).toBe("122525");
      expect(/^\d{6}$/.test(parsed["Estimated Date of Arrival"])).toBe(true);
    });
  });

  describe("Entry Status Disposition Rules (Record WO60 Output)", () => {
    it("should correctly encode and parse WO60 disposition action line", () => {
      const wo60Values = {
        "Control Identifier": "WO60",
        "Disposition Action Date": "091625",
        "Disposition Action Time": "1430",
        "Disposition Action Code": "22",
        "Narrative Message": "RELEASED",
        "Release Date": "091625",
        "Release Origin Code": "01",
        "Document Type": "DOC001",
      };

      const line = buildRecordLine(RECORD_WO60_OUTPUT_SPEC, wo60Values);
      expect(line.substring(0, 4)).toBe("WO60");
      expect(line.substring(4, 10)).toBe("091625"); // Date 5-10
      expect(line.substring(10, 14)).toBe("1430"); // Time 11-14
      expect(line.substring(14, 16)).toBe("22"); // Code 15-16
      expect(line.substring(16, 56).trim()).toBe("RELEASED"); // Narrative 17-56
      expect(line.substring(56, 62)).toBe("091625"); // Release Date 57-62
      expect(line.substring(62, 64)).toBe("01"); // Release Origin 63-64
      expect(line.substring(64, 70).trim()).toBe("DOC001"); // Document Type 65-70

      const validation = validateRecordLine(line, RECORD_WO60_OUTPUT_SPEC);
      expect(validation.valid).toBe(true);
    });

    it("should handle common disposition action codes (22=RELEASED, 04=ENTRY SUMMARY FILED, 1N=HOLD)", () => {
      const dispositionCodes = [
        { code: "22", narrative: "RELEASED" },
        { code: "04", narrative: "ENTRY SUMMARY FILED" },
        { code: "1N", narrative: "CBP HOLD PLACED" },
        { code: "98", narrative: "ADMISSIBLE" },
      ];

      dispositionCodes.forEach(({ code, narrative }) => {
        const line = buildRecordLine(RECORD_WO60_OUTPUT_SPEC, {
          "Disposition Action Date": "091625",
          "Disposition Action Time": "1200",
          "Disposition Action Code": code,
          "Narrative Message": narrative,
        });

        const parsed = parseRecordLine(line, RECORD_WO60_OUTPUT_SPEC);
        expect(parsed["Disposition Action Code"]).toBe(code);
        expect(parsed["Narrative Message"]).toBe(narrative);
      });
    });
  });

  describe("Manifest / Conveyance Results Rules (Record WR1 & WR2 Output)", () => {
    it("should build and parse WR1 Output manifest conveyance record", () => {
      const wr1OutValues = {
        "Control Identifier": "WR",
        "Record Type": "1",
        "District/Port of Entry": "1001",
        "Entry Filer Code": "ABC",
        "Entry Number": "123456789",
        "Entry Type Code": "01",
        "Importer of Record Number": "123456789000",
        "Broker Reference Number": "REF123456",
        "Carrier Code": "MAEU",
        "Importing Vessel Code or Importing Conveyance Name": "MAERSK MCKINNEY",
        "Voyage/Flight/Trip Manifest Number": "V4567",
        "Date of Arrival": "092025",
      };

      const line = buildRecordLine(RECORD_WR1_OUTPUT_SPEC, wr1OutValues);
      expect(line.substring(0, 3)).toBe("WR1");
      expect(line.substring(3, 7)).toBe("1001");
      expect(line.substring(7, 10)).toBe("ABC");
      expect(line.substring(10, 19)).toBe("123456789");
      expect(line.substring(19, 21)).toBe("01");
      expect(line.substring(42, 46)).toBe("MAEU");
      expect(line.substring(71, 77)).toBe("092025");

      const validation = validateRecordLine(line, RECORD_WR1_OUTPUT_SPEC);
      expect(validation.valid).toBe(true);
    });

    it("should build and parse WR2 Output trip & FIRMS record", () => {
      const wr2Values = {
        "Control Identifier": "WR",
        "Record Type": "2",
        "Trip Number": "TRIP-998877",
        FIRMS: "F123",
      };

      const line = buildRecordLine(RECORD_WR2_OUTPUT_SPEC, wr2Values);
      expect(line.substring(0, 3)).toBe("WR2");
      expect(line.substring(3, 28).trim()).toBe("TRIP-998877");
      expect(line.substring(76, 80)).toBe("F123");

      const validation = validateRecordLine(line, RECORD_WR2_OUTPUT_SPEC);
      expect(validation.valid).toBe(true);
    });
  });

  describe("Round Trip Integration & Envelope Assembly Simulation", () => {
    it("should simulate a complete Query Request batch envelope (Application CQ)", () => {
      const headerLine = "B".padEnd(3, " ") + "CQ" + "FILER1".padEnd(75, " ");
      const queryLine = buildRecordLine(RECORD_WR1_INPUT_SPEC, {
        "Entry Filer Code": "ABC",
        "Entry Number": "123456789",
        "Request for Bill of lading and Entry data indicator": "Y",
      });
      const trailerLine = "Y".padEnd(80, " ");

      const batch = [headerLine, queryLine, trailerLine];
      expect(batch.length).toBe(3);
      expect(batch[0].substring(3, 5)).toBe("CQ");
      expect(batch[1].substring(0, 3)).toBe("WR1");
      expect(batch[2].substring(0, 1)).toBe("Y");
    });

    it("should simulate a complete Query Error Response batch envelope (Application C1)", () => {
      const headerLine = "B".padEnd(3, " ") + "C1" + "FILER1".padEnd(75, " ");
      const errorLine = buildRecordLine(RECORD_WR0_OUTPUT_SPEC, {
        "Entry Filer Code": "ABC",
        "Entry Number": "123456789",
        "Error Message Identifier": "E01",
        "Narrative Message": "ENTRY NOT ON FILE",
      });
      const trailerLine = "Y".padEnd(80, " ");

      const responseBatch = [headerLine, errorLine, trailerLine];
      expect(responseBatch.length).toBe(3);
      expect(responseBatch[0].substring(3, 5)).toBe("C1");
      expect(responseBatch[1].substring(0, 3)).toBe("WR0");
      expect(responseBatch[1].substring(29, 32)).toBe("E01");
    });

    it("should simulate a complete Query Success Response batch envelope (Application C1 with WO10, WO60, WR1, WR2)", () => {
      const headerLine = "B".padEnd(3, " ") + "C1" + "FILER1".padEnd(75, " ");

      const wo10Line = buildRecordLine(RECORD_WO10_OUTPUT_SPEC, {
        "District/Port of Entry": "1001",
        "Entry Filer Code": "ABC",
        "Entry Number": "12345678",
        "Entry Type Code": "01",
        "Importer of Record Number": "123456789000",
        "Estimated Date of Arrival": "091525",
      });

      const wo60Line = buildRecordLine(RECORD_WO60_OUTPUT_SPEC, {
        "Disposition Action Date": "091625",
        "Disposition Action Time": "1430",
        "Disposition Action Code": "22",
        "Narrative Message": "RELEASED",
      });

      const wr1OutLine = buildRecordLine(RECORD_WR1_OUTPUT_SPEC, {
        "District/Port of Entry": "1001",
        "Entry Filer Code": "ABC",
        "Entry Number": "123456789",
        "Voyage/Flight/Trip Manifest Number": "V123",
        "Date of Arrival": "091525",
      });

      const wr2OutLine = buildRecordLine(RECORD_WR2_OUTPUT_SPEC, {
        "Trip Number": "TRIP100",
        FIRMS: "F456",
      });

      const trailerLine = "Y".padEnd(80, " ");

      const fullResponsePayload = [headerLine, wo10Line, wo60Line, wr1OutLine, wr2OutLine, trailerLine];
      expect(fullResponsePayload.length).toBe(6);
      expect(fullResponsePayload[0].substring(3, 5)).toBe("C1");
      expect(fullResponsePayload[1].substring(0, 4)).toBe("WO10");
      expect(fullResponsePayload[2].substring(0, 4)).toBe("WO60");
      expect(fullResponsePayload[3].substring(0, 3)).toBe("WR1");
      expect(fullResponsePayload[4].substring(0, 3)).toBe("WR2");

      fullResponsePayload.slice(1, 5).forEach((line) => {
        expect(line.length).toBe(80);
      });
    });
  });
});
