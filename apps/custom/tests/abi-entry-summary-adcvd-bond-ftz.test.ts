import { describe, it, expect } from 'vitest';

/**
 * CATAIR Entry Summary Create/Update (AE/AX) - AD/CVD, FTZ, and Bond Records Test Suite
 * Source: docs/plans/catair-source-docs/02-entry-summary-create-update-2026-07.pdf
 * 
 * Records covered:
 * - 31-Record: Bond Detail (Pages 49-50)
 * - 41-Record: FTZ Status Information (Page 72)
 * - SE61-Record: FTZ Privileged Foreign Status Additional Detail (Page 92)
 * - 53-Record: AD/CVD Case Detail (Pages 98-99)
 * - 88-Record: AD/CVD Duty Totals (Page 128)
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

export const BOND_RECORD_31: RecordSpec = {
  recordId: '31',
  name: 'Bond Detail',
  pageCitations: 'Pages 49-50',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Bond Type Code', start: 3, end: 3, length: 1, class: '1AN', designation: 'M', notes: '8 = Continuous, 9 = STB' },
    { name: 'Bond Designation Type Code', start: 4, end: 4, length: 1, class: '1AN', designation: 'M', notes: 'B = Basic, A = Additional, U = Substitution STB, E = Superseding STB' },
    { name: 'Continuous Bond Indicator', start: 5, end: 5, length: 1, class: '1AN', designation: 'C', notes: 'Y = Continuous supersedes, S = Substitution continuous replaces' },
    { name: 'Surety Company Code', start: 6, end: 8, length: 3, class: '3AN', designation: 'M' },
    { name: 'Single Transaction Bond Amount', start: 9, end: 18, length: 10, class: '10(S)N or 10S', designation: 'C', impliedDecimals: 0, notes: 'Whole U.S. dollars; space fill if continuous bond' },
    { name: 'Single Transaction Bond Producer Account Number', start: 19, end: 28, length: 10, class: '10AN', designation: 'O', notes: 'Surety reference number; left justified, trailing spaces' },
    { name: 'Filler', start: 29, end: 80, length: 52, class: '52S', designation: 'M' },
  ],
};

export const FTZ_RECORD_41: RecordSpec = {
  recordId: '41',
  name: 'FTZ Status Information',
  pageCitations: 'Page 72',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'FTZ Merchandise Status Code', start: 3, end: 3, length: 1, class: '1AN', designation: 'M', notes: 'P = Privileged Foreign, N = Non-Privileged Foreign, D = Domestic' },
    { name: 'Privileged FTZ Merchandise Filing Date', start: 4, end: 9, length: 6, class: '6D or 6S', designation: 'C', notes: 'Date entered zone for Privileged Foreign (YYMMDD format); space fill if NOT Privileged Foreign' },
    { name: 'FTZ Line Item Quantity', start: 10, end: 19, length: 10, class: '10N', designation: 'M', impliedDecimals: 0, notes: 'Whole units removed from zone' },
    { name: 'Filler', start: 20, end: 80, length: 61, class: '61S', designation: 'M' },
  ],
};

export const FTZ_RECORD_SE61: RecordSpec = {
  recordId: 'SE61',
  name: 'FTZ Privileged Foreign Status Additional Detail',
  pageCitations: 'Page 92',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: 'Must always equal SE61' },
    { name: 'Current HTS Number for PF Status Merchandise', start: 5, end: 14, length: 10, class: '10AN', designation: 'M', notes: 'Full 10-digit classification number' },
    { name: 'Filler', start: 15, end: 80, length: 66, class: '66S', designation: 'M' },
  ],
};

export const ADCVD_RECORD_53: RecordSpec = {
  recordId: '53',
  name: 'AD/CVD Case Detail',
  pageCitations: 'Pages 98-99',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Case Number', start: 3, end: 12, length: 10, class: '10AN', designation: 'M', notes: 'Case number without hyphens' },
    { name: 'Bond/Cash Claim Code', start: 13, end: 13, length: 1, class: '1AN', designation: 'M', notes: 'B = Surety bond, C = Cash deposit' },
    { name: 'Case Deposit Rate', start: 14, end: 21, length: 8, class: '8(S)N', designation: 'M', impliedDecimals: 2 },
    { name: 'Case Rate Type Qualifier Code', start: 22, end: 22, length: 1, class: '1AN', designation: 'M', notes: 'A = Ad valorem rate, S = Specific rate' },
    { name: 'Filler', start: 23, end: 24, length: 2, class: '2S', designation: 'M' },
    { name: 'AD/CVD Value of Goods Amount', start: 25, end: 34, length: 10, class: '10(S)N', designation: 'C', impliedDecimals: 0, notes: 'Whole U.S. dollars; used in lieu of line item value' },
    { name: 'AD/CVD Quantity', start: 35, end: 46, length: 12, class: '12(S)N', designation: 'C', impliedDecimals: 4, notes: 'Primary unit quantity for specific rate calculations' },
    { name: 'AD/CVD Duty Amount', start: 47, end: 56, length: 10, class: '10(S)N', designation: 'M', impliedDecimals: 2, notes: 'Estimated duty amount in U.S. dollars and cents' },
    { name: 'AD/CVD Non-Reimbursement Declaration Identifier', start: 57, end: 66, length: 10, class: '10AN', designation: 'C', notes: 'Blanket non-reimbursement declaration identifier' },
    { name: 'Filler', start: 67, end: 80, length: 14, class: '14S', designation: 'M' },
  ],
};

export const ADCVD_RECORD_88: RecordSpec = {
  recordId: '88',
  name: 'AD/CVD Duty Totals',
  pageCitations: 'Page 128',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Total Bonded AD Duty Amount', start: 3, end: 13, length: 11, class: '11(S)N', designation: 'C', impliedDecimals: 2 },
    { name: 'Filler', start: 14, end: 14, length: 1, class: '1S', designation: 'M' },
    { name: 'Total Cash Deposit AD Duty Amount', start: 15, end: 25, length: 11, class: '11(S)N', designation: 'C', impliedDecimals: 2 },
    { name: 'Filler', start: 26, end: 26, length: 1, class: '1S', designation: 'M' },
    { name: 'Total Bonded CV Duty Amount', start: 27, end: 37, length: 11, class: '11(S)N', designation: 'C', impliedDecimals: 2 },
    { name: 'Filler', start: 38, end: 38, length: 1, class: '1S', designation: 'M' },
    { name: 'Total Cash Deposit CV Duty Amount', start: 39, end: 49, length: 11, class: '11(S)N', designation: 'C', impliedDecimals: 2 },
    { name: 'Filler', start: 50, end: 80, length: 31, class: '31S', designation: 'M' },
  ],
};

const ALL_RECORDS: RecordSpec[] = [
  BOND_RECORD_31,
  FTZ_RECORD_41,
  FTZ_RECORD_SE61,
  ADCVD_RECORD_53,
  ADCVD_RECORD_88,
];

describe('CATAIR Entry Summary - AD/CVD, FTZ, and Bond Records Validation (E1)', () => {
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

      it('should accurately calculate total field length sum equal to 80', () => {
        const sum = spec.fields.reduce((acc, field) => acc + field.length, 0);
        expect(sum).toBe(80);
      });
    });
  });

  describe('Implied Decimal & Field-Specific Rule Assertions', () => {
    it('should confirm Record 31 STB amount is whole U.S. dollars (0 implied decimals)', () => {
      const stbField = BOND_RECORD_31.fields.find(f => f.name === 'Single Transaction Bond Amount');
      expect(stbField).toBeDefined();
      expect(stbField?.impliedDecimals).toBe(0);
      expect(stbField?.class).toContain('10(S)N');
    });

    it('should confirm Record 41 date class is 6D/6S (YYMMDD format)', () => {
      const dateField = FTZ_RECORD_41.fields.find(f => f.name === 'Privileged FTZ Merchandise Filing Date');
      expect(dateField).toBeDefined();
      expect(dateField?.class).toBe('6D or 6S');
      expect(dateField?.length).toBe(6);
    });

    it('should confirm Record 53 quantity has 4 implied decimals and duty amount has 2 implied decimals', () => {
      const qtyField = ADCVD_RECORD_53.fields.find(f => f.name === 'AD/CVD Quantity');
      const dutyField = ADCVD_RECORD_53.fields.find(f => f.name === 'AD/CVD Duty Amount');
      const valField = ADCVD_RECORD_53.fields.find(f => f.name === 'AD/CVD Value of Goods Amount');
      
      expect(qtyField?.impliedDecimals).toBe(4);
      expect(dutyField?.impliedDecimals).toBe(2);
      expect(valField?.impliedDecimals).toBe(0); // Whole dollars
    });

    it('should confirm Record 88 duty totals all specify 2 implied decimal places', () => {
      const totalFields = ADCVD_RECORD_88.fields.filter(f => f.name.includes('Amount'));
      expect(totalFields.length).toBe(4);
      totalFields.forEach(f => {
        expect(f.impliedDecimals).toBe(2);
        expect(f.length).toBe(11);
      });
    });

    it('should confirm Record SE61 has control identifier length 4 starting at position 1', () => {
      const ctrlId = FTZ_RECORD_SE61.fields.find(f => f.name === 'Control Identifier');
      expect(ctrlId?.length).toBe(4);
      expect(ctrlId?.start).toBe(1);
      expect(ctrlId?.end).toBe(4);
      expect(ctrlId?.class).toBe('4AN');
    });
  });
});
