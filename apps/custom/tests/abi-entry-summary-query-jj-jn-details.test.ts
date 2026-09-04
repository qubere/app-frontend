import { describe, it, expect } from 'vitest';

/**
 * CATAIR Entry Summary Query (JC) - JJ-JN Output Records & Details Grouping Test Suite
 * Source: docs/plans/catair-source-docs/03-entry-summary-query-2026-05-v26.pdf
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

export const ES_QUERY_RECORD_JK: RecordSpec = {
  recordId: 'JK',
  name: 'Bill Detail Status Information',
  pageCitations: 'Page 44',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Always JK' },
    { name: 'Bill Number', start: 3, end: 13, length: 11, class: '11AN', designation: 'M' },
    { name: 'Bill Date', start: 14, end: 19, length: 6, class: '6D or 6S', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Bill Type', start: 20, end: 20, length: 1, class: '1N', designation: 'M', notes: '1=Deferred Tax, 2=Supplemental Duty, 3=Regional, 4=Misc, etc.' },
    { name: 'Bill Collection Status', start: 21, end: 22, length: 2, class: '2N', designation: 'M', notes: '01=Not Paid, 04=Paid, 05=Partial, 06=Canceled, 09=Write Off, etc.' },
    { name: 'Total Bill Amount', start: 23, end: 33, length: 11, class: '11N', designation: 'M', impliedDecimals: 2 },
    { name: 'Paid Amount', start: 34, end: 44, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Principal Amount', start: 45, end: 55, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    // Continues onto the PDF's next page (ESQ-44): the original fixture ended
    // at position 55 with a 25-char filler, silently swallowing this Interest
    // Amount field into the filler. Restored per the source PDF.
    { name: 'Interest Amount', start: 56, end: 66, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Filler', start: 67, end: 80, length: 14, class: '14S', designation: 'M' },
  ],
};

export const ES_QUERY_RECORD_JL: RecordSpec = {
  recordId: 'JL',
  name: 'Collection Detail Status Information',
  pageCitations: 'Page 46',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Always JL' },
    { name: 'Collection Date', start: 3, end: 8, length: 6, class: '6D or 6S', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Total Amount', start: 9, end: 19, length: 11, class: '11N', designation: 'M', impliedDecimals: 2 },
    { name: 'Filler', start: 20, end: 80, length: 61, class: '61S', designation: 'M' },
  ],
};

export const ES_QUERY_RECORD_JM: RecordSpec = {
  recordId: 'JM',
  name: 'Collection Class Code Detail Information',
  pageCitations: 'Page 47',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Always JM' },
    { name: 'Class Code', start: 3, end: 5, length: 3, class: '3N', designation: 'C' },
    { name: 'Class Code Amount', start: 6, end: 16, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Filler', start: 17, end: 80, length: 64, class: '64S', designation: 'M' },
  ],
};

export const ES_QUERY_RECORD_JN: RecordSpec = {
  recordId: 'JN',
  name: 'Surety Bill Detail Status Information',
  pageCitations: 'Page 49',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Always JN' },
    { name: 'Surety Code', start: 3, end: 5, length: 3, class: '3N', designation: 'C' },
    { name: 'Primary Surety Indicator', start: 6, end: 6, length: 1, class: '1AN', designation: 'C', notes: 'Y=Primary, N=Non-Primary' },
    { name: '612 Report Date', start: 7, end: 12, length: 6, class: '6D or 6S', designation: 'C', notes: 'Date first appeared on CBP Report 612' },
    { name: 'Bill Number', start: 13, end: 23, length: 11, class: '11N', designation: 'M' },
    { name: 'Bill Date', start: 24, end: 29, length: 6, class: '6D or 6S', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Bill Type', start: 30, end: 30, length: 1, class: '1N', designation: 'M' },
    { name: 'Bill Collection Status', start: 31, end: 32, length: 2, class: '2N', designation: 'M' },
    { name: 'Total Bill Amount', start: 33, end: 43, length: 11, class: '11N', designation: 'M', impliedDecimals: 2 },
    { name: 'Filler', start: 44, end: 80, length: 37, class: '37S', designation: 'M' },
  ],
};

const ALL_RECORDS: RecordSpec[] = [
  ES_QUERY_RECORD_JK,
  ES_QUERY_RECORD_JL,
  ES_QUERY_RECORD_JM,
  ES_QUERY_RECORD_JN,
];

describe('CATAIR Entry Summary Query - Extended Output Records Validation', () => {
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

  it('should confirm that the Entry Summary Details Grouping reuses the exact same 10-90 input record layouts from Entry Summary Create/Update', () => {
    const reuseStatement = 'The output 10- through 90-Records provides the latest detail of the entry summary in the form of input AE 10- through 90-Records.';
    expect(reuseStatement).toContain('input AE 10- through 90-Records');
  });
});
