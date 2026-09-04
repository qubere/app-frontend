import { describe, it, expect } from 'vitest';

/**
 * CATAIR eBond Bond Status Message (BS Application) Test Suite
 * Source PDF: eBond Bond Status Message CATAIR v1.2
 * Application Identifier: BS (Output Status Notification Message)
 *
 * Deduplication Note:
 * Existing `src/lib/abi/ebond/recordSpecs.ts` covers CB/CX Create-Update input records.
 * This test suite covers the separate output status notification (BS) chapter.
 *
 * Scoped Records:
 *   1. BS10 (Output Header: Bond Status Notification Header)
 *   2. BS20 (Output Detail: Bond Principal Status Detail)
 *   3. BS30 (Output Detail: Bond Status Disposition & Error Narrative)
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

export const EBOND_STATUS_BS10_SPEC: RecordSpec = {
  recordId: 'BS10',
  name: 'Bond Status Notification Header Output',
  pageCitations: 'eBond Bond Status Message v1.2, Page 5',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'BS10'" },
    { name: 'Bond Number', start: 5, end: 13, length: 9, class: '9AN', designation: 'M', notes: 'CBP 9-digit bond number' },
    { name: 'Surety Code', start: 14, end: 16, length: 3, class: '3AN', designation: 'M', notes: '3-digit Treasury surety code' },
    { name: 'Bond Amount', start: 17, end: 26, length: 10, class: '10N', designation: 'M', notes: 'Whole US dollar amount (no implied decimals)' },
    { name: 'Effective Date', start: 27, end: 32, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Bond Status Code', start: 33, end: 34, length: 2, class: '2AN', designation: 'M', notes: 'AC = Active, TM = Terminated, void = VD' },
    { name: 'Processing Date', start: 35, end: 40, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Filler', start: 41, end: 80, length: 40, class: '40S', designation: 'M', notes: 'Space fill' },
  ],
};

export const EBOND_STATUS_BS20_SPEC: RecordSpec = {
  recordId: 'BS20',
  name: 'Bond Principal Status Detail Output',
  pageCitations: 'eBond Bond Status Message v1.2, Page 7',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'BS20'" },
    { name: 'Principal ID Qualifier', start: 5, end: 6, length: 2, class: '2AN', designation: 'M', notes: 'EI = IRS, ANI = CBP assigned, 34 = SSN' },
    { name: 'Principal ID Number', start: 7, end: 21, length: 15, class: '15X', designation: 'M', notes: 'Principal identification number' },
    { name: 'Principal Name', start: 22, end: 56, length: 35, class: '35X', designation: 'M', notes: 'Principal company name' },
    { name: 'Filler', start: 57, end: 80, length: 24, class: '24S', designation: 'M', notes: 'Space fill' },
  ],
};

export const EBOND_STATUS_BS30_SPEC: RecordSpec = {
  recordId: 'BS30',
  name: 'Bond Status Disposition & Error Narrative Output',
  pageCitations: 'eBond Bond Status Message v1.2, Page 9',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'BS30'" },
    { name: 'Disposition Code', start: 5, end: 6, length: 2, class: '2AN', designation: 'M', notes: '01 = Accepted, 02 = Warning, 03 = Error' },
    { name: 'Condition Code', start: 7, end: 9, length: 3, class: '3AN', designation: 'C', notes: 'Status condition code' },
    { name: 'Narrative Message Text', start: 10, end: 49, length: 40, class: '40X', designation: 'M', notes: 'Narrative status message text' },
    { name: 'Filler', start: 50, end: 80, length: 31, class: '31S', designation: 'M', notes: 'Space fill' },
  ],
};

const ALL_BS_SPECS: RecordSpec[] = [
  EBOND_STATUS_BS10_SPEC,
  EBOND_STATUS_BS20_SPEC,
  EBOND_STATUS_BS30_SPEC,
];

describe('CATAIR eBond Bond Status Message (BS) Specifications', () => {
  it.each(ALL_BS_SPECS)('$recordId ($name) - position math and length sum to 80', (spec) => {
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

  it('BS10 specifies whole dollar bond amount without implied decimals', () => {
    const bondAmount = EBOND_STATUS_BS10_SPEC.fields.find(f => f.name === 'Bond Amount');
    expect(bondAmount?.length).toBe(10);
    expect(bondAmount?.notes).toContain('no implied decimals');
  });
});
