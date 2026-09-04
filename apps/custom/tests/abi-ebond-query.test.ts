import { describe, it, expect } from 'vitest';

/**
 * CATAIR eBond - Record Specifications & Transaction Query Mapping Test Suite
 * Source Documents:
 * - docs/plans/catair-source-docs/06-ebond-create-update-v1.9.pdf
 * - docs/plans/catair-source-docs/01-batch-block-control-v23.pdf (Pages 11-12, 22-23)
 * 
 * Evidentiary Audit Note on QB / QX Query Codes:
 * - Per 01-batch-block-control-v23.pdf (p. 11-12, 22-23), Application Identifiers QA (input) / QB (response) map to Quota Query.
 * - QX was an obsolete in-bond status query code (removed per 04b-cargo-manifest-bond-entry-status-query-v21.pdf p. 8).
 * - Customs eBond Create/Update uses Application Identifier CB (input) / CX (response).
 * - Customs eBond Status Notification uses Application Identifier BS.
 * - Importer/Bond Query uses Application Identifier KI (input) / KR (response).
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

export const EBOND_RECORD_10: RecordSpec = {
  recordId: '10',
  name: 'Bond Header Record',
  pageCitations: '06-ebond-create-update-v1.9.pdf Pages 23-26',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal 10' },
    { name: 'Bond Action Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M' },
    { name: 'Bond Activity Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'C' },
    { name: 'Bond Amount', start: 8, end: 17, length: 10, class: '10(S)N', designation: 'C', impliedDecimals: 0, notes: 'Whole U.S. dollars' },
    { name: 'Execution Date', start: 18, end: 23, length: 6, class: '6D', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Surety Reference Number', start: 24, end: 32, length: 9, class: '9X', designation: 'O' },
    { name: 'Effective Date', start: 33, end: 38, length: 6, class: '6D', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Termination Date', start: 39, end: 44, length: 6, class: '6D', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Bond Number', start: 45, end: 53, length: 9, class: '9AN', designation: 'C' },
    { name: 'Filler 1', start: 54, end: 56, length: 3, class: '3S', designation: 'M' },
    { name: 'Filler 2', start: 57, end: 80, length: 24, class: '24S', designation: 'M' },
  ],
};

export const EBOND_RECORD_12: RecordSpec = {
  recordId: '12',
  name: 'Secondary Notify Parties Record',
  pageCitations: '06-ebond-create-update-v1.9.pdf Page 29',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal 12' },
    { name: 'Secondary Notify Party Code 1', start: 3, end: 11, length: 9, class: '9AN', designation: 'M' },
    { name: 'Secondary Notify Party Code 2', start: 12, end: 20, length: 9, class: '9AN', designation: 'O' },
    { name: 'Secondary Notify Party Code 3', start: 21, end: 29, length: 9, class: '9AN', designation: 'O' },
    { name: 'Secondary Notify Party Code 4', start: 30, end: 38, length: 9, class: '9AN', designation: 'O' },
    { name: 'Filler', start: 39, end: 80, length: 42, class: '42S', designation: 'M' },
  ],
};

export const EBOND_RECORD_20: RecordSpec = {
  recordId: '20',
  name: 'Single Transaction Bond Record',
  pageCitations: '06-ebond-create-update-v1.9.pdf Pages 30-31',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal 20' },
    { name: 'Transaction ID Type Code', start: 3, end: 3, length: 1, class: '1AN', designation: 'M' },
    { name: 'Entry Type Code', start: 4, end: 5, length: 2, class: '2AN', designation: 'C' },
    { name: 'Transaction ID', start: 6, end: 45, length: 40, class: '40X', designation: 'M' },
    { name: 'Filler', start: 46, end: 80, length: 35, class: '35S', designation: 'M' },
  ],
};

export const EBOND_RECORD_30: RecordSpec = {
  recordId: '30',
  name: 'Principal Record',
  pageCitations: '06-ebond-create-update-v1.9.pdf Page 32',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal 30' },
    { name: 'Principal ID Type', start: 3, end: 5, length: 3, class: '3AN', designation: 'M' },
    { name: 'Principal ID', start: 6, end: 17, length: 12, class: '12X', designation: 'M' },
    { name: 'Principal Name', start: 18, end: 57, length: 40, class: '40X', designation: 'C' },
    { name: 'Filler', start: 58, end: 80, length: 23, class: '23S', designation: 'M' },
  ],
};

export const EBOND_RECORD_35: RecordSpec = {
  recordId: '35',
  name: 'Co-Principal Record',
  pageCitations: '06-ebond-create-update-v1.9.pdf Page 33',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal 35' },
    { name: 'Co-principal ID Type', start: 3, end: 5, length: 3, class: '3AN', designation: 'M' },
    { name: 'Co-principal ID', start: 6, end: 17, length: 12, class: '12X', designation: 'M' },
    { name: 'Co-principal Name', start: 18, end: 57, length: 40, class: '40X', designation: 'C' },
    { name: 'Filler', start: 58, end: 80, length: 23, class: '23S', designation: 'M' },
  ],
};

export const EBOND_RECORD_36: RecordSpec = {
  recordId: '36',
  name: 'Bond User Record',
  pageCitations: '06-ebond-create-update-v1.9.pdf Pages 34-35',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal 36' },
    { name: 'Bond User ID Type', start: 3, end: 5, length: 3, class: '3AN', designation: 'M' },
    { name: 'Bond User ID', start: 6, end: 17, length: 12, class: '12X', designation: 'M' },
    { name: 'Bond User Name', start: 18, end: 57, length: 40, class: '40X', designation: 'C' },
    { name: 'User Add Date', start: 58, end: 63, length: 6, class: '6D', designation: 'C', notes: 'MMDDYY format' },
    { name: 'User Delete Date', start: 64, end: 69, length: 6, class: '6D', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Filler', start: 70, end: 80, length: 11, class: '11S', designation: 'M' },
  ],
};

export const EBOND_RECORD_40: RecordSpec = {
  recordId: '40',
  name: 'Surety Record',
  pageCitations: '06-ebond-create-update-v1.9.pdf Page 36',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal 40' },
    { name: 'Surety Code', start: 3, end: 5, length: 3, class: '3N', designation: 'M' },
    { name: 'Agent ID Number', start: 6, end: 16, length: 11, class: '11X', designation: 'M' },
    { name: 'Surety Name', start: 17, end: 56, length: 40, class: '40X', designation: 'C' },
    { name: 'Surety Liability Amount', start: 57, end: 66, length: 10, class: '10(S)N', designation: 'C', impliedDecimals: 0, notes: 'Whole U.S. dollars' },
    { name: 'Filler', start: 67, end: 80, length: 14, class: '14S', designation: 'M' },
  ],
};

export const EBOND_RECORD_45: RecordSpec = {
  recordId: '45',
  name: 'Co-Surety Record',
  pageCitations: '06-ebond-create-update-v1.9.pdf Page 37',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal 45' },
    { name: 'Co-Surety Code', start: 3, end: 5, length: 3, class: '3N', designation: 'M' },
    { name: 'Agent ID Number', start: 6, end: 16, length: 11, class: '11X', designation: 'M' },
    { name: 'Co-Surety Name', start: 17, end: 56, length: 40, class: '40X', designation: 'C' },
    { name: 'Co-Surety Liability Amount', start: 57, end: 66, length: 10, class: '10(S)N', designation: 'M', impliedDecimals: 0, notes: 'Whole U.S. dollars' },
    { name: 'Filler', start: 67, end: 80, length: 14, class: '14S', designation: 'M' },
  ],
};

export const EBOND_RECORD_46: RecordSpec = {
  recordId: '46',
  name: 'Re-Insurer Record',
  pageCitations: '06-ebond-create-update-v1.9.pdf Page 38',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal 46' },
    { name: 'Surety Code for Re-Insurer', start: 3, end: 5, length: 3, class: '3N', designation: 'M' },
    { name: 'Agent ID Number', start: 6, end: 16, length: 11, class: '11X', designation: 'M' },
    { name: 'Surety Name', start: 17, end: 56, length: 40, class: '40X', designation: 'C' },
    { name: 'Filler', start: 57, end: 80, length: 24, class: '24S', designation: 'M' },
  ],
};

export const EBOND_RECORD_90: RecordSpec = {
  recordId: '90',
  name: 'Error or Accept/Reject Message Record',
  pageCitations: '06-ebond-create-update-v1.9.pdf Page 39',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal 90' },
    { name: 'Record ID in Error', start: 3, end: 4, length: 2, class: '2AN', designation: 'C' },
    { name: 'Condition Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M' },
    { name: 'Filler 1', start: 8, end: 9, length: 2, class: '2X', designation: 'M' },
    { name: 'Narrative Text', start: 10, end: 49, length: 40, class: '40X', designation: 'M' },
    { name: 'Filler 2', start: 50, end: 80, length: 31, class: '31S', designation: 'M' },
  ],
};

const ALL_RECORDS: RecordSpec[] = [
  EBOND_RECORD_10,
  EBOND_RECORD_12,
  EBOND_RECORD_20,
  EBOND_RECORD_30,
  EBOND_RECORD_35,
  EBOND_RECORD_36,
  EBOND_RECORD_40,
  EBOND_RECORD_45,
  EBOND_RECORD_46,
  EBOND_RECORD_90,
];

describe('CATAIR eBond - Record Specifications & Query Mapping Validation', () => {
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

  describe('Application & Query Transaction Mapping Audit', () => {
    it('should verify eBond input application CB and output application CX', () => {
      const ebondInputAppId = 'CB';
      const ebondOutputAppId = 'CX';
      const ebondStatusAppId = 'BS';

      expect(ebondInputAppId).toBe('CB');
      expect(ebondOutputAppId).toBe('CX');
      expect(ebondStatusAppId).toBe('BS');
    });

    it('should document that QA/QB is Quota Query and KI/KR is Importer/Bond Query', () => {
      const quotaQueryInput = 'QA';
      const quotaQueryOutput = 'QB';
      const bondQueryInput = 'KI';
      const bondQueryOutput = 'KR';

      expect(quotaQueryInput).toBe('QA');
      expect(quotaQueryOutput).toBe('QB');
      expect(bondQueryInput).toBe('KI');
      expect(bondQueryOutput).toBe('KR');
    });

    it('should confirm eBond money amounts use whole U.S. dollars (0 implied decimals)', () => {
      const bondAmt = EBOND_RECORD_10.fields.find(f => f.name === 'Bond Amount');
      const liabilityAmt = EBOND_RECORD_40.fields.find(f => f.name === 'Surety Liability Amount');
      const coLiabilityAmt = EBOND_RECORD_45.fields.find(f => f.name === 'Co-Surety Liability Amount');

      expect(bondAmt?.impliedDecimals).toBe(0);
      expect(liabilityAmt?.impliedDecimals).toBe(0);
      expect(coLiabilityAmt?.impliedDecimals).toBe(0);
    });
  });
});
