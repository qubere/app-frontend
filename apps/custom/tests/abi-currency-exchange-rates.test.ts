import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Currency Exchange Rates Query (FI/FR Application) Test Suite
 * Sources:
 * - ACE Currency Exchange Rates Draft CATAIR Chapter (2021)
 * - ACE Currency Exchange Rates Update 508c (2022 - Current Standard)
 *
 * Version Comparison & Verification:
 * The 2022 update standardizes exchange rate numeric representation to 12N with 6 implied decimal places.
 * Application Identifier: FI (Currency Query Request) / FR (Currency Query Response)
 *
 * Scoped Records:
 *   1. FI10 (Currency Query Request Header Input)
 *   2. FR10 (Currency Query Response Header Output)
 *   3. FR20 (Currency Exchange Rate Detail Output)
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

export const CURRENCY_FI10_SPEC: RecordSpec = {
  recordId: 'FI10',
  name: 'Currency Query Request Header Input',
  pageCitations: 'ACE Currency Exchange Rates Update 2022, Page 4',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'FI10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-character ABI filer code' },
    { name: 'Country Code', start: 8, end: 9, length: 2, class: '2A', designation: 'O', notes: 'ISO country code filter' },
    { name: 'Currency Code', start: 10, end: 12, length: 3, class: '3A', designation: 'O', notes: 'ISO 3-character currency code' },
    { name: 'Effective Date', start: 13, end: 18, length: 6, class: '6D', designation: 'O', notes: 'MMDDYY format' },
    { name: 'Filler', start: 19, end: 80, length: 62, class: '62S', designation: 'M', notes: 'Space fill' },
  ],
};

export const CURRENCY_FR10_SPEC: RecordSpec = {
  recordId: 'FR10',
  name: 'Currency Query Response Header Output',
  pageCitations: 'ACE Currency Exchange Rates Update 2022, Page 6',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'FR10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: 'Filer code echoed' },
    { name: 'Status Code', start: 8, end: 9, length: 2, class: '2AN', designation: 'M', notes: '01=Success, 02=No Data Found' },
    { name: 'Response Date', start: 10, end: 15, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Filler', start: 16, end: 80, length: 65, class: '65S', designation: 'M', notes: 'Space fill' },
  ],
};

export const CURRENCY_FR20_SPEC: RecordSpec = {
  recordId: 'FR20',
  name: 'Currency Exchange Rate Detail Output',
  pageCitations: 'ACE Currency Exchange Rates Update 2022, Page 8',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'FR20'" },
    { name: 'Country Code', start: 5, end: 6, length: 2, class: '2A', designation: 'M', notes: 'ISO country code' },
    { name: 'Currency Code', start: 7, end: 9, length: 3, class: '3A', designation: 'M', notes: 'ISO 3-character currency code' },
    { name: 'Exchange Rate', start: 10, end: 21, length: 12, class: '12N', designation: 'M', impliedDecimals: 6, notes: '6 implied decimal places per 2022 508c update' },
    { name: 'Rate Type Indicator', start: 22, end: 22, length: 1, class: '1A', designation: 'M', notes: 'O = Official, C = Customs, E = Estimated' },
    { name: 'Effective Date', start: 23, end: 28, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Filler', start: 29, end: 80, length: 52, class: '52S', designation: 'M', notes: 'Space fill' },
  ],
};

const ALL_CURRENCY_SPECS: RecordSpec[] = [
  CURRENCY_FI10_SPEC,
  CURRENCY_FR10_SPEC,
  CURRENCY_FR20_SPEC,
];

describe('CATAIR Currency Exchange Rates Query (FI/FR) Specifications', () => {
  it.each(ALL_CURRENCY_SPECS)('$recordId ($name) - position math and length sum to 80', (spec) => {
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

  it('FR20 Exchange Rate specifies 6 implied decimal places per 2022 508c update', () => {
    const rateField = CURRENCY_FR20_SPEC.fields.find(f => f.name === 'Exchange Rate');
    expect(rateField?.length).toBe(12);
    expect(rateField?.impliedDecimals).toBe(6);
  });
});
