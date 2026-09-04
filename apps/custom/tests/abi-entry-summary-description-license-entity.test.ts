import { describe, it, expect } from 'vitest';

/**
 * CATAIR Entry Summary Create/Update (AE/AX) - Description, License/Certificate, and Entity/GBI Records Test Suite (E2)
 * Source: docs/plans/catair-source-docs/02-entry-summary-create-update-2026-07.pdf
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

export const INVOICE_RECORD_42: RecordSpec = {
  recordId: '42',
  name: 'Invoice Line Reference Detail',
  pageCitations: 'Pages 73-75',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Supplier ID Code', start: 3, end: 17, length: 15, class: '15AN', designation: 'M' },
    { name: 'Invoice Number', start: 18, end: 34, length: 17, class: '17X', designation: 'M' },
    { name: 'Filler Line 1 Begin', start: 35, end: 35, length: 1, class: '1S', designation: 'M' },
    { name: 'Invoice Line Range 1 - Begin', start: 36, end: 39, length: 4, class: '4(S)N', designation: 'M' },
    { name: 'Filler Line 1 End', start: 40, end: 40, length: 1, class: '1S', designation: 'M' },
    { name: 'Invoice Line Range 1 - End', start: 41, end: 44, length: 4, class: '4(S)N', designation: 'M' },
    { name: 'Filler Line 2 Begin', start: 45, end: 45, length: 1, class: '1S', designation: 'M' },
    { name: 'Invoice Line Range 2 - Begin', start: 46, end: 49, length: 4, class: '4(S)N or 4S', designation: 'C' },
    { name: 'Filler Line 2 End', start: 50, end: 50, length: 1, class: '1S', designation: 'M' },
    { name: 'Invoice Line Range 2 - End', start: 51, end: 54, length: 4, class: '4(S)N or 4S', designation: 'C' },
    { name: 'Filler Line 3 Begin', start: 55, end: 55, length: 1, class: '1S', designation: 'M' },
    { name: 'Invoice Line Range 3 - Begin', start: 56, end: 59, length: 4, class: '4(S)N or 4S', designation: 'C' },
    { name: 'Filler Line 3 End', start: 60, end: 60, length: 1, class: '1S', designation: 'M' },
    { name: 'Invoice Line Range 3 - End', start: 61, end: 64, length: 4, class: '4(S)N or 4S', designation: 'C' },
    { name: 'Filler Line 4 Begin', start: 65, end: 65, length: 1, class: '1S', designation: 'M' },
    { name: 'Invoice Line Range 4 - Begin', start: 66, end: 69, length: 4, class: '4(S)N or 4S', designation: 'C' },
    { name: 'Filler Line 4 End', start: 70, end: 70, length: 1, class: '1S', designation: 'M' },
    { name: 'Invoice Line Range 4 - End', start: 71, end: 74, length: 4, class: '4(S)N or 4S', designation: 'C' },
    { name: 'Filler', start: 75, end: 80, length: 6, class: '6S', designation: 'M' },
  ],
};

export const RULINGS_RECORD_43: RecordSpec = {
  recordId: '43',
  name: 'Rulings Detail',
  pageCitations: 'Page 76',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Ruling Type Code', start: 3, end: 3, length: 1, class: '1AN', designation: 'M', notes: 'C = Pre-Classification, P = Pre-Approval, R = Binding Ruling' },
    { name: 'Filler', start: 4, end: 8, length: 5, class: '5S', designation: 'M' },
    { name: 'Ruling Number', start: 9, end: 14, length: 6, class: '6AN', designation: 'C' },
    { name: 'Filler', start: 15, end: 80, length: 66, class: '66S', designation: 'M' },
  ],
};

export const COMMERCIAL_DESC_RECORD_44: RecordSpec = {
  recordId: '44',
  name: 'Commercial Description',
  pageCitations: 'Page 77',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Commercial Description Text', start: 3, end: 72, length: 70, class: '70X', designation: 'M' },
    { name: 'Filler', start: 73, end: 80, length: 8, class: '8S', designation: 'M' },
  ],
};

export const LICENSE_RECORD_52: RecordSpec = {
  recordId: '52',
  name: 'License/Certificate/Permit Detail',
  pageCitations: 'Pages 95-97',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'License/Certificate/Permit Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: '01=Steel, 06=Diamond, 28=Aluminum, 31=Argentine Grape Juice' },
    { name: 'License Number/Certificate Number/Permit Number', start: 5, end: 14, length: 10, class: '10X', designation: 'M' },
    { name: 'Filler Expansion', start: 15, end: 24, length: 10, class: '10S', designation: 'M' },
    { name: 'Filler', start: 25, end: 80, length: 56, class: '56S', designation: 'M' },
  ],
};

export const ENTITY_LINE_RECORD_SE50: RecordSpec = {
  recordId: 'SE50',
  name: 'Line Entity Name and Type',
  pageCitations: 'Page 77/80',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: 'Always SE50' },
    { name: 'Entity Code', start: 5, end: 7, length: 3, class: '3A', designation: 'M', notes: 'MF=Manufacturer, SE=Seller, BY=Buyer, ST=Ship To, CN=Consignee' },
    { name: 'Entity Name', start: 8, end: 42, length: 35, class: '35X', designation: 'C' },
    { name: 'Entity Identifier Qualifier', start: 43, end: 45, length: 3, class: '3X', designation: 'C' },
    { name: 'Entity Identifier', start: 46, end: 65, length: 20, class: '20X', designation: 'C' },
    { name: 'Filler', start: 66, end: 80, length: 15, class: '15X', designation: 'M' },
  ],
};

export const ENTITY_GBI_RECORD_SE51: RecordSpec = {
  recordId: 'SE51',
  name: 'Line Entity GBI Identifier',
  pageCitations: 'Page 85',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: 'Must equal SE51' },
    { name: 'GBI Identifier Qualifier', start: 5, end: 8, length: 4, class: '4A', designation: 'M', notes: 'LEI, GLN, DUNS, ALTA' },
    { name: 'Identifier', start: 9, end: 43, length: 35, class: '35AN', designation: 'M' },
    { name: 'Filler', start: 44, end: 80, length: 37, class: '37X', designation: 'M' },
  ],
};

export const ENTITY_STREET_RECORD_SE55: RecordSpec = {
  recordId: 'SE55',
  name: 'Line Entity Street Address',
  pageCitations: 'Page 87',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: 'Always SE55' },
    { name: 'Address Component Qualifier 1', start: 5, end: 6, length: 2, class: '2AN', designation: 'M' },
    { name: 'Address Information 1', start: 7, end: 41, length: 35, class: '35X', designation: 'M' },
    { name: 'Address Component Qualifier 2', start: 42, end: 43, length: 2, class: '2AN', designation: 'O' },
    { name: 'Address Information 2', start: 44, end: 78, length: 35, class: '35X', designation: 'O' },
    { name: 'Filler', start: 79, end: 80, length: 2, class: '2X', designation: 'M' },
  ],
};

export const ENTITY_GEO_RECORD_SE56: RecordSpec = {
  recordId: 'SE56',
  name: 'Line Entity Geographic Area',
  pageCitations: 'Page 88',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: 'Always SE56' },
    { name: 'City Name', start: 5, end: 39, length: 35, class: '35X', designation: 'M' },
    { name: 'Country Sub Entity Code', start: 40, end: 42, length: 3, class: '3AN', designation: 'C' },
    { name: 'Filler', start: 43, end: 48, length: 6, class: '6X', designation: 'M' },
    { name: 'Postal Code', start: 49, end: 63, length: 15, class: '15X', designation: 'C' },
    { name: 'Country Code', start: 64, end: 65, length: 2, class: '2A', designation: 'M' },
    { name: 'Filler', start: 66, end: 80, length: 15, class: '15X', designation: 'M' },
  ],
};

const ALL_RECORDS: RecordSpec[] = [
  INVOICE_RECORD_42,
  RULINGS_RECORD_43,
  COMMERCIAL_DESC_RECORD_44,
  LICENSE_RECORD_52,
  ENTITY_LINE_RECORD_SE50,
  ENTITY_GBI_RECORD_SE51,
  ENTITY_STREET_RECORD_SE55,
  ENTITY_GEO_RECORD_SE56,
];

describe('CATAIR Entry Summary - Description, License, and Entity Records Validation (E2)', () => {
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
});
