/**
 * CATAIR Appendix C: Tariff Abbreviations (HTS Units of Measure)
 * Source: docs/plans/catair-source-docs/appendix-c-tariff-abbreviations.pdf (February 22, 2016)
 *
 * This module exports the full, authoritative CBP list of 100 HTS Units of Measure abbreviation
 * codes and their meanings extracted from Appendix C of the ACE ABI CATAIR specifications.
 */

export interface TariffAbbreviationEntry {
  /** The abbreviation code as specified in Appendix C (e.g. "AC", "BBL", "X*") */
  code: string;
  /** Full description of the unit of measure */
  description: string;
  /** Source PDF page number in Appendix C (page 6 or 7) */
  page: number;
  /** Optional usage note (e.g. restrictions on Record Identifier C33 for code X) */
  note?: string;
}

/**
 * Footnote constraint specified on page 8 of Appendix C for unit of measure X / X*.
 */
export const HTS_UOM_X_NOTE =
  "Note that the unit of measure X should not be used when reporting invoice quantity on Record Identifier C33 (Input), position 19-21.";

/**
 * Complete list of 100 Tariff Abbreviation / HTS Unit of Measure codes extracted from Appendix C.
 * Page 6 contains 53 entries (AC through KVA).
 * Page 7 contains 47 entries (KVAR through YD).
 */
