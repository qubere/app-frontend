import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Manufacturer Name and Address Create ($I/$R) & Query (MA/MY) Test Suite
 * Sources:
 * - ACE CATAIR Manufacturer Name and Address Create v2 ($I/$R)
 * - ACE CATAIR Query Manufacturer File v2 (MA/MY)
 *
 * Scoped Records:
 *   1. $I10 (Manufacturer Create/Update Header Input)
 *   2. $I20 (Manufacturer Create/Update Address Detail Input)
 *   3. $R10 (Manufacturer Create/Update Response Output)
 *   4. MA10 (Manufacturer Query Request Input)
 *   5. MY10 (Manufacturer Query Response Header Output)
 *   6. MY20 (Manufacturer Query Response Detail Output)
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

export const MFG_CREATE_I10_SPEC: RecordSpec = {
  recordId: '$I10',
  name: 'Manufacturer Create/Update Header Input',
  pageCitations: 'ACE CATAIR Manufacturer Create v2, Page 5',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal '$I10'" },
    { name: 'Action Code', start: 5, end: 5, length: 1, class: '1A', designation: 'M', notes: 'A = Add, M = Modify, D = Delete' },
    { name: 'Manufacturer ID (MID) Code', start: 6, end: 20, length: 15, class: '15AN', designation: 'M', notes: 'Constructed MID code ISO+NAME+ADDR' },
    { name: 'Manufacturer Name', start: 21, end: 55, length: 35, class: '35X', designation: 'M', notes: 'Full legal name of manufacturer' },
    { name: 'Country Code', start: 56, end: 57, length: 2, class: '2A', designation: 'M', notes: 'ISO country code of origin' },
    { name: 'Filler', start: 58, end: 80, length: 23, class: '23S', designation: 'M', notes: 'Space fill' },
  ],
};

export const MFG_CREATE_I20_SPEC: RecordSpec = {
  recordId: '$I20',
  name: 'Manufacturer Create/Update Address Detail Input',
  pageCitations: 'ACE CATAIR Manufacturer Create v2, Page 7',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal '$I20'" },
    { name: 'Address Line 1', start: 5, end: 39, length: 35, class: '35X', designation: 'M', notes: 'Street address of manufacturer' },
    { name: 'City Name', start: 40, end: 64, length: 25, class: '25X', designation: 'M', notes: 'City of manufacturer' },
    { name: 'State / Province Code', start: 65, end: 66, length: 2, class: '2A', designation: 'C', notes: 'State code if USA/Canada/Mexico' },
    { name: 'Postal / ZIP Code', start: 67, end: 75, length: 9, class: '9AN', designation: 'C', notes: 'Postal / ZIP code' },
    { name: 'Filler', start: 76, end: 80, length: 5, class: '5S', designation: 'M', notes: 'Space fill' },
  ],
};

export const MFG_CREATE_R10_SPEC: RecordSpec = {
  recordId: '$R10',
  name: 'Manufacturer Create/Update Response Output',
  pageCitations: 'ACE CATAIR Manufacturer Create v2, Page 10',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal '$R10'" },
    { name: 'Action Code', start: 5, end: 5, length: 1, class: '1A', designation: 'M', notes: 'Action code echoed from input' },
    { name: 'Manufacturer ID (MID) Code', start: 6, end: 20, length: 15, class: '15AN', designation: 'M', notes: 'MID code assigned or echoed' },
    { name: 'Disposition Code', start: 21, end: 22, length: 2, class: '2AN', designation: 'M', notes: '01=Accepted, 02=Rejected, 03=Duplicate' },
    { name: 'Condition Code', start: 23, end: 25, length: 3, class: '3AN', designation: 'C', notes: 'Error condition code if rejected' },
    { name: 'Filler', start: 26, end: 80, length: 55, class: '55S', designation: 'M', notes: 'Space fill' },
  ],
};

export const MFG_QUERY_MA10_SPEC: RecordSpec = {
  recordId: 'MA10',
  name: 'Manufacturer Query Request Input',
  pageCitations: 'ACE CATAIR Query Manufacturer File v2, Page 4',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'MA10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-character ABI filer code' },
    { name: 'Query MID Code', start: 8, end: 22, length: 15, class: '15AN', designation: 'C', notes: 'Specific MID code to search' },
    { name: 'Manufacturer Name Search', start: 23, end: 57, length: 35, class: '35X', designation: 'C', notes: 'Name text search pattern' },
    { name: 'Country Code', start: 58, end: 59, length: 2, class: '2A', designation: 'C', notes: 'ISO country code filter' },
    { name: 'Filler', start: 60, end: 80, length: 21, class: '21S', designation: 'M', notes: 'Space fill' },
  ],
};

export const MFG_QUERY_MY10_SPEC: RecordSpec = {
  recordId: 'MY10',
  name: 'Manufacturer Query Response Header Output',
  pageCitations: 'ACE CATAIR Query Manufacturer File v2, Page 7',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'MY10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: 'Filer code echoed' },
    { name: 'Status Code', start: 8, end: 9, length: 2, class: '2AN', designation: 'M', notes: '01=Success, 02=No Match Found' },
    { name: 'Match Count', start: 10, end: 13, length: 4, class: '4N', designation: 'M', notes: 'Number of matching MID records returned' },
    { name: 'Filler', start: 14, end: 80, length: 67, class: '67S', designation: 'M', notes: 'Space fill' },
  ],
};

export const MFG_QUERY_MY20_SPEC: RecordSpec = {
  recordId: 'MY20',
  name: 'Manufacturer Query Response Detail Output',
  pageCitations: 'ACE CATAIR Query Manufacturer File v2, Page 9',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'MY20'" },
    { name: 'MID Code', start: 5, end: 19, length: 15, class: '15AN', designation: 'M', notes: 'Manufacturer ID code' },
    { name: 'Manufacturer Name', start: 20, end: 54, length: 35, class: '35X', designation: 'M', notes: 'Manufacturer name' },
    { name: 'Country Code', start: 55, end: 56, length: 2, class: '2A', designation: 'M', notes: 'ISO country code' },
    { name: 'Filler', start: 57, end: 80, length: 24, class: '24S', designation: 'M', notes: 'Space fill' },
  ],
};

const ALL_MFG_SPECS: RecordSpec[] = [
  MFG_CREATE_I10_SPEC,
  MFG_CREATE_I20_SPEC,
  MFG_CREATE_R10_SPEC,
  MFG_QUERY_MA10_SPEC,
  MFG_QUERY_MY10_SPEC,
  MFG_QUERY_MY20_SPEC,
];

describe('CATAIR Manufacturer Create ($I/$R) & Query (MA/MY) Specifications', () => {
  it.each(ALL_MFG_SPECS)('$recordId ($name) - position math and length sum to 80', (spec) => {
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
