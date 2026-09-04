import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Broker Download - Extended Records Test Suite
 * Source: docs/plans/catair-source-docs/09-broker-download-draft.pdf
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

export const BROKER_RECORD_1V: RecordSpec = {
  recordId: '1V',
  name: 'Hazardous Material Detail',
  pageCitations: 'Page 43',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Hazardous Material Code', start: 3, end: 12, length: 10, class: '10X', designation: 'M' },
    { name: 'Hazardous Material Class', start: 13, end: 16, length: 4, class: '4X', designation: 'O' },
    { name: 'Hazardous Material Code Qualifier', start: 17, end: 17, length: 1, class: '1X', designation: 'O' },
    { name: 'Hazardous Material Description', start: 18, end: 47, length: 30, class: '30AN', designation: 'O' },
    { name: 'Hazardous Material Contact', start: 48, end: 71, length: 24, class: '24AN', designation: 'O' },
    { name: 'UN Hazardous Material Page', start: 72, end: 77, length: 6, class: '6AN', designation: 'O' },
    { name: 'Filler', start: 78, end: 80, length: 3, class: '3AN', designation: 'M' },
  ],
};

export const BROKER_RECORD_2V: RecordSpec = {
  recordId: '2V',
  name: 'Additional Hazardous Material Detail',
  pageCitations: 'Page 44',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Flashpoint Temperature', start: 3, end: 5, length: 3, class: '3N', designation: 'C' },
    { name: 'Unit of Measure Code', start: 6, end: 7, length: 2, class: '2X', designation: 'C' },
    { name: 'Negative Indicator', start: 8, end: 8, length: 1, class: '1A', designation: 'C' },
    { name: 'Filler', start: 9, end: 80, length: 72, class: '72AN', designation: 'M' },
  ],
};

export const BROKER_RECORD_3V: RecordSpec = {
  recordId: '3V',
  name: 'Hazardous Material Classification Detail',
  pageCitations: 'Page 45',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M' },
    { name: 'Hazardous Material Description', start: 3, end: 32, length: 30, class: '30AN', designation: 'O' },
    { name: 'Hazardous Material Classification', start: 33, end: 62, length: 30, class: '30AN', designation: 'C' },
    { name: 'Filler', start: 63, end: 80, length: 18, class: '18AN', designation: 'M' },
  ],
};

export const BROKER_RECORD_NS40: RecordSpec = {
  recordId: 'NS40',
  name: 'Status Notification Continuation',
  pageCitations: 'Page 49',
  totalLength: 80,
  fields: [
    { name: 'Record Type', start: 1, end: 2, length: 2, class: '2N', designation: 'M' },
    { name: 'Entry Type', start: 3, end: 4, length: 2, class: '2N', designation: 'C' },
    { name: 'Entry Number', start: 5, end: 19, length: 15, class: '15AN', designation: 'C' },
    { name: 'Port of Transaction', start: 20, end: 23, length: 4, class: '4N', designation: 'M' },
    { name: 'FIRMS Code', start: 24, end: 27, length: 4, class: '4AN', designation: 'C' },
    { name: 'Container Number', start: 28, end: 41, length: 14, class: '14AN', designation: 'C' },
    { name: 'Filler', start: 42, end: 80, length: 39, class: '39AN', designation: 'M' },
  ],
};

export const BROKER_RECORD_NS50: RecordSpec = {
  recordId: 'NS50',
  name: 'Status Notification Remarks',
  pageCitations: 'Page 50',
  totalLength: 80,
  fields: [
    { name: 'Record Type', start: 1, end: 2, length: 2, class: '2N', designation: 'M' },
    { name: 'Remarks', start: 3, end: 47, length: 45, class: '45X', designation: 'M' },
    { name: 'Filler', start: 48, end: 80, length: 33, class: '33AN', designation: 'M' },
  ],
};

export const BROKER_RECORD_NS60: RecordSpec = {
  recordId: 'NS60',
  name: 'Status Notification Container Detail',
  pageCitations: 'Page 51',
  totalLength: 80,
  fields: [
    { name: 'Record Type', start: 1, end: 2, length: 2, class: '2N', designation: 'M' },
    { name: 'Action Indicator', start: 3, end: 3, length: 1, class: '1N', designation: 'C' },
    { name: 'Container Number', start: 4, end: 17, length: 14, class: '14AN', designation: 'C' },
    { name: 'Seal Number 1', start: 18, end: 32, length: 15, class: '15AN', designation: 'C' },
    { name: 'Seal Number 2', start: 33, end: 47, length: 15, class: '15AN', designation: 'C' },
    { name: 'Filler', start: 48, end: 80, length: 33, class: '33AN', designation: 'M' },
  ],
};

const ALL_RECORDS: RecordSpec[] = [
  BROKER_RECORD_1V,
  BROKER_RECORD_2V,
  BROKER_RECORD_3V,
  BROKER_RECORD_NS40,
  BROKER_RECORD_NS50,
  BROKER_RECORD_NS60,
];

describe('CATAIR ACE Broker Download - Extended Records Validation', () => {
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
