import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Entry Summary Create/Update (AE Application) - Record 54 Internal Sub-Type Layouts Test Suite
 * Source PDF: docs/plans/catair-source-docs/02-entry-summary-create-update-2026-07.pdf (July 2026 Revision)
 * Pages: 101–117 (Record Identifier 54 & Note 1 Types 01 through 12)
 *
 * Scoped Sub-Types (all fit within Record 54's 80-byte record payload):
 *   - Type 01: Softwood Lumber Export Information (p. 102)
 *   - Type 02: Product Exclusion Information – Steel Products (p. 103)
 *   - Type 03: Product Exclusion Information – Aluminum Products (p. 104)
 *   - Type 04: South Korean (KR) Export Steel Certificate (p. 105)
 *   - Type 05: CBMA Product Detail (pp. 106–109)
 *   - Type 06: AD/CVD Certification Designation (p. 110)
 *   - Type 07: Aluminum Smelt and Cast Country Detail (pp. 111–112)
 *   - Type 08: Steel Melt and Pour Country Detail (p. 113)
 *   - Type 09: 201 Bifacial Certification Designation (p. 114)
 *   - Type 10: 301 Ship-to-Shore Crane Certification Designation (p. 115)
 *   - Type 11: Auto Parts Offset License (p. 116)
 *   - Type 12: Copper Smelt and Cast Country Detail (p. 117)
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

export interface RecordSubtypeSpec {
  typeCode: string;
  name: string;
  pageCitations: string;
  totalLength: number;
  fields: FieldSpec[];
}

export const RECORD_54_SUBTYPES: RecordSubtypeSpec[] = [
  // ── Type 01 ─────────────────────────────────────────────────────────────
  {
    typeCode: '01',
    name: 'Softwood Lumber Export Information',
    pageCitations: 'Page 102 (ESF-102)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '01'" },
      { name: 'Softwood Lumber Declaration Indicator', start: 5, end: 5, length: 1, class: '1AN', designation: 'M', notes: 'P = Declaration requirements met' },
      { name: 'Softwood Lumber Export Price', start: 6, end: 16, length: 11, class: '11N', designation: 'M', impliedDecimals: 2, notes: 'Export price in USD, 2 implied decimals' },
      { name: 'Softwood Lumber Export Charges', start: 17, end: 27, length: 11, class: '11N', designation: 'M', impliedDecimals: 2, notes: 'Export charges/taxes in USD, 2 implied decimals' },
      { name: 'Filler', start: 28, end: 80, length: 53, class: '53S', designation: 'M', notes: 'Space fill' },
    ],
  },
  // ── Type 02 ─────────────────────────────────────────────────────────────
  {
    typeCode: '02',
    name: 'Product Exclusion Information – Steel Products',
    pageCitations: 'Page 103 (ESF-103)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '02'" },
      { name: 'Product Exclusion Identifier - Steel', start: 5, end: 13, length: 9, class: '9AN', designation: 'M', notes: 'Format STLnnnnnn or APRnnnnnn from DOC portal' },
      { name: 'Filler', start: 14, end: 80, length: 67, class: '67S', designation: 'M', notes: 'Space fill' },
    ],
  },
  // ── Type 03 ─────────────────────────────────────────────────────────────
  {
    typeCode: '03',
    name: 'Product Exclusion Information – Aluminum Products',
    pageCitations: 'Page 104 (ESF-104)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '03'" },
      { name: 'Product Exclusion Identifier - Aluminum', start: 5, end: 13, length: 9, class: '9AN', designation: 'M', notes: 'Format ALUnnnnnn or APRnnnnnn from DOC portal' },
      { name: 'Filler', start: 14, end: 80, length: 67, class: '67S', designation: 'M', notes: 'Space fill' },
    ],
  },
  // ── Type 04 ─────────────────────────────────────────────────────────────
  {
    typeCode: '04',
    name: 'South Korean (KR) Export Steel Certificate',
    pageCitations: 'Page 105 (ESF-105)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '04'" },
      { name: 'Official Export Steel Certificate Number', start: 5, end: 13, length: 9, class: '9AN', designation: 'M', notes: 'Official export certificate number from South Korea' },
      { name: 'Filler', start: 14, end: 80, length: 67, class: '67S', designation: 'M', notes: 'Space fill' },
    ],
  },
  // ── Type 05 ─────────────────────────────────────────────────────────────
  {
    typeCode: '05',
    name: 'CBMA Product Detail',
    pageCitations: 'Pages 106-109 (ESF-106 - ESF-109)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '05'" },
      { name: 'Controlled Group Name', start: 5, end: 14, length: 10, class: '10X', designation: 'M', notes: "Post-2023 report 'XXXXXXXXXX'" },
      { name: 'Foreign Producer Identifier', start: 15, end: 32, length: 18, class: '18X', designation: 'M', notes: 'TTB registration identifier TTB-FP-XXXXXXX' },
      { name: 'Foreign Producer Name', start: 33, end: 53, length: 21, class: '21X', designation: 'M', notes: 'Registered name of foreign producer with TTB' },
      { name: 'Allocation Quantity', start: 54, end: 65, length: 12, class: '12N', designation: 'M', impliedDecimals: 4, notes: 'Post-2023 report zeros. Pre-2023 4 implied decimals' },
      { name: 'Flavor Content Credit Indicator', start: 66, end: 66, length: 1, class: '1AN', designation: 'M', notes: 'Y = Flavor content credit used, space fill otherwise' },
      { name: 'CBMA Rate Designation Code', start: 67, end: 72, length: 6, class: '6AN', designation: 'M', notes: 'ACE CBMA rate designation code per TTB table' },
      { name: 'TTB Tax Rate Confirmation / Filler', start: 73, end: 80, length: 8, class: '8N', designation: 'M', notes: 'TTB tax rate confirmation in USD or space fill' },
    ],
  },
  // ── Type 06 ─────────────────────────────────────────────────────────────
  {
    typeCode: '06',
    name: 'AD/CVD Certification Designation',
    pageCitations: 'Page 110 (ESF-110)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '06'" },
      { name: 'AD/CVD Certification Indicator', start: 5, end: 18, length: 14, class: '14AN', designation: 'M', notes: "Must equal 'AD/CVD CERT'" },
      { name: 'Filler', start: 19, end: 80, length: 62, class: '62S', designation: 'M', notes: 'Space fill' },
    ],
  },
  // ── Type 07 ─────────────────────────────────────────────────────────────
  {
    typeCode: '07',
    name: 'Aluminum Smelt and Cast Country Detail',
    pageCitations: 'Pages 111-112 (ESF-111 - ESF-112)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '07'" },
      { name: 'Primary Country of Smelt Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: "ISO country code or 'OTH'" },
      { name: 'Filler 1', start: 8, end: 9, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
      { name: 'Secondary Country of Smelt Code', start: 10, end: 12, length: 3, class: '3AN', designation: 'C', notes: "ISO country code or 'OTH'" },
      { name: 'Filler 2', start: 13, end: 14, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
      { name: 'Country of Most Recent Cast Code', start: 15, end: 17, length: 3, class: '3AN', designation: 'M', notes: "ISO country code or 'OTH'" },
      { name: 'Filler 3', start: 18, end: 80, length: 63, class: '63S', designation: 'M', notes: 'Space fill' },
    ],
  },
  // ── Type 08 ─────────────────────────────────────────────────────────────
  {
    typeCode: '08',
    name: 'Steel Melt and Pour Country Detail',
    pageCitations: 'Page 113 (ESF-113)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '08'" },
      { name: 'Country of Melt and Pour Code', start: 5, end: 6, length: 2, class: '2AN', designation: 'C', notes: 'ISO country code where steel was melted and poured' },
      { name: 'Country of Melt and Pour Applicability Code', start: 7, end: 9, length: 3, class: '3S', designation: 'C', notes: "'OTH' for derivative steel if ISO code not provided" },
      { name: 'Filler', start: 10, end: 80, length: 71, class: '71S', designation: 'M', notes: 'Space fill' },
    ],
  },
  // ── Type 09 ─────────────────────────────────────────────────────────────
  {
    typeCode: '09',
    name: '201 Bifacial Certification Designation',
    pageCitations: 'Page 114 (ESF-114)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '09'" },
      { name: '201 Bifacial Certification Designation', start: 5, end: 17, length: 13, class: '13AN', designation: 'M', notes: "Must equal '201BIFAC CERT'" },
      { name: 'Filler', start: 18, end: 80, length: 63, class: '63S', designation: 'M', notes: 'Space fill' },
    ],
  },
  // ── Type 10 ─────────────────────────────────────────────────────────────
  {
    typeCode: '10',
    name: '301 Ship-to-Shore Crane Certification Designation',
    pageCitations: 'Page 115 (ESF-115)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '10'" },
      { name: '301 Ship-to-Shore Crane Certification Designation', start: 5, end: 15, length: 11, class: '11AN', designation: 'M', notes: "Must equal '301STS CERT'" },
      { name: 'Filler', start: 16, end: 80, length: 65, class: '65S', designation: 'M', notes: 'Space fill' },
    ],
  },
  // ── Type 11 ─────────────────────────────────────────────────────────────
  {
    typeCode: '11',
    name: 'Auto Parts Offset License',
    pageCitations: 'Page 116 (ESF-116)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '11'" },
      { name: 'Auto Parts Offset License Number', start: 5, end: 12, length: 8, class: '8AN', designation: 'M', notes: 'Department of Commerce license format AANNNNNN' },
      { name: 'Filler', start: 13, end: 80, length: 68, class: '68S', designation: 'M', notes: 'Space fill' },
    ],
  },
  // ── Type 12 ─────────────────────────────────────────────────────────────
  {
    typeCode: '12',
    name: 'Copper Smelt and Cast Country Detail',
    pageCitations: 'Page 117 (ESF-117)',
    totalLength: 80,
    fields: [
      { name: 'Control Identifier', start: 1, end: 2, length: 2, class: '2AN', designation: 'M', notes: "Must equal '54'" },
      { name: 'Declaration Type Code', start: 3, end: 4, length: 2, class: '2AN', designation: 'M', notes: "Must equal '12'" },
      { name: 'Primary Country of Smelt Code', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: "ISO country code or 'OTH'" },
      { name: 'Filler 1', start: 8, end: 9, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
      { name: 'Secondary Country of Smelt Code', start: 10, end: 12, length: 3, class: '3AN', designation: 'C', notes: "ISO country code or 'OTH'" },
      { name: 'Filler 2', start: 13, end: 14, length: 2, class: '2S', designation: 'M', notes: 'Space fill' },
      { name: 'Country of Most Recent Cast Code', start: 15, end: 17, length: 3, class: '3AN', designation: 'M', notes: "ISO country code or 'OTH'" },
      { name: 'Filler 3', start: 18, end: 80, length: 63, class: '63S', designation: 'M', notes: 'Space fill' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe('CATAIR Entry Summary Create/Update — Record 54 Internal Sub-Type Specifications', () => {
  it.each(RECORD_54_SUBTYPES)('Type $typeCode ($name) - field position math and total width sum to 80', (spec) => {
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

  it('Verifies all 12 Type Codes (01 to 12) are represented without gaps', () => {
    const typeCodes = RECORD_54_SUBTYPES.map(s => s.typeCode);
    expect(typeCodes).toHaveLength(12);
    expect(typeCodes).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
  });

  it('Type 05 (CBMA Product Detail) correctly enforces TTB registration identifier length', () => {
    const cbmaSpec = RECORD_54_SUBTYPES.find(s => s.typeCode === '05');
    const producerId = cbmaSpec?.fields.find(f => f.name === 'Foreign Producer Identifier');
    expect(producerId?.length).toBe(18);
    expect(producerId?.start).toBe(15);
  });
});
