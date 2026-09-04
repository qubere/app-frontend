/**
 * CATAIR Appendix B: Valid Codes for ACE Reference Data
 * Source: docs/plans/catair-source-docs/appendix-b-valid-codes.pdf (August 4, 2026)
 *
 * This module exports programmatically extracted lookup tables and validation helper functions
 * for reference code tables specified in Appendix B:
 * - Entry Type Codes (Page 26)
 * - Mode of Transportation Codes (Page 27)
 * - EU Country Codes (Page 17)
 */

export type EntryTypeFilingStatus =
  | 'category_header'
  | 'standard'
  | 'approved_eip_rlf' // *** Approved for EIP/RLF Filing
  | 'not_appropriate' // * Not appropriate for automated filing
  | 'not_approved'; // ** Not approved for automated filing

export interface EntryTypeCodeEntry {
  /** 2-digit entry type code (e.g. "01", "11", "21", "86") or "00"/"10"/etc. for category headers */
  code: string;
  /** Full entry type description from Appendix B */
  description: string;
  /** Category grouping name (e.g. "Consumption Category", "Informal Category") */
  category: string;
  /** True if this record represents a category group header */
  isCategoryHeader: boolean;
  /** Automated filing eligibility status annotation (*, **, ***, or standard) */
  filingStatus: EntryTypeFilingStatus;
}

export interface ModeOfTransportationCodeEntry {
  /** 2-digit mode of transportation code (e.g. "10", "11", "40", "70") */
  code: string;
  /** Detailed description of mode of transportation from Appendix B */
  description: string;
}

export interface EuCountryCodeEntry {
  /** 2-letter ISO country code (e.g. "DE", "FR", "IT") */
  code: string;
  /** Country name in English */
  countryName: string;
}

/**
 * Entry Type Codes and Category Headers extracted from CATAIR Appendix B (Page 26).
 */
