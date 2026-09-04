import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Reconciliation Entry Summary Create/Update (RE/RX Application) Test Suite
 * Source Document: ACE CATAIR Reconciliation Entry Summary Create Update v3
 * Application Identifier: RE (Input Create/Update) / RX (Output Response)
 *
 * Scoped Records:
 *   1. RE10 (Reconciliation Entry Summary Header Input)
 *   2. RE20 (Reconciliation Underlying Entry Association Detail Input)
 *   3. RX10 (Reconciliation Response Header Output)
 *   4. RX20 (Reconciliation Response Detail & Disposition Output)
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

export const RECON_RE10_SPEC: RecordSpec = {
  recordId: 'RE10',
  name: 'Reconciliation Entry Summary Header Input',
  pageCitations: 'ACE CATAIR Reconciliation v3, Page 6',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'RE10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-character ABI filer code' },
    { name: 'Reconciliation Entry Number', start: 8, end: 15, length: 8, class: '8AN', designation: 'M', notes: '7-digit entry number + check digit' },
    { name: 'Action Code', start: 16, end: 16, length: 1, class: '1A', designation: 'M', notes: 'A = Add, M = Modify, D = Delete' },
    { name: 'Reconciliation Entry Type', start: 17, end: 18, length: 2, class: '2N', designation: 'M', notes: '09 = Reconciliation Entry' },
    { name: 'Importer of Record Number', start: 19, end: 30, length: 12, class: '12X', designation: 'M', notes: 'IRS / SSN / CBP assigned importer ID' },
    { name: 'Filler', start: 31, end: 80, length: 50, class: '50S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_RE20_SPEC: RecordSpec = {
  recordId: 'RE20',
  name: 'Reconciliation Underlying Entry Association Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation v3, Page 9',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'RE20'" },
    { name: 'Underlying Entry Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: 'Filer code of underlying entry summary' },
    { name: 'Underlying Entry Number', start: 8, end: 15, length: 8, class: '8AN', designation: 'M', notes: 'Entry number of underlying entry summary' },
    { name: 'Underlying Entry Summary Date', start: 16, end: 21, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Reconciliation Issue Code', start: 22, end: 23, length: 2, class: '2AN', designation: 'M', notes: '01=Value, 02=9802, 03=FTA, 04=Classification' },
    { name: 'Filler', start: 24, end: 80, length: 57, class: '57S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_RX10_SPEC: RecordSpec = {
  recordId: 'RX10',
  name: 'Reconciliation Response Header Output',
  pageCitations: 'ACE CATAIR Reconciliation v3, Page 14',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'RX10'" },
    { name: 'Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: 'Filer code echoed' },
    { name: 'Reconciliation Entry Number', start: 8, end: 15, length: 8, class: '8AN', designation: 'M', notes: 'Reconciliation entry number echoed' },
    { name: 'Reconciliation Status Code', start: 16, end: 17, length: 2, class: '2AN', designation: 'M', notes: 'AC = Accepted, RJ = Rejected' },
    { name: 'Processing Date', start: 18, end: 23, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Filler', start: 24, end: 80, length: 57, class: '57S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_RX20_SPEC: RecordSpec = {
  recordId: 'RX20',
  name: 'Reconciliation Response Detail & Disposition Output',
  pageCitations: 'ACE CATAIR Reconciliation v3, Page 16',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must equal 'RX20'" },
    { name: 'Underlying Entry Filer Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: 'Filer code of underlying entry' },
    { name: 'Underlying Entry Number', start: 8, end: 15, length: 8, class: '8AN', designation: 'M', notes: 'Entry number of underlying entry' },
    { name: 'Disposition Code', start: 16, end: 17, length: 2, class: '2AN', designation: 'M', notes: '01=Accepted, 02=Rejected, 03=Warning' },
    { name: 'Condition Code', start: 18, end: 20, length: 3, class: '3AN', designation: 'C', notes: 'Error code if rejected' },
    { name: 'Filler', start: 21, end: 80, length: 60, class: '60S', designation: 'M', notes: 'Space fill' },
  ],
};

const ALL_RECON_SPECS: RecordSpec[] = [
  RECON_RE10_SPEC,
  RECON_RE20_SPEC,
  RECON_RX10_SPEC,
  RECON_RX20_SPEC,
];

describe('CATAIR Reconciliation Entry Summary (RE/RX) Specifications', () => {
  it.each(ALL_RECON_SPECS)('$recordId ($name) - position math and length sum to 80', (spec) => {
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
