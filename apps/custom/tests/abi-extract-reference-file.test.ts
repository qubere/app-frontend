import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Extract Reference File Query (FQ/FO Application) Test Suite
 * Source PDF: Draft ACE ABI CATAIR Extract Reference File Query v2
 * Application Identifier: FQ (Query Request) / FO (Query Response)
 *
 * Scoped Records:
 *   1. FQ10 (Input Query Request Header)
 *   2. FO10 (Output Response Header)
 *   3. FO20 (Output Reference Data Detail Record)
 */

export interface FieldSpec {
  name: string;
  start: number;
  end: number;
  length: number;
  class: string;
  designation: 'M' | 'C' | 'O';
  notes?: string;
}

export interface RecordSpec {
  recordId: string;
  name: string;
  pageCitations: string;
  totalLength: number;
  fields: FieldSpec[];
}

export const EXTRACT_REF_FQ10_SPEC: RecordSpec = {
  recordId: 'FQ10',
  name: 'Extract Reference File Query Request Header',
  pageCitations: 'Draft ACE ABI CATAIR Extract Reference File Query v2, Page 5',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'FQ10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-character ABI filer code' },
    { name: 'Extract File Type Code', start: 8, end: 11, length: 4, class: '4AN', designation: 'M', notes: 'PORT=Ports, CARR=Carriers, CNTY=Countries, FIRM=FIRMS' },
    { name: 'CBP Port Code', start: 12, end: 15, length: 4, class: '4N', designation: 'O', notes: 'Optional specific CBP port filter' },
    { name: 'Effective Date', start: 16, end: 21, length: 6, class: '6D', designation: 'O', notes: 'MMDDYY format' },
    { name: 'Filler', start: 22, end: 80, length: 59, class: '59S', designation: 'M', notes: 'Space fill' },
  ],
};

export const EXTRACT_REF_FO10_SPEC: RecordSpec = {
  recordId: 'FO10',
  name: 'Extract Reference File Query Response Header',
  pageCitations: 'Draft ACE ABI CATAIR Extract Reference File Query v2, Page 8',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'FO10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-character ABI filer code' },
    { name: 'Extract File Type Code', start: 8, end: 11, length: 4, class: '4AN', designation: 'M', notes: 'File type echoed from request' },
    { name: 'Query Status Code', start: 12, end: 13, length: 2, class: '2AN', designation: 'M', notes: '01=Success, 02=No Data Found, 03=Error' },
    { name: 'Response Date', start: 14, end: 19, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Filler', start: 20, end: 80, length: 61, class: '61S', designation: 'M', notes: 'Space fill' },
  ],
};

export const EXTRACT_REF_FO20_SPEC: RecordSpec = {
  recordId: 'FO20',
  name: 'Extract Reference Data Detail Record',
  pageCitations: 'Draft ACE ABI CATAIR Extract Reference File Query v2, Page 10',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'FO20'" },
    { name: 'Reference Code', start: 5, end: 14, length: 10, class: '10AN', designation: 'M', notes: 'Port/Carrier/Country/FIRMS code value' },
    { name: 'Reference Name / Title', start: 15, end: 54, length: 40, class: '40X', designation: 'M', notes: 'Official text description' },
    { name: 'Additional Qualifier / State', start: 55, end: 74, length: 20, class: '20X', designation: 'O', notes: 'Additional attributes (e.g. State, Region)' },
    { name: 'Filler', start: 75, end: 80, length: 6, class: '6S', designation: 'M', notes: 'Space fill' },
  ],
};

const ALL_FO_SPECS: RecordSpec[] = [
  EXTRACT_REF_FQ10_SPEC,
  EXTRACT_REF_FO10_SPEC,
  EXTRACT_REF_FO20_SPEC,
];

describe('CATAIR Extract Reference File Query (FQ/FO) Specifications', () => {
  it.each(ALL_FO_SPECS)('$recordId ($name) - position math and length sum to 80', (spec) => {
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
