import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Broker Download (BD Application) - Remaining 11 Deferred Records Test Suite
 * Source PDF: docs/plans/catair-source-docs/09-broker-download-draft.pdf (August 2024 DRAFT)
 *
 * Scoped Records:
 *   1. Record 2M (Conditional, Page 15): Manifest Reference Identifier (Rail Carrier-Assigned Batch Number)
 *   2. Record 1A (Conditional, Pages 18-19): Bill of Lading Amendment Record (Add/Delete/Replace)
 *   3. Record 2B (Conditional, Page 25): Bill of Lading Additional / Pre-Carrier Receipt Record
 *   4. Record 4B (Conditional, Page 26): Bill of Lading Reference Identifier Record
 *   5. Record 2N (Conditional, Page 30): Entity Address Line 1 & Line 2 Record
 *   6. Record 3N (Conditional, Page 31): Entity Geographic Area / City / State / Zip Record
 *   7. Record 4N (Conditional, Page 33): Administrative Communication Contact Record
 *   8. Record 1I (Conditional, Pages 34-35): Supplemental In-Bond Details Record
 *   9. Record 2I (Conditional, Page 36): Water-Borne Export In-Bond Record (Rail only)
 *  10. Record 2C (Conditional, Page 39): Motor Vehicle Control (VIN) Record
 *  11. Record 0D (Conditional, Page 40): Harmonized Tariff / HTS Classification Record
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
// 1. RECORD 2M: Manifest Reference Identifier (Page 15 / BD-14)
// ─────────────────────────────────────────────────────────────────────────────
export const BROKER_RECORD_2M_SPEC: RecordSpec = {
  recordId: '2M',
  name: 'Manifest Reference Identifier',
  pageCitations: 'Page 15 (BD-14)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '2M'" },
    { name: 'Carrier-Assigned Batch Number', start: 3, end: 32, length: 30, class: '30AN', designation: 'M', notes: 'Control number assigned by carrier (Rail only)' },
    { name: 'Filler', start: 33, end: 80, length: 48, class: '48AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. RECORD 1A: Bill of Lading Amendment (Pages 18-19 / BD-17 - BD-18)
// ─────────────────────────────────────────────────────────────────────────────
export const BROKER_RECORD_1A_SPEC: RecordSpec = {
  recordId: '1A',
  name: 'Bill of Lading Amendment',
  pageCitations: 'Pages 18-19 (BD-17 - BD-18)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '1A'" },
    { name: 'Carrier Code', start: 3, end: 6, length: 4, class: '4AN', designation: 'M', notes: 'SCAC of importing carrier' },
    { name: 'CBP Port', start: 7, end: 10, length: 4, class: '4N', designation: 'M', notes: 'USCBP port of crossing or unlading' },
    { name: 'Action Code', start: 11, end: 11, length: 1, class: '1N', designation: 'C', notes: 'A=Add, D=Delete, M=Replace segment, R=Replace manifest quantity' },
    { name: 'Bill of Lading Number', start: 12, end: 23, length: 12, class: '12AN', designation: 'M', notes: 'Master bill of lading number / SCN' },
    { name: 'Quantity', start: 24, end: 33, length: 10, class: '10X', designation: 'C', notes: 'Amended quantity if Action Code is R (Rail/Ocean)' },
    { name: 'Amendment Code', start: 34, end: 35, length: 2, class: '2X', designation: 'C', notes: 'Reason code for manifest amendment (ACE Ocean App B)' },
    { name: 'House Bill Number', start: 36, end: 47, length: 12, class: '12X', designation: 'C', notes: 'House bill number (Truck and Ocean HBR)' },
    { name: 'Filler', start: 48, end: 51, length: 4, class: '4AN', designation: 'M', notes: 'Space fill' },
    { name: 'Code Qualifier', start: 52, end: 54, length: 3, class: '3AN', designation: 'C', notes: 'Code ABI = ABI Office Routing Code' },
    { name: 'ID Code', start: 55, end: 71, length: 17, class: '17AN', designation: 'C', notes: 'ABI office routing code (Port 4 + Filer 3 + Office 2 = 9 chars)' },
    { name: 'Issuer Code', start: 72, end: 75, length: 4, class: '4A', designation: 'C', notes: 'SCAC of house bill issuer (Truck and Ocean HBR)' },
    { name: 'Filler', start: 76, end: 80, length: 5, class: '5AN', designation: 'M', notes: 'Space fill' },
  ],
  mismatches: [
    {
      field: 'Action Code',
      tableClass: '1N',
      actualType: '1A (Alphabetic)',
      description: "PDF table specifies class '1N', but valid values are 'A', 'D', 'M', 'R', which are non-numeric alphabetic characters.",
    },
    {
      field: 'House Bill Number',
      tableClass: '12X',
      actualType: 'Documentation Typo',
      description: "Description text contains layout typo 'in positions 52-5572-75'. Issuer Code position table row is actually 72-75.",
    },
    {
      field: 'Code Qualifier',
      tableClass: '3AN',
      actualType: 'Documentation Discrepancy',
      description: "Note states 'required if action code is C', but valid action codes are listed as A, D, M, R.",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. RECORD 2B: Bill of Lading Additional / Pre-Carrier Receipt (Page 25 / BD-24)
// ─────────────────────────────────────────────────────────────────────────────
export const BROKER_RECORD_2B_SPEC: RecordSpec = {
  recordId: '2B',
  name: 'Bill of Lading Additional / Pre-Carrier Receipt',
  pageCitations: 'Page 25 (BD-24)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '2B'" },
    { name: 'Measurement', start: 3, end: 12, length: 10, class: '10N', designation: 'O', notes: 'Measurement from manifest. Zero filled if not transmitted' },
    { name: 'Measurement Unit', start: 13, end: 14, length: 2, class: '2A', designation: 'C', notes: 'Unit of measure. Required if measurement given' },
    { name: 'Place of Receipt by Pre-carrier', start: 15, end: 31, length: 17, class: '17AN', designation: 'C', notes: 'City/country where pre-carrier took possession. Required' },
    { name: 'Filler', start: 32, end: 43, length: 12, class: '12X', designation: 'M', notes: 'Space fill (table class 12X)' },
    { name: 'Secondary Notify Party 1 SCAC', start: 44, end: 47, length: 4, class: '4AN', designation: 'O', notes: '1st Secondary Notify Party SCAC (labeled Carrier Code in PDF)' },
    { name: 'Secondary Notify Party 2 SCAC', start: 48, end: 51, length: 4, class: '4AN', designation: 'O', notes: '2nd Secondary Notify Party SCAC (labeled Carrier Code in PDF)' },
    { name: 'Filler', start: 52, end: 80, length: 29, class: '29AN', designation: 'M', notes: 'Space fill' },
  ],
  mismatches: [
    {
      field: 'Secondary Notify Party 1 & 2 SCAC',
      tableClass: '4AN',
      actualType: 'Duplicate Field Label',
      description: "PDF table reuses identical label 'Carrier Code' for positions 44-47 and 48-51 (Secondary Notify Parties 1 & 2).",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. RECORD 4B: Bill of Lading Reference Identifier (Page 26 / BD-25)
// ─────────────────────────────────────────────────────────────────────────────
export const BROKER_RECORD_4B_SPEC: RecordSpec = {
  recordId: '4B',
  name: 'Bill of Lading Reference Identifier',
  pageCitations: 'Page 26 (BD-25)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '4B'" },
    { name: 'Reference Qualifier', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'Reference type code (e.g., 8S, BEN, BL, BM, BN, CG, CN, CO, CR, CUB, CX, ED, EP, FEN, FN, FP, GB, GR, HS, IN, LT, MA, MB). 2-char codes left-justified' },
    { name: 'Reference Number', start: 6, end: 35, length: 30, class: '30AN', designation: 'M', notes: 'Number identified by reference qualifier' },
    { name: 'Filler', start: 36, end: 80, length: 45, class: '45AN', designation: 'M', notes: 'Space fill' },
  ],
  mismatches: [
    {
      field: 'Record Repeatability',
      tableClass: '10 vs 999',
      actualType: 'Cardinality Ambiguity',
      description: "Page 26 intro states 'repeated up to ten times', while broader structure allows up to 999 4B records.",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. RECORD 2N: Entity Address (Page 30 / BD-29)
// ─────────────────────────────────────────────────────────────────────────────
export const BROKER_RECORD_2N_SPEC: RecordSpec = {
  recordId: '2N',
  name: 'Entity Address Line 1 & Line 2',
  pageCitations: 'Page 30 (BD-29)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '2N'" },
    { name: 'Entity Address Line 1', start: 3, end: 37, length: 35, class: '35X', designation: 'M', notes: 'First line of entity address or country (labeled Entity Party Address)' },
    { name: 'Entity Address Line 2', start: 38, end: 72, length: 35, class: '35X', designation: 'C', notes: 'Second line of entity address if available (labeled Entity Party Address)' },
    { name: 'Filler', start: 73, end: 80, length: 8, class: '8AN', designation: 'M', notes: 'Space fill' },
  ],
  mismatches: [
    {
      field: 'Entity Address Line 1 & 2',
      tableClass: '35X',
      actualType: 'Duplicate Field Label',
      description: "PDF table lists identical label 'Entity Party Address' for both pos 3-37 (Line 1) and pos 38-72 (Line 2).",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. RECORD 3N: Entity Geographic Area (Page 31 / BD-30)
// ─────────────────────────────────────────────────────────────────────────────
export const BROKER_RECORD_3N_SPEC: RecordSpec = {
  recordId: '3N',
  name: 'Entity Geographic Area',
  pageCitations: 'Page 31 (BD-30)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '3N'" },
    { name: 'City Name', start: 3, end: 21, length: 19, class: '19AN', designation: 'C', notes: 'City name (limited to 19 chars for Rail)' },
    { name: 'State/Province', start: 22, end: 23, length: 2, class: '2AN', designation: 'O', notes: 'State/Province code (Rail and Ocean only)' },
    { name: 'Postal Code', start: 24, end: 32, length: 9, class: '9AN', designation: 'O', notes: 'Postal/Zip code without punctuation/blanks' },
    { name: 'Country Code', start: 33, end: 34, length: 2, class: '2AN', designation: 'O', notes: 'ISO country code' },
    { name: 'Location Identifier', start: 35, end: 39, length: 5, class: '5AN', designation: 'C', notes: 'Space fill in Rail/Ocean; 1-3 letter state/province code in Truck' },
    { name: 'Filler', start: 40, end: 80, length: 41, class: '41AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. RECORD 4N: Administrative Communication Contact (Page 33 / BD-32)
// ─────────────────────────────────────────────────────────────────────────────
export const BROKER_RECORD_4N_SPEC: RecordSpec = {
  recordId: '4N',
  name: 'Administrative Communication Contact',
  pageCitations: 'Page 33 (BD-32)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '4N'" },
    { name: 'Contact Name', start: 3, end: 25, length: 23, class: '23AN', designation: 'O', notes: 'Contact person name' },
    { name: 'Comm Number Qualifier', start: 26, end: 27, length: 2, class: '2AN', designation: 'C', notes: 'Qualifier code (AU, CP, ED, EM, EX, FT, FX, HP, IT, PS, TE, TL, TM, TX, WP)' },
    { name: 'Communications Number', start: 28, end: 52, length: 25, class: '25AN', designation: 'C', notes: 'Comms number incl country/area code (Rail/Truck). Truncated if >25' },
    { name: 'Reserved Comm Qualifier', start: 53, end: 54, length: 2, class: '2AN', designation: 'C', notes: 'Reserved for future use. Space fill (labeled Comm Number Qualifier)' },
    { name: 'Reserved Communications Number', start: 55, end: 79, length: 25, class: '25AN', designation: 'C', notes: 'Reserved for future use. Space fill (labeled Communications Number)' },
    { name: 'Filler', start: 80, end: 80, length: 1, class: '1AN', designation: 'M', notes: 'Space fill' },
  ],
  mismatches: [
    {
      field: 'Comm Number Qualifier & Number (Reserved)',
      tableClass: '2AN / 25AN',
      actualType: 'Duplicate Field Label',
      description: "PDF table reuses labels 'Comm Number Qualifier' (pos 53-54) and 'Communications Number' (pos 55-79) for reserved future fields.",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. RECORD 1I: Supplemental In-Bond Details (Pages 34-35 / BD-33 - BD-34)
// ─────────────────────────────────────────────────────────────────────────────
export const BROKER_RECORD_1I_SPEC: RecordSpec = {
  recordId: '1I',
  name: 'Supplemental In-Bond Details',
  pageCitations: 'Pages 34-35 (BD-33 - BD-34)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '1I'" },
    { name: 'In-Bond Entry Type', start: 3, end: 4, length: 2, class: '2N', designation: 'M', notes: '61=IT, 62=T&E, 63=IE; 69=Transit (US-CA-US), 70=Transit (CA-US-CA)' },
    { name: 'FDA/BTA Confirmation Indicator', start: 5, end: 5, length: 1, class: '1A', designation: 'M', notes: 'Y=PN on file with FDA, N=No PN on file' },
    { name: 'Filler', start: 6, end: 6, length: 1, class: '1AN', designation: 'M', notes: 'Space fill' },
    { name: 'Conventional In-Bond Number', start: 7, end: 15, length: 9, class: '9N', designation: 'C', notes: 'CF-7512 in-bond number. Zero-filled if carrier transmits V in-bond' },
    { name: 'In-Bond Carrier Code', start: 16, end: 19, length: 4, class: '4AN', designation: 'C', notes: 'SCAC of in-bond carrier' },
    { name: 'U.S. Port of Destination', start: 20, end: 23, length: 4, class: '4N', designation: 'C', notes: 'Schedule D port of termination (61), export (62), or arrival (63)' },
    { name: 'Foreign Destination', start: 24, end: 28, length: 5, class: '5N', designation: 'C', notes: 'Schedule K code for foreign port of destination (62/63). Blank for 61' },
    { name: 'Value', start: 29, end: 36, length: 8, class: '8N', designation: 'M', impliedDecimals: 0, notes: 'Whole dollar value ($/USD, 0 decimals). $20/kg if unknown. Must be > 0' },
    { name: 'Bonded Carrier ID Number', start: 37, end: 48, length: 12, class: '12X', designation: 'M', notes: 'IRS (NN-NNNNNNNXX), CBP (YYDDPP-NNNN), or SSN (NNN-NN-NNNN) with hyphens' },
    { name: 'Paperless In-Bond', start: 49, end: 59, length: 11, class: '11AN', designation: 'C', notes: 'Carrier assigned V in-bond number' },
    { name: 'Shipment Control Number', start: 60, end: 75, length: 16, class: '16AN', designation: 'C', notes: 'Carrier assigned shipment control number (Truck only)' },
    { name: 'Filler', start: 76, end: 80, length: 5, class: '5AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. RECORD 2I: Water-Borne Export In-Bond (Page 36 / BD-35)
// ─────────────────────────────────────────────────────────────────────────────
export const BROKER_RECORD_2I_SPEC: RecordSpec = {
  recordId: '2I',
  name: 'Water-Borne Export In-Bond',
  pageCitations: 'Page 36 (BD-35)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '2I'" },
    { name: 'Transportation Indicator', start: 3, end: 4, length: 2, class: '2N', designation: 'O', notes: "Must be 'S' = Sea (Rail only)" },
    { name: 'Vessel Name', start: 5, end: 27, length: 23, class: '23AN', designation: 'O', notes: 'Name of exporting vessel' },
    { name: 'Filler', start: 28, end: 80, length: 53, class: '53AN', designation: 'M', notes: 'Space fill' },
  ],
  mismatches: [
    {
      field: 'Transportation Indicator',
      tableClass: '2N',
      actualType: '1A / 2A (Alphabetic)',
      description: "PDF table specifies class '2N', but description explicitly states value must be 'S' (alphabetic 'Sea').",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. RECORD 2C: Motor Vehicle Control / VIN (Page 39 / BD-38)
// ─────────────────────────────────────────────────────────────────────────────
export const BROKER_RECORD_2C_SPEC: RecordSpec = {
  recordId: '2C',
  name: 'Motor Vehicle Control / VIN',
  pageCitations: 'Page 39 (BD-38)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '2C'" },
    { name: 'VIN', start: 3, end: 32, length: 30, class: '30AN', designation: 'M', notes: 'Vehicle Identification Number (Canadian finished vehicles)' },
    { name: 'Filler', start: 33, end: 42, length: 10, class: '10AN', designation: 'M', notes: 'Space fill' },
    { name: 'Factory Car Order Number', start: 43, end: 52, length: 10, class: '10AN', designation: 'O', notes: 'Canadian border car order number (Rail only)' },
    { name: 'Filler', start: 53, end: 80, length: 28, class: '28AN', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. RECORD 0D: Harmonized Tariff / HTS Classification (Page 40 / BD-39)
// ─────────────────────────────────────────────────────────────────────────────
export const BROKER_RECORD_0D_SPEC: RecordSpec = {
  recordId: '0D',
  name: 'Harmonized Tariff Classification',
  pageCitations: 'Page 40 (BD-39)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '0D'" },
    { name: 'Harmonized Number', start: 3, end: 13, length: 11, class: '11N', designation: 'C', notes: 'HTSUS code. Left justified, space filled if 6 digits' },
    { name: 'Value', start: 14, end: 21, length: 8, class: '8N', designation: 'C', impliedDecimals: 0, notes: 'Whole dollar value ($/USD, 0 decimals), > 0' },
    { name: 'Weight', start: 22, end: 31, length: 10, class: '10N', designation: 'C', notes: 'Net weight in pounds or kilos (> 0)' },
    { name: 'Weight Unit', start: 32, end: 33, length: 2, class: '2A', designation: 'C', notes: 'Unit of measure: LB, KG, LT, ST, ET, MT (Rail/Ocean); G, L, K, O, T (Truck)' },
    { name: 'Filler', start: 34, end: 80, length: 47, class: '47AN', designation: 'M', notes: 'Space fill' },
  ],
  mismatches: [
    {
      field: 'Harmonized Number',
      tableClass: '11N',
      actualType: '11AN (Alphanumeric / Space-Padded)',
      description: "PDF table specifies class '11N', but note explicitly states 'if only six positions are sent the remaining positions will be space filled', requiring character space padding.",
    },
  ],
};

export const ALL_REMAINING_BROKER_RECORDS: RecordSpec[] = [
  BROKER_RECORD_2M_SPEC,
  BROKER_RECORD_1A_SPEC,
  BROKER_RECORD_2B_SPEC,
  BROKER_RECORD_4B_SPEC,
  BROKER_RECORD_2N_SPEC,
  BROKER_RECORD_3N_SPEC,
  BROKER_RECORD_4N_SPEC,
  BROKER_RECORD_1I_SPEC,
  BROKER_RECORD_2I_SPEC,
  BROKER_RECORD_2C_SPEC,
  BROKER_RECORD_0D_SPEC,
];

// ─────────────────────────────────────────────────────────────────────────────
// VITEST TEST SUITE FOR REMAINING BROKER DOWNLOAD RECORDS
// ─────────────────────────────────────────────────────────────────────────────
describe('CATAIR ACE Broker Download - 11 Deferred Records Spec Suite', () => {
  it('should contain exactly 11 deferred records', () => {
    expect(ALL_REMAINING_BROKER_RECORDS.length).toBe(11);
  });

  ALL_REMAINING_BROKER_RECORDS.forEach((record) => {
    describe(`Record ${record.recordId}: ${record.name} (${record.pageCitations})`, () => {
      it('should have contiguous field positions starting at 1 and ending at 80', () => {
        let currentPos = 1;
        record.fields.forEach((field) => {
          expect(field.start).toBe(currentPos);
          expect(field.end - field.start + 1).toBe(field.length);
          currentPos = field.end + 1;
        });
        expect(currentPos - 1).toBe(record.totalLength);
        expect(record.totalLength).toBe(80);
      });

      it('should calculate field length sum equal to exactly 80 characters', () => {
        const sum = record.fields.reduce((acc, f) => acc + f.length, 0);
        expect(sum).toBe(80);
      });

      it('should start with a valid Control Identifier field', () => {
        const controlField = record.fields[0];
        expect(controlField.name).toBe('Control Identifier');
        expect(controlField.start).toBe(1);
        expect(controlField.end).toBe(2);
        expect(controlField.length).toBe(2);
        expect(controlField.designation).toBe('M');
      });

      it('should terminate with a Filler field ending at position 80', () => {
        const lastField = record.fields[record.fields.length - 1];
        expect(lastField.name).toMatch(/Filler/i);
        expect(lastField.end).toBe(80);
        expect(lastField.designation).toBe('M');
      });
    });
  });

  describe('Explicit Value & Decimal Field Validation', () => {
    it('Record 1I (Supplemental In-Bond) Value should be whole dollars with 0 implied decimals', () => {
      const valueField = BROKER_RECORD_1I_SPEC.fields.find((f) => f.name === 'Value');
      expect(valueField).toBeDefined();
      expect(valueField?.start).toBe(29);
      expect(valueField?.end).toBe(36);
      expect(valueField?.length).toBe(8);
      expect(valueField?.class).toBe('8N');
      expect(valueField?.impliedDecimals).toBe(0);
    });

    it('Record 0D (Harmonized Tariff) Value should be whole dollars with 0 implied decimals', () => {
      const valueField = BROKER_RECORD_0D_SPEC.fields.find((f) => f.name === 'Value');
      expect(valueField).toBeDefined();
      expect(valueField?.start).toBe(14);
      expect(valueField?.end).toBe(21);
      expect(valueField?.length).toBe(8);
      expect(valueField?.class).toBe('8N');
      expect(valueField?.impliedDecimals).toBe(0);
    });

    it('Record 1I Bonded Carrier ID Number should be 12X to accommodate hyphens', () => {
      const idField = BROKER_RECORD_1I_SPEC.fields.find((f) => f.name === 'Bonded Carrier ID Number');
      expect(idField).toBeDefined();
      expect(idField?.start).toBe(37);
      expect(idField?.end).toBe(48);
      expect(idField?.length).toBe(12);
      expect(idField?.class).toBe('12X');
    });
  });

  describe('Documented Position-Label-vs-Class Mismatches', () => {
    it('Record 1A Action Code mismatch should be documented', () => {
      expect(BROKER_RECORD_1A_SPEC.mismatches).toBeDefined();
      const actionMismatch = BROKER_RECORD_1A_SPEC.mismatches?.find((m) => m.field === 'Action Code');
      expect(actionMismatch).toBeDefined();
      expect(actionMismatch?.tableClass).toBe('1N');
      expect(actionMismatch?.actualType).toBe('1A (Alphabetic)');
    });

    it('Record 2I Transportation Indicator mismatch should be documented', () => {
      expect(BROKER_RECORD_2I_SPEC.mismatches).toBeDefined();
      const transMismatch = BROKER_RECORD_2I_SPEC.mismatches?.find((m) => m.field === 'Transportation Indicator');
      expect(transMismatch).toBeDefined();
      expect(transMismatch?.tableClass).toBe('2N');
      expect(transMismatch?.actualType).toBe('1A / 2A (Alphabetic)');
    });

    it('Record 0D Harmonized Number space-padding mismatch should be documented', () => {
      expect(BROKER_RECORD_0D_SPEC.mismatches).toBeDefined();
      const htsMismatch = BROKER_RECORD_0D_SPEC.mismatches?.find((m) => m.field === 'Harmonized Number');
      expect(htsMismatch).toBeDefined();
      expect(htsMismatch?.tableClass).toBe('11N');
      expect(htsMismatch?.actualType).toBe('11AN (Alphanumeric / Space-Padded)');
    });

    it('Duplicate field labels across 2B, 2N, and 4N should be explicitly documented', () => {
      expect(BROKER_RECORD_2B_SPEC.mismatches?.[0].actualType).toBe('Duplicate Field Label');
      expect(BROKER_RECORD_2N_SPEC.mismatches?.[0].actualType).toBe('Duplicate Field Label');
      expect(BROKER_RECORD_4N_SPEC.mismatches?.[0].actualType).toBe('Duplicate Field Label');
    });
  });
});
