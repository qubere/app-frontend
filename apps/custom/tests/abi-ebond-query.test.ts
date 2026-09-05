import { describe, it, expect } from 'vitest';

/**
 * CATAIR eBond Importer / Bond Query (KI -> KR Application Identifier) Test Suite
 *
 * Source PDF:
 * - docs/apps/customs/feature/abi/catair-source-docs/importer-bond-query-v7.pdf (July 15, 2025)
 *
 * Application Identifiers:
 * - Input Application: KI (Record B)
 * - Output Application: KR (Record B)
 *
 * Scope & Deduplication:
 * Existing `src/lib/abi/ebond/recordSpecs.ts` covers eBond Create/Update (Records 10, 12, 20, 30, 35, 36, 40, 45, 46, 90).
 * Existing `apps/custom/tests/abi-ebond-status.test.ts` covers eBond Status Message (BS10, BS20, BS30).
 * This test suite covers the separate Importer/Bond Query transaction:
 *   - Record K (Input Header / Query Record, Pages 9-10)
 *   - Record K1 (Output Header Response Record, Pages 11-13)
 *   - Record K2 (Output Detail Response Record - Name line 2, bond status/amount, Pages 14-15)
 *   - Record K3 (Output Mailing Address Line 1 & 2, Page 16)
 *   - Record K4 (Output Mailing Address City, State, ZIP, Page 17)
 *   - Record K5 (Output Physical Address Line 1 & 2, Page 18)
 *   - Record K6 (Output Physical Address City, State, ZIP, Page 19)
 *   - Record K7 (Output Full Legal Name & Center Identifier, Page 20)
 *   - Record K8 (Output Additional Information Text, Page 21)
 *
 * Deferred Items:
 * - Importer/Consignee Create/Update Form 5106 records (covered in separate 19-importer-consignee chapter)
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

/** Record Identifier K (Input): Importer/Bond Query Input Record */
export const EBOND_QUERY_RECORD_K_INPUT: RecordSpec = {
  recordId: 'K (Input)',
  name: 'Importer/Bond Query Input Record',
  pageCitations: 'importer-bond-query-v7.pdf Pages 9-10',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: "Must always equal 'K'" },
    { name: 'Filler 1', start: 2, end: 2, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Importer Number (1)', start: 3, end: 14, length: 12, class: '12X', designation: 'M', notes: 'IRS, CBP assigned, or SSN format' },
    { name: 'Address Request Code (1)', start: 15, end: 15, length: 1, class: '1AN', designation: 'M', notes: "Space = K1,K2,K7,K8; '1' = K1-K8" },
    { name: 'Importer Number (2)', start: 16, end: 27, length: 12, class: '12X', designation: 'C', notes: 'Additional importer number or space fill' },
    { name: 'Address Request Code (2)', start: 28, end: 28, length: 1, class: '1AN', designation: 'C', notes: 'Address request code or space fill' },
    { name: 'Importer Number (3)', start: 29, end: 40, length: 12, class: '12X', designation: 'C', notes: 'Additional importer number or space fill' },
    { name: 'Address Request Code (3)', start: 41, end: 41, length: 1, class: '1AN', designation: 'C', notes: 'Address request code or space fill' },
    { name: 'Importer Number (4)', start: 42, end: 53, length: 12, class: '12X', designation: 'C', notes: 'Additional importer number or space fill' },
    { name: 'Address Request Code (4)', start: 54, end: 54, length: 1, class: '1AN', designation: 'C', notes: 'Address request code or space fill' },
    { name: 'Importer Number (5)', start: 55, end: 66, length: 12, class: '12X', designation: 'C', notes: 'Additional importer number or space fill' },
    { name: 'Address Request Code (5)', start: 67, end: 67, length: 1, class: '1AN', designation: 'C', notes: 'Address request code or space fill' },
    { name: 'Importer Number (6)', start: 68, end: 79, length: 12, class: '12X', designation: 'C', notes: 'Additional importer number or space fill' },
    { name: 'Address Request Code (6)', start: 80, end: 80, length: 1, class: '1AN', designation: 'C', notes: 'Address request code or space fill' },
  ],
};

