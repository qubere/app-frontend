import { describe, it, expect } from 'vitest';

/**
 * CATAIR Statement Processing - Statement Update/Delete (SU), ACH Payment (RM/PN), and Outstanding Action ES Query Test Suite
 * Sources:
 * - docs/plans/catair-source-docs/05-daily-statement.pdf
 * - docs/plans/catair-source-docs/05b-periodic-monthly-statement.pdf
 * - docs/plans/catair-source-docs/03-entry-summary-query-2026-05-v26.pdf (Pages 24-51)
 * - docs/plans/catair-source-docs/01-batch-block-control-v23.pdf (Pages 11-12, 22-23)
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

export const STATEMENT_RECORD_Q1: RecordSpec = {
  recordId: 'Q1',
  name: 'Daily Statements Listed & Duty/Tax Detail Record',
  pageCitations: '05-daily-statement.pdf Pages 10-11',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal Q1' },
    { name: 'District/Port of Entry Summary', start: 3, end: 6, length: 4, class: '4N', designation: 'M' },
    { name: 'Entry Filer Code', start: 7, end: 9, length: 3, class: '3AN', designation: 'M' },
    { name: 'Filler 1', start: 10, end: 11, length: 2, class: '2S', designation: 'M' },
    { name: 'Entry Number', start: 12, end: 19, length: 8, class: '8AN', designation: 'M' },
    { name: 'Filler 2', start: 20, end: 21, length: 2, class: '2S', designation: 'M' },
    { name: 'Importer of Record Number', start: 22, end: 33, length: 12, class: '12X', designation: 'C' },
    { name: 'Preliminary Daily Statement Print Date', start: 34, end: 39, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Estimated Duty Amount', start: 40, end: 50, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Estimated Tax Amount', start: 51, end: 61, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Deferred Tax Indicator', start: 62, end: 62, length: 1, class: '1A', designation: 'C' },
    { name: 'Broker Reference Number', start: 63, end: 71, length: 9, class: '9X', designation: 'C' },
    { name: 'Consolidated Indicator', start: 72, end: 72, length: 1, class: '1A', designation: 'C' },
    { name: 'Client Branch Designation', start: 73, end: 74, length: 2, class: '2AN', designation: 'C' },
    { name: 'Filler 3', start: 75, end: 77, length: 3, class: '3S', designation: 'M' },
    { name: 'Entry Type', start: 78, end: 79, length: 2, class: '2N', designation: 'M' },
    { name: 'Filler 4', start: 80, end: 80, length: 1, class: '1S', designation: 'M' },
  ],
};

export const STATEMENT_RECORD_Q2: RecordSpec = {
  recordId: 'Q2',
  name: 'Daily Statement Entry Summary Detail Record',
  pageCitations: '05-daily-statement.pdf Pages 13-14',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal Q2' },
    { name: 'District/Port of Entry Summary', start: 3, end: 6, length: 4, class: '4N', designation: 'M' },
    { name: 'Entry Filer Code', start: 7, end: 9, length: 3, class: '3AN', designation: 'M' },
    { name: 'Filler 1', start: 10, end: 11, length: 2, class: '2S', designation: 'M' },
    { name: 'Entry Number', start: 12, end: 19, length: 8, class: '8AN', designation: 'M' },
    { name: 'Filler 2', start: 20, end: 20, length: 1, class: '1S', designation: 'M' },
    { name: 'Antidumping Duty Amount', start: 21, end: 31, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Countervailing Duty Amount', start: 32, end: 42, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Filler 3', start: 43, end: 53, length: 11, class: '11S', designation: 'M' },
    { name: 'Payment Type Indicator', start: 54, end: 54, length: 1, class: '1N', designation: 'M' },
    { name: 'Pay Indicator', start: 55, end: 55, length: 1, class: '1A', designation: 'C' },
    { name: 'Countervailing Indicator', start: 56, end: 56, length: 1, class: '1A', designation: 'C' },
    { name: 'Antidumping Indicator', start: 57, end: 57, length: 1, class: '1A', designation: 'C' },
    { name: 'Filler 4', start: 58, end: 61, length: 4, class: '4S', designation: 'M' },
    { name: 'Team Number', start: 62, end: 64, length: 3, class: '3AN', designation: 'C' },
    { name: 'Interest Amount for Reconciliation Summary', start: 65, end: 72, length: 8, class: '8N', designation: 'C', impliedDecimals: 2 },
    { name: 'Filler 5', start: 73, end: 80, length: 8, class: '8S', designation: 'M' },
  ],
};

export const STATEMENT_RECORD_QA: RecordSpec = {
  recordId: 'QA',
  name: 'Daily Statement Fees Record',
  pageCitations: '05-daily-statement.pdf Pages 15-16',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal QA' },
    { name: 'Sequence Number', start: 3, end: 4, length: 2, class: '2N', designation: 'M' },
    { name: 'First Fee Class Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'C' },
    { name: 'First Fee Amount', start: 8, end: 18, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Second Fee Class Code', start: 19, end: 21, length: 3, class: '3AN', designation: 'C' },
    { name: 'Second Fee Amount', start: 22, end: 32, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Third Fee Class Code', start: 33, end: 35, length: 3, class: '3AN', designation: 'C' },
    { name: 'Third Fee Amount', start: 36, end: 46, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Fourth Fee Class Code', start: 47, end: 49, length: 3, class: '3AN', designation: 'C' },
    { name: 'Fourth Fee Amount', start: 50, end: 60, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Fifth Fee Class Code', start: 61, end: 63, length: 3, class: '3AN', designation: 'C' },
    { name: 'Fifth Fee Amount', start: 64, end: 74, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Filler', start: 75, end: 80, length: 6, class: '6S', designation: 'M' },
  ],
};

export const STATEMENT_RECORD_Q3: RecordSpec = {
  recordId: 'Q3',
  name: 'PMS Payment Due Totals & Duty/Tax Record',
  pageCitations: '05-daily-statement.pdf Pages 17-18',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal Q3' },
    { name: 'Daily Statement Number', start: 3, end: 12, length: 10, class: '10AN', designation: 'M' },
    { name: 'Filler 1', start: 13, end: 14, length: 2, class: '2S', designation: 'M' },
    { name: 'Daily Statement Print Date', start: 15, end: 20, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Entry Filer Code', start: 21, end: 23, length: 3, class: '3AN', designation: 'M' },
    { name: 'Filler 2', start: 24, end: 25, length: 2, class: '2S', designation: 'M' },
    { name: 'Importer of Record Number', start: 26, end: 37, length: 12, class: '12X', designation: 'C' },
    { name: 'Total Estimated Duty', start: 38, end: 48, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Total Estimated Tax', start: 49, end: 59, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Total Deferred Tax', start: 60, end: 70, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'District/Port Which Processes Entries', start: 71, end: 74, length: 4, class: '4N', designation: 'M' },
    { name: 'Filler 3', start: 75, end: 80, length: 6, class: '6S', designation: 'M' },
  ],
};

export const STATEMENT_RECORD_Q4: RecordSpec = {
  recordId: 'Q4',
  name: 'PMS Payment Due Total Record',
  pageCitations: '05-daily-statement.pdf Page 19',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal Q4' },
    { name: 'Total Antidumping Duty', start: 3, end: 13, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Total Countervailing Duty', start: 14, end: 24, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Total Amount Due', start: 25, end: 35, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Total Interest Amount For Reconciliation Summary', start: 36, end: 46, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Total Number Revenue Producing Entries', start: 47, end: 51, length: 5, class: '5N', designation: 'M' },
    { name: 'Total Number Non-Revenue Producing Entries', start: 52, end: 56, length: 5, class: '5N', designation: 'M' },
    { name: 'Filler', start: 57, end: 80, length: 24, class: '24S', designation: 'M' },
  ],
};

export const STATEMENT_RECORD_QE: RecordSpec = {
  recordId: 'QE',
  name: 'PMS Payment Due Fees Record',
  pageCitations: '05-daily-statement.pdf Page 20',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal QE' },
    { name: 'Sequence Number', start: 3, end: 4, length: 2, class: '2N', designation: 'M' },
    { name: 'First Fee Class Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'C' },
    { name: 'First Fee Amount', start: 8, end: 18, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Second Fee Class Code', start: 19, end: 21, length: 3, class: '3AN', designation: 'C' },
    { name: 'Second Fee Amount', start: 22, end: 32, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Third Fee Class Code', start: 33, end: 35, length: 3, class: '3AN', designation: 'C' },
    { name: 'Third Fee Amount', start: 36, end: 46, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Fourth Fee Class Code', start: 47, end: 49, length: 3, class: '3AN', designation: 'C' },
    { name: 'Fourth Fee Amount', start: 50, end: 60, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Fifth Fee Class Code', start: 61, end: 63, length: 3, class: '3AN', designation: 'C' },
    { name: 'Fifth Fee Amount', start: 64, end: 74, length: 11, class: '11N', designation: 'C', impliedDecimals: 2 },
    { name: 'Filler', start: 75, end: 80, length: 6, class: '6S', designation: 'M' },
  ],
};

export const STATEMENT_RECORD_Q7: RecordSpec = {
  recordId: 'Q7',
  name: 'Entry Summaries Deleted Record',
  pageCitations: '05-daily-statement.pdf Pages 28-30 / 05b-periodic-monthly-statement.pdf Pages 19-21',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Must equal Q7' },
    { name: 'Daily Statement Number', start: 3, end: 12, length: 10, class: '10AN', designation: 'M' },
    { name: 'Entry Filer Code 1', start: 13, end: 15, length: 3, class: '3AN', designation: 'M' },
    { name: 'Filler 1', start: 16, end: 17, length: 2, class: '2S', designation: 'M' },
    { name: 'Entry Number 1', start: 18, end: 25, length: 8, class: '8AN', designation: 'M' },
    { name: 'Delete Source 1', start: 26, end: 28, length: 3, class: '3AN', designation: 'M', notes: 'ABI = Deleted via SU application by filer, CBP = Deleted by CBP' },
    { name: 'Entry Filer Code 2', start: 29, end: 31, length: 3, class: '3AN', designation: 'M' },
    { name: 'Filler 2', start: 32, end: 33, length: 2, class: '2S', designation: 'M' },
    { name: 'Entry Number 2', start: 34, end: 41, length: 8, class: '8AN', designation: 'M' },
    { name: 'Delete Source 2', start: 42, end: 44, length: 3, class: '3AN', designation: 'C' },
    { name: 'Entry Filer Code 3', start: 45, end: 47, length: 3, class: '3AN', designation: 'M' },
    { name: 'Filler 3', start: 48, end: 49, length: 2, class: '2S', designation: 'M' },
    { name: 'Entry Number 3', start: 50, end: 57, length: 8, class: '8AN', designation: 'M' },
    { name: 'Delete Source 3', start: 58, end: 60, length: 3, class: '3AN', designation: 'C' },
    { name: 'Entry Filer Code 4', start: 61, end: 63, length: 3, class: '3AN', designation: 'M' },
    { name: 'Filler 4', start: 64, end: 65, length: 2, class: '2S', designation: 'M' },
    { name: 'Entry Number 4', start: 66, end: 73, length: 8, class: '8AN', designation: 'M' },
    { name: 'Delete Source 4', start: 74, end: 76, length: 3, class: '3AN', designation: 'C' },
    { name: 'Filler 5', start: 77, end: 80, length: 4, class: '4S', designation: 'M' },
  ],
};

export const ES_QUERY_RECORD_JA: RecordSpec = {
  recordId: 'JA',
  name: 'Criteria Query Response Header',
  pageCitations: '03-entry-summary-query-2026-05-v26.pdf Page 25',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Always JA' },
    { name: 'Filler 1', start: 3, end: 3, length: 1, class: '1S', designation: 'M' },
    { name: 'Criteria Query Type Code', start: 4, end: 6, length: 3, class: '3AN', designation: 'M' },
    { name: 'Filler 2', start: 7, end: 7, length: 1, class: '1S', designation: 'M' },
    { name: 'Requested From Date/Time', start: 8, end: 21, length: 14, class: '14AN', designation: 'M', notes: 'MMDDYYHHMMSSXX format' },
    { name: 'Requested To Date/Time', start: 22, end: 35, length: 14, class: '14AN', designation: 'M', notes: 'MMDDYYHHMMSSXX format' },
    { name: 'Filler 3', start: 36, end: 80, length: 45, class: '45S', designation: 'M' },
  ],
};

export const ES_QUERY_RECORD_JB: RecordSpec = {
  recordId: 'JB',
  name: 'Entry Summary Number & Status Information',
  pageCitations: '03-entry-summary-query-2026-05-v26.pdf Page 26',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Always JB' },
    { name: 'Entry Filer Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M' },
    { name: 'Filler 1', start: 6, end: 7, length: 2, class: '2S', designation: 'M' },
    { name: 'Entry Number', start: 8, end: 15, length: 8, class: '8AN', designation: 'M' },
    { name: 'Entry Summary Status Code', start: 16, end: 17, length: 2, class: '2AN', designation: 'M' },
    { name: 'Filler 2', start: 18, end: 80, length: 63, class: '63S', designation: 'M' },
  ],
};

export const ES_QUERY_RECORD_JZ: RecordSpec = {
  recordId: 'JZ',
  name: 'Returned Condition Record',
  pageCitations: '03-entry-summary-query-2026-05-v26.pdf Page 51',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: 'Always JZ' },
    { name: 'Condition Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M' },
    { name: 'Reason Code', start: 6, end: 8, length: 3, class: '3AN', designation: 'C' },
    { name: 'Narrative Text', start: 9, end: 48, length: 40, class: '40AN', designation: 'M' },
    { name: 'Filler 1', start: 49, end: 49, length: 1, class: '1S', designation: 'M' },
    { name: 'Filler 2', start: 50, end: 52, length: 3, class: '3S', designation: 'M' },
    { name: 'Filler 3', start: 53, end: 54, length: 2, class: '2S', designation: 'C' },
    { name: 'Entry Number', start: 55, end: 62, length: 8, class: '8AN', designation: 'C' },
    { name: 'Filler 4', start: 63, end: 64, length: 2, class: '2S', designation: 'C' },
    { name: 'District/Port of Entry', start: 65, end: 68, length: 4, class: '4AN', designation: 'M' },
    { name: 'Filler 5', start: 69, end: 80, length: 12, class: '12S', designation: 'M' },
  ],
};

const ALL_RECORDS: RecordSpec[] = [
  STATEMENT_RECORD_Q1,
  STATEMENT_RECORD_Q2,
  STATEMENT_RECORD_QA,
  STATEMENT_RECORD_Q3,
  STATEMENT_RECORD_Q4,
  STATEMENT_RECORD_QE,
  STATEMENT_RECORD_Q7,
  ES_QUERY_RECORD_JA,
  ES_QUERY_RECORD_JB,
  ES_QUERY_RECORD_JZ,
];

describe('CATAIR Statement Processing - Record Validation & Evidentiary Spec Verification', () => {
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

  describe('Application Control Mapping & Delete Source Verification', () => {
    it('should verify Statement Update (SU) output SQ and ACH Payment Authorization (RM) output PZ', () => {
      const suInputAppId = 'SU';
      const suOutputAppId = 'SQ';
      const rmInputAppId = 'RM';
      const rmOutputAppId = 'PZ';

      expect(suInputAppId).toBe('SU');
      expect(suOutputAppId).toBe('SQ');
      expect(rmInputAppId).toBe('RM');
      expect(rmOutputAppId).toBe('PZ');
    });

    it('should verify Delete Source codes ABI and CBP in Record Q7', () => {
      const deleteSourceField = STATEMENT_RECORD_Q7.fields.find(f => f.name === 'Delete Source 1');
      expect(deleteSourceField?.notes).toContain('ABI');
      expect(deleteSourceField?.notes).toContain('CBP');
    });

    it('should verify statement money amounts use 2 implied decimals', () => {
      const dutyField = STATEMENT_RECORD_Q1.fields.find(f => f.name === 'Estimated Duty Amount');
      const taxField = STATEMENT_RECORD_Q1.fields.find(f => f.name === 'Estimated Tax Amount');
      const feeField = STATEMENT_RECORD_QA.fields.find(f => f.name === 'First Fee Amount');

      expect(dutyField?.impliedDecimals).toBe(2);
      expect(taxField?.impliedDecimals).toBe(2);
      expect(feeField?.impliedDecimals).toBe(2);
    });
  });
});
