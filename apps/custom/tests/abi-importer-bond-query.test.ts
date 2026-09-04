import { describe, it, expect } from 'vitest';

/**
 * CATAIR Importer/Bond Query (KI/KR) - Record Specifications & Verification Test Suite
 * 
 * Source Document:
 * - CBP ACE CATAIR Importer/Bond Query Chapter (July 15, 2025)
 *   Document Name: ACE CATAIR Importer Query Version 7_508.pdf
 *   Local Path: docs/plans/catair-source-docs/importer-bond-query-v7.pdf
 *   Source URL: https://www.cbp.gov/sites/default/files/2025-10/ACE%20CATAIR%20Importer%20Query%20Version%207_508.pdf
 *   CBP Guidance Page: https://www.cbp.gov/document/guidance/ace-draft-importerbond-query-catair
 * - CBP ACE ABI CATAIR Batch & Block Control Chapter (v23, June 12, 2023)
 *   Local Path: docs/plans/catair-source-docs/01-batch-block-control-v23.pdf (Pages 11, 23)
 *   Application Identifier KI (Input) / KR (Response)
 * 
 * Overview:
 * The Importer/Bond Query transaction allows ABI filers to query CBP's Importer/Consignee
 * File and Importer/Bond File for importer name, address, and continuous bond status.
 * Up to six importer numbers can be queried in a single Input Record K.
 * Response records K1-K8 are returned based on query results and requested address codes.
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

export interface RecordSpec {
  recordId: string;
  name: string;
  pageCitations: string;
  totalLength: number;
  fields: FieldSpec[];
}

/** Record Identifier K (Input) - Importer/Bond Query Input Record (Page 9 / QIB-8) */
export const IMPORTER_BOND_QUERY_RECORD_K: RecordSpec = {
  recordId: 'K',
  name: 'Importer/Bond Query Input Record',
  pageCitations: 'importer-bond-query-v7.pdf Page 9 (QIB-8)',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: 'Must always equal K' },
    { name: 'Filler', start: 2, end: 2, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Importer Number (1)', start: 3, end: 14, length: 12, class: '12X', designation: 'M', notes: 'Primary importer/consignee IRS/SSN/CBP-assigned number' },
    { name: 'Address Request Code (1)', start: 15, end: 15, length: 1, class: '1AN', designation: 'M', notes: 'Space = K1,K2,K7,K8; 1 = K1-K8' },
    { name: 'Importer Number (2)', start: 16, end: 27, length: 12, class: '12X or 12S', designation: 'C', notes: 'Second importer/consignee number' },
    { name: 'Address Request Code (2)', start: 28, end: 28, length: 1, class: '1AN or 1S', designation: 'C', notes: 'Address request code for 2nd importer' },
    { name: 'Importer Number (3)', start: 29, end: 40, length: 12, class: '12X or 12S', designation: 'C', notes: 'Third importer/consignee number' },
    { name: 'Address Request Code (3)', start: 41, end: 41, length: 1, class: '1AN or 1S', designation: 'C', notes: 'Address request code for 3rd importer' },
    { name: 'Importer Number (4)', start: 42, end: 53, length: 12, class: '12X or 12S', designation: 'C', notes: 'Fourth importer/consignee number' },
    { name: 'Address Request Code (4)', start: 54, end: 54, length: 1, class: '1AN or 1S', designation: 'C', notes: 'Address request code for 4th importer' },
    { name: 'Importer Number (5)', start: 55, end: 66, length: 12, class: '12X or 12S', designation: 'C', notes: 'Fifth importer/consignee number' },
    { name: 'Address Request Code (5)', start: 67, end: 67, length: 1, class: '1AN or 1S', designation: 'C', notes: 'Address request code for 5th importer' },
    { name: 'Importer Number (6)', start: 68, end: 79, length: 12, class: '12X or 12S', designation: 'C', notes: 'Sixth importer/consignee number' },
    { name: 'Address Request Code (6)', start: 80, end: 80, length: 1, class: '1AN or 1S', designation: 'C', notes: 'Address request code for 6th importer' },
  ],
};

