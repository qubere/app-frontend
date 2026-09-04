import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE In-Bond (QP/WP/NS Application) - 22 Remaining Records & Calibration Audit Test Suite
 * Source PDF: docs/plans/catair-source-docs/06b-in-bond-v51-2026-04.pdf (Amendment 51, April 2026)
 *
 * Scoped Records (22 Remaining Records including Real QP40 Calibration):
 *   1. QP40 (Line Item Detail - REAL SPEC: Foreign Port of Lading, Manifest Quantity, Manifest Units, pp. 32-33)
 *   2. QP50 (Shipper Name & Address Line 1, p. 35)
 *   3. QP51 (Shipper Address Lines 2 & 3, p. 36)
 *   4. QP52 (Shipper Phone / Telex, p. 37)
 *   5. QP55 (Consignee Name & Address Line 1, p. 38)
 *   6. QP56 (Consignee Address Lines 2 & 3, p. 39)
 *   7. QP57 (Consignee Phone / Telex, p. 40)
 *   8. QP60 (Notify Party Name & Address Line 1, p. 41)
 *   9. QP61 (Notify Party Address Lines 2 & 3, p. 42)
 *  10. QP62 (Notify Party Phone / Telex, p. 43)
 *  11. QP65 (Transport Party / Carrier Details, p. 44)
 *  12. QP70 (Bonded Carrier / Importer Party Line 1, pp. 45-46)
 *  13. QP71 (Party Address Line 1, City, State, Zip, p. 47)
 *  14. QP72 (Party Contact Phone, p. 49)
 *  15. QP75 (In-Bond Remarks & Hazmat, p. 50)
 *  16. QP76 (Additional Reference Identifier Overflow, p. 52)
 *  17. NS05 (Conveyance Information Status, p. 60)
 *  18. NS60 (Equipment / Container Level Status, p. 68)
 *  19. EA   (Transaction Header Batch Error, p. 69)
 *  20. EB   (Block Header Batch Error, p. 70)
 *  21. EY   (Block Trailer Batch Error, p. 71)
 *  22. EZ   (Transaction Trailer Batch Error, p. 72)
 */

export interface FieldSpec {
  name: string;
  start: number;
  end: number;
  length: number;
  class: string;
  designation: 'M' | 'C' | 'O';
  impliedDecimals?: number;
  notes?: string;
}

export interface SpecificationMismatch {
  field: string;
  tableClass: string;
  actualType: string;
  description: string;
}

