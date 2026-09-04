import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Cargo Release (SE Application) - Unified Entry / ISF Grouping Test Suite
 * Source PDF: docs/plans/catair-source-docs/04-cargo-release-implementation-guide-v40.pdf (Version 40, July 2025)
 * Section: Unified Entry/ISF Filing (Pages 75–84)
 *
 * Scoped ISF Records:
 *   1. SF10 (Mandatory Header, Pages 75–77)
 *   2. SF20 (Conditional Reference Data, Page 78)
 *   3. SF25 (Optional Container Details, Page 79)
 *   4. SF30 (Mandatory Commercial Entity Identifier/Name, Pages 80–81)
 *   5. SF31 (Optional Secondary Entity Name, Page 82)
 *   6. SF35 (Conditional Entity Address, Page 83)
 *   7. SF36 (Conditional Entity Geographic Details, Page 84)
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

export interface SpecificationMismatch {
  field: string;
  tableClass: string;
  actualType: string;
  description: string;
}

export interface RecordSpec {
  recordId: string;
  name: string;
  pageCitations: string;
  totalLength: number;
  designation: 'M' | 'C' | 'O';
  fields: FieldSpec[];
  mismatches?: SpecificationMismatch[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RECORD SF10: ISF Header (Pages 75-77 / SE-73 - SE-75)
// ─────────────────────────────────────────────────────────────────────────────
export const ISF_RECORD_SF10_SPEC: RecordSpec = {
  recordId: 'SF10',
  name: 'ISF Header',
  pageCitations: 'Pages 75-77 (SE-73 - SE-75)',
  designation: 'M',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must always equal 'SF10'" },
    { name: 'ISF Submission Type', start: 5, end: 5, length: 1, class: '1N', designation: 'M', notes: 'Always code 1 = ISF-10 submission' },
    { name: 'Shipment Type Code', start: 6, end: 7, length: 2, class: '2N', designation: 'M', notes: '01=Standard, 02=To Order, 04=Military, 07=US Goods Returned, 09=Int Mail, 10=Outer Cont Shelf' },
    { name: 'Action Code', start: 8, end: 8, length: 1, class: '1A', designation: 'M', notes: 'A = Add, D = Delete, R = Replace' },
    { name: 'Action Reason Code', start: 9, end: 10, length: 2, class: '2X', designation: 'C', notes: 'CT = Complete Transaction' },
    { name: 'ISF Importer Number Qualifier', start: 11, end: 13, length: 3, class: '3X', designation: 'M', notes: 'EI = IRS, ANI = CBP assigned, 34 = SSN' },
    { name: 'ISF Importer Number', start: 14, end: 28, length: 15, class: '15X', designation: 'M', notes: 'IRS format NN-NNNNNNNXX, ANI format YYDDPP-NNNNN, SSN format NNN-NN-NNNN' },
    { name: 'Reserved', start: 29, end: 36, length: 8, class: '8X', designation: 'M', notes: 'Space fill' },
    { name: 'Mode of Transportation Code', start: 37, end: 38, length: 2, class: '2N', designation: 'O', notes: '10 = Ocean non-containerized (Break Bulk), 11 = Ocean containerized' },
    { name: 'ISF Transaction Number', start: 39, end: 53, length: 15, class: '15X', designation: 'C', notes: 'FFF-NNNNNNNNNNN returned by CBP. Space filled when Action Code is A' },
    { name: 'SCAC Identifier', start: 54, end: 57, length: 4, class: '4A', designation: 'O', notes: 'Standard Carrier Alpha Code of vessel operator' },
    { name: 'Bond Holder', start: 58, end: 72, length: 15, class: '15X', designation: 'M', notes: 'Space fill for Unified Entry/ISF filing' },
    { name: 'Bond Activity Code', start: 73, end: 74, length: 2, class: '2AN', designation: 'M', notes: 'Space fill for Unified Entry/ISF filing' },
    { name: 'Bond Type', start: 75, end: 75, length: 1, class: '1N', designation: 'M', notes: 'Space fill for Unified Entry/ISF filing' },
    { name: 'Filler', start: 76, end: 78, length: 3, class: '3X', designation: 'M', notes: 'Space fill' },
    { name: 'Country of Issuance', start: 79, end: 80, length: 2, class: '2A', designation: 'M', notes: 'Space fill for Unified Entry/ISF filing' },
  ],
  mismatches: [
    {
      field: 'Bond Activity Code / Bond Type / Bond Holder / Country of Issuance',
      tableClass: 'Various (15X, 2AN, 1N, 2A)',
      actualType: 'Unified Entry Exemption Space Fill',
      description: 'Document explicitly specifies that for Unified Entry/ISF filing, these fields are space filled because Entry bond satisfies ISF bond requirement.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. RECORD SF20: ISF Reference Data (Page 78 / SE-76)
// ─────────────────────────────────────────────────────────────────────────────
export const ISF_RECORD_SF20_SPEC: RecordSpec = {
  recordId: 'SF20',
  name: 'ISF Reference Data',
  pageCitations: 'Page 78 (SE-76)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must always equal 'SF20'" },
    { name: 'Reference Identifier Qualifier', start: 5, end: 7, length: 3, class: '3AN', designation: 'M', notes: 'SBN = Bond Reference Number, V1 = Surety Code, CR = User Reference Number' },
    { name: 'Reference Identifier', start: 8, end: 57, length: 50, class: '50X', designation: 'M', notes: 'Reference data (no spaces, hyphens, or slashes)' },
    { name: 'Filler', start: 58, end: 80, length: 23, class: '23X', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. RECORD SF25: ISF Container Information (Page 79 / SE-77)
// ─────────────────────────────────────────────────────────────────────────────
export const ISF_RECORD_SF25_SPEC: RecordSpec = {
  recordId: 'SF25',
  name: 'ISF Container Information',
  pageCitations: 'Page 79 (SE-77)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must always equal 'SF25'" },
    { name: 'Equipment Description Code', start: 5, end: 6, length: 2, class: '2X', designation: 'M', notes: 'Valid codes per Appendix B (e.g. CN=Container)' },
    { name: 'Equipment Initial', start: 7, end: 10, length: 4, class: '4A', designation: 'M', notes: 'Alpha prefix preceding equipment serial number' },
    { name: 'Equipment Number', start: 11, end: 25, length: 15, class: '15N', designation: 'M', notes: 'Serial number of equipment' },
    { name: 'Equipment Number Check Digit', start: 26, end: 26, length: 1, class: '1N', designation: 'C', notes: 'Check digit if present' },
    { name: 'Equipment Size Type Code', start: 27, end: 30, length: 4, class: '4AN', designation: 'O', notes: 'Code identifying type of equipment per Appendix B' },
    { name: 'Filler', start: 31, end: 80, length: 50, class: '50X', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. RECORD SF30: ISF Entity Identifier / Name (Pages 80-81 / SE-78 - SE-79)
// ─────────────────────────────────────────────────────────────────────────────
export const ISF_RECORD_SF30_SPEC: RecordSpec = {
  recordId: 'SF30',
  name: 'ISF Entity Identifier / Name',
  pageCitations: 'Pages 80-81 (SE-78 - SE-79)',
  designation: 'M',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must always equal 'SF30'" },
    { name: 'Entity Code', start: 5, end: 7, length: 3, class: '3A', designation: 'M', notes: 'MF=Manufacturer, SE=Seller, BY=Buyer, ST=Ship To, LG=Stuffing Loc, CS=Consolidator, BKP=Booking Party, CN=Consignee' },
    { name: 'Entity Name', start: 8, end: 42, length: 35, class: '35X', designation: 'C', notes: 'Name of entity. Must be blank if Entity Identifier is supplied' },
    { name: 'Entity Identifier Qualifier', start: 43, end: 45, length: 3, class: '3X', designation: 'C', notes: 'EI=IRS, ANI=CBP assigned, CIN=CBP encrypted, 34=SSN, FR=FIRMS. Mandatory if CN' },
    { name: 'Entity Identifier', start: 46, end: 65, length: 20, class: '20X', designation: 'C', notes: 'Code per qualifier. Mandatory if CN' },
    { name: 'Country Code', start: 66, end: 67, length: 2, class: '2AN', designation: 'M', notes: 'Space fill for Unified Entry/ISF filing' },
    { name: 'Date of Birth (DOB)', start: 68, end: 75, length: 8, class: '8X', designation: 'M', notes: 'Space fill for Unified Entry/ISF filing' },
    { name: 'Filler', start: 76, end: 80, length: 5, class: '5X', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. RECORD SF31: ISF Entity Name Continuation (Page 82 / SE-80)
// ─────────────────────────────────────────────────────────────────────────────
export const ISF_RECORD_SF31_SPEC: RecordSpec = {
  recordId: 'SF31',
  name: 'ISF Entity Name Continuation',
  pageCitations: 'Page 82 (SE-80)',
  designation: 'O',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must always equal 'SF31'" },
    { name: 'Entity Code', start: 5, end: 7, length: 3, class: '3A', designation: 'M', notes: 'ALA=Alternative Addressee, DH=DBA, DV=Division, NU=Formerly Known As, NV=Formerly DBA, XD=Alias' },
    { name: 'Entity Name', start: 8, end: 42, length: 35, class: '35X', designation: 'M', notes: 'Secondary name of entity reported in preceding SF30' },
    { name: 'Filler', start: 43, end: 80, length: 38, class: '38X', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. RECORD SF35: ISF Entity Address (Page 83 / SE-81)
// ─────────────────────────────────────────────────────────────────────────────
export const ISF_RECORD_SF35_SPEC: RecordSpec = {
  recordId: 'SF35',
  name: 'ISF Entity Address',
  pageCitations: 'Page 83 (SE-81)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must always equal 'SF35'" },
    { name: 'Address Component Qualifier 1', start: 5, end: 6, length: 2, class: '2AN', designation: 'M', notes: '01=Street Num, 02=Street Name, 05=PO Box, 12=Building, 13=Apt, 14=Suite, 15=Unstructured, 28=Assoc, 30=Pier, 31=Wing, 32=Floor, 35=Room, 37=Unit, 57=Cross St, AK=Bldg Num' },
    { name: 'Address Information 1', start: 7, end: 41, length: 35, class: '35AN', designation: 'M', notes: 'Address information 1' },
    { name: 'Address Component Qualifier 2', start: 42, end: 43, length: 2, class: '2AN', designation: 'O', notes: 'Address component qualifier 2' },
    { name: 'Address Information 2', start: 44, end: 78, length: 35, class: '35AN', designation: 'O', notes: 'Address information 2' },
    { name: 'Filler', start: 79, end: 80, length: 2, class: '2X', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. RECORD SF36: ISF Entity Geographic Area (Page 84 / SE-82)
// ─────────────────────────────────────────────────────────────────────────────
export const ISF_RECORD_SF36_SPEC: RecordSpec = {
  recordId: 'SF36',
  name: 'ISF Entity Geographic Area',
  pageCitations: 'Page 84 (SE-82)',
  designation: 'C',
  totalLength: 80,
  fields: [
    { name: 'Control Identifier', start: 1, end: 4, length: 4, class: '4AN', designation: 'M', notes: "Must always equal 'SF36'" },
    { name: 'City Name', start: 5, end: 39, length: 35, class: '35AN', designation: 'M', notes: 'City portion of entity address' },
    { name: 'Country Sub Entity Code', start: 40, end: 42, length: 3, class: '3AN', designation: 'C', notes: 'ISO subdivision code (state/province)' },
    { name: 'Filler', start: 43, end: 48, length: 6, class: '6X', designation: 'M', notes: 'Space fill' },
    { name: 'Postal Code', start: 49, end: 63, length: 15, class: '15AN', designation: 'C', notes: 'Postal code (ZIP code in USA)' },
    { name: 'Country Code', start: 64, end: 65, length: 2, class: '2A', designation: 'M', notes: 'ISO 2-character country code' },
    { name: 'Filler', start: 66, end: 80, length: 15, class: '15X', designation: 'M', notes: 'Space fill' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

const ALL_ISF_SPECS: RecordSpec[] = [
  ISF_RECORD_SF10_SPEC,
  ISF_RECORD_SF20_SPEC,
  ISF_RECORD_SF25_SPEC,
  ISF_RECORD_SF30_SPEC,
  ISF_RECORD_SF31_SPEC,
  ISF_RECORD_SF35_SPEC,
  ISF_RECORD_SF36_SPEC,
];

describe('CATAIR Cargo Release — Unified Entry / ISF Grouping Specifications', () => {
  it.each(ALL_ISF_SPECS)('$recordId ($name) - field position math and total width sum to 80', (spec) => {
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

  it('SF10 - ISF Header contains correct mandatory control and importer fields', () => {
    expect(ISF_RECORD_SF10_SPEC.fields[0].notes).toContain("Must always equal 'SF10'");
    expect(ISF_RECORD_SF10_SPEC.fields[1].length).toBe(1); // Submission type
    expect(ISF_RECORD_SF10_SPEC.fields[3].length).toBe(1); // Action code
    expect(ISF_RECORD_SF10_SPEC.fields[6].length).toBe(15); // Importer number
  });

  it('SF30 - ISF Entity Identifier / Name correctly models name vs identifier conditionals', () => {
    const entityNameField = ISF_RECORD_SF30_SPEC.fields.find(f => f.name === 'Entity Name');
    const entityIdQualifier = ISF_RECORD_SF30_SPEC.fields.find(f => f.name === 'Entity Identifier Qualifier');
    expect(entityNameField?.length).toBe(35);
    expect(entityIdQualifier?.length).toBe(3);
  });
});
