import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Reconciliation Entry Summary Create/Update (RE/RX Application) Test Suite
 * Source Document: ACE CATAIR Reconciliation Entry Summary Create/Update (v12, June 2025)
 * Application Identifier: RE (Input Create/Update) / RX (Output Response)
 * Source PDF: docs/apps/customs/feature/abi/catair-source-docs/16-reconciliation-entry-summary-v3.pdf
 *
 * Full Record Set (27 Records):
 *   Input Records:
 *     10 - Reconciliation Entry Summary Header Input (Page 13)
 *     11 - Contact Information Input (Page 20)
 *     15 - Free Trade Agreement Statement Input (Page 21)
 *     D1 - Documentation Recipient Entity and Date Input (Page 22)
 *     D2 - Documentation Recipient Address Input (Page 22)
 *     D3 - Documentation Recipient Geographic Location Input (Page 23)
 *     C1 - Claimant Entity and Date Input (Page 24)
 *     C2 - Claimant Address Input (Page 24)
 *     C3 - Claimant Geographic Location Input (Page 25)
 *     P1 - Petition / Protest Detail Input (Page 26)
 *     Q1 - Classification Pending Action Detail Input (Page 27)
 *     20 - Associated ES Detail Input (Page 28)
 *     21 - Associated ES Revenue Detail Input (Page 29)
 *     50 - Reconciled Line Identity Detail Input (Page 31)
 *     51 - Additional Line Identity HTS Detail Input (Page 33)
 *     52 - Underlying ES Line Pointer Detail Input (Page 34)
 *     53 - Reconciled Line Change Detail Input (Page 36)
 *     54 - Additional Reconciled HTS Detail Input (Page 37)
 *     55 - Reconciled Line-Item Revenue Detail Input (Page 38)
 *     56 - Original Value Duty Detail Input (Page 40)
 *     57 - Additional Original Value Duty Detail Input (Page 41)
 *     58 - Original Amount Revenue Detail Input (Page 42)
 *     90 - Reconciliation Payment Handling Detail Input (Page 44)
 *     91 - Reconciled Amount Grand Total Detail Input (Page 46)
 *     92 - Payable Amount Grand Total Detail Input (Page 48)
 *   Output Records:
 *     E0 - Reconciliation Condition Reference Output (Page 62)
 *     E1 - Reconciliation Condition/Disposition Response Output (Page 68)
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

