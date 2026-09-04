/**
 * CATAIR Appendix B: Units of Measure for ACE Reference Data
 * Source: docs/plans/catair-source-docs/appendix-b-valid-codes.pdf (Pages 22-25)
 *
 * This module exports the full, authoritative CBP list of 255 Units of Measure (UOM) codes
 * used across ABI declarations including:
 * - Cargo Release line items
 * - Entry Summary quantity/UOM pairs (Records 40, 50, etc.)
 * - Drawback Unit of Measure Code on Records 42, 50, 60, 70
 * - PGA Message Set Unit of Measure fields
 */

export interface UnitOfMeasureEntry {
  /** Unit of Measure code (e.g. "BBL", "KG", "L", "DOZ", "CM3") */
  code: string;
  /** Full description from CATAIR Appendix B */
  description: string;
  /** Source PDF page number in Appendix B (pages 22-25) */
  page: number;
  /** True if code/description is marked with * (indicates updated or new code from ACS version) */
  isUpdatedOrNew: boolean;
}

/**
 * All 255 Units of Measure codes extracted programmatically from CATAIR Appendix B PDF (Pages 22-25).
 */
export const ABI_UNITS_OF_MEASURE: readonly UnitOfMeasureEntry[] = [
  {
    "code": "AC",
    "description": "Alternating Current",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "AE",
    "description": "Aerosol",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "AM",
    "description": "Ampoule, Nonprotected",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "AP",
    "description": "Ampoule, Protected",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "AST",
    "description": "American Society for Testing Materials*",
    "page": 22,
    "isUpdatedOrNew": true
  },
  {
    "code": "AT",
    "description": "Atomizer",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "AU",
    "description": "Allergy Units*",
    "page": 22,
    "isUpdatedOrNew": true
  },
  {
    "code": "BA",
    "description": "Barrel",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BAU",
    "description": "Bioequivalent Allergy Units*",
    "page": 22,
    "isUpdatedOrNew": true
  },
  {
    "code": "BB",
    "description": "Bobbin",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BBL",
    "description": "Barrels",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BC",
    "description": "Bottle crate, Bottle rack",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BD",
    "description": "Board",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BE",
    "description": "Bundle",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BF",
    "description": "Balloon, Nonprotected",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BG",
    "description": "Bag",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BH",
    "description": "Bunch",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BI",
    "description": "Bin",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BJ",
    "description": "Bucket",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BK",
    "description": "Basket",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BL",
    "description": "Bale, Compressed",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BN",
    "description": "Bale, Noncompressed",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BO",
    "description": "Bottle, Nonprotected, Cylindrical",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BOL",
    "description": "Boluses (Dosage)",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BP",
    "description": "Balloon, Protected",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BQ",
    "description": "Bottle, Protected, Cylindrical",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BQT",
    "description": "Bouquet (of flowers)*",
    "page": 22,
    "isUpdatedOrNew": true
  },
  {
    "code": "BR",
    "description": "Bar",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BS",
    "description": "Bottle, Nonprotected, Bulbous",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BT",
    "description": "Bolt",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BU",
    "description": "Butt",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BV",
    "description": "Bottle, Protected Bulbous",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BX",
    "description": "Box",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BY",
    "description": "Board, In Bundle/Bunch/Truss",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "BZ",
    "description": "Bars, In Bundle/Bunch/Truss",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "C",
    "description": "Celsius",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CA",
    "description": "Can, Rectangular",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CAG",
    "description": "Cage*",
    "page": 22,
    "isUpdatedOrNew": true
  },
  {
    "code": "CAP",
    "description": "Capsules (Dosage)",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CAR",
    "description": "Carat",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CB",
    "description": "Beer, Crate",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CC",
    "description": "Cubic Centimeter",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CCS",
    "description": "Carcasses*",
    "page": 22,
    "isUpdatedOrNew": true
  },
  {
    "code": "CE",
    "description": "Creel",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CF",
    "description": "Coffer",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CFT",
    "description": "Cubic Feet (Volume)",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CG",
    "description": "Centigrams",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CGM",
    "description": "Content Gram",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CH",
    "description": "Chest",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CHU",
    "description": "Churn*",
    "page": 22,
    "isUpdatedOrNew": true
  },
  {
    "code": "CI",
    "description": "Canister",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CJ",
    "description": "Coffin",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CK",
    "description": "Cask",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CKG",
    "description": "Content Kilogram",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CL",
    "description": "Coil",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CM",
    "description": "Centimeters",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CM2",
    "description": "Square Centimeters",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CM3",
    "description": "Cubic Centimeters",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CO",
    "description": "Carboy, Nonprotected",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "COM",
    "description": "Combo Bins",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CON",
    "description": "Container",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CP",
    "description": "Carboy, Protected",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CR",
    "description": "Crate",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CS",
    "description": "Case",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CT",
    "description": "Carton",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CTL",
    "description": "Centiliter*",
    "page": 22,
    "isUpdatedOrNew": true
  },
  {
    "code": "CTN",
    "description": "Content Ton",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CTR",
    "description": "Cartridge*",
    "page": 22,
    "isUpdatedOrNew": true
  },
  {
    "code": "CU",
    "description": "Cup*",
    "page": 22,
    "isUpdatedOrNew": true
  },
  {
    "code": "CUR",
    "description": "Curie",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CV",
    "description": "Cover",
    "page": 22,
    "isUpdatedOrNew": false
  },
  {
    "code": "CX",
    "description": "Can, Cylindrical",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "CY",
    "description": "Clean Yield",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "CYD",
    "description": "Cubic Yards (Volume)",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "CYG",
    "description": "Clean Yield Gram",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "CYK",
    "description": "Clean Yield Kilogram",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "CYL",
    "description": "Cylinder*",
    "page": 23,
    "isUpdatedOrNew": true
  },
  {
    "code": "CZ",
    "description": "Canvas",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "D",
    "description": "Denier",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "DC",
    "description": "Direct Current",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "DEG",
    "description": "Degree",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "DJ",
    "description": "Demijohn, Nonprotected",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "DOZ",
    "description": "Dozen",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "DP",
    "description": "Demijohn, Protected",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "DPC",
    "description": "Dozen Pieces",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "DPR",
    "description": "Dozen Pairs",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "DR",
    "description": "Drum",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "EN",
    "description": "Envelope",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "FBM",
    "description": "Fiber M",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "FC",
    "description": "Fruit Crate",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "FD",
    "description": "Framed Crate",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "FI",
    "description": "Firkin",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "FIB",
    "description": "Fibers",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "FL",
    "description": "Flask",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "FO",
    "description": "Footlocker",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "FOZ",
    "description": "Ounces, fluid (Volume)",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "FP",
    "description": "Filmpack",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "FR",
    "description": "Frame",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "FT",
    "description": "Feet (Length)",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "G",
    "description": "Gram",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "GAL",
    "description": "(US)(Volume)",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "GB",
    "description": "Gas Bottle",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "GBQ",
    "description": "Giqabecquerel",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "GI",
    "description": "Girder",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "GR",
    "description": "Gross",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "GRL",
    "description": "Gross Lines",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "GVW",
    "description": "Gross Vehicle Weight",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "GZ",
    "description": "Girders, In Bundle/Bunch/Truss",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "HG",
    "description": "Hogshead",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "HR",
    "description": "Hamper",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "HUN",
    "description": "Hundreds",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "HZ",
    "description": "Hertz",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "IN",
    "description": "Inch*",
    "page": 23,
    "isUpdatedOrNew": true
  },
  {
    "code": "ING",
    "description": "Ingot*",
    "page": 23,
    "isUpdatedOrNew": true
  },
  {
    "code": "IRC",
    "description": "Internal Revenue Code",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "IZ",
    "description": "Ingots, In Bundle/Bunch/Truss",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "JC",
    "description": "Jerrican, Rectangular",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "JG",
    "description": "Jug",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "JR",
    "description": "Jar",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "JT",
    "description": "Jutebag",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "JWL",
    "description": "Number of Jewels",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "JY",
    "description": "Jerrican, Cylindrical",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "K",
    "description": "1,000",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "KCA",
    "description": "Kilocalories*",
    "page": 23,
    "isUpdatedOrNew": true
  },
  {
    "code": "KEG",
    "description": "Keg*",
    "page": 23,
    "isUpdatedOrNew": true
  },
  {
    "code": "KG",
    "description": "1,000 Grams (kilogram)",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "KHZ",
    "description": "Kilohertz",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "KIT",
    "description": "Kit*",
    "page": 23,
    "isUpdatedOrNew": true
  },
  {
    "code": "KL",
    "description": "Kiloliter*",
    "page": 23,
    "isUpdatedOrNew": true
  },
  {
    "code": "KM",
    "description": "1,000 Meters",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "KM2",
    "description": "1,000 Square Meters",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "KM3",
    "description": "1,000 Cubic Meters",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "KN",
    "description": "Kilonewtons",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "KPA",
    "description": "Kilopascal",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "KSB",
    "description": "1,000 Standard Brick",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "KVA",
    "description": "Kilovolt - Amperes",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "KVR",
    "description": "Kilovolt - Amperes Reactive*",
    "page": 23,
    "isUpdatedOrNew": true
  },
  {
    "code": "KW",
    "description": "Kilowatts",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "KWH",
    "description": "Kilowatt-Hours",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "L",
    "description": "Liter",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "LB",
    "description": "Pounds, (weight) avdp)",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "LG",
    "description": "Log",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "LIN",
    "description": "Linear",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "LNM",
    "description": "Linear Meters",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "LZ",
    "description": "Logs, In Bundle/Bunch/Truss",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "M",
    "description": "Meters",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "M2",
    "description": "Square Meters",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "M3",
    "description": "Cubic Meters",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "MB",
    "description": "Multi-ply Bag",
    "page": 23,
    "isUpdatedOrNew": false
  },
  {
    "code": "MBQ",
    "description": "Megabecquerel",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "MC",
    "description": "Millicurie",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "MCG",
    "description": "Micrograms*",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "MG",
    "description": "Milligram",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "MHZ",
    "description": "Megahertz",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "ML",
    "description": "Milliliter",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "MLK",
    "description": "Milk Crate*",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "MM",
    "description": "Millimeters",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "MM2",
    "description": "Square Millimeters*",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "MM3",
    "description": "Cubic Millimeters*",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "MPA",
    "description": "Megapascal",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "MS",
    "description": "Multiwall Sack",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "MT",
    "description": "Mat*",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "MX",
    "description": "Matchbox",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "NE",
    "description": "Unpacked Or Unpackaged",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "NO",
    "description": "Number",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "NS",
    "description": "Nest",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "NT",
    "description": "Net",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "ODE",
    "description": "Ozone Depletion Equivalent",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "OZ",
    "description": "Ounces, (weight) (avdp)",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PA",
    "description": "Packet",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PAL",
    "description": "Pallet",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PC",
    "description": "Parcel",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PCS",
    "description": "Pieces",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PF",
    "description": "Proof",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PFG",
    "description": "Proof Gallon",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PFL",
    "description": "Proof Liter",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PG",
    "description": "Plate",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PH",
    "description": "Pitcher",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PI",
    "description": "Pipe",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PK",
    "description": "Pack",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PKG",
    "description": "Package*",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "PL",
    "description": "Pail",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PN",
    "description": "Plank",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PNU",
    "description": "Protein Nitrogen Units*",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "PO",
    "description": "Pouch",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PRS",
    "description": "Pairs",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PT",
    "description": "Pot",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PTL",
    "description": "Pints, liquid (US) (Volume)",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PTU",
    "description": "Plant Unit*",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "PU",
    "description": "Tray or Tray Pack",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PY",
    "description": "Plates, In Bundle/Bunch/Truss",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "PZ",
    "description": "Planks or Pipes, In Bundle/Bunch/Truss",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "QTL",
    "description": "Quarts, liquid (US) (Volume)",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "RD",
    "description": "Rod",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "RG",
    "description": "Ring",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "RL",
    "description": "Reel",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "RO",
    "description": "Roll",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "RPM",
    "description": "Revolutions Per Minute",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "RT",
    "description": "Rednet",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "RZ",
    "description": "Rods, In Bundle/Bunch/Truss",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SA",
    "description": "Sack",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SBE",
    "description": "Standard Brick Equivalent",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SC",
    "description": "Shallow Crate",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SD",
    "description": "Spindle",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SE",
    "description": "Sea-chest",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SFT",
    "description": "Sq. Feet (Area)",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SH",
    "description": "Sachet",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SK",
    "description": "Skeleton Case",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SL",
    "description": "Slipsheet",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SLF",
    "description": "Shelf*",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "SM",
    "description": "Sheetmetal",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SQ",
    "description": "Square",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SQI",
    "description": "Sq, Inches (Area)",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SS",
    "description": "Stem* [to be deprecated]",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "ST",
    "description": "Sheet",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "STM",
    "description": "Stem*",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "STN",
    "description": "Short Ton (2000 LB) (Weight)",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SU",
    "description": "Suitcase",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SUP",
    "description": "Suppositories (Dosage)",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SW",
    "description": "Shrinkwrapped",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SY",
    "description": "Syringe*",
    "page": 24,
    "isUpdatedOrNew": true
  },
  {
    "code": "SYD",
    "description": "Sq. Yards (Area)",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "SZ",
    "description": "Sheets, In Bundle/Bunch/Truss",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "T",
    "description": "Metric Ton",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "TAB",
    "description": "Tablets (Dosage)",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "TB",
    "description": "Tub",
    "page": 24,
    "isUpdatedOrNew": false
  },
  {
    "code": "TC",
    "description": "Tea-Chest",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TD",
    "description": "Tube, Collapsible",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TK",
    "description": "Tank, Rectangular",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TN",
    "description": "Tin",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TO",
    "description": "Tun",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TON",
    "description": "Long Ton (2,240 LB) (WGT)",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TOZ",
    "description": "Ounces,Troy/APOTH(WGT)",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TR",
    "description": "Trunk",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TS",
    "description": "Truss",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TU",
    "description": "Tube",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TWR",
    "description": "Tower",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TY",
    "description": "Tank, Cylindrical",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "TZ",
    "description": "Tubes, In Bundle/Bunch/Truss",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "V",
    "description": "Volts",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "VA",
    "description": "Vat",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "VG",
    "description": "Bulk Gas (At 1031 MBAR and 15 degrees Celsius)",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "VI",
    "description": "Vial",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "VL",
    "description": "Bulk Liquid",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "VO",
    "description": "Bulk, Solid, Large Particles (\u201cNodules\u201d)",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "VP",
    "description": "Vacuum-packed",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "VQ",
    "description": "Bulk, Liquified Gas (At Normal Temperature)",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "VR",
    "description": "Bulk, Solid, Granular Particles (\u201cGrains\u201d)",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "VY",
    "description": "Bulk, Solid, Fine Particles (\u201cPowders\u201d)",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "W",
    "description": "Watts",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "WB",
    "description": "Wicker bottle",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "WG",
    "description": "Wine Gallon",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "WL",
    "description": "Wine Liter",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "WT",
    "description": "Weight",
    "page": 25,
    "isUpdatedOrNew": false
  },
  {
    "code": "YD",
    "description": "Yards (Length)",
    "page": 25,
    "isUpdatedOrNew": false
  }
];

/**
 * Map of UOM Code -> UnitOfMeasureEntry for O(1) lookups.
 */
export const ABI_UNIT_OF_MEASURE_MAP: ReadonlyMap<string, UnitOfMeasureEntry> = new Map(
  ABI_UNITS_OF_MEASURE.map((entry) => [entry.code, entry])
);

/**
 * Set of all valid UOM codes for fast existence validation.
 */
export const ABI_UNIT_OF_MEASURE_SET: ReadonlySet<string> = new Set(
  ABI_UNITS_OF_MEASURE.map((entry) => entry.code)
);

/**
 * Validates whether a given code is a valid CATAIR Unit of Measure code.
 */
export function isValidUnitOfMeasure(code: string): boolean {
  if (!code) return false;
  return ABI_UNIT_OF_MEASURE_SET.has(code.trim().toUpperCase());
}

/**
 * Retrieves the UnitOfMeasureEntry for a given UOM code.
 */
export function getUnitOfMeasureEntry(code: string): UnitOfMeasureEntry | undefined {
  if (!code) return undefined;
  return ABI_UNIT_OF_MEASURE_MAP.get(code.trim().toUpperCase());
}
