import { describe, it, expect } from 'vitest';

/**
 * CATAIR Entry Summary Create/Update (AE/AX) - Declarations, Fees, PSC, and Census Override Records Test Suite (E3)
 * Source: docs/plans/catair-source-docs/02-entry-summary-create-update-2026-07.pdf
 */

interface FieldSpec {
  name: string;
  start: number;
  end: number;
  length: number;
  class: string;
  designation: 'M' | 'C' | 'O';
  impliedDecimals?: number;
  notes?: string;
}

interface RecordSpec {
  recordId: string;
  name: string;
  pageCitations: string;
  totalLength: number;
  fields: FieldSpec[];
}

export const DECLARATION_RECORD_54: RecordSpec = {
  recordId: '54',
  name: 'Importer\'s Additional Declaration Detail',
  pageCitations: 'Page 101',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Importer\'s Additional Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: '01=Softwood, 02=Steel Exclusion, 03=Aluminum Exclusion, 05=CBMA, 07=Aluminum Smelt/Cast, 08=Steel Melt/Pour, 10=Ship-to-Shore, 11=Auto Parts, 12=Copper' },
    { name: 'Importer\'s Additional Declaration Information', start: 5, end: 80, length: 76, class: '76X', designation: 'M' },
  ],
};

export const HEADER_FEES_RECORD_34: RecordSpec = {
  recordId: '34',
  name: 'Entry Summary Header Fees',
  pageCitations: 'Page 53',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Accounting Class Code (1)', start: 3, end: 5, length: 3, class: '3AN', designation: 'M' },
    { name: 'Header Fee Amount (1)', start: 6, end: 13, length: 8, class: '8(S)N', designation: 'M', impliedDecimals: 2 },
    { name: 'Accounting Class Code (2)', start: 14, end: 16, length: 3, class: '3AN', designation: 'C' },
    { name: 'Header Fee Amount (2)', start: 17, end: 24, length: 8, class: '8(S)N or 8S', designation: 'C', impliedDecimals: 2 },
    { name: 'Filler', start: 25, end: 80, length: 56, class: '56S', designation: 'M' },
  ],
};

export const LINE_USER_FEE_RECORD_62: RecordSpec = {
  recordId: '62',
  name: 'Line User Fee Detail',
  pageCitations: 'Page 120',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Accounting Class Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M' },
    { name: 'User Fee Amount', start: 6, end: 13, length: 8, class: '8(S)N', designation: 'M', impliedDecimals: 2 },
    { name: 'Filler', start: 14, end: 80, length: 67, class: '67S', designation: 'M' },
  ],
};

export const IR_TAX_RECORD_60: RecordSpec = {
  recordId: '60',
  name: 'IR Tax Information',
  pageCitations: 'Page 118',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Accounting Class Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M' },
    { name: 'IR Tax Amount', start: 6, end: 15, length: 10, class: '10(S)N', designation: 'M', impliedDecimals: 2 },
    { name: 'Filler', start: 16, end: 80, length: 65, class: '65S', designation: 'M' },
  ],
};

export const OTHER_REVENUE_RECORD_61: RecordSpec = {
  recordId: '61',
  name: 'Other Revenue Information',
  pageCitations: 'Page 118',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Accounting Class Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M' },
    { name: 'Other Revenue Amount', start: 6, end: 15, length: 10, class: '10(S)N', designation: 'M', impliedDecimals: 2 },
    { name: 'Filler', start: 16, end: 80, length: 65, class: '65S', designation: 'M' },
  ],
};

export const PSC_HEADER_REASONS_35: RecordSpec = {
  recordId: '35',
  name: 'PSC Header Reasons',
  pageCitations: 'Page 54',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Post Summary Correction Header Reason Code (1)', start: 3, end: 5, length: 3, class: '3AN', designation: 'M' },
    { name: 'Post Summary Correction Header Reason Code (2)', start: 6, end: 8, length: 3, class: '3AN', designation: 'C' },
    { name: 'Post Summary Correction Header Reason Code (3)', start: 9, end: 11, length: 3, class: '3AN', designation: 'C' },
    { name: 'Post Summary Correction Header Reason Code (4)', start: 12, end: 14, length: 3, class: '3AN', designation: 'C' },
    { name: 'Post Summary Correction Header Reason Code (5)', start: 15, end: 17, length: 3, class: '3AN', designation: 'C' },
    { name: 'Filler', start: 18, end: 80, length: 63, class: '63S', designation: 'M' },
  ],
};