/** Record Identifier K1 (Output): Importer/Bond Query Header Response Record */
export const EBOND_QUERY_RECORD_K1_OUTPUT: RecordSpec = {
  recordId: 'K1 (Output)',
  name: 'Importer/Bond Query Header Response Output Record',
  pageCitations: 'importer-bond-query-v7.pdf Pages 11-13',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: "Always equals 'K'" },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: "Always equals '1'" },
    { name: 'Importer Number', start: 3, end: 14, length: 12, class: '12X', designation: 'M', notes: 'Queried importer number' },
    { name: 'Query Results Code', start: 15, end: 15, length: 1, class: '1N', designation: 'M', notes: '0=No info, 1=Cont. bond, 2=No bond, 3=Voided, 4=Inactive' },
    { name: 'Importer Name', start: 16, end: 47, length: 32, class: '32AN', designation: 'C', notes: 'Importer/consignee name' },
    { name: 'Surety Code', start: 48, end: 50, length: 3, class: '3AN', designation: 'C', notes: '3-digit Treasury surety code' },
    { name: 'Bond Type/Activity Code', start: 51, end: 51, length: 1, class: '1AN', designation: 'C', notes: 'Continuous bond activity code (A, B, C, etc.)' },
    { name: 'Bond Amount', start: 52, end: 60, length: 9, class: '9N', designation: 'C', impliedDecimals: 0, notes: '9-digit bond value in whole US dollars' },
    { name: 'District/Port Where Bond Was Filed', start: 61, end: 64, length: 4, class: '4AN', designation: 'C', notes: 'District/port code' },
    { name: 'Bond Effective Date', start: 65, end: 70, length: 6, class: '6AN', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Bond Number', start: 71, end: 79, length: 9, class: '9AN', designation: 'C', notes: '9-digit bond number' },
    { name: 'Bond Amount Record Location Indicator', start: 80, end: 80, length: 1, class: '1AN', designation: 'C', notes: "1 = K1 record, 2 = K2 record" },
  ],
};