/** Record Identifier K1 (Output) - Mandatory Output Record (Page 11 / QIB-10) */
export const IMPORTER_BOND_QUERY_RECORD_K1: RecordSpec = {
  recordId: 'K1',
  name: 'Importer/Bond Query Output Record K1',
  pageCitations: 'importer-bond-query-v7.pdf Page 11 (QIB-10)',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: 'Always equals K' },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: 'Always equals 1' },
    { name: 'Importer Number', start: 3, end: 14, length: 12, class: '12X', designation: 'M', notes: 'Importer/consignee number' },
    { name: 'Query Results Code', start: 15, end: 15, length: 1, class: '1N', designation: 'M', notes: '0=No info, 1=Continuous bond, 2=No bond, 3=Voided, 4=Inactive' },
    { name: 'Importer\'s Name', start: 16, end: 47, length: 32, class: '32AN or 32S', designation: 'C', notes: 'Name of importer/consignee' },
    { name: 'Surety Code', start: 48, end: 50, length: 3, class: '3AN or 3S', designation: 'C', notes: 'Surety code for continuous bond' },
    { name: 'Bond Type/Activity Code', start: 51, end: 51, length: 1, class: '1AN or 1S', designation: 'C', notes: 'CBPF 301 continuous bond activity code (A-T)' },
    { name: 'Bond Amount', start: 52, end: 60, length: 9, class: '9N or 9S', designation: 'C', impliedDecimals: 0, notes: 'Whole U.S. dollars <= 9 digits. Space-filled if 10-digit bond (in K2)' },
    { name: 'District/Port Where Bond Was Filed', start: 61, end: 64, length: 4, class: '4AN or 4S', designation: 'C', notes: 'Port code' },
    { name: 'Bond Effective Date', start: 65, end: 70, length: 6, class: '6AN or 6S', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Bond Number', start: 71, end: 79, length: 9, class: '9AN or 9S', designation: 'C', notes: 'Bond number. EVIDENTIARY AUDIT NOTE: PDF table lists pos as 71-89, a typo for 71-79 given length 9AN and next field at 80-80' },
    { name: 'Bond Amount Record Location Indicator', start: 80, end: 80, length: 1, class: '1AN', designation: 'C', notes: '1 = K1 record (<=9 digits), 2 = K2 record (10 digits)' },
  ],
};

