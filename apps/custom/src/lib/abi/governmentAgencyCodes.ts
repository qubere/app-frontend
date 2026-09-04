/**
 * CATAIR Appendix V: Government Agency Codes for ACE Reference Data
 * Source: docs/plans/catair-source-docs/appendix-v-government-agency-codes.pdf (June 8, 2020, Pub # 0875-0419)
 *
 * This module exports the full, authoritative CBP list of 53 Participating Government Agency (PGA) codes
 * used in the PGA Message Set Record PG01 (governmentAgencyCode, Pos 8-10, 3AN).
 */

export interface GovernmentAgencyCodeEntry {
  /** 3-character government agency code (e.g. "FDA", "CBP", "EPA") */
  code: string;
  /** Full agency name / description from CATAIR Appendix V */
  agencyName: string;
  /** Source PDF page number in Appendix V */
  page: number;
}

/**
 * All 53 Government Agency Codes extracted programmatically from CATAIR Appendix V PDF.
 */
export const ABI_GOVERNMENT_AGENCY_CODES: readonly GovernmentAgencyCodeEntry[] = [
  {
    "code": "ACE",
    "agencyName": "U.S. Department of Defense, Department of the Army, Army Corps of Engineers",
    "page": 3
  },
  {
    "code": "AMS",
    "agencyName": "U.S. Department of Agriculture, Agricultural Marketing Service",
    "page": 3
  },
  {
    "code": "APH",
    "agencyName": "U.S. Department of Agriculture, Animal and Plant Health Inspection Service",
    "page": 3
  },
  {
    "code": "ATF",
    "agencyName": "U.S. Department of Justice, Bureau of Alcohol, Tobacco, Firearms and Explosives",
    "page": 3
  },
  {
    "code": "BIS",
    "agencyName": "U.S. Department of Commerce, Bureau of Industry and Security",
    "page": 3
  },
  {
    "code": "BLS",
    "agencyName": "U.S. Department of Labor, Bureau of Labor Statistics",
    "page": 3
  },
  {
    "code": "BTS",
    "agencyName": "U.S. Department of Transportation, Research & Innovative Technology, Bureau of Transportation Statistics",
    "page": 3
  },
  {
    "code": "CBC",
    "agencyName": "U.S. Department of Commerce, Bureau of the Census",
    "page": 3
  },
  {
    "code": "CBP",
    "agencyName": "U.S. Department of Homeland Security, Customs and Border Protection",
    "page": 3
  },
  {
    "code": "CDC",
    "agencyName": "U.S. Department of Health and Human Services, Center For Disease Control and Prevention",
    "page": 3
  },
  {
    "code": "CGD",
    "agencyName": "U.S Department of Homeland Security, United States Coast Guard",
    "page": 3
  },
  {
    "code": "CPS",
    "agencyName": "U.S. Consumer Products Safety Commission",
    "page": 3
  },
  {
    "code": "DCM",
    "agencyName": "U.S. Department of Defense, Defense Contract Management Agency",
    "page": 3
  },
  {
    "code": "DEA",
    "agencyName": "U.S. Department of Justice, Drug Enforcement Administration",
    "page": 3
  },
  {
    "code": "DEE",
    "agencyName": "U.S. Department of Energy, Energy Efficiency",
    "page": 3
  },
  {
    "code": "DTC",
    "agencyName": "U.S. Department of State, Directorate of Defense Trade Controls",
    "page": 3
  },
  {
    "code": "DOL",
    "agencyName": "U.S. Department of Labor",
    "page": 3
  },
  {
    "code": "ECO",
    "agencyName": "U.S. Department of Commerce, Enforcement and Compliance",
    "page": 3
  },
  {
    "code": "EIA",
    "agencyName": "U.S. Department of Energy, Energy Information Administration",
    "page": 3
  },
  {
    "code": "EPA",
    "agencyName": "U.S. Environmental Protection Agency",
    "page": 3
  },
  {
    "code": "ETA",
    "agencyName": "U.S. Department of Labor, Employment and Training Administration",
    "page": 3
  },
  {
    "code": "EXI",
    "agencyName": "Export-Import Bank of the United States",
    "page": 3
  },
  {
    "code": "FAA",
    "agencyName": "U.S. Department of Transportation, Federal Aviation Administration",
    "page": 3
  },
  {
    "code": "FAS",
    "agencyName": "U.S. Department of Agriculture, Foreign Agricultural Service",
    "page": 3
  },
  {
    "code": "FCC",
    "agencyName": "U.S. Federal Communications Commission",
    "page": 3
  },
  {
    "code": "FCN",
    "agencyName": "U.S. Department of Treasury, Financial Crimes Enforcement Network",
    "page": 3
  },
  {
    "code": "FDA",
    "agencyName": "U.S. Department of Health and Human Services, Food and Drug Administration",
    "page": 3
  },
  {
    "code": "FHA",
    "agencyName": "U.S. Department of Transportation, Federal Highway Administration",
    "page": 4
  },
  {
    "code": "FMC",
    "agencyName": "U.S. Federal Maritime Commission",
    "page": 4
  },
  {
    "code": "FMS",
    "agencyName": "U.S. Department of Transportation, Federal Motor Carrier Safety Administration",
    "page": 4
  },
  {
    "code": "FSI",
    "agencyName": "U.S. Department of Agriculture, Food Safety and Inspection Service",
    "page": 4
  },
  {
    "code": "FTZ",
    "agencyName": "U.S. Department of Commerce, Foreign Trade Zones Board",
    "page": 4
  },
  {
    "code": "FWS",
    "agencyName": "U.S. Department of the Interior, Fish & Wildlife Service",
    "page": 4
  },
  {
    "code": "GIP",
    "agencyName": "U.S. Department of Agriculture, Grain Inspection, Packers, and Stockyards Administration",
    "page": 4
  },
  {
    "code": "IDV",
    "agencyName": "U.S. Department of State, Agency for International Development",
    "page": 4
  },
  {
    "code": "ICE",
    "agencyName": "U.S. Department of Homeland Security, Immigration and Customs Enforcement",
    "page": 4
  },
  {
    "code": "IRS",
    "agencyName": "U.S. Department of the Treasury, Internal Revenue Service",
    "page": 4
  },
  {
    "code": "MAR",
    "agencyName": "U.S. Department of Transportation, Maritime Administration",
    "page": 4
  },
  {
    "code": "NHT",
    "agencyName": "U.S. Department of Transportation, National Highway Traffic Safety Administration",
    "page": 4
  },
  {
    "code": "NMF",
    "agencyName": "U.S. Department of Commerce, National Oceanic and Atmospheric Administration, National Marine Fisheries",
    "page": 4
  },
  {
    "code": "NRC",
    "agencyName": "U.S. Nuclear Regulatory Commission",
    "page": 4
  },
  {
    "code": "OFA",
    "agencyName": "U.S. Department of the Treasury, Office of Foreign Assets Control",
    "page": 4
  },
  {
    "code": "OFE",
    "agencyName": "U.S. Department of Energy, Office of Fossil Energy",
    "page": 4
  },
  {
    "code": "OFM",
    "agencyName": "U.S. Department of State, Office of Foreign Missions",
    "page": 4
  },
  {
    "code": "OGC",
    "agencyName": "U.S. Department of Energy, Office of the General Counsel",
    "page": 4
  },
  {
    "code": "OLM",
    "agencyName": "U.S. Department of State, Office of Logistics Management",
    "page": 4
  },
  {
    "code": "OMC",
    "agencyName": "U.S. Department of State, Bureau of Oceans and International Environmental and Scientific Affairs, Office of Marine Conservation",
    "page": 4
  },
  {
    "code": "OTX",
    "agencyName": "U.S. Department of Commerce, Office of Textiles and Apparel",
    "page": 4
  },
  {
    "code": "PHM",
    "agencyName": "U.S. Department of Transportation, Pipeline and Hazardous Materials Safety Administration",
    "page": 4
  },
  {
    "code": "TRP",
    "agencyName": "Office of U.S. Trade Representative",
    "page": 4
  },
  {
    "code": "TSA",
    "agencyName": "U.S. Department of Homeland Security, Transportation Security Administration",
    "page": 4
  },
  {
    "code": "TTB",
    "agencyName": "U.S. Department of the Treasury, Alcohol and Tobacco Tax and Trade Bureau",
    "page": 4
  },
  {
    "code": "UTC",
    "agencyName": "U.S. International Trade Commission",
    "page": 4
  }
];

/**
 * Lookup map keyed by 3-character government agency code.
 */
export const ABI_GOVERNMENT_AGENCY_CODE_MAP: ReadonlyMap<string, GovernmentAgencyCodeEntry> = new Map(
  ABI_GOVERNMENT_AGENCY_CODES.map((entry) => [entry.code, entry])
);

/**
 * Set of all valid 3-character government agency codes.
 */
export const ABI_GOVERNMENT_AGENCY_CODE_SET: ReadonlySet<string> = new Set(
  ABI_GOVERNMENT_AGENCY_CODES.map((entry) => entry.code)
);

/**
 * Checks whether a given string is a valid CATAIR Appendix V Government Agency Code.
 */
export function isValidGovernmentAgencyCode(code: string): boolean {
  return ABI_GOVERNMENT_AGENCY_CODE_SET.has(code.trim().toUpperCase());
}

/**
 * Retrieves the Government Agency Code entry for a given code.
 */
export function getGovernmentAgencyCodeEntry(code: string): GovernmentAgencyCodeEntry | undefined {
  return ABI_GOVERNMENT_AGENCY_CODE_MAP.get(code.trim().toUpperCase());
}