export const RECON_10_SPEC: RecordSpec = {
  recordId: '10',
  name: 'Reconciliation Entry Summary Header Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 13',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '10'" },
    { name: 'Filing Action Request Code', start: 3, end: 3, length: 1, class: '1AN', designation: 'M', notes: 'A = Add, R = Replace, D = Delete' },
    { name: 'Entry Filer Code', start: 4, end: 6, length: 3, class: '3AN', designation: 'M', notes: '3-character ABI filer code' },
    { name: 'Filler', start: 7, end: 8, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
    { name: 'Entry Number', start: 9, end: 16, length: 8, class: '8AN', designation: 'M', notes: '7-digit entry number + check digit' },
    { name: 'Reconciliation Type Code', start: 17, end: 19, length: 3, class: '3AN', designation: 'M', notes: 'C01-C04, Cx1-Cx7, NA1-NA7' },
    { name: 'Importer of Record Number', start: 20, end: 31, length: 12, class: '12X', designation: 'M', notes: 'IRS / SSN / CBP assigned importer ID' },
    { name: 'Surety Code', start: 32, end: 34, length: 3, class: '3AN', designation: 'C', notes: '3-digit surety company code' },
    { name: 'Bond Type Code', start: 35, end: 35, length: 1, class: '1N', designation: 'C', notes: '8 = Continuous, 9 = Single Entry' },
    { name: 'Aggregate Refund Waiver Indicator', start: 36, end: 36, length: 1, class: '1AN', designation: 'C', notes: 'Y = Waive aggregate refund' },
    { name: 'Prior Disclosure Indicator', start: 37, end: 37, length: 1, class: '1AN', designation: 'C', notes: 'Y = Prior Disclosure' },
    { name: 'Filler', start: 38, end: 40, length: 3, class: '3S', designation: 'M', notes: 'Space fill' },
    { name: 'Broker Reference Number', start: 41, end: 49, length: 9, class: '9X', designation: 'C', notes: 'Filer internal reference number' },
    { name: 'Designated Notify Party (4811) Number', start: 50, end: 61, length: 12, class: '12X', designation: 'C', notes: 'CBP Form 4811 ID' },
    { name: 'Filler', start: 62, end: 80, length: 19, class: '19S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_11_SPEC: RecordSpec = {
  recordId: '11',
  name: 'Contact Information Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 20',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '11'" },
    { name: 'Contact Name', start: 3, end: 32, length: 30, class: '30X', designation: 'M', notes: 'Contact person name' },
    { name: 'Contact Phone Number', start: 33, end: 42, length: 10, class: '10N', designation: 'M', notes: '10-digit phone number' },
    { name: 'Contact Email Address', start: 43, end: 80, length: 38, class: '38X', designation: 'C', notes: 'Email address of contact' },
  ],
};

export const RECON_15_SPEC: RecordSpec = {
  recordId: '15',
  name: 'Free Trade Agreement Statement Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 21',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '15'" },
    { name: 'Statement Indicator', start: 3, end: 3, length: 1, class: '1AN', designation: 'M', notes: 'Y = Statement attached / declared' },
    { name: 'Filler', start: 4, end: 80, length: 77, class: '77S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_D1_SPEC: RecordSpec = {
  recordId: 'D1',
  name: 'Documentation Recipient Entity and Date Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 22',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal 'D1'" },
    { name: 'Document Recipient Identifier', start: 3, end: 14, length: 12, class: '12X', designation: 'M', notes: 'IRS/SSN/CBP ID with dashes' },
    { name: 'Document Recipient Name', start: 15, end: 49, length: 35, class: '35X', designation: 'M', notes: 'Document Recipient Name' },
    { name: 'Filler', start: 50, end: 80, length: 31, class: '31S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_D2_SPEC: RecordSpec = {
  recordId: 'D2',
  name: 'Documentation Recipient Address Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 22',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal 'D2'" },
    { name: 'Address Information Line 1', start: 3, end: 37, length: 35, class: '35X', designation: 'M', notes: 'Address line 1' },
    { name: 'Address Information Line 2', start: 38, end: 72, length: 35, class: '35X', designation: 'C', notes: 'Address line 2' },
    { name: 'Filler', start: 73, end: 80, length: 8, class: '8S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_D3_SPEC: RecordSpec = {
  recordId: 'D3',
  name: 'Documentation Recipient Geographic Location Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 23',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal 'D3'" },
    { name: 'City', start: 3, end: 27, length: 25, class: '25X', designation: 'M', notes: 'City name' },
    { name: 'State/Province Code', start: 28, end: 29, length: 2, class: '2A', designation: 'C', notes: 'US State or Canadian Province' },
    { name: 'Postal Code', start: 30, end: 38, length: 9, class: '9X', designation: 'M', notes: 'ZIP/Postal Code' },
    { name: 'Country Code', start: 39, end: 40, length: 2, class: '2A', designation: 'M', notes: 'ISO Country Code' },
    { name: 'Filler', start: 41, end: 80, length: 40, class: '40S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_C1_SPEC: RecordSpec = {
  recordId: 'C1',
  name: 'Claimant Entity and Date Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 24',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal 'C1'" },
    { name: 'Claimant Identifier', start: 3, end: 14, length: 12, class: '12X', designation: 'M', notes: 'IRS/SSN/CBP ID with dashes' },
    { name: 'Claimant Name', start: 15, end: 49, length: 35, class: '35X', designation: 'M', notes: 'Claimant Name' },
    { name: 'Filler', start: 50, end: 80, length: 31, class: '31S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_C2_SPEC: RecordSpec = {
  recordId: 'C2',
  name: 'Claimant Address Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 24',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal 'C2'" },
    { name: 'Address Information Line 1', start: 3, end: 37, length: 35, class: '35X', designation: 'M', notes: 'Address line 1' },
    { name: 'Address Information Line 2', start: 38, end: 72, length: 35, class: '35X', designation: 'C', notes: 'Address line 2' },
    { name: 'Filler', start: 73, end: 80, length: 8, class: '8S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_C3_SPEC: RecordSpec = {
  recordId: 'C3',
  name: 'Claimant Geographic Location Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 25',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal 'C3'" },
    { name: 'City', start: 3, end: 27, length: 25, class: '25X', designation: 'M', notes: 'City name' },
    { name: 'State/Province Code', start: 28, end: 29, length: 2, class: '2A', designation: 'C', notes: 'US State or Canadian Province' },
    { name: 'Postal Code', start: 30, end: 38, length: 9, class: '9X', designation: 'M', notes: 'ZIP/Postal Code' },
    { name: 'Country Code', start: 39, end: 40, length: 2, class: '2A', designation: 'M', notes: 'ISO Country Code' },
    { name: 'Filler', start: 41, end: 80, length: 40, class: '40S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_P1_SPEC: RecordSpec = {
  recordId: 'P1',
  name: 'Petition / Protest Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 26',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal 'P1'" },
    { name: 'Protest / Petition Identifier', start: 3, end: 37, length: 35, class: '35AN', designation: 'M', notes: 'Protest or Petition Number' },
    { name: 'Filler', start: 38, end: 80, length: 43, class: '43S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_Q1_SPEC: RecordSpec = {
  recordId: 'Q1',
  name: 'Classification Pending Action Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 27',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal 'Q1'" },
    { name: 'Pending Action Identifier Type Code', start: 3, end: 3, length: 1, class: '1AN', designation: 'M', notes: 'P = Protest, C = Court' },
    { name: 'Pending Action Identifier', start: 4, end: 38, length: 35, class: '35AN', designation: 'M', notes: 'Court case or protest ID' },
    { name: 'Filler', start: 39, end: 80, length: 42, class: '42S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_20_SPEC: RecordSpec = {
  recordId: '20',
  name: 'Associated ES Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 28',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '20'" },
    { name: 'Associated Entry Filer Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'Filer code of underlying entry summary' },
    { name: 'Filler', start: 6, end: 7, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
    { name: 'Associated Entry Summary Number', start: 8, end: 15, length: 8, class: '8AN', designation: 'M', notes: 'Entry number of underlying entry summary' },
    { name: 'Associated Entry Summary Date', start: 16, end: 21, length: 6, class: '6D', designation: 'M', notes: 'MMDDYY format' },
    { name: 'Reconciliation Issue Code', start: 22, end: 23, length: 2, class: '2AN', designation: 'M', notes: '01=Value, 02=9802, 03=FTA, 04=Classification' },
    { name: 'Filler', start: 24, end: 80, length: 57, class: '57S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_21_SPEC: RecordSpec = {
  recordId: '21',
  name: 'Associated ES Revenue Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 29',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '21'" },
    { name: 'Accounting Class Code Line (1)', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'CBP accounting class code' },
    { name: 'Estimated Reconciled Revenue Amount Line (1)', start: 6, end: 16, length: 11, class: '11N', designation: 'M', impliedDecimals: 2, notes: 'Estimated amount' },
    { name: 'Filler (1)', start: 17, end: 17, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (2)', start: 18, end: 20, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Estimated Reconciled Revenue Amount Line (2)', start: 21, end: 31, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Estimated amount' },
    { name: 'Filler (2)', start: 32, end: 32, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (3)', start: 33, end: 35, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Estimated Reconciled Revenue Amount Line (3)', start: 36, end: 46, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Estimated amount' },
    { name: 'Filler (3)', start: 47, end: 47, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (4)', start: 48, end: 50, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Estimated Reconciled Revenue Amount Line (4)', start: 51, end: 61, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Estimated amount' },
    { name: 'Filler (4)', start: 62, end: 62, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (5)', start: 63, end: 65, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Estimated Reconciled Revenue Amount Line (5)', start: 66, end: 76, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Estimated amount' },
    { name: 'Filler', start: 77, end: 80, length: 4, class: '4S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_50_SPEC: RecordSpec = {
  recordId: '50',
  name: 'Reconciled Line Identity Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 31',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '50'" },
    { name: 'Primary HTS Number', start: 3, end: 12, length: 10, class: '10AN', designation: 'M', notes: 'First Harmonized Tariff Schedule number' },
    { name: 'Country of Origin', start: 13, end: 14, length: 2, class: '2X', designation: 'M', notes: 'Country of origin code' },
    { name: 'Trade Agreement / Special Program Claim Code', start: 15, end: 16, length: 2, class: '2AN', designation: 'C', notes: 'SPI / FTA claim code' },
    { name: 'Filler', start: 17, end: 17, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Begin Effective Date', start: 18, end: 25, length: 8, class: '8D', designation: 'O', notes: 'YYYYMMDD format' },
    { name: 'Filler', start: 26, end: 26, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Reconciliation Narrative Comment', start: 27, end: 66, length: 40, class: '40AN', designation: 'O', notes: 'Text comment' },
    { name: 'Filler', start: 67, end: 80, length: 14, class: '14S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_51_SPEC: RecordSpec = {
  recordId: '51',
  name: 'Additional Line Identity HTS Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 33',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '51'" },
    { name: 'Additional HTS Number (1)', start: 3, end: 12, length: 10, class: '10AN', designation: 'M', notes: 'Subsequent HTS number' },
    { name: 'Filler (1)', start: 13, end: 13, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Additional HTS Number (2)', start: 14, end: 23, length: 10, class: '10AN', designation: 'C', notes: 'Subsequent HTS number' },
    { name: 'Filler (2)', start: 24, end: 24, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Additional HTS Number (3)', start: 25, end: 34, length: 10, class: '10AN', designation: 'C', notes: 'Subsequent HTS number' },
    { name: 'Filler (3)', start: 35, end: 35, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Additional HTS Number (4)', start: 36, end: 45, length: 10, class: '10AN', designation: 'C', notes: 'Subsequent HTS number' },
    { name: 'Filler', start: 46, end: 80, length: 35, class: '35S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_52_SPEC: RecordSpec = {
  recordId: '52',
  name: 'Underlying ES Line Pointer Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 34',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '52'" },
    { name: 'Underlying Entry Pointer (1) Filer Code', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'Filer Code' },
    { name: 'Filler (1a)', start: 6, end: 7, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
    { name: 'Underlying Entry Pointer (1) Entry Number', start: 8, end: 15, length: 8, class: '8AN', designation: 'M', notes: 'Entry Summary Number' },
    { name: 'Filler (1b)', start: 16, end: 17, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
    { name: 'Underlying Entry Pointer (1) Line Number', start: 18, end: 20, length: 3, class: '3X', designation: 'M', notes: '3-digit Line Number' },
    { name: 'Filler (1c)', start: 21, end: 21, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Underlying Entry Pointer (2) Composite Pointer', start: 22, end: 39, length: 18, class: '18AN', designation: 'C', notes: 'Filer/Entry/Line composite pointer' },
    { name: 'Filler (2)', start: 40, end: 40, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Underlying Entry Pointer (3) Composite Pointer', start: 41, end: 58, length: 18, class: '18AN', designation: 'C', notes: 'Filer/Entry/Line composite pointer' },
    { name: 'Filler (3)', start: 59, end: 59, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Underlying Entry Pointer (4) Composite Pointer', start: 60, end: 77, length: 18, class: '18AN', designation: 'C', notes: 'Filer/Entry/Line composite pointer' },
    { name: 'Filler', start: 78, end: 80, length: 3, class: '3S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_53_SPEC: RecordSpec = {
  recordId: '53',
  name: 'Reconciled Line Change Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 36',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '53'" },
    { name: 'Reconciled Primary HTS Number', start: 3, end: 12, length: 10, class: '10AN', designation: 'C', notes: 'Changed HTS number' },
    { name: 'Filler (1)', start: 13, end: 13, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Reconciled Primary Merchandise Value', start: 14, end: 23, length: 10, class: '10N', designation: 'C', notes: 'Reconciled value' },
    { name: 'Filler (2)', start: 24, end: 24, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Reconciled Primary Duty', start: 25, end: 35, length: 11, class: '11N', designation: 'M', impliedDecimals: 2, notes: 'Reconciled duty' },
    { name: 'Filler (3)', start: 36, end: 36, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Reconciled Trade Agreement / Special Claim Code', start: 37, end: 38, length: 2, class: '2AN', designation: 'C', notes: 'SPI claim code' },
    { name: 'Filler (4)', start: 39, end: 39, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'HTS Changed Flag', start: 40, end: 40, length: 1, class: '1AN', designation: 'C', notes: 'Y = HTS changed for value' },
    { name: 'Filler', start: 41, end: 80, length: 40, class: '40S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_54_SPEC: RecordSpec = {
  recordId: '54',
  name: 'Additional Reconciled HTS Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 37',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
    { name: 'Additional Reconciled HTS Number (1)', start: 3, end: 12, length: 10, class: '10AN', designation: 'C', notes: 'Additional HTS' },
    { name: 'Filler (1a)', start: 13, end: 13, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Additional Reconciled Value (1)', start: 14, end: 23, length: 10, class: '10N', designation: 'C', notes: 'Reconciled value' },
    { name: 'Filler (1b)', start: 24, end: 24, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Additional Reconciled Duty (1)', start: 25, end: 35, length: 11, class: '11N', designation: 'M', impliedDecimals: 2, notes: 'Reconciled duty' },
    { name: 'Filler (1c)', start: 36, end: 36, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Additional Reconciled HTS Number (2)', start: 37, end: 46, length: 10, class: '10AN', designation: 'C', notes: 'Additional HTS' },
    { name: 'Filler (2a)', start: 47, end: 47, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Additional Reconciled Value (2)', start: 48, end: 57, length: 10, class: '10N', designation: 'C', notes: 'Reconciled value' },
    { name: 'Filler (2b)', start: 58, end: 58, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Additional Reconciled Duty (2)', start: 59, end: 69, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Reconciled duty' },
    { name: 'Filler', start: 70, end: 80, length: 11, class: '11S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_55_SPEC: RecordSpec = {
  recordId: '55',
  name: 'Reconciled Line-Item Revenue Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 38',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '55'" },
    { name: 'Accounting Class Code Line (1)', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'CBP accounting class code' },
    { name: 'Reconciled Line Revenue Amount Line (1)', start: 6, end: 16, length: 11, class: '11N', designation: 'M', impliedDecimals: 2, notes: 'Reconciled revenue amount' },
    { name: 'Filler (1)', start: 17, end: 17, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (2)', start: 18, end: 20, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Reconciled Line Revenue Amount Line (2)', start: 21, end: 31, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Reconciled revenue amount' },
    { name: 'Filler (2)', start: 32, end: 32, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (3)', start: 33, end: 35, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Reconciled Line Revenue Amount Line (3)', start: 36, end: 46, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Reconciled revenue amount' },
    { name: 'Filler (3)', start: 47, end: 47, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (4)', start: 48, end: 50, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Reconciled Line Revenue Amount Line (4)', start: 51, end: 61, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Reconciled revenue amount' },
    { name: 'Filler (4)', start: 62, end: 62, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (5)', start: 63, end: 65, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Reconciled Line Revenue Amount Line (5)', start: 66, end: 76, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Reconciled revenue amount' },
    { name: 'Filler', start: 77, end: 80, length: 4, class: '4S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_56_SPEC: RecordSpec = {
  recordId: '56',
  name: 'Original Value Duty Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 40',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '56'" },
    { name: 'Original Primary Merchandise Value', start: 3, end: 12, length: 10, class: '10N', designation: 'M', notes: 'Original interim value' },
    { name: 'Filler (1)', start: 13, end: 13, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Original Primary Duty', start: 14, end: 24, length: 11, class: '11N', designation: 'M', impliedDecimals: 2, notes: 'Original interim duty' },
    { name: 'Filler', start: 25, end: 80, length: 56, class: '56S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_57_SPEC: RecordSpec = {
  recordId: '57',
  name: 'Additional Original Value Duty Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 41',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '57'" },
    { name: 'Additional Original Value (1)', start: 3, end: 12, length: 10, class: '10N', designation: 'M', notes: 'Original value' },
    { name: 'Filler (1a)', start: 13, end: 13, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Additional Original Duty (1)', start: 14, end: 24, length: 11, class: '11N', designation: 'M', impliedDecimals: 2, notes: 'Original duty' },
    { name: 'Filler (1b)', start: 25, end: 25, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Additional Original Value (2)', start: 26, end: 35, length: 10, class: '10N', designation: 'C', notes: 'Original value' },
    { name: 'Filler (2a)', start: 36, end: 36, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Additional Original Duty (2)', start: 37, end: 47, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Original duty' },
    { name: 'Filler', start: 48, end: 80, length: 33, class: '33S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_58_SPEC: RecordSpec = {
  recordId: '58',
  name: 'Original Amount Revenue Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 42',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '58'" },
    { name: 'Accounting Class Code Line (1)', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'CBP accounting class code' },
    { name: 'Original Line Revenue Amount Line (1)', start: 6, end: 16, length: 11, class: '11N', designation: 'M', impliedDecimals: 2, notes: 'Original revenue amount' },
    { name: 'Filler (1)', start: 17, end: 17, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (2)', start: 18, end: 20, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Original Line Revenue Amount Line (2)', start: 21, end: 31, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Original revenue amount' },
    { name: 'Filler (2)', start: 32, end: 32, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (3)', start: 33, end: 35, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Original Line Revenue Amount Line (3)', start: 36, end: 46, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Original revenue amount' },
    { name: 'Filler (3)', start: 47, end: 47, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (4)', start: 48, end: 50, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Original Line Revenue Amount Line (4)', start: 51, end: 61, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Original revenue amount' },
    { name: 'Filler (4)', start: 62, end: 62, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (5)', start: 63, end: 65, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Original Line Revenue Amount Line (5)', start: 66, end: 76, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Original revenue amount' },
    { name: 'Filler', start: 77, end: 80, length: 4, class: '4S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_90_SPEC: RecordSpec = {
  recordId: '90',
  name: 'Reconciliation Payment Handling Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 44',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '90'" },
    { name: 'Payment Type Code', start: 3, end: 3, length: 1, class: '1AN', designation: 'C', notes: '1 = ACH, 2 = Check/Cash, 3 = Credit' },
    { name: 'Filler (1)', start: 4, end: 4, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Preliminary Statement Print Date', start: 5, end: 10, length: 6, class: '6D', designation: 'C', notes: 'MMDDYY format' },
    { name: 'Filler (2)', start: 11, end: 11, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Statement Client Code', start: 12, end: 13, length: 2, class: '2AN', designation: 'C', notes: 'Filer assigned code' },
    { name: 'Filler', start: 14, end: 80, length: 67, class: '67S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_91_SPEC: RecordSpec = {
  recordId: '91',
  name: 'Reconciled Amount Grand Total Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 46',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '91'" },
    { name: 'Accounting Class Code Line (1)', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'CBP accounting class code' },
    { name: 'Reconciled Total Revenue Amount Line (1)', start: 6, end: 16, length: 11, class: '11N', designation: 'M', impliedDecimals: 2, notes: 'Reconciled total revenue' },
    { name: 'Filler (1)', start: 17, end: 17, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (2)', start: 18, end: 20, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Reconciled Total Revenue Amount Line (2)', start: 21, end: 31, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Reconciled total revenue' },
    { name: 'Filler (2)', start: 32, end: 32, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (3)', start: 33, end: 35, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Reconciled Total Revenue Amount Line (3)', start: 36, end: 46, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Reconciled total revenue' },
    { name: 'Filler (3)', start: 47, end: 47, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (4)', start: 48, end: 50, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Reconciled Total Revenue Amount Line (4)', start: 51, end: 61, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Reconciled total revenue' },
    { name: 'Filler (4)', start: 62, end: 62, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (5)', start: 63, end: 65, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Reconciled Total Revenue Amount Line (5)', start: 66, end: 76, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Reconciled total revenue' },
    { name: 'Filler', start: 77, end: 80, length: 4, class: '4S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_92_SPEC: RecordSpec = {
  recordId: '92',
  name: 'Payable Amount Grand Total Detail Input',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 48',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '92'" },
    { name: 'Accounting Class Code Line (1)', start: 3, end: 5, length: 3, class: '3AN', designation: 'M', notes: 'CBP accounting class code' },
    { name: 'Payable Revenue Amount Line (1)', start: 6, end: 16, length: 11, class: '11N', designation: 'M', impliedDecimals: 2, notes: 'Payable revenue amount' },
    { name: 'Filler (1)', start: 17, end: 17, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (2)', start: 18, end: 20, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Payable Revenue Amount Line (2)', start: 21, end: 31, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Payable revenue amount' },
    { name: 'Filler (2)', start: 32, end: 32, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (3)', start: 33, end: 35, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Payable Revenue Amount Line (3)', start: 36, end: 46, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Payable revenue amount' },
    { name: 'Filler (3)', start: 47, end: 47, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (4)', start: 48, end: 50, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Payable Revenue Amount Line (4)', start: 51, end: 61, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Payable revenue amount' },
    { name: 'Filler (4)', start: 62, end: 62, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Accounting Class Code Line (5)', start: 63, end: 65, length: 3, class: '3AN', designation: 'C', notes: 'Additional class code' },
    { name: 'Payable Revenue Amount Line (5)', start: 66, end: 76, length: 11, class: '11N', designation: 'C', impliedDecimals: 2, notes: 'Payable revenue amount' },
    { name: 'Filler', start: 77, end: 80, length: 4, class: '4S', designation: 'M', notes: 'Space fill' },
  ],
};

export const RECON_E0_SPEC: RecordSpec = {
  recordId: 'E0',
  name: 'Reconciliation Condition Reference Output',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 62',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal 'E0'" },
    { name: 'Filler (1)', start: 3, end: 3, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Reference Data Type Code', start: 4, end: 9, length: 6, class: '6AN', designation: 'M', notes: 'RECONS, DOCREC, CLAIMT, etc.' },
    { name: 'Filler (2)', start: 10, end: 10, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Occurrence Position', start: 11, end: 16, length: 6, class: '6N', designation: 'M', notes: 'Relative sequence occurrence' },
    { name: 'Filler (3)', start: 17, end: 17, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Reference ID Tag', start: 18, end: 24, length: 7, class: '7X', designation: 'M', notes: "Always 'REF ID:'" },
    { name: 'Filler (4)', start: 25, end: 25, length: 1, class: '1S', designation: 'M', notes: 'Space fill' },
    { name: 'Returned Reference Data Text', start: 26, end: 80, length: 55, class: '55X', designation: 'M', notes: 'Reference data text content' },
  ],
};

export const RECON_E1_SPEC: RecordSpec = {
  recordId: 'E1',
  name: 'Reconciliation Condition/Disposition Response Output',
  pageCitations: 'ACE CATAIR Reconciliation Entry Summary Create/Update v12 (June 2025), Page 68',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal 'E1'" },
    { name: 'Disposition Type Code', start: 3, end: 3, length: 1, class: '1AN', designation: 'M', notes: 'A = Accepted, R = Rejected' },
    { name: 'Severity Code', start: 4, end: 4, length: 1, class: '1AN', designation: 'M', notes: 'F = Fatal, I = Informational' },
    { name: 'Condition Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: '3-char condition code' },
    { name: 'Reason Code', start: 8, end: 10, length: 3, class: '3AN', designation: 'C', notes: 'Reason code if applicable' },
    { name: 'Narrative Text', start: 11, end: 50, length: 40, class: '40AN', designation: 'M', notes: 'Text description' },
    { name: 'Entry Filer Code', start: 51, end: 53, length: 3, class: '3AN', designation: 'C', notes: 'Echoed Filer Code' },
    { name: 'Filler (1)', start: 54, end: 55, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
    { name: 'Entry Number', start: 56, end: 63, length: 8, class: '8AN', designation: 'C', notes: 'Echoed Entry Summary Number' },
    { name: 'Filler (2)', start: 64, end: 68, length: 5, class: '5S', designation: 'M', notes: 'Space fill' },
    { name: 'Broker Reference Number', start: 69, end: 77, length: 9, class: '9X', designation: 'C', notes: 'Echoed Broker Reference Number' },
    { name: 'Filler', start: 78, end: 80, length: 3, class: '3S', designation: 'M', notes: 'Space fill' },
  ],
};

export const ALL_RECON_SPECS: RecordSpec[] = [
  RECON_10_SPEC,
  RECON_11_SPEC,
  RECON_15_SPEC,
  RECON_D1_SPEC,
  RECON_D2_SPEC,
  RECON_D3_SPEC,
  RECON_C1_SPEC,
  RECON_C2_SPEC,
  RECON_C3_SPEC,
  RECON_P1_SPEC,
  RECON_Q1_SPEC,
  RECON_20_SPEC,
  RECON_21_SPEC,
  RECON_50_SPEC,
  RECON_51_SPEC,
  RECON_52_SPEC,
  RECON_53_SPEC,
  RECON_54_SPEC,
  RECON_55_SPEC,
  RECON_56_SPEC,
  RECON_57_SPEC,
  RECON_58_SPEC,
  RECON_90_SPEC,
  RECON_91_SPEC,
  RECON_92_SPEC,
  RECON_E0_SPEC,
  RECON_E1_SPEC,
];

describe('CATAIR Reconciliation Entry Summary (RE/RX) Specifications', () => {
  it('contains exactly 27 verified record specifications', () => {
    expect(ALL_RECON_SPECS.length).toBe(27);
  });

  it.each(ALL_RECON_SPECS)(' () - position math and length sum to 80', (spec) => {
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

  it.each(ALL_RECON_SPECS)(' () - control identifier starts at position 1 and matches record ID in position 1-2', (spec) => {
    const ctrlField = spec.fields[0];
    expect(ctrlField.name).toBe('Control Identifier');
    expect(ctrlField.start).toBe(1);
    expect(ctrlField.end).toBe(2);
    expect(ctrlField.length).toBe(2);
    expect(ctrlField.notes).toContain(spec.recordId);
  });
});
