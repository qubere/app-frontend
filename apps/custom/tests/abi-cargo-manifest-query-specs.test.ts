/**
 * CATAIR ACE Cargo Manifest/In-Bond/Entry Status Query (CQ/C1 Applications) Specification Tests
 * Source PDF: docs/plans/catair-source-docs/04b-cargo-manifest-bond-entry-status-query-v21.pdf (September 2025)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CATAIR ACE CARGO MANIFEST/ENTRY STATUS QUERY SCOPE NOTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Context & Architecture:
 * The CQ application allows an ABI participant to query the processing results and current status
 * of an entry, bill of lading, air waybill, or in-bond entry up to 6 months old.
 * Request messages use Application Identifier "CQ" with input query records.
 * Response messages use Application Identifier "C1" with status/results output records.
 *
 * Scoped IN (6 Core Records for Complete "Query an Entry, Get Status Back" Round Trip):
 *   1. Record WR1 (Input, Mandatory Query Request, Pages 14-15): Entry/In-bond/Bill Query Input.
 *      [Pos 1-80: 2(WR) + 1(1) + 4(filler) + 3(entryFilerCode) + 9(entryNumber) + 12(inBondNumber) + 4(issuerCode) + 12(billNumber) + 11(airWaybillNumber) + 12(houseAirWaybillNumber) + 1(requestRelatedBol) + 1(requestBillAndEntryData) + 1(limitOutputOption) + 7(filler) = 80]
 *   2. Record WR0 (Output, Mandatory Error Output for Entry Query, Page 22): Entry Query Error Response.
 *      [Pos 1-80: 2(WR) + 1(0) + 3(entryFilerCode) + 9(entryNumber) + 14(filler) + 3(errorMessageId) + 40(narrativeMessage) + 8(filler) = 80]
 *   3. Record WO10 (Output, Mandatory Entry Header Output for Cargo Release Status, Pages 46-47): Entry Status Processing Header.
 *      [Pos 1-80: 4(WO10) + 4(districtPort) + 3(entryFilerCode) + 2(filler) + 8(entryNumber) + 1(filler) + 2(entryTypeCode) + 12(importerOfRecord) + 4(carrierCode) + 20(vesselName) + 5(voyageFlightTrip) + 6(estimatedDateOfArrival) + 1(splitShipmentCode) + 1(correctionResponseIndicator) + 7(filler) = 80]
 *   4. Record WO60 (Output, Entry Processing Results / Status Disposition, Pages 55-57): Disposition & Release Action Results.
 *      [Pos 1-80: 4(WO60) + 6(dispositionActionDate) + 4(dispositionActionTime) + 2(dispositionActionCode) + 40(narrativeMessage) + 6(releaseDate) + 2(releaseOriginCode) + 6(documentType) + 10(filler) = 80]
 *      NOTE: PDF table lists Document Type position as 65-67, but explicitly states Length 6AN; position math (65-70) matches Filler at 71-80 to equal 80 characters.
 *   5. Record WR1 (Output, Manifest Processing Results / Conveyance, Pages 25-28): Master Conveyance Results.
 *      [Pos 1-80: 2(WR) + 1(1) + 4(districtPort) + 3(entryFilerCode) + 9(entryNumber) + 2(entryTypeCode) + 12(importerOfRecord) + 9(brokerReferenceNumber) + 4(carrierCode) + 20(importingVesselName) + 5(voyageFlightTrip) + 6(dateOfArrival) + 3(filler) = 80]
 *   6. Record WR2 (Output, Manifest Processing Results / Trip & Location, Page 29): Trip & FIRMS Location Results.
 *      [Pos 1-80: 2(WR) + 1(2) + 25(tripNumber) + 48(filler) + 4(firmsCode) = 80]
 *
 * Explicitly DEFERRED (20 Conditional / Narrowly Scoped / Mode-Specific Records):
 *   1. Record WO20 (Output, Pages 48-49): Reference Data (CR filer ref number, RRN rail ref, RSN rejection reasons, CMT comments). [Note: PDF labels header as WO20 Input in table, but WO20 Output in section title].
 *   2. Record WO30 (Output, Page 50): Country of Origin and HTS Tariff Numbers (Line item detail).
 *   3. Record WO40 (Output, Page 51): In-bond Number and Bill Quantities (Bill level detail on entry).
 *   4. Record WO42 (Output, Page 52): In-bond Departure and Arrival Ports (In-bond movement detail on entry).
 *   5. Record WO50 (Output, Pages 53-54): Bill Match Disposition Data & Arrival Port (Bill matching output).
 *   6. Record WO70 (Output, Pages 58-61): PGA/OGA Disposition Header & Line Status.
 *   7. Record WO71 (Output, Pages 62-63): Additional PGA/OGA Dispositions & Rejection Reasons.
 *   8. Record WO72 (Output, Page 64): PGA Comments to Trade.
 *   9. Record WR3 (Output, Page 30): Country of Origin and Tariff Number (Manifest query tariff results).
 *  10. Record WS4 (Output, Page 31): In-bond Query Results (With in-bond level updates).
 *  11. Record WR4 (Output, Pages 32-33): Master, House, and Sub-House Bill & In-bond Numbers.
 *  12. Record WS5 (Output, Pages 34-35): In-bond Query Results (No in-bond level updates).
 *  13. Record WR5 (Output, Pages 41-42): Ocean/Rail/Truck Master Transaction Disposition Action & In-bond Status.
 *  14. Record WSC (Output, Pages 36-38): Air Carrier Flight, Split Indicator, Quantity & Air In-bond Status.
 *  15. Record WSD (Output, Pages 39-40): Air Waybill Transaction Disposition Action & Narrative.
 *  16. Record WSA (Output, Page 23): In-bond & Ocean/Rail/Truck Bill Error Output.
 *  17. Record WSB (Output, Page 24): Air Waybill Error Output.
 *  18. Record WN0 (Output, Page 43): Amended Bill of Lading Quantities (Master & House).
 *  19. Record WN1 (Output, Pages 44-45): Conveyance Arrival, Destination, Diversion, Load Ports & Dates.
 *  20. Record WO20 (Input, Page 48): SE Submission Reference Data (defined in Cargo Release, not used in CQ query input).
 */

