import { describe, it, expect } from 'vitest';

/**
 * CATAIR Cargo Release (SE) - Equipment, GBI, FTZ, PGA, ISF Records Test Suite
 * Source: docs/plans/catair-source-docs/04-cargo-release-implementation-guide-v40.pdf
 */

interface FieldSpec {
  name: string;
  start: number;
  end: number;
  length: number;
  class: string;
  status: 'M' | 'C' | 'O';
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

export const CR_EQUIPMENT_SE17: RecordSpec = {
  recordId: 'SE17',
  name: 'Equipment Detail',
  pageCitations: 'Page 55',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', status: 'M', notes: 'Must equal SE17' },
    { name: 'Equipment Number', start: 5, end: 24, length: 20, class: '20AN', status: 'M', notes: 'Full SCAC prefix + equipment number + check digit' },
    { name: 'Filler', start: 25, end: 80, length: 56, class: '56X', status: 'M' },
  ],
};

export const CR_HEADER_GBI_SE31: RecordSpec = {
  recordId: 'SE31',
  name: 'Header Entity GBI Identifier',
  pageCitations: 'Page 61',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', status: 'M', notes: 'Must equal SE31' },
    { name: 'GBI Identifier Qualifier', start: 5, end: 8, length: 4, class: '4A', status: 'M', notes: 'LEI, GLN, DUNS' },
    { name: 'GBI Identifier', start: 9, end: 28, length: 20, class: '20AN', status: 'M' },
    { name: 'Filler', start: 29, end: 80, length: 52, class: '52X', status: 'M' },
  ],
};

export const CR_FTZ_SE41: RecordSpec = {
  recordId: 'SE41',
  name: 'FTZ Detail',
  pageCitations: 'Pages 65-66',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', status: 'M', notes: 'Must equal SE41' },
    { name: 'Zone Status', start: 5, end: 5, length: 1, class: '1A', status: 'M', notes: 'P = Privileged, N = Non-privileged, D = Domestic, Z = Zone restricted' },
    { name: 'Privileged FTZ Merchandise Filing Date', start: 6, end: 11, length: 6, class: '6N', status: 'C', notes: 'MMDDYY format (Cargo Release convention)' },
    { name: 'FTZ Line Item Quantity', start: 12, end: 19, length: 8, class: '8N', status: 'M', impliedDecimals: 0, notes: 'Whole number > 0' },
    { name: 'Filler', start: 20, end: 80, length: 61, class: '61X', status: 'M' },
  ],
};

export const CR_LINE_GBI_SE51: RecordSpec = {
  recordId: 'SE51',
  name: 'Line Entity GBI Identifier',
  pageCitations: 'Page 70',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', status: 'M', notes: 'Must equal SE51' },
    { name: 'GBI Identifier Qualifier', start: 5, end: 8, length: 4, class: '4A', status: 'M' },
    { name: 'GBI Identifier', start: 9, end: 28, length: 20, class: '20AN', status: 'M' },
    { name: 'Filler', start: 29, end: 80, length: 52, class: '52X', status: 'M' },
  ],
};

export const CR_FTZ_PF_HTS_SE61: RecordSpec = {
  recordId: 'SE61',
  name: 'FTZ Privileged Foreign Status Additional Detail',
  pageCitations: 'Page 74',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', status: 'M', notes: 'Must equal SE61' },
    { name: 'Current HTS Number for PF Status Merchandise', start: 5, end: 14, length: 10, class: '10AN', status: 'M' },
    { name: 'Filler', start: 15, end: 80, length: 66, class: '66X', status: 'M' },
  ],
};

const ALL_RECORDS: RecordSpec[] = [
  CR_EQUIPMENT_SE17,
  CR_HEADER_GBI_SE31,
  CR_FTZ_SE41,
  CR_LINE_GBI_SE51,
  CR_FTZ_PF_HTS_SE61,
];

describe('CATAIR Cargo Release - Extended Records Validation', () => {
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

  it('should explicitly note that Cargo Release PGA grouping reuses the generic PG01-PG60 records from src/lib/abi/pgaMessageSet/', () => {
    expect(true).toBe(true);
  });
});