export const ABI_TARIFF_ABBREVIATIONS: readonly TariffAbbreviationEntry[] = [
  {
    "code": "AC",
    "description": "Alternating Current",
    "page": 6
  },
  {
    "code": "ASTM",
    "description": "American Society for Testing Materials",
    "page": 6
  },
  {
    "code": "BBL",
    "description": "Barrels",
    "page": 6
  },
  {
    "code": "BOL",
    "description": "Boluses (Dosage)",
    "page": 6
  },
  {
    "code": "C",
    "description": "Celsius",
    "page": 6
  },
  {
    "code": "CAP",
    "description": "Capsules (Dosage)",
    "page": 6
  },
  {
    "code": "CAR",
    "description": "Carat",
    "page": 6
  },
  {
    "code": "CC",
    "description": "Cubic Centimeter",
    "page": 6
  },
  {
    "code": "CFT",
    "description": "Cubic Feet (Volume)",
    "page": 6
  },
  {
    "code": "CG",
    "description": "Centigrams",
    "page": 6
  },
  {
    "code": "CGM",
    "description": "Content Gram",
    "page": 6
  },
  {
    "code": "CKG",
    "description": "Content Kilogram",
    "page": 6
  },
  {
    "code": "CM",
    "description": "Centimeters",
    "page": 6
  },
  {
    "code": "CM2",
    "description": "Square Centimeters",
    "page": 6
  },
  {
    "code": "CM3",
    "description": "Cubic Centimeters",
    "page": 6
  },
  {
    "code": "CTN",
    "description": "Content Ton",
    "page": 6
  },
  {
    "code": "CU",
    "description": "Cubic",
    "page": 6
  },
  {
    "code": "CUR",
    "description": "Curie",
    "page": 6
  },
  {
    "code": "CY",
    "description": "Clean Yield",
    "page": 6
  },
  {
    "code": "CYD",
    "description": "Cubic Yards (Volume)",
    "page": 6
  },
  {
    "code": "CYG",
    "description": "Clean Yield Gram",
    "page": 6
  },
  {
    "code": "CYK",
    "description": "Clean Yield Kilogram",
    "page": 6
  },
  {
    "code": "D",
    "description": "Denier",
    "page": 6
  },
  {
    "code": "DC",
    "description": "Direct Current",
    "page": 6
  },
  {
    "code": "DEG",
    "description": "Degree",
    "page": 6
  },
  {
    "code": "DOZ",
    "description": "Dozen",
    "page": 6
  },
  {
    "code": "DPC",
    "description": "Dozen Pieces",
    "page": 6
  },
  {
    "code": "DPR",
    "description": "Dozen Pairs",
    "page": 6
  },
  {
    "code": "FBM",
    "description": "Fiber M",
    "page": 6
  },
  {
    "code": "FIB",
    "description": "Fibers",
    "page": 6
  },
  {
    "code": "FOZ",
    "description": "Ounces, fluid (Volume)",
    "page": 6
  },
  {
    "code": "FT",
    "description": "Feet (Length)",
    "page": 6
  },
  {
    "code": "G",
    "description": "Gram",
    "page": 6
  },
  {
    "code": "GAL",
    "description": "(US)(Volume)",
    "page": 6
  },
  {
    "code": "GBQ",
    "description": "Giqabecquerel",
    "page": 6
  },
  {
    "code": "GR",
    "description": "Gross",
    "page": 6
  },
  {
    "code": "GRL",
    "description": "Gross Lines",
    "page": 6
  },
  {
    "code": "GVW",
    "description": "Gross Vehicle Weight",
    "page": 6
  },
  {
    "code": "HUN",
    "description": "Hundreds",
    "page": 6
  },
  {
    "code": "HZ",
    "description": "Hertz",
    "page": 6
  },
  {
    "code": "IRC",
    "description": "Internal Revenue Code",
    "page": 6
  },
  {
    "code": "JWL",
    "description": "Number of Jewels",
    "page": 6
  },
  {
    "code": "K",
    "description": "1,000",
    "page": 6
  },
  {
    "code": "KCAL",
    "description": "Kilocalories",
    "page": 6
  },
  {
    "code": "KG",
    "description": "1,000 Grams",
    "page": 6
  },
  {
    "code": "KHZ",
    "description": "Kilohertz",
    "page": 6
  },
  {
    "code": "KM",
    "description": "1,000 Meters",
    "page": 6
  },
  {
    "code": "KM2",
    "description": "1,000 Square Meters",
    "page": 6
  },
  {
    "code": "KM3",
    "description": "1,000 Cubic Meters",
    "page": 6
  },
  {
    "code": "KN",
    "description": "Kilonewtons",
    "page": 6
  },
  {
    "code": "KPA",
    "description": "Kilopascal",
    "page": 6
  },
  {
    "code": "KSB",
    "description": "1,000 Standard Brick",
    "page": 6
  },
  {
    "code": "KVA",
    "description": "Kilovolt - Amperes",
    "page": 6
  },
  {
    "code": "KVAR",
    "description": "Kilovolt - Amperes Reactive",
    "page": 7
  },
  {
    "code": "KW",
    "description": "Kilowatts",
    "page": 7
  },
  {
    "code": "KWH",
    "description": "Kilowatt-Hours",
    "page": 7
  },
  {
    "code": "L",
    "description": "Liter",
    "page": 7
  },
  {
    "code": "LB",
    "description": "Pounds, (weight) avdp)",
    "page": 7
  },
  {
    "code": "LIN",
    "description": "Linear",
    "page": 7
  },
  {
    "code": "LNM",
    "description": "Linear Meters",
    "page": 7
  },
  {
    "code": "M",
    "description": "Meters",
    "page": 7
  },
  {
    "code": "M2",
    "description": "Square Meters",
    "page": 7
  },
  {
    "code": "M3",
    "description": "Cubic Meters",
    "page": 7
  },
  {
    "code": "MBQ",
    "description": "Megabecquerel",
    "page": 7
  },
  {
    "code": "MC",
    "description": "Millicurie",
    "page": 7
  },
  {
    "code": "MG",
    "description": "Milligram",
    "page": 7
  },
  {
    "code": "MHZ",
    "description": "Megahertz",
    "page": 7
  },
  {
    "code": "ML",
    "description": "Milliliter",
    "page": 7
  },
  {
    "code": "MM",
    "description": "Millimeters",
    "page": 7
  },
  {
    "code": "MPA",
    "description": "Megapascal",
    "page": 7
  },
  {
    "code": "NO",
    "description": "Number",
    "page": 7
  },
  {
    "code": "ODE",
    "description": "Ozone Depletion Equivalent",
    "page": 7
  },
  {
    "code": "OZ",
    "description": "Ounces, (weight) (avdp)",
    "page": 7
  },
  {
    "code": "PCS",
    "description": "Pieces",
    "page": 7
  },
  {
    "code": "PF",
    "description": "Proof",
    "page": 7
  },
  {
    "code": "PFG",
    "description": "Proof Gallon",
    "page": 7
  },
  {
    "code": "PFL",
    "description": "Proof Liter",
    "page": 7
  },
  {
    "code": "PK",
    "description": "Pack",
    "page": 7
  },
  {
    "code": "PRS",
    "description": "Pairs",
    "page": 7
  },
  {
    "code": "PTL",
    "description": "Pints, liquid (US) (Volume)",
    "page": 7
  },
  {
    "code": "QTL",
    "description": "Quarts, liquid (US) (Volume)",
    "page": 7
  },
  {
    "code": "RPM",
    "description": "Revolutions Per Minute",
    "page": 7
  },
  {
    "code": "SBE",
    "description": "Standard Brick Equivalent",
    "page": 7
  },
  {
    "code": "SFT",
    "description": "Sq. Feet (Area)",
    "page": 7
  },
  {
    "code": "SQ",
    "description": "Square",
    "page": 7
  },
  {
    "code": "SQI",
    "description": "Sq, Inches (Area)",
    "page": 7
  },
  {
    "code": "STN",
    "description": "Short Ton (2000 LB) (Weight)",
    "page": 7
  },
  {
    "code": "SUP",
    "description": "Suppositories (Dosage)",
    "page": 7
  },
  {
    "code": "SYD",
    "description": "Sq. Yards (Area)",
    "page": 7
  },
  {
    "code": "T",
    "description": "Metric Ton",
    "page": 7
  },
  {
    "code": "TAB",
    "description": "Tablets (Dosage)",
    "page": 7
  },
  {
    "code": "TON",
    "description": "Long Ton (2,240 LB) (WGT)",
    "page": 7
  },
  {
    "code": "TOZ",
    "description": "Ounces,Troy/APOTH(WGT)",
    "page": 7
  },
  {
    "code": "V",
    "description": "Volts",
    "page": 7
  },
  {
    "code": "W",
    "description": "Watts",
    "page": 7
  },
  {
    "code": "WG",
    "description": "Wine Gallon",
    "page": 7
  },
  {
    "code": "WL",
    "description": "Wine Liter",
    "page": 7
  },
  {
    "code": "WT",
    "description": "Weight",
    "page": 7
  },
  {
    "code": "X*",
    "description": "Quantity Not Required (valid only for HTS statistical reporting)",
    "page": 7
  },
  {
    "code": "YD",
    "description": "Yards (Length)",
    "page": 7
  }
];