import { describe, it, expect } from "vitest";

export interface FieldSpec {
  name: string;
  class: string;
  start: number;
  end: number;
  width: number;
  designation: "M" | "C" | "O";
  note?: string;
  discrepancyNote?: string;
}

export interface RecordSpec {
  recordId: string;
  name: string;
  context: "Input" | "Output";
  appId: "CQ" | "C1";
  pageCitation: string;
  totalLength: number;
  fields: FieldSpec[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RECORD WR1 (INPUT): MANDATORY CARGO MANIFEST QUERY REQUEST (Pages 14-15)
// ─────────────────────────────────────────────────────────────────────────────
export const RECORD_WR1_INPUT_SPEC: RecordSpec = {
  recordId: "WR1",
  name: "Cargo Manifest Query Request Record (Input)",
  context: "Input",
  appId: "CQ",
  pageCitation: "Pages 14-15",
  totalLength: 80,
  fields: [
    { name: "Control Identifier", class: "2A", start: 1, end: 2, width: 2, designation: "M" },
    { name: "Record Type", class: "1N", start: 3, end: 3, width: 1, designation: "M" },
    { name: "Filler", class: "4AN", start: 4, end: 7, width: 4, designation: "M" },
    { name: "Entry Filer Code", class: "3AN", start: 8, end: 10, width: 3, designation: "C", note: "1" },
    { name: "Entry Number", class: "9AN", start: 11, end: 19, width: 9, designation: "C", note: "1" },
    { name: "In-bond Number", class: "12AN", start: 20, end: 31, width: 12, designation: "C", note: "1,2" },
    { name: "Issuer Code of Bill of Lading Number", class: "4AN", start: 32, end: 35, width: 4, designation: "C", note: "1,4" },
    { name: "Bill of Lading Number", class: "12AN", start: 36, end: 47, width: 12, designation: "C", note: "1,4" },
    { name: "Air Waybill Number", class: "11AN", start: 48, end: 58, width: 11, designation: "C", note: "1" },
    { name: "House Air Waybill Number", class: "12AN", start: 59, end: 70, width: 12, designation: "O", note: "1" },
    { name: "Request for Related BOL Indicator", class: "1AN", start: 71, end: 71, width: 1, designation: "O", note: "3" },
    { name: "Request for Bill of lading and Entry data indicator", class: "1AN", start: 72, end: 72, width: 1, designation: "O", note: "1" },
    { name: "Limit Output Option", class: "1AN", start: 73, end: 73, width: 1, designation: "O", note: "5" },
    { name: "Filler", class: "7AN", start: 74, end: 80, width: 7, designation: "M" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. RECORD WR0 (OUTPUT): ENTRY QUERY ERROR OUTPUT RECORD (Page 22)
// ─────────────────────────────────────────────────────────────────────────────
export const RECORD_WR0_OUTPUT_SPEC: RecordSpec = {
  recordId: "WR0",
  name: "Cargo Manifest Query Entry Error Record (Output)",
  context: "Output",
  appId: "C1",
  pageCitation: "Page 22",
  totalLength: 80,
  fields: [
    { name: "Control Identifier", class: "2A", start: 1, end: 2, width: 2, designation: "M" },
    { name: "Record Type", class: "1N", start: 3, end: 3, width: 1, designation: "M" },
    { name: "Entry Filer Code", class: "3AN", start: 4, end: 6, width: 3, designation: "M" },
    { name: "Entry Number", class: "9AN", start: 7, end: 15, width: 9, designation: "M" },
    { name: "Filler", class: "14AN", start: 16, end: 29, width: 14, designation: "M" },
    { name: "Error Message Identifier", class: "3AN", start: 30, end: 32, width: 3, designation: "M", note: "1" },
    { name: "Narrative Message", class: "40X", start: 33, end: 72, width: 40, designation: "M", note: "1" },
    { name: "Filler", class: "8AN", start: 73, end: 80, width: 8, designation: "M" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. RECORD WO10 (OUTPUT): CARGO RELEASE ENTRY HEADER (Pages 46-47)
// ─────────────────────────────────────────────────────────────────────────────
export const RECORD_WO10_OUTPUT_SPEC: RecordSpec = {
  recordId: "WO10",
  name: "Cargo Release Processing Results Entry Header (Output)",
  context: "Output",
  appId: "C1",
  pageCitation: "Pages 46-47",
  totalLength: 80,
  fields: [
    { name: "Control Identifier", class: "4AN", start: 1, end: 4, width: 4, designation: "M" },
    { name: "District/Port of Entry", class: "4N", start: 5, end: 8, width: 4, designation: "C" },
    { name: "Entry Filer Code", class: "3AN", start: 9, end: 11, width: 3, designation: "M" },
    { name: "Filler", class: "2X", start: 12, end: 13, width: 2, designation: "M" },
    { name: "Entry Number", class: "8AN", start: 14, end: 21, width: 8, designation: "M" },
    { name: "Filler", class: "1X", start: 22, end: 22, width: 1, designation: "M" },
    { name: "Entry Type Code", class: "2N", start: 23, end: 24, width: 2, designation: "M" },
    { name: "Importer of Record Number", class: "12X", start: 25, end: 36, width: 12, designation: "M", note: "1" },
    { name: "Carrier Code", class: "4AN", start: 37, end: 40, width: 4, designation: "C" },
    { name: "Vessel Name", class: "20AN", start: 41, end: 60, width: 20, designation: "C" },
    { name: "Voyage/Flight/Trip Manifest Number", class: "5X", start: 61, end: 65, width: 5, designation: "C", note: "2" },
    { name: "Estimated Date of Arrival", class: "6N", start: 66, end: 71, width: 6, designation: "C" },
    { name: "Split Shipment Release Code", class: "1AN", start: 72, end: 72, width: 1, designation: "O" },
    { name: "Correction Response Indicator", class: "1X", start: 73, end: 73, width: 1, designation: "C" },
    { name: "Filler", class: "7X", start: 74, end: 80, width: 7, designation: "M" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. RECORD WO60 (OUTPUT): CARGO RELEASE PROCESSING RESULTS (Pages 55-57)
// ─────────────────────────────────────────────────────────────────────────────
export const RECORD_WO60_OUTPUT_SPEC: RecordSpec = {
  recordId: "WO60",
  name: "Cargo Release Processing Results Disposition (Output)",
  context: "Output",
  appId: "C1",
  pageCitation: "Pages 55-57",
  totalLength: 80,
  fields: [
    { name: "Control Identifier", class: "4AN", start: 1, end: 4, width: 4, designation: "M" },
    { name: "Disposition Action Date", class: "6N", start: 5, end: 10, width: 6, designation: "M" },
    { name: "Disposition Action Time", class: "4N", start: 11, end: 14, width: 4, designation: "M" },
    { name: "Disposition Action Code", class: "2AN", start: 15, end: 16, width: 2, designation: "M", note: "1" },
    { name: "Narrative Message", class: "40X", start: 17, end: 56, width: 40, designation: "M", note: "1" },
    { name: "Release Date", class: "6N", start: 57, end: 62, width: 6, designation: "C" },
    { name: "Release Origin Code", class: "2N", start: 63, end: 64, width: 2, designation: "C", note: "2" },
    {
      name: "Document Type",
      class: "6AN",
      start: 65,
      end: 70,
      width: 6,
      designation: "C",
      note: "3",
      discrepancyNote: "PDF table text lists position range as 65-67, but explicitly specifies Length 6AN. The position range 65-70 (width 6) aligns with Filler at 71-80 (width 10) to total 80 characters.",
    },
    { name: "Filler", class: "10AN", start: 71, end: 80, width: 10, designation: "M" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. RECORD WR1 (OUTPUT): CARGO MANIFEST QUERY RESULTS CONVEYANCE (Pages 25-28)
// ─────────────────────────────────────────────────────────────────────────────
export const RECORD_WR1_OUTPUT_SPEC: RecordSpec = {
  recordId: "WR1",
  name: "Cargo Manifest Query Processing Results Conveyance (Output)",
  context: "Output",
  appId: "C1",
  pageCitation: "Pages 25-28",
  totalLength: 80,
  fields: [
    { name: "Control Identifier", class: "2A", start: 1, end: 2, width: 2, designation: "M" },
    { name: "Record Type", class: "1N", start: 3, end: 3, width: 1, designation: "M" },
    { name: "District/Port of Entry", class: "4N", start: 4, end: 7, width: 4, designation: "C" },
    { name: "Entry Filer Code", class: "3AN", start: 8, end: 10, width: 3, designation: "C", note: "1" },
    { name: "Entry Number", class: "9AN", start: 11, end: 19, width: 9, designation: "C", note: "1" },
    { name: "Entry Type Code", class: "2N", start: 20, end: 21, width: 2, designation: "C", note: "1" },
    { name: "Importer of Record Number", class: "12X", start: 22, end: 33, width: 12, designation: "C", note: "1,2" },
    { name: "Broker Reference Number", class: "9X", start: 34, end: 42, width: 9, designation: "C", note: "1" },
    { name: "Carrier Code", class: "4AN", start: 43, end: 46, width: 4, designation: "C", note: "3,4" },
    { name: "Importing Vessel Code or Importing Conveyance Name", class: "20AN", start: 47, end: 66, width: 20, designation: "C" },
    { name: "Voyage/Flight/Trip Manifest Number", class: "5X", start: 67, end: 71, width: 5, designation: "M", note: "4,5" },
    { name: "Date of Arrival", class: "6N", start: 72, end: 77, width: 6, designation: "M", note: "5" },
    { name: "Filler", class: "3X", start: 78, end: 80, width: 3, designation: "M" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. RECORD WR2 (OUTPUT): CARGO MANIFEST QUERY RESULTS TRIP & FIRMS (Page 29)
// ─────────────────────────────────────────────────────────────────────────────
export const RECORD_WR2_OUTPUT_SPEC: RecordSpec = {
  recordId: "WR2",
  name: "Cargo Manifest Query Processing Results Trip & FIRMS (Output)",
  context: "Output",
  appId: "C1",
  pageCitation: "Page 29",
  totalLength: 80,
  fields: [
    { name: "Control Identifier", class: "2A", start: 1, end: 2, width: 2, designation: "M" },
    { name: "Record Type", class: "1N", start: 3, end: 3, width: 1, designation: "M" },
    { name: "Trip Number", class: "25AN", start: 4, end: 28, width: 25, designation: "M" },
    { name: "Filler", class: "48X", start: 29, end: 76, width: 48, designation: "M" },
    { name: "FIRMS", class: "4AN", start: 77, end: 80, width: 4, designation: "M" },
  ],
};

export const CORE_QUERY_SPECS: RecordSpec[] = [
  RECORD_WR1_INPUT_SPEC,
  RECORD_WR0_OUTPUT_SPEC,
  RECORD_WO10_OUTPUT_SPEC,
  RECORD_WO60_OUTPUT_SPEC,
  RECORD_WR1_OUTPUT_SPEC,
  RECORD_WR2_OUTPUT_SPEC,
];

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE: SPECIFICATION VERIFICATION & MATH TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("CATAIR Cargo Manifest / Entry Status Query Specification Tests", () => {
  CORE_QUERY_SPECS.forEach((spec) => {
    describe(`Record ${spec.recordId} (${spec.context}) - ${spec.name}`, () => {
      it("should sum to exactly 80 characters total length", () => {
        const sumWidths = spec.fields.reduce((acc, field) => acc + field.width, 0);
        expect(sumWidths).toBe(80);
        expect(spec.totalLength).toBe(80);
      });

      it("should have contiguous field positions from 1 to 80 without gaps or overlaps", () => {
        let expectedStart = 1;
        spec.fields.forEach((field) => {
          expect(field.start).toBe(expectedStart);
          expect(field.end - field.start + 1).toBe(field.width);
          expectedStart = field.end + 1;
        });
        expect(expectedStart - 1).toBe(80);
      });

      it("should have class length matching the calculated field width", () => {
        spec.fields.forEach((field) => {
          // Extract leading numbers from class string (e.g., '12AN' -> 12, '1N' -> 1, '50X' -> 50)
          const match = field.class.match(/^(\d+)/);
          if (match) {
            const classLength = parseInt(match[1], 10);
            expect(classLength).toBe(field.width);
          }
        });
      });
    });
  });

  describe("Specific Field Discrepancies & Date Conventions", () => {
    it("should document WO60 Document Type position label discrepancy (65-67 vs 65-70 for 6AN)", () => {
      const docTypeField = RECORD_WO60_OUTPUT_SPEC.fields.find((f) => f.name === "Document Type");
      expect(docTypeField).toBeDefined();
      expect(docTypeField?.class).toBe("6AN");
      expect(docTypeField?.width).toBe(6);
      expect(docTypeField?.start).toBe(65);
      expect(docTypeField?.end).toBe(70);
      expect(docTypeField?.discrepancyNote).toContain("65-67");
    });

    it("should verify all date fields in core query records use 6N MMDDYY numeric format", () => {
      const dateFields = [
        { spec: RECORD_WO10_OUTPUT_SPEC, name: "Estimated Date of Arrival", pos: "66-71" },
        { spec: RECORD_WO60_OUTPUT_SPEC, name: "Disposition Action Date", pos: "5-10" },
        { spec: RECORD_WO60_OUTPUT_SPEC, name: "Release Date", pos: "57-62" },
        { spec: RECORD_WR1_OUTPUT_SPEC, name: "Date of Arrival", pos: "72-77" },
      ];

      dateFields.forEach(({ spec, name, pos }) => {
        const field = spec.fields.find((f) => f.name === name);
        expect(field).toBeDefined();
        expect(field?.class).toBe("6N");
        expect(field?.width).toBe(6);
      });
    });

    it("should distinguish WR1 Input (Pos 8-10 Filer, 11-19 Entry) from WR1 Output (Pos 4-7 Port, 8-10 Filer)", () => {
      const inputFiler = RECORD_WR1_INPUT_SPEC.fields.find((f) => f.name === "Entry Filer Code");
      const inputEntry = RECORD_WR1_INPUT_SPEC.fields.find((f) => f.name === "Entry Number");
      expect(inputFiler?.start).toBe(8);
      expect(inputFiler?.end).toBe(10);
      expect(inputEntry?.start).toBe(11);
      expect(inputEntry?.end).toBe(19);

      const outputPort = RECORD_WR1_OUTPUT_SPEC.fields.find((f) => f.name === "District/Port of Entry");
      const outputFiler = RECORD_WR1_OUTPUT_SPEC.fields.find((f) => f.name === "Entry Filer Code");
      expect(outputPort?.start).toBe(4);
      expect(outputPort?.end).toBe(7);
      expect(outputFiler?.start).toBe(8);
      expect(outputFiler?.end).toBe(10);
    });

    it("should verify WO10 Entry Number structure uses 3AN Filer + 2X Filler + 8AN Entry Number", () => {
      const filer = RECORD_WO10_OUTPUT_SPEC.fields.find((f) => f.name === "Entry Filer Code");
      const filler12 = RECORD_WO10_OUTPUT_SPEC.fields.find((f) => f.start === 12);
      const entryNum = RECORD_WO10_OUTPUT_SPEC.fields.find((f) => f.name === "Entry Number");

      expect(filer?.start).toBe(9);
      expect(filer?.end).toBe(11);
      expect(filer?.width).toBe(3);

      expect(filler12?.start).toBe(12);
      expect(filler12?.end).toBe(13);
      expect(filler12?.width).toBe(2);

      expect(entryNum?.start).toBe(14);
      expect(entryNum?.end).toBe(21);
      expect(entryNum?.width).toBe(8);
    });
  });
});
