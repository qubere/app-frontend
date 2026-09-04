/**
 * CATAIR ACE Broker Download (Chapter 9 / BD & NS Applications) Specification Tests
 * Source PDF: docs/plans/catair-source-docs/09-broker-download-draft.pdf (August 2024 DRAFT)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CATAIR ACE BROKER DOWNLOAD TRANSACTION SCOPE NOTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Scoped IN (10 Core Mandatory Backbone Output Records):
 *   1. Record 1M (Output, Mandatory, Pages 13-14): Manifest Header Record.
 *      [Pos 1-80: 2(1M) + 4(carrierCode) + 2(transportationIndicator) + 2(countryCode) + 23(conveyanceName) + 5(tripData) + 5(filler) + 6(manifestSequenceNumber) + 1(filler) + 7(vesselCode) + 1(manifestTypeCode) + 22(filler) = 80]
 *   2. Record 1P (Output, Mandatory, Page 16): Port of Crossing Record.
 *      [Pos 1-80: 2(1P) + 4(portOfUnlading) + 6(originalScheduledArrivalDate) + 5(filler) + 4(firmsCode) + 4(time) + 55(filler) = 80]
 *   3. Record 1J (Output, Mandatory, Page 17): Issuer Code Record.
 *      [Pos 1-80: 2(1J) + 4(issuerCode) + 74(filler) = 80]
 *   4. Record 1B (Output, Mandatory, Pages 20-21): Bill of Lading Transaction Record.
 *      [Pos 1-80: 2(1B) + 12(billOfLading) + 5(foreignPortOfLading) + 10(manifestQuantity) + 5(manifestUnits) + 10(weight) + 2(weightUnit) + 1(billStatusIndicator) + 1(masterInBondIndicator) + 12(houseBillNumber) + 2(inBondEntryType) + 4(inBondPortOfDestination) + 4(issuerCode) + 10(filler) = 80]
 *   5. Record 0N (Output, Mandatory, Pages 28-29): Entity Name Record.
 *      [Pos 1-80: 2(0N) + 3(entityIdCode) + 35(name) + 2(codeQualifier) + 17(idCode) + 2(entityRelationshipCode) + 2(entityIdCodeReserved) + 17(filler) = 80]
 *      NOTE: PDF table lists Filler label as "78AN", but position math (64-80) equals exactly 17 characters.
 *   6. Record 1C (Output, Mandatory, Pages 37-38): Bill of Lading Container Record.
 *      [Pos 1-80: 2(1C) + 4(equipmentInitial) + 10(equipmentNumber) + 15(sealNumber1) + 15(sealNumber2) + 2(containerDescriptionCode) + 5(containerLength) + 8(height) + 8(width) + 4(containerType) + 1(loadEmptyStatus) + 2(typeOfService) + 4(filler) = 80]
 *   7. Record 1D (Output, Mandatory, Page 41): Bill Cargo Description Record.
 *      [Pos 1-80: 2(1D) + 10(pieceCount) + 45(description) + 14(c4Number) + 3(manifestUnitCode) + 2(countryCode) + 4(filler) = 80]
 *   8. Record 2D (Output, Mandatory in Map, Page 42): Marks and Numbers Record.
 *      [Pos 1-80: 2(2D) + 45(marksAndNumbers) + 33(filler) = 80]
 *   9. Record NS05 (Output, Header for Broker Download Status Notifications, Page 46): Conveyance Information Header.
 *      [Pos 1-80: 2(05) + 23(importingConveyanceName) + 5(tripNumber) + 4(port) + 6(estimatedArrivalDate) + 6(estimatedArrivalTime) + 34(filler) = 80]
 *  10. Record NS30 (Output, Mandatory in Status Notification Grouping, Pages 47-48): Status Notification Detail Record.
 *      [Pos 1-80: 2(30) + 2(dispositionCode) + 4(issuerCodeMasterBill) + 12(masterBillNumber) + 4(issuerCodeHouseBill) + 12(houseBillNumber) + 4(issuerCodeSubHouseBill) + 12(subHouseBillNumber) + 10(quantity) + 1(negativeIndicator) + 6(actionDate) + 4(actionTime) + 4(inBondCarrierCode) + 3(filler) = 80]
 *
 * Explicitly DEFERRED (17 Conditional / Optional / Mode-Specific / Overflow Records):
 *   - BD Application Grouping:
 *     1. Record 2M (Conditional, Page 15): Manifest Reference Identifier (Rail Carrier-Assigned Batch Number).
 *     2. Record 1A (Conditional, Pages 18-19): Bill of Lading Amendment Record (Add/Delete/Replace).
 *     3. Record 2B (Conditional, Page 25): Bill of Lading Additional / Pre-Carrier Receipt Record.
 *     4. Record 4B (Conditional, Page 26): Bill of Lading Reference Identifier Record (Overflow reference codes, max 999).
 *     5. Record 2N (Conditional, Page 30): Entity Address Line 1 & Line 2 Record.
 *     6. Record 3N (Optional, Page 31): Entity Geographic Area / City / State / Zip Record.
 *     7. Record 4N (Optional, Page 33): Administrative Communication Contact Record.
 *     8. Record 1I (Conditional, Pages 34-35): Supplemental In-Bond Details Record.
 *     9. Record 2I (Conditional, Page 36): Water-Borne Export In-Bond Record (Rail only).
 *    10. Record 2C (Conditional, Page 39): Motor Vehicle Control (VIN) Container Record.
 *    11. Record 0D (Conditional, Page 40): Harmonized Tariff / HTS Classification Record.
 *    12. Record 1V (Conditional, Page 43): Primary Hazardous Material Record.
 *    13. Record 2V (Conditional, Page 44): Hazardous Material Flashpoint Record (Rail only).
 *    14. Record 3V (Conditional, Page 45): Additional Hazardous Material Description Record.
 *   - NS Application Grouping:
 *    15. Record NS40 (Conditional, Page 49): Status Notification Detail Continuation Record (Entry Number & FIRMS).
 *    16. Record NS50 (Conditional, Page 50): Status Notification Remarks Record (Hold narrative).
 *    17. Record NS60 (Conditional, Page 51): Container Status Notification Record.
 */