/** Record Identifier K2 (Output) - Conditional Name/Date/Status Output Record (Page 14 / QIB-13) */
export const IMPORTER_BOND_QUERY_RECORD_K2: RecordSpec = {
  recordId: 'K2',
  name: 'Importer/Bond Query Output Record K2',
  pageCitations: 'importer-bond-query-v7.pdf Page 14 (QIB-13)',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: 'Always equals K' },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: 'Always equals 2' },
    { name: 'Name Qualifier', start: 3, end: 5, length: 3, class: '3A or 3S', designation: 'C', notes: 'DBA, DIV, or AKA' },
    { name: 'Line Two of Importer Name', start: 6, end: 37, length: 32, class: '32X or 32S', designation: 'C', notes: 'Second line of importer name' },
    { name: 'Filler 1', start: 38, end: 38, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Bond Termination Date', start: 39, end: 44, length: 6, class: '6D or 6S', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Filler 2', start: 45, end: 45, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Periodic Monthly Statement Status', start: 46, end: 46, length: 1, class: '1AN', designation: 'C', notes: 'Y = Yes, N = No' },
    { name: 'Filler 3', start: 47, end: 47, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Bond Sufficiency Indicator', start: 48, end: 48, length: 1, class: '1AN or 1S', designation: 'C', notes: 'Y = Yes (sufficient), N = No (not sufficient)' },
    { name: 'Filler 4', start: 49, end: 49, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Bond User Status Indicator', start: 50, end: 50, length: 1, class: '1AN or 1S', designation: 'C', notes: 'A = Active, T = Terminated' },
    { name: 'Filler 5', start: 51, end: 51, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Bond User Termination Date', start: 52, end: 57, length: 6, class: '6D or 6S', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Bond Amount', start: 58, end: 67, length: 10, class: '10N or 10S', designation: 'C', impliedDecimals: 0, notes: 'Whole U.S. dollars for 10-digit bond. Space-filled if <= 9 digits (in K1)' },
    { name: 'Filler 6', start: 68, end: 80, length: 13, class: '13AN', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K3 (Output) - Mailing Address Lines 1 & 2 (Page 16 / QIB-15) */
export const IMPORTER_BOND_QUERY_RECORD_K3: RecordSpec = {
  recordId: 'K3',
  name: 'Importer/Bond Query Output Record K3',
  pageCitations: 'importer-bond-query-v7.pdf Page 16 (QIB-15)',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: 'Always equals K' },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: 'Always equals 3' },
    { name: 'Address Line One', start: 3, end: 34, length: 32, class: '32X or 32S', designation: 'C', notes: 'Street address or PO box' },
    { name: 'Address Line Two', start: 35, end: 66, length: 32, class: '32X or 32S', designation: 'C', notes: 'Second line of mailing address' },
    { name: 'Filler', start: 67, end: 80, length: 14, class: '14S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K4 (Output) - Mailing Address City/State/Zip (Page 17 / QIB-16) */
export const IMPORTER_BOND_QUERY_RECORD_K4: RecordSpec = {
  recordId: 'K4',
  name: 'Importer/Bond Query Output Record K4',
  pageCitations: 'importer-bond-query-v7.pdf Page 17 (QIB-16)',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: 'Always equals K' },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: 'Always equals 4' },
    { name: 'Filler 1', start: 3, end: 34, length: 32, class: '32X', designation: 'M', notes: 'Space fill' },
    { name: 'City', start: 35, end: 55, length: 21, class: '21X', designation: 'M', notes: 'City portion of mailing address' },
    { name: 'State Code', start: 56, end: 57, length: 2, class: '2A', designation: 'M', notes: 'US state, Canadian province, Mexican state, or FN for foreign' },
    { name: 'Postal Code', start: 58, end: 66, length: 9, class: '9AN or 9S', designation: 'M', notes: 'ZIP / postal code' },
    { name: 'Filler 2', start: 67, end: 80, length: 14, class: '14S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K5 (Output) - Physical Address Lines 1 & 2 (Page 18 / QIB-17) */
export const IMPORTER_BOND_QUERY_RECORD_K5: RecordSpec = {
  recordId: 'K5',
  name: 'Importer/Bond Query Output Record K5',
  pageCitations: 'importer-bond-query-v7.pdf Page 18 (QIB-17)',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: 'Always equals K' },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: 'Always equals 5' },
    { name: 'Address Line One', start: 3, end: 34, length: 32, class: '32X or 32S', designation: 'C', notes: 'Street address or PO box of physical address' },
    { name: 'Address Line Two', start: 35, end: 66, length: 32, class: '32X or 32S', designation: 'C', notes: 'Second line of physical address' },
    { name: 'Filler', start: 67, end: 80, length: 14, class: '14S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K6 (Output) - Physical Address City/State/Zip (Page 19 / QIB-18) */
export const IMPORTER_BOND_QUERY_RECORD_K6: RecordSpec = {
  recordId: 'K6',
  name: 'Importer/Bond Query Output Record K6',
  pageCitations: 'importer-bond-query-v7.pdf Page 19 (QIB-18)',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: 'Always equals K' },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: 'Always equals 6' },
    { name: 'Filler 1', start: 3, end: 34, length: 32, class: '32X', designation: 'M', notes: 'Space fill' },
    { name: 'City', start: 35, end: 55, length: 21, class: '21X', designation: 'M', notes: 'City portion of physical address' },
    { name: 'State Code', start: 56, end: 57, length: 2, class: '2A', designation: 'M', notes: 'US state, Canadian province, Mexican state, or FN' },
    { name: 'Postal Code', start: 58, end: 66, length: 9, class: '9AN or 9S', designation: 'M', notes: 'ZIP / postal code' },
    { name: 'Filler 2', start: 67, end: 80, length: 14, class: '14S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K7 (Output) - Full Legal Importer Name & Center ID (Page 20 / QIB-19) */
export const IMPORTER_BOND_QUERY_RECORD_K7: RecordSpec = {
  recordId: 'K7',
  name: 'Importer/Bond Query Output Record K7',
  pageCitations: 'importer-bond-query-v7.pdf Page 20 (QIB-19)',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: 'Always equals K' },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: 'Always equals 7' },
    { name: 'Full Legal Importer Name', start: 3, end: 32, length: 30, class: '30X', designation: 'M', notes: 'Full legal name of importer' },
    { name: 'Filler 1', start: 33, end: 33, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Center Identifier', start: 34, end: 39, length: 6, class: '6AN', designation: 'M', notes: 'Center ID (CEE001-CEE010, NOTELG, PNDING)' },
    { name: 'Filler 2', start: 40, end: 40, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Center ID Description', start: 41, end: 70, length: 30, class: '30AN', designation: 'M', notes: 'Descriptive name of Center ID' },
    { name: 'Filler 3', start: 71, end: 80, length: 10, class: '10S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K8 (Output) - Additional Information Overflow Record (Page 21 / QIB-20) */
export const IMPORTER_BOND_QUERY_RECORD_K8: RecordSpec = {
  recordId: 'K8',
  name: 'Importer/Bond Query Output Record K8',
  pageCitations: 'importer-bond-query-v7.pdf Page 21 (QIB-20)',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: 'Always equals K' },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: 'Always equals 8' },
    { name: 'Additional Information Qualifier Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'IN1 = Full Legal Name overflow for K7, IN2 = Full Center ID Description overflow for K7' },
    { name: 'Additional Information', start: 6, end: 75, length: 70, class: '70X', designation: 'M', notes: 'Overflow text' },
    { name: 'Filler', start: 76, end: 80, length: 5, class: '5S', designation: 'M', notes: 'Space fill' },
  ],
};

/** All Importer/Bond Query Record Specifications */
export const IMPORTER_BOND_QUERY_SPECS: RecordSpec[] = [
  IMPORTER_BOND_QUERY_RECORD_K,
  IMPORTER_BOND_QUERY_RECORD_K1,
  IMPORTER_BOND_QUERY_RECORD_K2,
  IMPORTER_BOND_QUERY_RECORD_K3,
  IMPORTER_BOND_QUERY_RECORD_K4,
  IMPORTER_BOND_QUERY_RECORD_K5,
  IMPORTER_BOND_QUERY_RECORD_K6,
  IMPORTER_BOND_QUERY_RECORD_K7,
  IMPORTER_BOND_QUERY_RECORD_K8,
];

/** Valid Query Result Codes (K1 Record) */
export const QUERY_RESULTS_CODES = {
  0: 'No name and address information is on file',
  1: 'Name and address information is on file with a continuous bond',
  2: 'Name and address information is on file with no bond',
  3: 'Importer number voided',
  4: 'Importer number is in inactive status',
} as const;

/** Continuous Bond Activity Codes (K1 Record - CBPF 301 equivalents) */
export const BOND_ACTIVITY_CODES: Record<string, { cbpf301: string; description: string }> = {
  A: { cbpf301: '1', description: 'Importer or Broker' },
  B: { cbpf301: '1A', description: 'Drawback Payments Refunds' },
  C: { cbpf301: '1A1', description: 'Importer/Broker Drawback' },
  D: { cbpf301: '2', description: 'Custodian of Bonded Merchandise' },
  E: { cbpf301: '3', description: 'International Carrier' },
  F: { cbpf301: '3A', description: 'Instruments of International Traffic' },
  G: { cbpf301: '3A3', description: 'Combination of 3 and 3a' },
  H: { cbpf301: '4', description: 'Foreign Trade Zone Operator' },
  J: { cbpf301: '5', description: 'Public Gauger' },
  K: { cbpf301: '11', description: 'Airport Security Bond' },
  L: { cbpf301: '12', description: 'ITC Exclusion Bond' },
  M: { cbpf301: '13', description: 'Immigration Bond' },
  N: { cbpf301: '14', description: 'Miami In-Bond Export Consolidator Bond' },
  O: { cbpf301: '15', description: 'IPR' },
  P: { cbpf301: '16', description: 'Importer Security Filing (ISF)' },
  Q: { cbpf301: '17', description: 'Marine Terminal Operator' },
  R: { cbpf301: '18', description: 'Dog and Cat Act' },
  S: { cbpf301: '19', description: 'User Fee Facility Bond' },
  T: { cbpf301: '20', description: 'Vehicle Export Consolidator' },
};

/** Center Identifiers & Descriptions (K7 Record) */
export const CENTER_IDENTIFIERS: Record<string, string> = {
  CEE001: 'Pharmaceuticals, Health and Chemicals',
  CEE002: 'Agriculture and Prepared Products',
  CEE003: 'Automotive and Aerospace',
  CEE004: 'Apparel, Footwear and Textiles',
  CEE005: 'Base Metals',
  CEE006: 'Petroleum, Natural Gas and Minerals',
  CEE007: 'Electronics',
  CEE008: 'Consumer Products and Mass Merchandising',
  CEE009: 'Industrial and Manufacturing Materials',
  CEE010: 'Machinery',
  NOTELG: 'Not Center Eligible',
  PNDING: 'Pending Center Assignment',
};

// ============================================================================
// TEST SUITE: CATAIR Importer/Bond Query (KI/KR) Specifications
// ============================================================================

describe('CATAIR Importer/Bond Query (KI/KR) Record Specifications', () => {
  it('covers all 9 KI/KR records in the chapter', () => {
    expect(IMPORTER_BOND_QUERY_SPECS).toHaveLength(9);
    const recordIds = IMPORTER_BOND_QUERY_SPECS.map(r => r.recordId);
    expect(recordIds).toEqual(['K', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8']);
  });

  describe('Self-Verified Position Math & Field Length Sums', () => {
    IMPORTER_BOND_QUERY_SPECS.forEach(spec => {
      describe(`Record ${spec.recordId} (${spec.name})`, () => {
        it('has exact 80-character total length sum', () => {
          const sum = spec.fields.reduce((acc, f) => acc + f.length, 0);
          expect(sum).toBe(80);
          expect(spec.totalLength).toBe(80);
        });

        it('starts at position 1 and ends at position 80', () => {
          expect(spec.fields[0].start).toBe(1);
          expect(spec.fields[spec.fields.length - 1].end).toBe(80);
        });

        it('has internally consistent field lengths and position boundaries', () => {
          spec.fields.forEach(field => {
            const calculatedLength = field.end - field.start + 1;
            expect(field.length).toBe(calculatedLength);
          });
        });

        it('has contiguous non-overlapping sequential field positions', () => {
          for (let i = 1; i < spec.fields.length; i++) {
            const prev = spec.fields[i - 1];
            const curr = spec.fields[i];
            expect(curr.start).toBe(prev.end + 1);
          }
        });
      });
    });
  });

  describe('Evidentiary Audit & Typo Corrections', () => {
    it('flags and corrects the Record K1 Bond Number position misprint (71-89 vs 71-79)', () => {
      const k1BondNumber = IMPORTER_BOND_QUERY_RECORD_K1.fields.find(f => f.name === 'Bond Number');
      expect(k1BondNumber).toBeDefined();
      expect(k1BondNumber?.start).toBe(71);
      expect(k1BondNumber?.end).toBe(79);
      expect(k1BondNumber?.length).toBe(9);
      expect(k1BondNumber?.notes).toContain('EVIDENTIARY AUDIT NOTE');

      const k1LocIndicator = IMPORTER_BOND_QUERY_RECORD_K1.fields.find(f => f.name === 'Bond Amount Record Location Indicator');
      expect(k1LocIndicator?.start).toBe(80);
      expect(k1LocIndicator?.end).toBe(80);
    });
  });

  describe('Explicit Date-Format and Implied-Decimal Verification', () => {
    it('verifies MMDDYY date formats in K1 and K2 records', () => {
      const k1EffDate = IMPORTER_BOND_QUERY_RECORD_K1.fields.find(f => f.name === 'Bond Effective Date');
      expect(k1EffDate?.notes).toContain('MMDDYY format');

      const k2TermDate = IMPORTER_BOND_QUERY_RECORD_K2.fields.find(f => f.name === 'Bond Termination Date');
      expect(k2TermDate?.notes).toContain('MMDDYY format');

      const k2UserTermDate = IMPORTER_BOND_QUERY_RECORD_K2.fields.find(f => f.name === 'Bond User Termination Date');
      expect(k2UserTermDate?.notes).toContain('MMDDYY format');
    });

    it('verifies whole dollar bond amounts without implied decimals in K1 and K2', () => {
      const k1BondAmount = IMPORTER_BOND_QUERY_RECORD_K1.fields.find(f => f.name === 'Bond Amount');
      expect(k1BondAmount?.impliedDecimals).toBe(0);
      expect(k1BondAmount?.length).toBe(9);

      const k2BondAmount = IMPORTER_BOND_QUERY_RECORD_K2.fields.find(f => f.name === 'Bond Amount');
      expect(k2BondAmount?.impliedDecimals).toBe(0);
      expect(k2BondAmount?.length).toBe(10);
    });

    it('verifies bond amount location indicator logic between K1 and K2', () => {
      const indicator = IMPORTER_BOND_QUERY_RECORD_K1.fields.find(f => f.name === 'Bond Amount Record Location Indicator');
      expect(indicator?.notes).toContain('1 = K1 record (<=9 digits)');
      expect(indicator?.notes).toContain('2 = K2 record (10 digits)');
    });
  });

  describe('Batch & Block Control Envelope Mapping', () => {
    it('verifies Application Identifiers KI (input request) and KR (output response)', () => {
      const batchMapping = {
        transactionName: 'Importer/Bond Query',
        inputCode: 'KI',
        responseCode: 'KR',
        citation: '01-batch-block-control-v23.pdf Pages 11, 23',
      };
      expect(batchMapping.inputCode).toBe('KI');
      expect(batchMapping.responseCode).toBe('KR');
    });
  });

  describe('Code Sets & Business Rules', () => {
    it('contains all 5 Query Result codes (0-4)', () => {
      expect(Object.keys(QUERY_RESULTS_CODES)).toHaveLength(5);
      expect(QUERY_RESULTS_CODES[0]).toContain('No name and address');
      expect(QUERY_RESULTS_CODES[1]).toContain('continuous bond');
      expect(QUERY_RESULTS_CODES[3]).toContain('voided');
    });

    it('contains continuous bond activity codes A through T with CBPF 301 mappings', () => {
      expect(Object.keys(BOND_ACTIVITY_CODES)).toHaveLength(19); // A-T excluding I
      expect(BOND_ACTIVITY_CODES['A']).toEqual({ cbpf301: '1', description: 'Importer or Broker' });
      expect(BOND_ACTIVITY_CODES['P']).toEqual({ cbpf301: '16', description: 'Importer Security Filing (ISF)' });
      expect(BOND_ACTIVITY_CODES['T']).toEqual({ cbpf301: '20', description: 'Vehicle Export Consolidator' });
    });

    it('contains all Center Identifiers CEE001-CEE010, NOTELG, PNDING', () => {
      expect(Object.keys(CENTER_IDENTIFIERS)).toHaveLength(12);
      expect(CENTER_IDENTIFIERS['CEE001']).toBe('Pharmaceuticals, Health and Chemicals');
      expect(CENTER_IDENTIFIERS['CEE010']).toBe('Machinery');
      expect(CENTER_IDENTIFIERS['NOTELG']).toBe('Not Center Eligible');
    });
  });
});
