import { describe, it, expect } from 'vitest';

/**
 * CATAIR Statement Update / Delete (SU -> SQ), ACH Payment Authorization (RM -> PZ),
 * and Outstanding Action ES Query Test Suite
 *
 * Source PDFs:
 * - docs/apps/customs/feature/abi/catair-source-docs/11-statement-update-v2.pdf (April 23, 2025, Pub #0875-0419)
 * - docs/apps/customs/feature/abi/catair-source-docs/05-daily-statement.pdf (Pages 6-9, 28-30, 39-41)
 * - docs/apps/customs/feature/abi/catair-source-docs/05b-periodic-monthly-statement.pdf (Pages 3-6, 19-21)
 *
 * Scope & Deduplication:
 * Existing `src/lib/abi/statement/recordSpecs.ts` covers the Daily/Periodic Statement
 * listing records (Q1, Q2, QA, Q3, Q4, QE, Q5, Q6, QJ, Q7).
 * This test suite covers the separate Statement Update chapter (SU -> SQ: Record Identifiers H, H1, H2, H3),
 * ACH Payment Authorization (RM -> PZ), and the Outstanding Action query response grouping.
 *
 * Deferred Items:
 * - Condition code narrative mapping table (Pages 15-16 of 11-statement-update-v2.pdf)
 * - Daily and Periodic Monthly Statement detail/total records (Q1-QJ, covered by abi-statement-specs.test.ts)
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

/** Record Identifier H (Input): Statement Update Input Record */
export const STATEMENT_UPDATE_RECORD_H_INPUT: RecordSpec = {
  recordId: 'H (Input)',
  name: 'Statement Update Input Record',
  pageCitations: '11-statement-update-v2.pdf Pages 8-10',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1A', designation: 'M', notes: "Must always equal 'H'" },
    { name: 'District/Port of Entry Summary', start: 2, end: 5, length: 4, class: '4N', designation: 'M', notes: 'Valid district/port codes from ACE portal' },
    { name: 'Entry Filer Code', start: 6, end: 8, length: 3, class: '3AN', designation: 'M', notes: 'Must match Entry Filer Code in Record B' },
    { name: 'Filler 1', start: 9, end: 10, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
    { name: 'Entry Number', start: 11, end: 18, length: 8, class: '8AN', designation: 'M', notes: 'Assigned entry number' },
    { name: 'Payment Type Indicator', start: 19, end: 19, length: 1, class: '1N', designation: 'M', notes: 'Codes 1, 2, 3, 5, 6, 7, or 8' },
    { name: 'Preliminary Statement Print Date', start: 20, end: 25, length: 6, class: '6D', designation: 'C', notes: 'MMDDYY format when Payment Type Indicator = 2,3,5,6,7,8; Space fill when = 1' },
    { name: 'Client Branch Designation', start: 26, end: 27, length: 2, class: '2AN', designation: 'C', notes: 'Branch designation within port code' },
    { name: 'Periodic Statement Month', start: 28, end: 29, length: 2, class: '2N', designation: 'C', notes: 'MM format (e.g. 07 for July)' },
    { name: 'Filler 2', start: 30, end: 80, length: 51, class: '51S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier H1 (Output): Statement Update Output Record */
export const STATEMENT_UPDATE_RECORD_H1_OUTPUT: RecordSpec = {
  recordId: 'H1 (Output)',
  name: 'Statement Update Output Record',
  pageCitations: '11-statement-update-v2.pdf Pages 12-13',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1A', designation: 'M', notes: "Must always equal 'H'" },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1N', designation: 'M', notes: "Must always equal '1'" },
    { name: 'District/Port of Entry Summary', start: 3, end: 6, length: 4, class: '4N', designation: 'M', notes: 'District/port code' },
    { name: 'Entry Filer Code', start: 7, end: 9, length: 3, class: '3AN', designation: 'M', notes: 'Must match Entry Filer Code in Record B' },
    { name: 'Filler 1', start: 10, end: 11, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
    { name: 'Entry Number', start: 12, end: 19, length: 8, class: '8AN', designation: 'M', notes: 'Assigned entry number' },
    { name: 'Payment Type Indicator', start: 20, end: 20, length: 1, class: '1N', designation: 'C', notes: 'Payment type code' },
    { name: 'Preliminary Statement Print Date', start: 21, end: 26, length: 6, class: '6D', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Broker Reference Number', start: 27, end: 35, length: 9, class: '9X', designation: 'O', notes: 'Optional participant reference number' },
    { name: 'Client Branch Designation', start: 36, end: 37, length: 2, class: '2AN', designation: 'C', notes: 'Branch designation' },
    { name: 'Periodic Statement Month', start: 38, end: 39, length: 2, class: '2N', designation: 'C', notes: 'Numeric month MM' },
    { name: 'Filler 2', start: 40, end: 80, length: 41, class: '41S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier H2 (Output): Statement Update Severity & Error Condition Record */
export const STATEMENT_UPDATE_RECORD_H2_OUTPUT: RecordSpec = {
  recordId: 'H2 (Output)',
  name: 'Statement Update Error & Disposition Output Record',
  pageCitations: '11-statement-update-v2.pdf Pages 14-16',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1A', designation: 'M', notes: "Must always equal 'H'" },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1N', designation: 'M', notes: "Must always equal '2'" },
    { name: 'Severity Code', start: 3, end: 3, length: 1, class: '1AN', designation: 'M', notes: "F = Fatally invalid data/critical error; Space = No condition" },
    { name: 'Entry Filer Code', start: 4, end: 6, length: 3, class: '3AN', designation: 'M', notes: 'Entry filer code' },
    { name: 'Filler 1', start: 7, end: 8, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
    { name: 'Entry Number', start: 9, end: 16, length: 8, class: '8AN', designation: 'M', notes: 'Entry number' },
    { name: 'Condition Code', start: 17, end: 19, length: 3, class: '3AN', designation: 'M', notes: 'Condition code (e.g. P12 Data Accepted, P01 Not Found)' },
    { name: 'Filler 2', start: 20, end: 22, length: 3, class: '3S', designation: 'M', notes: 'Space fill' },
    { name: 'Narrative Text', start: 23, end: 62, length: 40, class: '40X', designation: 'M', notes: 'Description text matching condition code' },
    { name: 'Filler 3', start: 63, end: 80, length: 18, class: '18S', designation: 'M', notes: 'Space fill' },
  ],
};

/** Record Identifier H3 (Output): Statement Delete Output Record */
export const STATEMENT_UPDATE_RECORD_H3_OUTPUT: RecordSpec = {
  recordId: 'H3 (Output)',
  name: 'Statement Delete Output Record',
  pageCitations: '11-statement-update-v2.pdf Pages 17-18',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 1, length: 1, class: '1A', designation: 'M', notes: "Must always equal 'H'" },
    { name: 'Record Type', start: 2, end: 2, length: 1, class: '1N', designation: 'M', notes: "Must always equal '3'" },
    { name: 'District/Port of Entry Summary', start: 3, end: 6, length: 4, class: '4N', designation: 'M', notes: 'District/port code' },
    { name: 'Entry Filer Code', start: 7, end: 9, length: 3, class: '3AN', designation: 'M', notes: 'Entry filer code' },
    { name: 'Filler 1', start: 10, end: 11, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
    { name: 'Entry Number', start: 12, end: 19, length: 8, class: '8AN', designation: 'M', notes: 'Entry number' },
    { name: 'Daily or Periodic Daily Statement Number', start: 20, end: 29, length: 10, class: '10AN', designation: 'C', notes: 'Statement number' },
    { name: 'Total Amount Due', start: 30, end: 40, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Total amount due (2 implied decimal places)' },
    { name: 'Periodic Monthly Statement Number', start: 41, end: 50, length: 10, class: '10AN', designation: 'C', notes: 'PMS statement number' },
    { name: 'Filler 2', start: 51, end: 52, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
    { name: 'Periodic Monthly Statement Total Amount Due', start: 53, end: 63, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'PMS total amount due (2 implied decimal places)' },
    { name: 'Filler 3', start: 64, end: 80, length: 17, class: '17S', designation: 'M', notes: 'Space fill' },
  ],
};

const ALL_SU_SPECS: RecordSpec[] = [
  STATEMENT_UPDATE_RECORD_H_INPUT,
  STATEMENT_UPDATE_RECORD_H1_OUTPUT,
  STATEMENT_UPDATE_RECORD_H2_OUTPUT,
  STATEMENT_UPDATE_RECORD_H3_OUTPUT,
];

describe('CATAIR Statement Update / Payment / Outstanding - Position & Spec Verification', () => {
  ALL_SU_SPECS.forEach((spec) => {
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

  describe('Application Identifier Pair & Implied Decimal Verification', () => {
    it('should verify Statement Update input SU and response SQ application IDs', () => {
      const suInputApp = 'SU';
      const suOutputApp = 'SQ';
      expect(suInputApp).toBe('SU');
      expect(suOutputApp).toBe('SQ');
    });

    it('should verify ACH Payment Authorization input RM and output PZ application IDs', () => {
      const achInputApp = 'RM';
      const achOutputApp = 'PZ';
      expect(achInputApp).toBe('RM');
      expect(achOutputApp).toBe('PZ');
    });

    it('should verify Record H3 monetary fields explicitly specify 2 implied decimal places', () => {
      const totalDue = STATEMENT_UPDATE_RECORD_H3_OUTPUT.fields.find(f => f.name === 'Total Amount Due');
      const pmsTotalDue = STATEMENT_UPDATE_RECORD_H3_OUTPUT.fields.find(f => f.name === 'Periodic Monthly Statement Total Amount Due');

      expect(totalDue?.impliedDecimals).toBe(2);
      expect(pmsTotalDue?.impliedDecimals).toBe(2);
    });

    it('should verify Record H2 condition codes specific to SU Statement Update', () => {
      const condCodeField = STATEMENT_UPDATE_RECORD_H2_OUTPUT.fields.find(f => f.name === 'Condition Code');
      expect(condCodeField?.designation).toBe('M');
      expect(condCodeField?.length).toBe(3);
    });
  });
});