import { describe, it, expect } from "vitest";

// Interface defining field specification shape
export interface FieldSpec {
  name: string;
  class: string;
  start: number;
  end: number;
  width: number;
  desig: "M" | "C" | "O";
  notes?: string;
}

export interface RecordSpec {
  recordId: string;
  name: string;
  designation: "M" | "C" | "O";
  pdfPages: string;
  fields: FieldSpec[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE BACKBONE RECORD SPECIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const RECORD_1M_SPEC: RecordSpec = {
  recordId: "1M",
  name: "Manifest Header",
  designation: "M",
  pdfPages: "BD-12 - BD-13 (Pages 13-14)",
  fields: [
    { name: "Control Identifier", class: "2AN", start: 1, end: 2, width: 2, desig: "M", notes: "Must equal '1M'" },
    { name: "Carrier Code", class: "4AN", start: 3, end: 6, width: 4, desig: "M", notes: "SCAC of importing carrier" },
    { name: "Transportation Indicator", class: "2N", start: 7, end: 8, width: 2, desig: "M", notes: "10=Vessel Non-Cont, 11=Vessel Cont, 20=Rail Non-Cont, 21=Rail Cont, 30=Land Non-Cont" },
    { name: "Country Code of Importing Conveyance", class: "2A", start: 9, end: 10, width: 2, desig: "C", notes: "Mandatory in Ocean/Rail; Not used in Truck" },
    { name: "Importing Conveyance Name", class: "23X", start: 11, end: 33, width: 23, desig: "C", notes: "Trip number in Truck ('SYSTEM' if preliminary unknown)" },
    { name: "Trip Data", class: "5X", start: 34, end: 38, width: 5, desig: "O", notes: "Rail: Julian YYDDD; Ocean: Voyage number" },
    { name: "Filler", class: "5AN", start: 39, end: 43, width: 5, desig: "M", notes: "Space fill" },
    { name: "Manifest Sequence Number", class: "6N", start: 44, end: 49, width: 6, desig: "O", notes: "Rail and Ocean only; default 000001" },
    { name: "Filler", class: "1AN", start: 50, end: 50, width: 1, desig: "M", notes: "Space fill" },
    { name: "Vessel Code", class: "7AN", start: 51, end: 57, width: 7, desig: "C", notes: "IMO code (Ocean)" },
    { name: "Manifest Type Code", class: "1A", start: 58, end: 58, width: 1, desig: "M", notes: "P=Preliminary, Y=Amendment, T=In-transit, W=Complete" },
    { name: "Filler", class: "22AN", start: 59, end: 80, width: 22, desig: "M", notes: "Space fill" },
  ],
};

export const RECORD_1P_SPEC: RecordSpec = {
  recordId: "1P",
  name: "Port of Crossing",
  designation: "M",
  pdfPages: "BD-15 (Page 16)",
  fields: [
    { name: "Control Identifier", class: "2AN", start: 1, end: 2, width: 2, desig: "M", notes: "Must equal '1P'" },
    { name: "Port of Unlading", class: "4N", start: 3, end: 6, width: 4, desig: "M", notes: "Schedule D port code" },
    { name: "Original Scheduled Date of Arrival", class: "6N", start: 7, end: 12, width: 6, desig: "M", notes: "MMDDYY format" },
    { name: "Filler", class: "5AN", start: 13, end: 17, width: 5, desig: "M", notes: "Space fill" },
    { name: "FIRMS Code", class: "4AN", start: 18, end: 21, width: 4, desig: "O", notes: "Rail only" },
    { name: "Time", class: "4AN", start: 22, end: 25, width: 4, desig: "C", notes: "HHMM format (Rail & Truck)" },
    { name: "Filler", class: "55AN", start: 26, end: 80, width: 55, desig: "M", notes: "Space fill" },
  ],
};

export const RECORD_1J_SPEC: RecordSpec = {
  recordId: "1J",
  name: "Issuer Code",
  designation: "M",
  pdfPages: "BD-16 (Page 17)",
  fields: [
    { name: "Control Identifier", class: "2AN", start: 1, end: 2, width: 2, desig: "M", notes: "Must equal '1J'" },
    { name: "Issuer Code", class: "4AN", start: 3, end: 6, width: 4, desig: "M", notes: "SCAC of party issuing master bill / SCN" },
    { name: "Filler", class: "74AN", start: 7, end: 80, width: 74, desig: "M", notes: "Space fill" },
  ],
};

export const RECORD_1B_SPEC: RecordSpec = {
  recordId: "1B",
  name: "Bill of Lading Transaction",
  designation: "M",
  pdfPages: "BD-19 - BD-20 (Pages 20-21)",
  fields: [
    { name: "Control Identifier", class: "2AN", start: 1, end: 2, width: 2, desig: "M", notes: "Must equal '1B'" },
    { name: "Bill of Lading", class: "12X", start: 3, end: 14, width: 12, desig: "M", notes: "Master bill number / SCN" },
    { name: "Foreign Port of Lading", class: "5N", start: 15, end: 19, width: 5, desig: "M", notes: "Schedule K code" },
    { name: "Manifest Quantity", class: "10N", start: 20, end: 29, width: 10, desig: "C", notes: "Rail/Ocean required, whole number" },
    { name: "Manifest Units", class: "5X", start: 30, end: 34, width: 5, desig: "C", notes: "Rail/Ocean required" },
    { name: "Weight", class: "10N", start: 35, end: 44, width: 10, desig: "C", notes: "Gross weight in whole numbers, no decimals" },
    { name: "Weight Unit", class: "2A", start: 45, end: 46, width: 2, desig: "C", notes: "LB, KG, LT, ST, ET, MT" },
    { name: "Bill of Lading Status Indicator / Type Code", class: "1X", start: 47, end: 47, width: 1, desig: "C", notes: "Bill type (0, 2-9, B, I, J, K, M, N, O, P, R, S, T, U)" },
    { name: "Master In-Bond Indicator", class: "1X", start: 48, end: 48, width: 1, desig: "C", notes: "0/space=Not MIB, 1=MIB (Rail/Ocean)" },
    { name: "House Bill Number", class: "12X", start: 49, end: 60, width: 12, desig: "C", notes: "Truck & Ocean house bill" },
    { name: "In-Bond Entry Type", class: "2N", start: 61, end: 62, width: 2, desig: "C", notes: "61, 62, 63, 69, 70" },
    { name: "In-Bond Port of Destination", class: "4N", start: 63, end: 66, width: 4, desig: "M", notes: "Schedule D port code" },
    { name: "Issuer Code", class: "4AN", start: 67, end: 70, width: 4, desig: "C", notes: "SCAC of house bill issuer" },
    { name: "Filler", class: "10AN", start: 71, end: 80, width: 10, desig: "M", notes: "Space fill" },
  ],
};

export const RECORD_0N_SPEC: RecordSpec = {
  recordId: "0N",
  name: "Entity Name",
  designation: "M",
  pdfPages: "BD-27 - BD-28 (Pages 28-29)",
  fields: [
    { name: "Control Identifier", class: "2A", start: 1, end: 2, width: 2, desig: "M", notes: "Must equal '0N'" },
    { name: "Entity ID Code", class: "3AN", start: 3, end: 5, width: 3, desig: "C", notes: "BN, C1, CB, CD, CN, IM, N1, N2, OO, PF, SF, SH, UC, SNP" },
    { name: "Name", class: "35AN", start: 6, end: 40, width: 35, desig: "C", notes: "Entity name" },
    { name: "Code Qualifier", class: "2AN", start: 41, end: 42, width: 2, desig: "C", notes: "2=SCAC, 17=ABI Routing Code" },
    { name: "ID Code", class: "17AN", start: 43, end: 59, width: 17, desig: "C", notes: "SCAC/FIRMS or ABI routing code" },
    { name: "Entity Relationship Code", class: "2AN", start: 60, end: 61, width: 2, desig: "O", notes: "Reserved for future use" },
    { name: "Entity ID Code (Reserved)", class: "2AN", start: 62, end: 63, width: 2, desig: "O", notes: "Reserved for future use" },
    { name: "Filler", class: "17AN", start: 64, end: 80, width: 17, desig: "M", notes: "Space fill (PDF label says 78AN, position width is 17)" },
  ],
};

export const RECORD_1C_SPEC: RecordSpec = {
  recordId: "1C",
  name: "Bill of Lading Container",
  designation: "M",
  pdfPages: "BD-36 - BD-37 (Pages 37-38)",
  fields: [
    { name: "Control Identifier", class: "2AN", start: 1, end: 2, width: 2, desig: "M", notes: "Must equal '1C'" },
    { name: "Equipment Initial", class: "4AN", start: 3, end: 6, width: 4, desig: "O", notes: "Equipment prefix" },
    { name: "Equipment Number", class: "10AN", start: 7, end: 16, width: 10, desig: "M", notes: "Equipment serial number ('No number' in Truck if unknown)" },
    { name: "Seal Number 1", class: "15AN", start: 17, end: 31, width: 15, desig: "C", notes: "Seal number" },
    { name: "Seal Number 2", class: "15AN", start: 32, end: 46, width: 15, desig: "C", notes: "Seal number" },
    { name: "Container/Equipment Description Code", class: "2AN", start: 47, end: 48, width: 2, desig: "C", notes: "See Ocean App B ('NC' if none)" },
    { name: "Container/Equipment Length", class: "5N", start: 49, end: 53, width: 5, desig: "O", notes: "FFFII format (Ocean only)" },
    { name: "Height", class: "8X", start: 54, end: 61, width: 8, desig: "O", notes: "FFFFFFII format (Ocean only)" },
    { name: "Width", class: "8X", start: 62, end: 69, width: 8, desig: "O", notes: "FFFFFFII format (Ocean only)" },
    { name: "Container/Equipment Type", class: "4AN", start: 70, end: 73, width: 4, desig: "O", notes: "Ocean App M (Ocean only)" },
    { name: "Load/Empty Status Code", class: "1A", start: 74, end: 74, width: 1, desig: "O", notes: "E/L for Rail/Ocean; C/I/A/B for Truck" },
    { name: "Type of Service", class: "2AN", start: 75, end: 76, width: 2, desig: "O", notes: "BB, CS, CY, HH, HL, HP, MD, NC, PH, PP, RR (Ocean only)" },
    { name: "Filler", class: "4AN", start: 77, end: 80, width: 4, desig: "M", notes: "Space fill" },
  ],
};

export const RECORD_1D_SPEC: RecordSpec = {
  recordId: "1D",
  name: "Bill Cargo Description",
  designation: "M",
  pdfPages: "BD-40 (Page 41)",
  fields: [
    { name: "Control Identifier", class: "2AN", start: 1, end: 2, width: 2, desig: "M", notes: "Must equal '1D'" },
    { name: "Piece Count", class: "10N", start: 3, end: 12, width: 10, desig: "C", notes: "Smallest exterior package units" },
    { name: "Description", class: "45X", start: 13, end: 57, width: 45, desig: "M", notes: "Cargo description" },
    { name: "C4 Number", class: "14AN", start: 58, end: 71, width: 14, desig: "O", notes: "CBP C4 line release number (Rail & Truck)" },
    { name: "Manifest Unit Code", class: "3AN", start: 72, end: 74, width: 3, desig: "O", notes: "Manifest UOM" },
    { name: "Country Code", class: "2AN", start: 75, end: 76, width: 2, desig: "O", notes: "ISO country code of origin (Rail & Truck)" },
    { name: "Filler", class: "4AN", start: 77, end: 80, width: 4, desig: "M", notes: "Space fill" },
  ],
};

export const RECORD_2D_SPEC: RecordSpec = {
  recordId: "2D",
  name: "Marks and Numbers",
  designation: "M",
  pdfPages: "BD-41 (Page 42)",
  fields: [
    { name: "Control Identifier", class: "2AN", start: 1, end: 2, width: 2, desig: "M", notes: "Must equal '2D'" },
    { name: "Marks and Numbers", class: "45AN", start: 3, end: 47, width: 45, desig: "C", notes: "Marks text ('No Marks or Numbers' if none)" },
    { name: "Filler", class: "33AN", start: 48, end: 80, width: 33, desig: "M", notes: "Space fill" },
  ],
};

export const RECORD_NS05_SPEC: RecordSpec = {
  recordId: "NS05",
  name: "Status Notification Header - Conveyance Information",
  designation: "C",
  pdfPages: "BD-45 (Page 46)",
  fields: [
    { name: "Record Type", class: "2AN", start: 1, end: 2, width: 2, desig: "M", notes: "Must equal '05'" },
    { name: "Importing Conveyance Name", class: "23AN", start: 3, end: 25, width: 23, desig: "O", notes: "Conveyance name" },
    { name: "Trip Number", class: "5X", start: 26, end: 30, width: 5, desig: "O", notes: "Rail: Julian YYDDD; Ocean: Voyage number" },
    { name: "Port", class: "4N", start: 31, end: 34, width: 4, desig: "O", notes: "Schedule D port code" },
    { name: "Estimated Date of Arrival", class: "6N", start: 35, end: 40, width: 6, desig: "O", notes: "YYMMDD format" },
    { name: "Estimated Time of Arrival", class: "6N", start: 41, end: 46, width: 6, desig: "O", notes: "HHMMSS format (Rail only)" },
    { name: "Filler", class: "34AN", start: 47, end: 80, width: 34, desig: "M", notes: "Space fill" },
  ],
};

export const RECORD_NS30_SPEC: RecordSpec = {
  recordId: "NS30",
  name: "Status Notification Detail",
  designation: "M",
  pdfPages: "BD-46 - BD-47 (Pages 47-48)",
  fields: [
    { name: "Record Type", class: "2N", start: 1, end: 2, width: 2, desig: "M", notes: "Must equal '30'" },
    { name: "Disposition Code", class: "2AN", start: 3, end: 4, width: 2, desig: "M", notes: "Posting action disposition code" },
    { name: "Issuer Code of Master Bill Number", class: "4AN", start: 5, end: 8, width: 4, desig: "C", notes: "SCAC (Mandatory for Ocean)" },
    { name: "Master Bill Number", class: "12AN", start: 9, end: 20, width: 12, desig: "M", notes: "Master bill / SCN" },
    { name: "Issuer Code of House Bill Number", class: "4AN", start: 21, end: 24, width: 4, desig: "C", notes: "SCAC (Truck & Ocean)" },
    { name: "House Bill Number", class: "12AN", start: 25, end: 36, width: 12, desig: "C", notes: "House bill number (Truck & Ocean)" },
    { name: "Issuer Code of Sub-house Bill Number", class: "4AN", start: 37, end: 40, width: 4, desig: "C", notes: "Reserved space fill" },
    { name: "Sub-house Bill Number", class: "12AN", start: 41, end: 52, width: 12, desig: "C", notes: "Reserved space fill" },
    { name: "Quantity", class: "10N", start: 53, end: 62, width: 10, desig: "M", notes: "Total piece count affected" },
    { name: "Negative Indicator", class: "1A", start: 63, end: 63, width: 1, desig: "C", notes: "'N' for negative quantity, else space" },
    { name: "Action Date", class: "6N", start: 64, end: 69, width: 6, desig: "M", notes: "YYMMDD format" },
    { name: "Action Time", class: "4N", start: 70, end: 73, width: 4, desig: "M", notes: "HHMM military format" },
    { name: "In-bond Carrier Code", class: "4X", start: 74, end: 77, width: 4, desig: "M", notes: "SCAC or IATA code" },
    { name: "Filler", class: "3AN", start: 78, end: 80, width: 3, desig: "M", notes: "Space fill" },
  ],
};

export const CORE_BACKBONE_SPECS: RecordSpec[] = [
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
];

// List of deferred records with metadata
export const DEFERRED_RECORDS = [
  { id: "2M", name: "Manifest Reference Identifier", page: 15, reason: "Conditional / Rail only carrier-assigned batch number" },
  { id: "1A", name: "Bill of Lading Amendment", page: 18, reason: "Conditional / Amendment Add/Delete transaction" },
  { id: "2B", name: "Bill of Lading Additional", page: 25, reason: "Conditional / Pre-carrier receipt place" },
  { id: "4B", name: "Bill of Lading Reference Identifier", page: 26, reason: "Conditional / Overflow reference qualifier (max 999)" },
  { id: "2N", name: "Entity Address", page: 30, reason: "Conditional / Multi-line address detail" },
  { id: "3N", name: "Entity Geographic Area", page: 31, reason: "Optional / City, State, Zip details" },
  { id: "4N", name: "Administrative Communication Contact", page: 33, reason: "Optional / Phone, Email, Fax contact" },
  { id: "1I", name: "Supplemental In-Bond Details", page: 34, reason: "Conditional / In-bond movement details" },
  { id: "2I", name: "Water-Borne Export In-Bond", page: 36, reason: "Conditional / Rail only export vessel details" },
  { id: "2C", name: "Container Motor Vehicle Control", page: 39, reason: "Conditional / Finished vehicles VIN details" },
  { id: "0D", name: "Harmonized Nomenclature", page: 40, reason: "Conditional / HTS tariff line details" },
  { id: "1V", name: "Primary Hazardous Material", page: 43, reason: "Conditional / HAZMAT details" },
  { id: "2V", name: "Hazardous Material Flashpoint", page: 44, reason: "Conditional / Rail only flashpoint temperature" },
  { id: "3V", name: "Additional Hazardous Material Description", page: 45, reason: "Conditional / HAZMAT overflow descriptions" },
  { id: "NS40", name: "Status Notification Continuation", page: 49, reason: "Conditional / Entry number & FIRMS notification" },
  { id: "NS50", name: "Status Notification Remarks", page: 50, reason: "Conditional / Hold narrative remarks" },
  { id: "NS60", name: "Container Status Notification", page: 51, reason: "Conditional / Container-level hold status" },
];

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("ACE Broker Download (Chapter 9 / BD & NS) Record Specification Audit", () => {

  describe("Core Backbone Records Math & Boundary Validation (1-80 Continuous Coverage)", () => {
    CORE_BACKBONE_SPECS.forEach((spec) => {
      it(`Record ${spec.recordId} (${spec.name}): field positions cover 1-80 continuously with sum = 80`, () => {
        let currentPos = 1;
        let totalWidth = 0;

        spec.fields.forEach((field) => {
          // Check position continuity
          expect(field.start).toBe(currentPos);
          // Check calculated width matches position range
          const calcWidth = field.end - field.start + 1;
          expect(field.width).toBe(calcWidth);
          // Check stated class number matches width (unless known PDF label typo documented)
          const match = field.class.match(/^(\d+)/);
          if (match && !(spec.recordId === "0N" && field.name === "Filler")) {
            expect(parseInt(match[1], 10)).toBe(calcWidth);
          }

          totalWidth += calcWidth;
          currentPos = field.end + 1;
        });

        expect(currentPos - 1).toBe(80);
        expect(totalWidth).toBe(80);
      });
    });
  });

  describe("Specific Field Evidentiary & Anomaly Verification", () => {
    it("Record 0N: Filler label discrepancy is explicitly audited (stated 78AN vs calc 17 pos 64-80)", () => {
      const fillerField = RECORD_0N_SPEC.fields.find((f) => f.name === "Filler");
      expect(fillerField).toBeDefined();
      expect(fillerField?.start).toBe(64);
      expect(fillerField?.end).toBe(80);
      expect(fillerField?.width).toBe(17);
      expect(fillerField?.class).toBe("17AN"); // Corrected math in spec
    });

    it("Record 1P: Date of Arrival uses 6N class N with MMDDYY format (pos 7-12)", () => {
      const dateField = RECORD_1P_SPEC.fields.find((f) => f.name === "Original Scheduled Date of Arrival");
      expect(dateField).toBeDefined();
      expect(dateField?.start).toBe(7);
      expect(dateField?.end).toBe(12);
      expect(dateField?.width).toBe(6);
      expect(dateField?.class).toBe("6N");
      expect(dateField?.notes).toContain("MMDDYY");
    });

    it("Record NS05 & NS30: Date fields use 6N class N with YYMMDD format (pos 35-40 in NS05, pos 64-69 in NS30)", () => {
      const ns05Date = RECORD_NS05_SPEC.fields.find((f) => f.name === "Estimated Date of Arrival");
      expect(ns05Date).toBeDefined();
      expect(ns05Date?.start).toBe(35);
      expect(ns05Date?.end).toBe(40);
      expect(ns05Date?.class).toBe("6N");
      expect(ns05Date?.notes).toContain("YYMMDD");

      const ns30Date = RECORD_NS30_SPEC.fields.find((f) => f.name === "Action Date");
      expect(ns30Date).toBeDefined();
      expect(ns30Date?.start).toBe(64);
      expect(ns30Date?.end).toBe(69);
      expect(ns30Date?.class).toBe("6N");
      expect(ns30Date?.notes).toContain("YYMMDD");
    });

    it("Record 1M & NS05: Trip Data / Number use 5X class X with Julian YYDDD format for Rail", () => {
      const trip1M = RECORD_1M_SPEC.fields.find((f) => f.name === "Trip Data");
      expect(trip1M).toBeDefined();
      expect(trip1M?.start).toBe(34);
      expect(trip1M?.end).toBe(38);
      expect(trip1M?.class).toBe("5X");

      const tripNS05 = RECORD_NS05_SPEC.fields.find((f) => f.name === "Trip Number");
      expect(tripNS05).toBeDefined();
      expect(tripNS05?.start).toBe(26);
      expect(tripNS05?.end).toBe(30);
      expect(tripNS05?.class).toBe("5X");
    });

    it("Numeric & Weight fields explicitly state whole number conventions (1B pos 20-29, 35-44)", () => {
      const qty1B = RECORD_1B_SPEC.fields.find((f) => f.name === "Manifest Quantity");
      expect(qty1B).toBeDefined();
      expect(qty1B?.class).toBe("10N");
      expect(qty1B?.notes).toContain("whole number");

      const wgt1B = RECORD_1B_SPEC.fields.find((f) => f.name === "Weight");
      expect(wgt1B).toBeDefined();
      expect(wgt1B?.class).toBe("10N");
      expect(wgt1B?.notes).toContain("no decimals");
    });
  });

  describe("Deferred Records Registry Audit", () => {
    it("Explicitly catalogs all 17 deferred records with page citations and deferral rationale", () => {
      expect(DEFERRED_RECORDS.length).toBe(17);
      DEFERRED_RECORDS.forEach((rec) => {
        expect(rec.id).toBeDefined();
        expect(rec.name).toBeDefined();
        expect(rec.page).toBeGreaterThan(0);
        expect(rec.reason).toBeDefined();
      });
    });
  });
});