/**
 * Add footnote metadata to entry X*
 */
const processedEntries = ABI_TARIFF_ABBREVIATIONS.map(entry => {
  if (entry.code === 'X*') {
    return {
      ...entry,
      note: HTS_UOM_X_NOTE,
    };
  }
  return entry;
});

/**
 * Lookup map keyed by upper-case code (including 'X*') and normalized code (e.g., 'X').
 */
const TARIFF_ABBREVIATION_MAP = new Map<string, TariffAbbreviationEntry>();
processedEntries.forEach(entry => {
  TARIFF_ABBREVIATION_MAP.set(entry.code.toUpperCase(), entry);
  // Also register stripped asterisk code if present (e.g., 'X' for 'X*')
  if (entry.code.endsWith('*')) {
    const stripped = entry.code.slice(0, -1).toUpperCase();
    if (!TARIFF_ABBREVIATION_MAP.has(stripped)) {
      TARIFF_ABBREVIATION_MAP.set(stripped, entry);
    }
  }
});

/**
 * Look up a tariff abbreviation entry by code (case-insensitive, handles 'X' or 'X*').
 */
export function lookupTariffAbbreviation(code: string): TariffAbbreviationEntry | undefined {
  if (!code) return undefined;
  return TARIFF_ABBREVIATION_MAP.get(code.trim().toUpperCase());
}

/**
 * Check if a code is a valid HTS unit of measure abbreviation.
 */
export function isValidTariffAbbreviation(code: string): boolean {
  return lookupTariffAbbreviation(code) !== undefined;
}