export const PSC_EXPLANATION_36: RecordSpec = {
  recordId: '36',
  name: 'PSC Filing Explanation',
  pageCitations: 'Page 55',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'PSC Filing Explanation Text', start: 3, end: 77, length: 75, class: '75X', designation: 'M' },
    { name: 'Filler', start: 78, end: 80, length: 3, class: '3S', designation: 'M' },
  ],
};

export const PSC_LINE_REASONS_63: RecordSpec = {
  recordId: '63',
  name: 'PSC Line Reasons',
  pageCitations: 'Page 125',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Post Summary Correction Line Reason Code (1)', start: 3, end: 5, length: 3, class: '3AN', designation: 'M' },
    { name: 'Post Summary Correction Line Reason Code (2)', start: 6, end: 8, length: 3, class: '3AN', designation: 'C' },
    { name: 'Post Summary Correction Line Reason Code (3)', start: 9, end: 11, length: 3, class: '3AN', designation: 'C' },
    { name: 'Post Summary Correction Line Reason Code (4)', start: 12, end: 14, length: 3, class: '3AN', designation: 'C' },
    { name: 'Post Summary Correction Line Reason Code (5)', start: 15, end: 17, length: 3, class: '3AN', designation: 'C' },
    { name: 'Filler', start: 18, end: 80, length: 63, class: '63S', designation: 'M' },
  ],
};

export const CENSUS_OVERRIDE_CW02: RecordSpec = {
  recordId: 'CW02',
  name: 'Census Warning Condition Override Information',
  pageCitations: 'Page 126',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M' },
    { name: 'Filler', start: 5, end: 9, length: 5, class: '5S', designation: 'M' },
    { name: 'Census Warning Condition Code (1)', start: 10, end: 12, length: 3, class: '3AN', designation: 'M' },
    { name: 'Census Warning Condition Override Code (1)', start: 13, end: 14, length: 2, class: '2AN', designation: 'M' },
    { name: 'Census Warning Condition Code (2)', start: 15, end: 17, length: 3, class: '3AN', designation: 'C' },
    { name: 'Census Warning Condition Override Code (2)', start: 18, end: 19, length: 2, class: '2AN', designation: 'C' },
    { name: 'Census Warning Condition Code (3)', start: 20, end: 22, length: 3, class: '3AN', designation: 'C' },
    { name: 'Census Warning Condition Override Code (3)', start: 23, end: 24, length: 2, class: '2AN', designation: 'C' },
    { name: 'Census Warning Condition Code (4)', start: 25, end: 27, length: 3, class: '3AN', designation: 'C' },
    { name: 'Census Warning Condition Override Code (4)', start: 28, end: 29, length: 2, class: '2AN', designation: 'C' },
    { name: 'Census Warning Condition Code (5)', start: 30, end: 32, length: 3, class: '3AN', designation: 'C' },
    { name: 'Census Warning Condition Override Code (5)', start: 33, end: 34, length: 2, class: '2AN', designation: 'C' },
    { name: 'Census Warning Condition Code (6)', start: 35, end: 37, length: 3, class: '3AN', designation: 'C' },
    { name: 'Census Warning Condition Override Code (6)', start: 38, end: 39, length: 2, class: '2AN', designation: 'C' },
    { name: 'Census Warning Condition Code (7)', start: 40, end: 42, length: 3, class: '3AN', designation: 'C' },
    { name: 'Census Warning Condition Override Code (7)', start: 43, end: 44, length: 2, class: '2AN', designation: 'C' },
    { name: 'Filler', start: 45, end: 80, length: 36, class: '36S', designation: 'M' },
  ],
};

const ALL_RECORDS: RecordSpec[] = [
  DECLARATION_RECORD_54,
  HEADER_FEES_RECORD_34,
  LINE_USER_FEE_RECORD_62,
  IR_TAX_RECORD_60,
  OTHER_REVENUE_RECORD_61,
  PSC_HEADER_REASONS_35,
  PSC_EXPLANATION_36,
  PSC_LINE_REASONS_63,
  CENSUS_OVERRIDE_CW02,
];

describe('CATAIR Entry Summary - Declarations, Fees, PSC, and Census Override Validation (E3)', () => {
  ALL_RECORDS.forEach((spec) => {
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
});