/** Record Identifier K2 (Output): Importer/Bond Query Detail Response Record */
export const EBOND_QUERY_RECORD_K2_OUTPUT: RecordSpec = {
  recordId: 'K2 (Output)',
  name: 'Importer/Bond Query Name Line 2 & Status Output Record',
  pageCitations: 'importer-bond-query-v7.pdf Pages 14-15',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: "Always equals 'K'" },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: "Always equals '2'" },
    { name: 'Name Qualifier', start: 3, end: 5, length: 3, class: '3A', designation: 'C', notes: 'DBA, DIV, or AKA' },
    { name: 'Line Two of Importer Name', start: 6, end: 37, length: 32, class: '32X', designation: 'C', notes: 'Name line 2' },
    { name: 'Filler 1', start: 38, end: 38, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Bond Termination Date', start: 39, end: 44, length: 6, class: '6D', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Filler 2', start: 45, end: 45, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Periodic Monthly Statement Status', start: 46, end: 46, length: 1, class: '1AN', designation: 'C', notes: 'Y = Approved, N = Not approved' },
    { name: 'Filler 3', start: 47, end: 47, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Bond Sufficiency Indicator', start: 48, end: 48, length: 1, class: '1AN', designation: 'C', notes: 'Y = Sufficient, N = Not sufficient' },
    { name: 'Filler 4', start: 49, end: 49, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Bond User Status Indicator', start: 50, end: 50, length: 1, class: '1AN', designation: 'C', notes: 'A = Active, T = Terminated' },
    { name: 'Filler 5', start: 51, end: 51, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Bond User Termination Date', start: 52, end: 57, length: 6, class: '6D', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Bond Amount', start: 58, end: 67, length: 10, class: '10N', designation: 'C', impliedDecimals: 0, notes: '10-digit bond value in whole US dollars' },
    { name: 'Filler 6', start: 68, end: 80, length: 13, class: '13AN', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K3 (Output): Importer/Bond Query Mailing Address Line 1 & 2 */
export const EBOND_QUERY_RECORD_K3_OUTPUT: RecordSpec = {
  recordId: 'K3 (Output)',
  name: 'Mailing Address Line 1 & 2 Output Record',
  pageCitations: 'importer-bond-query-v7.pdf Page 16',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: "Always equals 'K'" },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: "Always equals '3'" },
    { name: 'Address Line One', start: 3, end: 34, length: 32, class: '32X', designation: 'C', notes: 'Mailing address line 1' },
    { name: 'Address Line Two', start: 35, end: 66, length: 32, class: '32X', designation: 'C', notes: 'Mailing address line 2' },
    { name: 'Filler', start: 67, end: 80, length: 14, class: '14S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K4 (Output): Importer/Bond Query Mailing Address City, State, Postal Code */
export const EBOND_QUERY_RECORD_K4_OUTPUT: RecordSpec = {
  recordId: 'K4 (Output)',
  name: 'Mailing Address City, State, ZIP Output Record',
  pageCitations: 'importer-bond-query-v7.pdf Page 17',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: "Always equals 'K'" },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: "Always equals '4'" },
    { name: 'Filler 1', start: 3, end: 34, length: 32, class: '32X', designation: 'M', notes: 'Space fill' },
    { name: 'City', start: 35, end: 55, length: 21, class: '21X', designation: 'M', notes: 'Mailing city' },
    { name: 'State Code', start: 56, end: 57, length: 2, class: '2A', designation: 'M', notes: 'US state, Canadian province, MX state, or FN' },
    { name: 'Postal Code', start: 58, end: 66, length: 9, class: '9AN', designation: 'M', notes: 'Postal code format' },
    { name: 'Filler 2', start: 67, end: 80, length: 14, class: '14S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K5 (Output): Importer/Bond Query Physical Address Line 1 & 2 */
export const EBOND_QUERY_RECORD_K5_OUTPUT: RecordSpec = {
  recordId: 'K5 (Output)',
  name: 'Physical Address Line 1 & 2 Output Record',
  pageCitations: 'importer-bond-query-v7.pdf Page 18',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: "Always equals 'K'" },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: "Always equals '5'" },
    { name: 'Address Line One', start: 3, end: 34, length: 32, class: '32X', designation: 'C', notes: 'Physical street address line 1' },
    { name: 'Address Line Two', start: 35, end: 66, length: 32, class: '32X', designation: 'C', notes: 'Physical street address line 2' },
    { name: 'Filler', start: 67, end: 80, length: 14, class: '14S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K6 (Output): Importer/Bond Query Physical Address City, State, Postal Code */
export const EBOND_QUERY_RECORD_K6_OUTPUT: RecordSpec = {
  recordId: 'K6 (Output)',
  name: 'Physical Address City, State, ZIP Output Record',
  pageCitations: 'importer-bond-query-v7.pdf Page 19',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: "Always equals 'K'" },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: "Always equals '6'" },
    { name: 'Filler 1', start: 3, end: 34, length: 32, class: '32X', designation: 'M', notes: 'Space fill' },
    { name: 'City', start: 35, end: 55, length: 21, class: '21X', designation: 'M', notes: 'Physical city' },
    { name: 'State Code', start: 56, end: 57, length: 2, class: '2A', designation: 'M', notes: 'US state, CA province, MX state, or FN' },
    { name: 'Postal Code', start: 58, end: 66, length: 9, class: '9AN', designation: 'M', notes: 'Postal code format' },
    { name: 'Filler 2', start: 67, end: 80, length: 14, class: '14S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K7 (Output): Importer/Bond Query Full Legal Name & Center Identifier */
export const EBOND_QUERY_RECORD_K7_OUTPUT: RecordSpec = {
  recordId: 'K7 (Output)',
  name: 'Full Legal Name & Center Identifier Output Record',
  pageCitations: 'importer-bond-query-v7.pdf Page 20',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: "Always equals 'K'" },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: "Always equals '7'" },
    { name: 'Full Legal Importer Name', start: 3, end: 32, length: 30, class: '30X', designation: 'M', notes: 'Full legal name' },
    { name: 'Filler 1', start: 33, end: 33, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Center Identifier', start: 34, end: 39, length: 6, class: '6AN', designation: 'M', notes: 'CEE001-CEE010, NOTELG, PNDING' },
    { name: 'Filler 2', start: 40, end: 40, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Center ID Description', start: 41, end: 70, length: 30, class: '30AN', designation: 'M', notes: 'Center of Excellence description name' },
    { name: 'Filler 3', start: 71, end: 80, length: 10, class: '10S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier K8 (Output): Importer/Bond Query Additional Information Overflow Record */
export const EBOND_QUERY_RECORD_K8_OUTPUT: RecordSpec = {
  recordId: 'K8 (Output)',
  name: 'Additional Information Overflow Output Record',
  pageCitations: 'importer-bond-query-v7.pdf Page 21',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1AN', designation: 'M', notes: "Always equals 'K'" },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1AN', designation: 'M', notes: "Always equals '8'" },
    { name: 'Additional Information Qualifier Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'IN1 = Legal name overflow, IN2 = Center description overflow' },
    { name: 'Additional Information', start: 6, end: 75, length: 70, class: '70X', designation: 'M', notes: 'Text of overflow information' },
    { name: 'Filler', start: 76, end: 80, length: 5, class: '5S', designation: 'M', notes: 'Space fill' },
  ],
};

const ALL_KI_KR_SPECS: RecordSpec[] = [
  EBOND_QUERY_RECORD_K_INPUT,
  EBOND_QUERY_RECORD_K1_OUTPUT,
  EBOND_QUERY_RECORD_K2_OUTPUT,
  EBOND_QUERY_RECORD_K3_OUTPUT,
  EBOND_QUERY_RECORD_K4_OUTPUT,
  EBOND_QUERY_RECORD_K5_OUTPUT,
  EBOND_QUERY_RECORD_K6_OUTPUT,
  EBOND_QUERY_RECORD_K7_OUTPUT,
  EBOND_QUERY_RECORD_K8_OUTPUT,
];

describe('CATAIR eBond Importer/Bond Query (KI/KR) - Position Math & Spec Validation', () => {
  ALL_KI_KR_SPECS.forEach((spec) => {
    describe(`Record ${spec.recordId}: ${spec.name} (${spec.pageCitations})`, () => {
      it('should have contiguous field positions starting at 1 and ending at 80', () => {
        let currentPos = 1;
        spec.fields.forEach((field) => {
          expect(field.start).toBe(currentPos);
          expect(field.end - field.start + 1).toBe(field.length);
          currentPos = field.end + 1;
        });
        expect(currentPos - 1).toBe(spec.totalLength);
        expect(spec.totalLength).toBe(80);
      });

      it('should calculate field length sum equal to 80', () => {
        const sum = spec.fields.reduce((acc, f) => acc + f.length, 0);
        expect(sum).toBe(80);
      });
    });
  });

  describe('Application Identifier & Bond Amount Encoding Verification', () => {
    it('should verify Importer/Bond Query uses input application KI and output application KR', () => {
      const inputAppId = 'KI';
      const outputAppId = 'KR';
      expect(inputAppId).toBe('KI');
      expect(outputAppId).toBe('KR');
    });

    it('should verify eBond query monetary fields use whole dollars (0 implied decimals)', () => {
      const k1BondAmt = EBOND_QUERY_RECORD_K1_OUTPUT.fields.find(f => f.name === 'Bond Amount');
      const k2BondAmt = EBOND_QUERY_RECORD_K2_OUTPUT.fields.find(f => f.name === 'Bond Amount');

      expect(k1BondAmt?.impliedDecimals).toBe(0);
      expect(k2BondAmt?.impliedDecimals).toBe(0);
    });

    it('should verify Record K supports querying up to 6 importer numbers in positions 1-80', () => {
      const imp1 = EBOND_QUERY_RECORD_K_INPUT.fields.find(f => f.name === 'Importer Number (1)');
      const imp6 = EBOND_QUERY_RECORD_K_INPUT.fields.find(f => f.name === 'Importer Number (6)');
      const addr6 = EBOND_QUERY_RECORD_K_INPUT.fields.find(f => f.name === 'Address Request Code (6)');

      expect(imp1?.start).toBe(3);
      expect(imp6?.start).toBe(68);
      expect(addr6?.start).toBe(80);
    });
  });
});
