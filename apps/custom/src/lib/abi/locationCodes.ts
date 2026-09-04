/**
 * CATAIR Appendix B: Location Identifiers Reference Data
 * Source: docs/plans/catair-source-docs/appendix-b-valid-codes.pdf (Pages 18-21)
 *
 * This module exports programmatically extracted lookup tables and validation functions for:
 * 1. United States Location Identifiers - Page 18 (44 entries, AK to SD)
 * 2. United States Location Identifiers - Page 19 (13 entries, TN to WY, AA, AE, AP)
 * 3. Mexican States - Page 20 (32 entries, AGU to ZAC)
 * 4. Canadian Provinces - Page 21 (13 entries, AB to YT)
 *
 * Total Location Code Entries: 102
 */

export type LocationCodeRegion = 'US' | 'MX' | 'CA';

export interface LocationCodeEntry {
  /** 2-character or 3-character location/state/province code (e.g. "CA", "AGU", "ON", "AA") */
  code: string;
  /** Description from Appendix B (e.g. "California", "Aguascalientes", "Ontario*") */
  description: string;
  /** Source PDF page in Appendix B (18, 19, 20, or 21) */
  page: number;
  /** Region/Category: 'US' | 'MX' | 'CA' */
  region: LocationCodeRegion;
  /** True if code/description has asterisk indicating updated/new code relative to ACS version */
  isUpdatedCode?: boolean;
}

/**
 * United States Location Identifiers - Page 18 (44 entries: AK through SD)
 */
export const ABI_US_LOCATION_CODES_PAGE_18: readonly LocationCodeEntry[] = [
  { code: "AK", description: "Alaska", page: 18, region: "US" },
  { code: "AL", description: "Alabama", page: 18, region: "US" },
  { code: "AR", description: "Arkansas", page: 18, region: "US" },
  { code: "AZ", description: "Arizona", page: 18, region: "US" },
  { code: "CA", description: "California", page: 18, region: "US" },
  { code: "CO", description: "Colorado", page: 18, region: "US" },
  { code: "CT", description: "Connecticut", page: 18, region: "US" },
  { code: "DC", description: "District of Columbia", page: 18, region: "US" },
  { code: "DE", description: "Delaware", page: 18, region: "US" },
  { code: "FL", description: "Florida", page: 18, region: "US" },
  { code: "GA", description: "Georgia", page: 18, region: "US" },
  { code: "GU", description: "Guam", page: 18, region: "US" },
  { code: "HI", description: "Hawaii", page: 18, region: "US" },
  { code: "IA", description: "Iowa", page: 18, region: "US" },
  { code: "ID", description: "Idaho", page: 18, region: "US" },
  { code: "IL", description: "Illinois", page: 18, region: "US" },
  { code: "IN", description: "Indiana", page: 18, region: "US" },
  { code: "KS", description: "Kansas", page: 18, region: "US" },
  { code: "KY", description: "Kentucky", page: 18, region: "US" },
  { code: "LA", description: "Louisiana", page: 18, region: "US" },
  { code: "MA", description: "Massachusetts", page: 18, region: "US" },
  { code: "MD", description: "Maryland", page: 18, region: "US" },
  { code: "ME", description: "Maine", page: 18, region: "US" },
  { code: "MI", description: "Michigan", page: 18, region: "US" },
  { code: "MN", description: "Minnesota", page: 18, region: "US" },
  { code: "MO", description: "Missouri", page: 18, region: "US" },
  { code: "MS", description: "Mississippi", page: 18, region: "US" },
  { code: "MT", description: "Montana", page: 18, region: "US" },
  { code: "NC", description: "North Carolina", page: 18, region: "US" },
  { code: "ND", description: "North Dakota", page: 18, region: "US" },
  { code: "NE", description: "Nebraska", page: 18, region: "US" },
  { code: "NH", description: "New Hampshire", page: 18, region: "US" },
  { code: "NJ", description: "New Jersey", page: 18, region: "US" },
  { code: "NM", description: "New Mexico", page: 18, region: "US" },
  { code: "NV", description: "Nevada", page: 18, region: "US" },
  { code: "NY", description: "New York", page: 18, region: "US" },
  { code: "OH", description: "Ohio", page: 18, region: "US" },
  { code: "OK", description: "Oklahoma", page: 18, region: "US" },
  { code: "OR", description: "Oregon", page: 18, region: "US" },
  { code: "PA", description: "Pennsylvania", page: 18, region: "US" },
  { code: "PR", description: "Puerto Rico", page: 18, region: "US" },
  { code: "RI", description: "Rhoda Island", page: 18, region: "US" },
  { code: "SC", description: "South Carolina", page: 18, region: "US" },
  { code: "SD", description: "South Dakota", page: 18, region: "US" },
];

