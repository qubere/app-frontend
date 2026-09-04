import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Harmonized Tariff Schedule Query (HA/HY Application) Test Suite
 * Source PDF: Draft ACE ABI CATAIR Harmonized Tariff Schedule v2
 * Application Identifier: HA (HTS Query Request) / HY (HTS Query Response)
 *
 * Scoped Records:
 *   1. HA10 (Input HTS Query Request Header)
 *   2. HY10 (Output HTS Query Response Header)
 *   3. HY20 (Output HTS Tariff Detail & Rate Record)
 *   4. HY30 (Output HTS Special Program & PGA Flags Record)
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

export const HTS_QUERY_HA10_SPEC: RecordSpec = {
  recordId: 'HA10',
  name: 'HTS Query Request Header',
  pageCitations: 'Draft ACE ABI CATAIR HTS Query v2, Page 4',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'HA10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-character ABI filer code' },
    { name: 'HTS Number', start: 8, end: 17, length: 10, class: '10AN', designation: 'M', notes: '10-digit tariff number (no decimals/dots)' },
    { name: 'Query Option Code', start: 18, end: 18, length: 1, class: '1A', designation: 'M', notes: 'F = Full detail, S = Summary rate detail' },
    { name: 'Effective Date', start: 19, end: 24, length: 6, class: '6D', designation: 'O', notes: 'MMDDYY format' },
    { name: 'Filler', start: 25, end: 80, length: 56, class: '56S', designation: 'M', notes: 'Space fill' },
  ],
};

export const HTS_QUERY_HY10_SPEC: RecordSpec = {
  recordId: 'HY10',
  name: 'HTS Query Response Header',
  pageCitations: 'Draft ACE ABI CATAIR HTS Query v2, Page 7',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'HY10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-character ABI filer code' },
    { name: 'HTS Number', start: 8, end: 17, length: 10, class: '10AN', designation: 'M', notes: '10-digit tariff number echoed' },
    { name: 'Query Status Code', start: 18, end: 19, length: 2, class: '2AN', designation: 'M', notes: '01=Success, 02=Invalid HTS, 03=No Record Found' },
    { name: 'Response Date', start: 20, end: 25, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Filler', start: 26, end: 80, length: 55, class: '55S', designation: 'M', notes: 'Space fill' },
  ],
};

export const HTS_QUERY_HY20_SPEC: RecordSpec = {
  recordId: 'HY20',
  name: 'HTS Tariff Detail & Rate Record',
  pageCitations: 'Draft ACE ABI CATAIR HTS Query v2, Page 9',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'HY20'" },
    { name: 'HTS Number', start: 5, end: 14, length: 10, class: '10AN', designation: 'M', notes: '10-digit tariff classification' },
    { name: 'Tariff Description', start: 15, end: 49, length: 35, class: '35X', designation: 'M', notes: 'Official HTS description text' },
    { name: 'Statistical Unit of Measure', start: 50, end: 52, length: 3, class: '3AN', designation: 'C', notes: 'Primary UOM code e.g. KGM, NO, PCS' },
    { name: 'Column 1 General Duty Rate', start: 53, end: 62, length: 10, class: '10N', designation: 'C', impliedDecimals: 2, notes: 'Ad valorem or specific duty rate' },
    { name: 'Column 2 Duty Rate', start: 63, end: 72, length: 10, class: '10N', designation: 'C', impliedDecimals: 2, notes: 'Statutory column 2 duty rate' },
    { name: 'Filler', start: 73, end: 80, length: 8, class: '8S', designation: 'M', notes: 'Space fill' },
  ],
};

export const HTS_QUERY_HY30_SPEC: RecordSpec = {
  recordId: 'HY30',
  name: 'HTS Special Program & PGA Flags Record',
  pageCitations: 'Draft ACE ABI CATAIR HTS Query v2, Page 11',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'HY30'" },
    { name: 'Special Program Indicator', start: 5, end: 6, length: 2, class: '2AN', designation: 'C', notes: 'GSP=A, USMCA=S, CAFTA=E, etc.' },
    { name: 'Special Duty Rate', start: 7, end: 16, length: 10, class: '10N', designation: 'C', impliedDecimals: 2, notes: 'Reduced/free duty rate' },
    { name: 'PGA Government Agency Code', start: 17, end: 19, length: 3, class: '3AN', designation: 'C', notes: 'FDA, EPA, USDA, TTB, etc.' },
    { name: 'PGA Flag Code', start: 20, end: 21, length: 2, class: '2AN', designation: 'C', notes: 'FD1=Required, FD2=May be required, etc.' },
    { name: 'Filler', start: 22, end: 80, length: 59, class: '59S', designation: 'M', notes: 'Space fill' },
  ],
};

const ALL_HY_SPECS: RecordSpec[] = [
  HTS_QUERY_HA10_SPEC,
  HTS_QUERY_HY10_SPEC,
  HTS_QUERY_HY20_SPEC,
  HTS_QUERY_HY30_SPEC,
];

describe('CATAIR Harmonized Tariff Schedule Query (HA/HY) Specifications', () => {
  it.each(ALL_HY_SPECS)('$recordId ($name) - position math and length sum to 80', (spec) => {
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