export const ABI_ENTRY_TYPE_CODES: readonly EntryTypeCodeEntry[] = [
  // Consumption Category
  { code: '00', description: 'Consumption Category', category: 'Consumption Category', isCategoryHeader: true, filingStatus: 'category_header' },
  { code: '01', description: 'Consumption - Free and Dutiable', category: 'Consumption Category', isCategoryHeader: false, filingStatus: 'approved_eip_rlf' },
  { code: '02', description: 'Consumption - Quota/Visa', category: 'Consumption Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '03', description: 'Consumption - Antidumping/Countervailing Duty', category: 'Consumption Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '04', description: 'Appraisement', category: 'Consumption Category', isCategoryHeader: false, filingStatus: 'not_appropriate' },
  { code: '05', description: 'Vessel - Repair', category: 'Consumption Category', isCategoryHeader: false, filingStatus: 'not_appropriate' },
  { code: '06', description: 'Consumption - Foreign Trade Zone (FTZ)', category: 'Consumption Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '07', description: 'Consumption - Antidumping/Countervailing Duty and Quota/Visa Combination', category: 'Consumption Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '08', description: 'NAFTA Duty Deferral', category: 'Consumption Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '09', description: 'Reconciliation Summary', category: 'Consumption Category', isCategoryHeader: false, filingStatus: 'standard' },

  // Informal Category
  { code: '10', description: 'Informal Category', category: 'Informal Category', isCategoryHeader: true, filingStatus: 'category_header' },
  { code: '11', description: 'Informal - Free and Dutiable', category: 'Informal Category', isCategoryHeader: false, filingStatus: 'approved_eip_rlf' },
  { code: '12', description: 'Informal - Quota/Visa (other than textiles)', category: 'Informal Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '13', description: 'International Mail Shipment', category: 'Informal Category', isCategoryHeader: false, filingStatus: 'standard' },

  // Warehouse Category
  { code: '20', description: 'Warehouse Category', category: 'Warehouse Category', isCategoryHeader: true, filingStatus: 'category_header' },
  { code: '21', description: 'Warehouse', category: 'Warehouse Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '22', description: 'Re-Warehouse', category: 'Warehouse Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '23', description: 'Temporary Importation Bond (TIB)', category: 'Warehouse Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '24', description: 'Trade Fair', category: 'Warehouse Category', isCategoryHeader: false, filingStatus: 'not_approved' },
  { code: '25', description: 'Permanent Exhibition', category: 'Warehouse Category', isCategoryHeader: false, filingStatus: 'not_approved' },
  { code: '26', description: 'Warehouse - Foreign Trade Zone (FTZ) (Admission)', category: 'Warehouse Category', isCategoryHeader: false, filingStatus: 'not_approved' },

  // Warehouse Withdrawal Category
  { code: '30', description: 'Warehouse Withdrawal Category', category: 'Warehouse Withdrawal Category', isCategoryHeader: true, filingStatus: 'category_header' },
  { code: '31', description: 'Warehouse Withdrawal Consumption', category: 'Warehouse Withdrawal Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '32', description: 'Warehouse Withdrawal - Quota', category: 'Warehouse Withdrawal Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '33', description: 'Aircraft and Vessel Supply (For Immediate Exportation)', category: 'Warehouse Withdrawal Category', isCategoryHeader: false, filingStatus: 'not_approved' },
  { code: '34', description: 'Warehouse Withdrawal Antidumping/Countervailing Duty', category: 'Warehouse Withdrawal Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '38', description: 'Warehouse Withdrawal - Antidumping/Countervailing Duty & Quota/Visa Combination', category: 'Warehouse Withdrawal Category', isCategoryHeader: false, filingStatus: 'standard' },

  // Drawback Category
  { code: '40', description: 'Drawback Category', category: 'Drawback Category', isCategoryHeader: true, filingStatus: 'category_header' },
  { code: '41', description: 'Direct Identification Manufacturing Drawback', category: 'Drawback Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '42', description: 'Direct Identification Unused Merchandise Drawback', category: 'Drawback Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '43', description: 'Rejected Merchandise Drawback', category: 'Drawback Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '44', description: 'Substitution Manufacturer Drawback', category: 'Drawback Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '45', description: 'Substitution Unused Merchandise Drawback', category: 'Drawback Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '46', description: 'Other Drawback', category: 'Drawback Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '47', description: 'Drawback Entry', category: 'Drawback Category', isCategoryHeader: false, filingStatus: 'standard' },

  // Government Category
  { code: '50', description: 'Government Category', category: 'Government Category', isCategoryHeader: true, filingStatus: 'category_header' },
  { code: '51', description: 'Defense Contract Administration Service Region (DCASR)', category: 'Government Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '52', description: 'Government - Dutiable', category: 'Government Category', isCategoryHeader: false, filingStatus: 'standard' },

  // Transportation Category
  { code: '60', description: 'Transportation Category', category: 'Transportation Category', isCategoryHeader: true, filingStatus: 'category_header' },
  { code: '61', description: 'Immediate Transportation', category: 'Transportation Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '62', description: 'Transportation and Exportation', category: 'Transportation Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '63', description: 'Immediate Exportation', category: 'Transportation Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '64', description: 'Barge Movement', category: 'Transportation Category', isCategoryHeader: false, filingStatus: 'not_approved' },
  { code: '65', description: 'Permit to Proceed', category: 'Transportation Category', isCategoryHeader: false, filingStatus: 'not_approved' },
  { code: '66', description: 'Baggage', category: 'Transportation Category', isCategoryHeader: false, filingStatus: 'not_approved' },

  // Special Entry Processing
  { code: '86', description: 'Section 321', category: 'Special Category', isCategoryHeader: false, filingStatus: 'standard' },
  { code: '90', description: 'Special Entry Processing - Not in Use', category: 'Special Category', isCategoryHeader: false, filingStatus: 'standard' },
];

/**
 * Filtered array containing only valid entry type codes (excluding category headers).
 */
export const ABI_VALID_ENTRY_TYPE_CODES: readonly EntryTypeCodeEntry[] = ABI_ENTRY_TYPE_CODES.filter(
  (entry) => !entry.isCategoryHeader
);

/**
 * Lookup map keyed by 2-digit code for all entry type codes (including headers).
 */
export const ABI_ENTRY_TYPE_CODE_MAP: ReadonlyMap<string, EntryTypeCodeEntry> = new Map(
  ABI_ENTRY_TYPE_CODES.map((entry) => [entry.code.padStart(2, '0'), entry])
);

/**
 * Set of all valid 2-digit entry type codes (excluding category headers).
 */
export const ABI_VALID_ENTRY_TYPE_CODE_SET: ReadonlySet<string> = new Set(
  ABI_VALID_ENTRY_TYPE_CODES.map((entry) => entry.code.padStart(2, '0'))
);

/**
 * Mode of Transportation Codes extracted from CATAIR Appendix B (Page 27).
 */
export const ABI_MODE_OF_TRANSPORTATION_CODES: readonly ModeOfTransportationCodeEntry[] = [
  {
    code: '10',
    description:
      'Vessel, non-container. Including all cargo at first U.S. port of unlading aboard a vessel regardless of later disposition. This includes Lightered, Land Bridge and LASH. If the container status is unknown but the goods did arrive by vessel, use this code.',
  },
  { code: '11', description: 'Vessel, Container' },
  { code: '12', description: 'Border Water-borne (only Mexico and Canada)' },
  { code: '20', description: 'Rail, Non-container' },
  { code: '21', description: 'Rail, Container' },
  { code: '30', description: 'Truck, Non-container' },
  { code: '31', description: 'Truck, Container' },
  { code: '32', description: 'Auto' },
  { code: '33', description: 'Pedestrian' },
  { code: '34', description: 'Road, other. Includes foot and animal-borne.' },
  { code: '40', description: 'Air, Non-container' },
  { code: '41', description: 'Air, Container' },
  { code: '50', description: 'Mail' },
  { code: '60', description: 'Passenger, hand-carried.' },
  { code: '70', description: 'Fixed Transport Installations. Includes pipeline and powerhouse.' },
];

/**
 * Lookup map keyed by 2-digit code for Mode of Transportation.
 */
export const ABI_MODE_OF_TRANSPORTATION_CODE_MAP: ReadonlyMap<string, ModeOfTransportationCodeEntry> = new Map(
  ABI_MODE_OF_TRANSPORTATION_CODES.map((entry) => [entry.code.padStart(2, '0'), entry])
);

/**
 * Set of all valid 2-digit Mode of Transportation codes.
 */
export const ABI_MODE_OF_TRANSPORTATION_CODE_SET: ReadonlySet<string> = new Set(
  ABI_MODE_OF_TRANSPORTATION_CODES.map((entry) => entry.code.padStart(2, '0'))
);

/**
 * European Union (EU) Country Codes extracted from CATAIR Appendix B (Page 17).
 */
export const ABI_EU_COUNTRY_CODES: readonly EuCountryCodeEntry[] = [
  { code: 'AT', countryName: 'AUSTRIA' },
  { code: 'BE', countryName: 'BELGIUM' },
  { code: 'BG', countryName: 'BULGARIA' },
  { code: 'CY', countryName: 'CYPRUS' },
  { code: 'HR', countryName: 'CROATIA' },
  { code: 'CZ', countryName: 'CZECH REPUBLIC' },
  { code: 'DK', countryName: 'DENMARK' },
  { code: 'EE', countryName: 'ESTONIA' },
  { code: 'FI', countryName: 'FINLAND' },
  { code: 'FR', countryName: 'FRANCE' },
  { code: 'DE', countryName: 'GERMANY' },
  { code: 'GR', countryName: 'GREECE' },
  { code: 'IE', countryName: 'IRELAND' },
  { code: 'HU', countryName: 'HUNGARY' },
  { code: 'IT', countryName: 'ITALY' },
  { code: 'LV', countryName: 'LATVIA' },
  { code: 'LT', countryName: 'LITHUANIA' },
  { code: 'LU', countryName: 'LUXEMBOURG' },
  { code: 'MT', countryName: 'MALTA' },
  { code: 'NL', countryName: 'NETHERLANDS' },
  { code: 'PL', countryName: 'POLAND' },
  { code: 'PT', countryName: 'PORTUGAL' },
  { code: 'RO', countryName: 'ROMANIA' },
  { code: 'SK', countryName: 'SLOVAKIA' },
  { code: 'SI', countryName: 'SLOVENIA' },
  { code: 'ES', countryName: 'SPAIN' },
  { code: 'SE', countryName: 'SWEDEN' },
];

/**
 * Lookup map keyed by 2-letter ISO code for EU Countries.
 */
export const ABI_EU_COUNTRY_CODE_MAP: ReadonlyMap<string, EuCountryCodeEntry> = new Map(
  ABI_EU_COUNTRY_CODES.map((entry) => [entry.code, entry])
);

/**
 * Set of all valid 2-letter EU Country codes.
 */
export const ABI_EU_COUNTRY_CODE_SET: ReadonlySet<string> = new Set(
  ABI_EU_COUNTRY_CODES.map((entry) => entry.code)
);

// ----------------------------------------------------------------------------
// Helper Validation Functions
// ----------------------------------------------------------------------------

/**
 * Checks whether a given string is a valid CATAIR Appendix B Entry Type code.
 * (Pads numeric input to 2 digits, e.g. "1" -> "01").
 */
export function isValidEntryTypeCode(code: string | number): boolean {
  const formatted = String(code).trim().padStart(2, '0');
  return ABI_VALID_ENTRY_TYPE_CODE_SET.has(formatted);
}

/**
 * Retrieves the EntryTypeCodeEntry for a given code.
 */
export function getEntryTypeCodeEntry(code: string | number): EntryTypeCodeEntry | undefined {
  const formatted = String(code).trim().padStart(2, '0');
  return ABI_ENTRY_TYPE_CODE_MAP.get(formatted);
}

/**
 * Checks whether a given string is a valid CATAIR Appendix B Mode of Transportation code.
 * (Pads numeric input to 2 digits, e.g. "10" -> "10").
 */
export function isValidModeOfTransportationCode(code: string | number): boolean {
  const formatted = String(code).trim().padStart(2, '0');
  return ABI_MODE_OF_TRANSPORTATION_CODE_SET.has(formatted);
}

/**
 * Retrieves the ModeOfTransportationCodeEntry for a given code.
 */
export function getModeOfTransportationCodeEntry(code: string | number): ModeOfTransportationCodeEntry | undefined {
  const formatted = String(code).trim().padStart(2, '0');
  return ABI_MODE_OF_TRANSPORTATION_CODE_MAP.get(formatted);
}

/**
 * Checks whether a given country code is a valid EU member state code.
 */
export function isEuCountryCode(code: string): boolean {
  return ABI_EU_COUNTRY_CODE_SET.has(code.trim().toUpperCase());
}

/**
 * Retrieves the EuCountryCodeEntry for a given 2-letter code.
 */
export function getEuCountryCodeEntry(code: string): EuCountryCodeEntry | undefined {
  return ABI_EU_COUNTRY_CODE_MAP.get(code.trim().toUpperCase());
}