/**
 * United States Location Identifiers - Page 19 (13 entries: TN through WY, plus Armed Forces AA, AE, AP)
 */
export const ABI_US_LOCATION_CODES_PAGE_19: readonly LocationCodeEntry[] = [
  { code: "TN", description: "Tennessee", page: 19, region: "US" },
  { code: "TX", description: "Texas", page: 19, region: "US" },
  { code: "UT", description: "Utah", page: 19, region: "US" },
  { code: "VA", description: "Virginia", page: 19, region: "US" },
  { code: "VI", description: "Virgin Islands", page: 19, region: "US" },
  { code: "VT", description: "Vermont", page: 19, region: "US" },
  { code: "WA", description: "Washington", page: 19, region: "US" },
  { code: "WI", description: "Wisconsin", page: 19, region: "US" },
  { code: "WV", description: "West Virginia", page: 19, region: "US" },
  { code: "WY", description: "Wyoming", page: 19, region: "US" },
  { code: "AA", description: "Armed Forces America*", page: 19, region: "US", isUpdatedCode: true },
  { code: "AE", description: "Armed Forces Europe*", page: 19, region: "US", isUpdatedCode: true },
  { code: "AP", description: "Armed Forces Pacific*", page: 19, region: "US", isUpdatedCode: true },
];

/**
 * Combined United States Location Identifiers - Pages 18 & 19 (57 total entries)
 */
export const ABI_US_LOCATION_CODES: readonly LocationCodeEntry[] = [
  ...ABI_US_LOCATION_CODES_PAGE_18,
  ...ABI_US_LOCATION_CODES_PAGE_19,
];

/**
 * Mexican States Location Identifiers - Page 20 (32 entries: AGU through ZAC)
 */
export const ABI_MEXICAN_STATE_CODES: readonly LocationCodeEntry[] = [
  { code: "AGU", description: "Aguascalientes", page: 20, region: "MX" },
  { code: "BCN", description: "Baja California Nord", page: 20, region: "MX" },
  { code: "BCS", description: "Baja California Sur", page: 20, region: "MX" },
  { code: "CAM", description: "Campeche", page: 20, region: "MX" },
  { code: "CHH", description: "Chihuahua", page: 20, region: "MX" },
  { code: "CHP", description: "Chiapas", page: 20, region: "MX" },
  { code: "COA", description: "Coahuila", page: 20, region: "MX" },
  { code: "COL", description: "Colima", page: 20, region: "MX" },
  { code: "DIF", description: "Distrito Federal", page: 20, region: "MX" },
  { code: "DUR", description: "Durango", page: 20, region: "MX" },
  { code: "GRO", description: "Guerrero", page: 20, region: "MX" },
  { code: "GUA", description: "Guanajuato", page: 20, region: "MX" },
  { code: "HID", description: "Hidalgo", page: 20, region: "MX" },
  { code: "JAL", description: "Jalisco", page: 20, region: "MX" },
  { code: "MEX", description: "Mexico State", page: 20, region: "MX" },
  { code: "MIC", description: "Michoacán", page: 20, region: "MX" },
  { code: "MOR", description: "Morelos", page: 20, region: "MX" },
  { code: "NAY", description: "Nayarit", page: 20, region: "MX" },
  { code: "NLE", description: "Nuevo Leon", page: 20, region: "MX" },
  { code: "OAX", description: "Oaxaca", page: 20, region: "MX" },
  { code: "PUE", description: "Puebla*", page: 20, region: "MX", isUpdatedCode: true },
  { code: "QUE", description: "Queretaro", page: 20, region: "MX" },
  { code: "ROO", description: "Quintana Roo", page: 20, region: "MX" },
  { code: "SIN", description: "Sinaloa", page: 20, region: "MX" },
  { code: "SLP", description: "San Luis Potosi", page: 20, region: "MX" },
  { code: "SON", description: "Sonora", page: 20, region: "MX" },
  { code: "TAB", description: "Tabasco", page: 20, region: "MX" },
  { code: "TAM", description: "Tamaulipas", page: 20, region: "MX" },
  { code: "TLA", description: "Tlaxcala", page: 20, region: "MX" },
  { code: "VER", description: "Vera Cruz", page: 20, region: "MX" },
  { code: "YUC", description: "Yucatán", page: 20, region: "MX" },
  { code: "ZAC", description: "Zacatecas", page: 20, region: "MX" },
];

