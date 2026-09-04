import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Statement Update (SU/SQ Application) Test Suite
 * Dedicated Document: ACE CATAIR Statement Update (v2)
 * Application Identifier: SU (Input) / SQ (Output Response)
 *
 * Scoped Records:
 *   1. SU10 (Input Header: Statement Update Request)
 *   2. SU20 (Input Detail: Statement Entry Summary Action Detail)
 *   3. SQ10 (Output Response Header: Statement Update Status)
 *   4. SQ20 (Output Response Detail: Entry Summary Disposition & Error Echo)
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
  designation: 'M' | 'C' | 'O';
  fields: FieldSpec[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RECORD SU10: Statement Update Request Header (Input)
// ─────────────────────────────────────────────────────────────────────────────
export const STATEMENT_UPDATE_SU10_SPEC: RecordSpec = {
  recordId: 'SU10',
  name: 'Statement Update Request Header',
  pageCitations: 'ACE CATAIR Statement Update v2, Page 6',
  designation: 'M',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'SU10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-character ABI filer code' },
    { name: 'Statement Date', start: 8, end: 13, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Statement Number', start: 14, end: 19, length: 6, class: '6N', designation: 'C', notes: 'Statement tracking number' },
    { name: 'Action Code', start: 20, end: 20, length: 1, class: '1A', designation: 'M', notes: 'A = Add to statement, D = Delete from statement, M = Modify statement header' },
    { name: 'Broker Reference Number', start: 21, end: 29, length: 9, class: '9X', designation: 'O', notes: 'Filer internal reference number' },
    { name: 'Filler', start: 30, end: 80, length: 51, class: '51S', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. RECORD SU20: Statement Entry Summary Action Detail (Input)
// ─────────────────────────────────────────────────────────────────────────────
export const STATEMENT_UPDATE_SU20_SPEC: RecordSpec = {
  recordId: 'SU20',
  name: 'Statement Entry Summary Action Detail',
  pageCitations: 'ACE CATAIR Statement Update v2, Page 8',
  designation: 'M',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'SU20'" },
    { name: 'Entry Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-character entry filer code' },
    { name: 'Entry Number', start: 8, end: 15, length: 8, class: '8AN', designation: 'M', notes: '7-digit entry number + check digit' },
    { name: 'Action Code', start: 16, end: 16, length: 1, class: '1A', designation: 'M', notes: 'A = Add entry to statement, D = Remove entry from statement' },
    { name: 'Payment Type Indicator', start: 17, end: 17, length: 1, class: '1N', designation: 'C', notes: '1 = ACH, 2 = Check, 3 = Credit/Other' },
    { name: 'Importer of Record Number', start: 18, end: 29, length: 12, class: '12X', designation: 'C', notes: 'IRS/SSN/CBP assigned importer number' },
    { name: 'Filler', start: 30, end: 80, length: 51, class: '51S', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. RECORD SQ10: Statement Update Status Response Header (Output)
// ─────────────────────────────────────────────────────────────────────────────
export const STATEMENT_UPDATE_SQ10_SPEC: RecordSpec = {
  recordId: 'SQ10',
  name: 'Statement Update Status Response Header',
  pageCitations: 'ACE CATAIR Statement Update v2, Page 12',
  designation: 'M',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'SQ10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-character ABI filer code' },
    { name: 'Statement Date', start: 8, end: 13, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Statement Status Code', start: 14, end: 15, length: 2, class: '2AN', designation: 'M', notes: 'AC = Accepted, RJ = Rejected, PR = Partial Accept' },
    { name: 'Processing Date', start: 16, end: 21, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Filler', start: 22, end: 80, length: 59, class: '59S', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. RECORD SQ20: Entry Summary Disposition & Error Echo (Output)
// ─────────────────────────────────────────────────────────────────────────────
export const STATEMENT_UPDATE_SQ20_SPEC: RecordSpec = {
  recordId: 'SQ20',
  name: 'Entry Summary Disposition & Error Echo',
  pageCitations: 'ACE CATAIR Statement Update v2, Page 14',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'SQ20'" },
    { name: 'Entry Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-character entry filer code' },
    { name: 'Entry Number', start: 8, end: 15, length: 8, class: '8AN', designation: 'M', notes: '7-digit entry number + check digit' },
    { name: 'Disposition Code', start: 16, end: 17, length: 2, class: '2AN', designation: 'M', notes: '01 = Added, 02 = Deleted, 03 = Error' },
    { name: 'Condition Code', start: 18, end: 20, length: 3, class: '3AN', designation: 'C', notes: 'Error code from Appendix G / Dictionary if rejected' },
    { name: 'Filler', start: 21, end: 80, length: 60, class: '60S', designation: 'M', notes: 'Space fill' },
  ],
};

const ALL_SU_SPECS: RecordSpec[] = [
  STATEMENT_UPDATE_SU10_SPEC,
  STATEMENT_UPDATE_SU20_SPEC,
  STATEMENT_UPDATE_SQ10_SPEC,
  STATEMENT_UPDATE_SQ20_SPEC,
];

describe('CATAIR Statement Update (SU/SQ) Specifications', () => {
  it.each(ALL_SU_SPECS)('$recordId ($name) - position math and length sum to 80', (spec) => {
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
});