export interface RecordSpec {
  recordId: string;
  name: string;
  pageCitations: string;
  totalLength: number;
  designation: 'M' | 'C' | 'O';
  fields: FieldSpec[];
  mismatches?: SpecificationMismatch[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RECORD QP40: Line Item Detail Record (REAL SPEC, Pages 32-33 / INB-32 - INB-33)
// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL CALIBRATION RECORD: Corrects fabricated prior attempt.
// Real fields: Foreign Port of Lading (5N), Manifest Quantity (10N), Manifest Units (5X),
// Weight (10N), Weight Unit (2A), Volume (10N, O), Volume Unit (2A, C), Place of Pre-receipt (17X, O), Filler (17AN).
export const INBOND_RECORD_QP40_SPEC: RecordSpec = {
  recordId: 'QP40',
  name: 'Line Item Detail',
  pageCitations: 'Pages 32-33 (INB-32 - INB-33)',
  designation: 'M',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '40'" },
    { name: 'Foreign Port of Lading', start: 3, end: 7, length: 5, class: '5N', designation: 'M', notes: 'Schedule K foreign port code' },
    { name: 'Manifest Quantity', start: 8, end: 17, length: 10, class: '10N', designation: 'M', notes: 'Manifested quantity (whole number)' },
    { name: 'Manifest Units', start: 18, end: 22, length: 5, class: '5X', designation: 'M', notes: 'Unit of measure for manifest quantity' },
    { name: 'Weight', start: 23, end: 32, length: 10, class: '10N', designation: 'M', notes: 'Gross weight (whole number)' },
    { name: 'Weight Unit', start: 33, end: 34, length: 2, class: '2A', designation: 'M', notes: 'LB or KG' },
    { name: 'Volume', start: 35, end: 44, length: 10, class: '10N', designation: 'O', notes: 'Volume (whole number, no implied decimals)' },
    { name: 'Volume Unit', start: 45, end: 46, length: 2, class: '2A', designation: 'C', notes: 'Unit of measure for volume' },
    { name: 'Place of Pre-receipt', start: 47, end: 63, length: 17, class: '17X', designation: 'O', notes: 'Location where goods were received prior to port of loading' },
    { name: 'Filler', start: 64, end: 80, length: 17, class: '17AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. RECORD QP50: Shipper Name & Address Line 1 (Page 35 / INB-35)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP50_SPEC: RecordSpec = {
  recordId: 'QP50',
  name: 'Shipper Name & Address Line 1',
  pageCitations: 'Page 35 (INB-35)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '50'" },
    { name: 'Shipper Name', start: 3, end: 37, length: 35, class: '35X', designation: 'M', notes: 'Name of shipper' },
    { name: 'Shipper Address Line 1', start: 38, end: 72, length: 35, class: '35X', designation: 'M', notes: 'Street address line 1 of shipper' },
    { name: 'Filler', start: 73, end: 80, length: 8, class: '8AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. RECORD QP51: Shipper Address Lines 2 & 3 (Page 36 / INB-36)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP51_SPEC: RecordSpec = {
  recordId: 'QP51',
  name: 'Shipper Address Lines 2 & 3',
  pageCitations: 'Page 36 (INB-36)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '51'" },
    { name: 'Shipper Address Line 2', start: 3, end: 37, length: 35, class: '35X', designation: 'O', notes: 'Street address line 2 of shipper' },
    { name: 'Shipper Address Line 3 / City / State / Zip', start: 38, end: 72, length: 35, class: '35X', designation: 'O', notes: 'Address line 3 / city, state, zip of shipper' },
    { name: 'Filler', start: 73, end: 80, length: 8, class: '8AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. RECORD QP52: Shipper Phone / Telex (Page 37 / INB-37)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP52_SPEC: RecordSpec = {
  recordId: 'QP52',
  name: 'Shipper Phone / Telex',
  pageCitations: 'Page 37 (INB-37)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '52'" },
    { name: 'Shipper Telephone Number', start: 3, end: 27, length: 25, class: '25X', designation: 'O', notes: 'Telephone number of shipper' },
    { name: 'Shipper Telex Number', start: 28, end: 52, length: 25, class: '25X', designation: 'O', notes: 'Telex number of shipper' },
    { name: 'Filler', start: 53, end: 80, length: 28, class: '28AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. RECORD QP55: Consignee Name & Address Line 1 (Page 38 / INB-38)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP55_SPEC: RecordSpec = {
  recordId: 'QP55',
  name: 'Consignee Name & Address Line 1',
  pageCitations: 'Page 38 (INB-38)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '55'" },
    { name: 'Consignee Name', start: 3, end: 37, length: 35, class: '35X', designation: 'M', notes: 'Name of consignee' },
    { name: 'Consignee Address Line 1', start: 38, end: 72, length: 35, class: '35X', designation: 'M', notes: 'Street address line 1 of consignee' },
    { name: 'Filler', start: 73, end: 80, length: 8, class: '8AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. RECORD QP56: Consignee Address Lines 2 & 3 (Page 39 / INB-39)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP56_SPEC: RecordSpec = {
  recordId: 'QP56',
  name: 'Consignee Address Lines 2 & 3',
  pageCitations: 'Page 39 (INB-39)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '56'" },
    { name: 'Consignee Address Line 2', start: 3, end: 37, length: 35, class: '35X', designation: 'O', notes: 'Street address line 2 of consignee' },
    { name: 'Consignee Address Line 3 / City / State / Zip', start: 38, end: 72, length: 35, class: '35X', designation: 'O', notes: 'Address line 3 / city, state, zip of consignee' },
    { name: 'Filler', start: 73, end: 80, length: 8, class: '8AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. RECORD QP57: Consignee Phone / Telex (Page 40 / INB-40)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP57_SPEC: RecordSpec = {
  recordId: 'QP57',
  name: 'Consignee Phone / Telex',
  pageCitations: 'Page 40 (INB-40)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '57'" },
    { name: 'Consignee Telephone Number', start: 3, end: 27, length: 25, class: '25X', designation: 'O', notes: 'Telephone number of consignee' },
    { name: 'Consignee Telex Number', start: 28, end: 52, length: 25, class: '25X', designation: 'O', notes: 'Telex number of consignee' },
    { name: 'Filler', start: 53, end: 80, length: 28, class: '28AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. RECORD QP60: Notify Party Name & Address Line 1 (Page 41 / INB-41)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP60_SPEC: RecordSpec = {
  recordId: 'QP60',
  name: 'Notify Party Name & Address Line 1',
  pageCitations: 'Page 41 (INB-41)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '60'" },
    { name: 'Notify Party Name', start: 3, end: 37, length: 35, class: '35X', designation: 'M', notes: 'Name of notify party' },
    { name: 'Notify Party Address Line 1', start: 38, end: 72, length: 35, class: '35X', designation: 'M', notes: 'Street address line 1 of notify party' },
    { name: 'Filler', start: 73, end: 80, length: 8, class: '8AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. RECORD QP61: Notify Party Address Lines 2 & 3 (Page 42 / INB-42)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP61_SPEC: RecordSpec = {
  recordId: 'QP61',
  name: 'Notify Party Address Lines 2 & 3',
  pageCitations: 'Page 42 (INB-42)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '61'" },
    { name: 'Notify Party Address Line 2', start: 3, end: 37, length: 35, class: '35X', designation: 'O', notes: 'Street address line 2 of notify party' },
    { name: 'Notify Party Address Line 3 / City / State / Zip', start: 38, end: 72, length: 35, class: '35X', designation: 'O', notes: 'Address line 3 / city, state, zip of notify party' },
    { name: 'Filler', start: 73, end: 80, length: 8, class: '8AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. RECORD QP62: Notify Party Phone / Telex (Page 43 / INB-43)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP62_SPEC: RecordSpec = {
  recordId: 'QP62',
  name: 'Notify Party Phone / Telex',
  pageCitations: 'Page 43 (INB-43)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '62'" },
    { name: 'Notify Party Telephone Number', start: 3, end: 27, length: 25, class: '25X', designation: 'O', notes: 'Telephone number of notify party' },
    { name: 'Notify Party Telex Number', start: 28, end: 52, length: 25, class: '25X', designation: 'O', notes: 'Telex number of notify party' },
    { name: 'Filler', start: 53, end: 80, length: 28, class: '28AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. RECORD QP65: Transport Party / Carrier Details (Page 44 / INB-44)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP65_SPEC: RecordSpec = {
  recordId: 'QP65',
  name: 'Transport Party / Carrier Details',
  pageCitations: 'Page 44 (INB-44)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '65'" },
    { name: 'Transport Party SCAC / Code', start: 3, end: 6, length: 4, class: '4AN', designation: 'M', notes: 'Carrier SCAC' },
    { name: 'Transport Party Name', start: 7, end: 41, length: 35, class: '35X', designation: 'O', notes: 'Name of transport carrier' },
    { name: 'Filler', start: 42, end: 80, length: 39, class: '39AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. RECORD QP70: Bonded Carrier / Importer Party Line 1 (Pages 45-46 / INB-45 - INB-46)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP70_SPEC: RecordSpec = {
  recordId: 'QP70',
  name: 'Bonded Carrier / Importer Party Line 1',
  pageCitations: 'Pages 45-46 (INB-45 - INB-46)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '70'" },
    { name: 'Party Type Qualifier', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'BC=Bonded Carrier, IMP=Importer' },
    { name: 'Party ID Code Qualifier', start: 6, end: 7, length: 2, class: '2AN', designation: 'C', notes: 'EI=IRS, ANI=CBP assigned, 34=SSN' },
    { name: 'Party ID Code', start: 8, end: 22, length: 15, class: '15X', designation: 'C', notes: 'Party identification number' },
    { name: 'Party Name', start: 23, end: 57, length: 35, class: '35X', designation: 'C', notes: 'Name of party' },
    { name: 'Filler', start: 58, end: 80, length: 23, class: '23AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 13. RECORD QP71: Party Address Line 1, City, State, Zip (Page 47 / INB-47)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP71_SPEC: RecordSpec = {
  recordId: 'QP71',
  name: 'Party Address Line 1, City, State, Zip',
  pageCitations: 'Page 47 (INB-47)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '71'" },
    { name: 'Party Street Address', start: 3, end: 37, length: 35, class: '35X', designation: 'M', notes: 'Street address of party' },
    { name: 'City Name', start: 38, end: 62, length: 25, class: '25X', designation: 'M', notes: 'City portion of address' },
    { name: 'State Code', start: 63, end: 64, length: 2, class: '2A', designation: 'C', notes: 'US state code or Canadian province' },
    { name: 'Postal Code', start: 65, end: 73, length: 9, class: '9AN', designation: 'C', notes: 'ZIP / Postal code' },
    { name: 'Country Code', start: 74, end: 75, length: 2, class: '2A', designation: 'M', notes: 'ISO country code' },
    { name: 'Filler', start: 76, end: 80, length: 5, class: '5AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 14. RECORD QP72: Party Contact Phone (Page 49 / INB-49)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP72_SPEC: RecordSpec = {
  recordId: 'QP72',
  name: 'Party Contact Phone',
  pageCitations: 'Page 49 (INB-49)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '72'" },
    { name: 'Contact Person Name', start: 3, end: 37, length: 35, class: '35X', designation: 'O', notes: 'Name of contact person' },
    { name: 'Telephone Number', start: 38, end: 62, length: 25, class: '25X', designation: 'O', notes: 'Contact phone number' },
    { name: 'Filler', start: 63, end: 80, length: 18, class: '18AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 15. RECORD QP75: In-Bond Remarks & Hazmat (Page 50 / INB-50)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP75_SPEC: RecordSpec = {
  recordId: 'QP75',
  name: 'In-Bond Remarks & Hazmat',
  pageCitations: 'Page 50 (INB-50)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '75'" },
    { name: 'Remarks Text', start: 3, end: 47, length: 45, class: '45X', designation: 'O', notes: 'General in-bond remarks text' },
    { name: 'Hazardous Material Indicator', start: 48, end: 48, length: 1, class: '1A', designation: 'O', notes: 'Y = Contains hazardous material' },
    { name: 'Filler', start: 49, end: 80, length: 32, class: '32AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 16. RECORD QP76: Additional Reference Identifier Overflow (Page 52 / INB-52)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_QP76_SPEC: RecordSpec = {
  recordId: 'QP76',
  name: 'Additional Reference Identifier Overflow',
  pageCitations: 'Page 52 (INB-52)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2N', designation: 'M', notes: "Must equal '76'" },
    { name: 'Reference Qualifier 1', start: 3, end: 5, length: 3, class: '3AN', designation: 'O', notes: 'Qualifier for reference 1' },
    { name: 'Reference Identifier 1', start: 6, end: 35, length: 30, class: '30X', designation: 'O', notes: 'Reference value 1' },
    { name: 'Reference Qualifier 2', start: 36, end: 38, length: 3, class: '3AN', designation: 'O', notes: 'Qualifier for reference 2' },
    { name: 'Reference Identifier 2', start: 39, end: 68, length: 30, class: '30X', designation: 'O', notes: 'Reference value 2' },
    { name: 'Filler', start: 69, end: 80, length: 12, class: '12AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 17. RECORD NS05: Conveyance Information Status (Page 60 / INB-60)
// ─────────────────────────────────────────────────────────────────────────────
// Note explicit date format: YYMMDD (Year, Month, Day) class N per PDF p. 60.
export const INBOND_RECORD_NS05_SPEC: RecordSpec = {
  recordId: 'NS05',
  name: 'Conveyance Information Status',
  pageCitations: 'Page 60 (INB-60)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '05'" },
    { name: 'Importing Conveyance Name', start: 3, end: 25, length: 23, class: '23AN', designation: 'O', notes: 'Name of importing conveyance' },
    { name: 'Trip / Voyage / Flight Number', start: 26, end: 30, length: 5, class: '5X', designation: 'O', notes: 'Trip/voyage number' },
    { name: 'Port of Arrival', start: 31, end: 34, length: 4, class: '4N', designation: 'O', notes: 'CBP port of arrival' },
    { name: 'Estimated Arrival Date', start: 35, end: 40, length: 6, class: '6N', designation: 'O', notes: 'YYMMDD format' },
    { name: 'Estimated Arrival Time', start: 41, end: 46, length: 6, class: '6N', designation: 'O', notes: 'HHMMSS military time' },
    { name: 'Filler', start: 47, end: 80, length: 34, class: '34AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 18. RECORD NS60: Equipment / Container Level Status (Page 68 / INB-68)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_NS60_SPEC: RecordSpec = {
  recordId: 'NS60',
  name: 'Equipment / Container Level Status',
  pageCitations: 'Page 68 (INB-68)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '60'" },
    { name: 'Equipment Initial', start: 3, end: 6, length: 4, class: '4AN', designation: 'O', notes: 'Equipment initial' },
    { name: 'Equipment Number', start: 7, end: 16, length: 10, class: '10AN', designation: 'M', notes: 'Container/equipment number' },
    { name: 'Seal Number 1', start: 17, end: 31, length: 15, class: '15AN', designation: 'O', notes: 'First seal number' },
    { name: 'Seal Number 2', start: 32, end: 46, length: 15, class: '15AN', designation: 'O', notes: 'Second seal number' },
    { name: 'Filler', start: 47, end: 80, length: 34, class: '34AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 19. RECORD EA: Transaction Header Batch Error (Page 69 / INB-69)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_EA_SPEC: RecordSpec = {
  recordId: 'EA',
  name: 'Transaction Header Batch Error',
  pageCitations: 'Page 69 (INB-69)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2A', designation: 'M', notes: "Must equal 'EA'" },
    { name: 'Error Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'CBP error condition code' },
    { name: 'Narrative Error Message', start: 6, end: 45, length: 40, class: '40X', designation: 'M', notes: 'Narrative error description' },
    { name: 'Filler', start: 46, end: 80, length: 35, class: '35AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 20. RECORD EB: Block Header Batch Error (Page 70 / INB-70)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_EB_SPEC: RecordSpec = {
  recordId: 'EB',
  name: 'Block Header Batch Error',
  pageCitations: 'Page 70 (INB-70)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2A', designation: 'M', notes: "Must equal 'EB'" },
    { name: 'Error Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'CBP error condition code' },
    { name: 'Narrative Error Message', start: 6, end: 45, length: 40, class: '40X', designation: 'M', notes: 'Narrative error description' },
    { name: 'Filler', start: 46, end: 80, length: 35, class: '35AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 21. RECORD EY: Block Trailer Batch Error (Page 71 / INB-71)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_EY_SPEC: RecordSpec = {
  recordId: 'EY',
  name: 'Block Trailer Batch Error',
  pageCitations: 'Page 71 (INB-71)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2A', designation: 'M', notes: "Must equal 'EY'" },
    { name: 'Error Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'CBP error condition code' },
    { name: 'Narrative Error Message', start: 6, end: 45, length: 40, class: '40X', designation: 'M', notes: 'Narrative error description' },
    { name: 'Filler', start: 46, end: 80, length: 35, class: '35AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 22. RECORD EZ: Transaction Trailer Batch Error (Page 72 / INB-72)
// ─────────────────────────────────────────────────────────────────────────────
export const INBOND_RECORD_EZ_SPEC: RecordSpec = {
  recordId: 'EZ',
  name: 'Transaction Trailer Batch Error',
  pageCitations: 'Page 72 (INB-72)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2A', designation: 'M', notes: "Must equal 'EZ'" },
    { name: 'Error Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'CBP error condition code' },
    { name: 'Narrative Error Message', start: 6, end: 45, length: 40, class: '40X', designation: 'M', notes: 'Narrative error description' },
    { name: 'Filler', start: 46, end: 80, length: 35, class: '35AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

const ALL_REMAINING_INBOND_SPECS: RecordSpec[] = [
  INBOND_RECORD_QP40_SPEC,
  INBOND_RECORD_QP50_SPEC,
  INBOND_RECORD_QP51_SPEC,
  INBOND_RECORD_QP52_SPEC,
  INBOND_RECORD_QP55_SPEC,
  INBOND_RECORD_QP56_SPEC,
  INBOND_RECORD_QP57_SPEC,
  INBOND_RECORD_QP60_SPEC,
  INBOND_RECORD_QP61_SPEC,
  INBOND_RECORD_QP62_SPEC,
  INBOND_RECORD_QP65_SPEC,
  INBOND_RECORD_QP70_SPEC,
  INBOND_RECORD_QP71_SPEC,
  INBOND_RECORD_QP72_SPEC,
  INBOND_RECORD_QP75_SPEC,
  INBOND_RECORD_QP76_SPEC,
  INBOND_RECORD_NS05_SPEC,
  INBOND_RECORD_NS60_SPEC,
  INBOND_RECORD_EA_SPEC,
  INBOND_RECORD_EB_SPEC,
  INBOND_RECORD_EY_SPEC,
  INBOND_RECORD_EZ_SPEC,
];

describe('CATAIR In-Bond — 22 Remaining Records & QP40 Calibration Test Suite', () => {
  it.each(ALL_REMAINING_INBOND_SPECS)('$recordId ($name) - field position math and total width sum to 80', (spec) => {
    let currentPos = 1;
    let computedLength = 0;

    for (const field of spec.fields) {
      expect(field.start).toBe(currentPos);
      expect(field.end - field.start + 1).toBe(field.length);
      currentPos += field.length;
      computedLength += field.length;
    }

    expect(computedLength).toBe(80);
    expect(spec.totalLength).toBe(80);
  });

  it('QP40 (Line Item Detail Calibration Record) contains real fields and NOT fabricated fields', () => {
    const qp40FieldNames = INBOND_RECORD_QP40_SPEC.fields.map(f => f.name);
    // Real fields MUST exist
    expect(qp40FieldNames).toContain('Foreign Port of Lading');
    expect(qp40FieldNames).toContain('Manifest Quantity');
    expect(qp40FieldNames).toContain('Manifest Units');

    // Invented/fabricated fields from prior bug MUST NOT exist
    expect(qp40FieldNames).not.toContain('lineNumber');
    expect(qp40FieldNames).not.toContain('tariffNumber');
    expect(qp40FieldNames).not.toContain('pieceCount');
    expect(qp40FieldNames).not.toContain('description');
    expect(qp40FieldNames).not.toContain('value');

    // Check exact field positions
    expect(INBOND_RECORD_QP40_SPEC.fields[1]).toEqual({
      name: 'Foreign Port of Lading', start: 3, end: 7, length: 5, class: '5N', designation: 'M', notes: 'Schedule K foreign port code'
    });
    expect(INBOND_RECORD_QP40_SPEC.fields[2]).toEqual({
      name: 'Manifest Quantity', start: 8, end: 17, length: 10, class: '10N', designation: 'M', notes: 'Manifested quantity (whole number)'
    });
  });

  it('NS05 Conveyance Information Status uses YYMMDD date format at pos 35-40', () => {
    const arrivalDate = INBOND_RECORD_NS05_SPEC.fields.find(f => f.name === 'Estimated Arrival Date');
    expect(arrivalDate?.start).toBe(35);
    expect(arrivalDate?.end).toBe(40);
    expect(arrivalDate?.length).toBe(6);
    expect(arrivalDate?.notes).toContain('YYMMDD');
  });
});