/**
 * Canadian Provinces Location Identifiers - Page 21 (13 entries: AB through YT)
 */
export const ABI_CANADIAN_PROVINCE_CODES: readonly LocationCodeEntry[] = [
  { code: "AB", description: "Alberta", page: 21, region: "CA" },
  { code: "BC", description: "British Columbia", page: 21, region: "CA" },
  { code: "MB", description: "Manitoba", page: 21, region: "CA" },
  { code: "NB", description: "New Brunswick", page: 21, region: "CA" },
  { code: "NL", description: "New Foundland and Labrador", page: 21, region: "CA" },
  { code: "NS", description: "Nova Scotia", page: 21, region: "CA" },
  { code: "NT", description: "Northwest Territories", page: 21, region: "CA" },
  { code: "NU", description: "Nunavut", page: 21, region: "CA" },
  { code: "ON", description: "Ontario*", page: 21, region: "CA", isUpdatedCode: true },
  { code: "PE", description: "Prince Edward Island", page: 21, region: "CA" },
  { code: "QC", description: "Quebec", page: 21, region: "CA" },
  { code: "SK", description: "Saskatchewan", page: 21, region: "CA" },
  { code: "YT", description: "Yukon Territory", page: 21, region: "CA" },
];

/**
 * All 102 Location Identifiers combined across US (57), MX (32), and CA (13)
 */
export const ABI_LOCATION_CODES: readonly LocationCodeEntry[] = [
  ...ABI_US_LOCATION_CODES,
  ...ABI_MEXICAN_STATE_CODES,
  ...ABI_CANADIAN_PROVINCE_CODES,
];

/**
 * Map keyed by uppercase region:code -> Entry
 */
export const ABI_LOCATION_CODE_MAP: ReadonlyMap<string, LocationCodeEntry> = new Map(
  ABI_LOCATION_CODES.map((e) => [`${e.region}:${e.code.toUpperCase()}`, e])
);

export const ABI_US_LOCATION_CODE_SET: ReadonlySet<string> = new Set(
  ABI_US_LOCATION_CODES.map((e) => e.code.toUpperCase())
);

export const ABI_MEXICAN_STATE_CODE_SET: ReadonlySet<string> = new Set(
  ABI_MEXICAN_STATE_CODES.map((e) => e.code.toUpperCase())
);

export const ABI_CANADIAN_PROVINCE_CODE_SET: ReadonlySet<string> = new Set(
  ABI_CANADIAN_PROVINCE_CODES.map((e) => e.code.toUpperCase())
);

export const ABI_LOCATION_CODE_SET: ReadonlySet<string> = new Set(
  ABI_LOCATION_CODES.map((e) => e.code.toUpperCase())
);

/**
 * Lookup a location code entry by code and optional region ('US' | 'MX' | 'CA').
 */
export function getLocationCodeEntry(
  code: string,
  region?: LocationCodeRegion
): LocationCodeEntry | undefined {
  const normalized = code.trim().toUpperCase();
  if (region) {
    return ABI_LOCATION_CODE_MAP.get(`${region}:${normalized}`);
  }
  // Try US, then MX, then CA if no region specified
  return (
    ABI_LOCATION_CODE_MAP.get(`US:${normalized}`) ||
    ABI_LOCATION_CODE_MAP.get(`MX:${normalized}`) ||
    ABI_LOCATION_CODE_MAP.get(`CA:${normalized}`)
  );
}

/**
 * Check if a given code is a valid location code (optionally scoped to a region).
 */
export function isValidLocationCode(code: string, region?: LocationCodeRegion): boolean {
  const normalized = code.trim().toUpperCase();
  if (region === 'US') return ABI_US_LOCATION_CODE_SET.has(normalized);
  if (region === 'MX') return ABI_MEXICAN_STATE_CODE_SET.has(normalized);
  if (region === 'CA') return ABI_CANADIAN_PROVINCE_CODE_SET.has(normalized);
  return ABI_LOCATION_CODE_SET.has(normalized);
}

/** Returns all United States location code entries */
export function getUsLocationCodes(): readonly LocationCodeEntry[] {
  return ABI_US_LOCATION_CODES;
}

/** Returns all Mexican State location code entries */
export function getMexicanStateCodes(): readonly LocationCodeEntry[] {
  return ABI_MEXICAN_STATE_CODES;
}

/** Returns all Canadian Province location code entries */
export function getCanadianProvinceCodes(): readonly LocationCodeEntry[] {
  return ABI_CANADIAN_PROVINCE_CODES;
}
