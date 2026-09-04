/**
 * CATAIR Appendix B: Equipment Description Codes for ACE Reference Data
 * Source: docs/plans/catair-source-docs/appendix-b-valid-codes.pdf (Pages 28-31)
 *
 * This module exports the full, authoritative CBP list of 133 Equipment Description Codes
 * used in container and equipment reference fields (e.g. Cargo Release container records,
 * Broker Download 1C Bill of Lading Container record's Container/Equipment Description Code).
 */

export interface EquipmentDescriptionCodeEntry {
  /** 2-character equipment description code (e.g. "20", "2B", "AC", "CN", "CZ", "TW") */
  code: string;
  /** Full description from Appendix B */
  description: string;
  /** Source PDF page number in Appendix B (pages 28-31) */
  page: number;
}

/**
 * All 133 Equipment Description Codes extracted programmatically from CATAIR Appendix B PDF.
 */
export const ABI_EQUIPMENT_DESCRIPTION_CODES: readonly EquipmentDescriptionCodeEntry[] = [
  {
    "code": "20",
    "description": "20 ft IL Container (Open Top)",
    "page": 28
  },
  {
    "code": "2B",
    "description": "20 ft. IL Container (Closed Top)",
    "page": 28
  },
  {
    "code": "2D",
    "description": "Control Unit",
    "page": 28
  },
  {
    "code": "2E",
    "description": "Helper Unit",
    "page": 28
  },
  {
    "code": "2F",
    "description": "Road railer",
    "page": 28
  },
  {
    "code": "40",
    "description": "40 ft. IL Container (Open Top)",
    "page": 28
  },
  {
    "code": "4B",
    "description": "40 ft. IL Container (Closed Top)",
    "page": 28
  },
  {
    "code": "AC",
    "description": "Closed Container",
    "page": 28
  },
  {
    "code": "AF",
    "description": "Air Freight (Break Bulk)",
    "page": 28
  },
  {
    "code": "AL",
    "description": "Container, Aluminum - Container must be made of aluminum",
    "page": 28
  },
  {
    "code": "AP",
    "description": "Aircraft",
    "page": 28
  },
  {
    "code": "AT",
    "description": "Closed Container (Controlled Temperature)",
    "page": 28
  },
  {
    "code": "BC",
    "description": "Covered Barge",
    "page": 28
  },
  {
    "code": "BE",
    "description": "Bilevel Railcar Fully Open",
    "page": 28
  },
  {
    "code": "BF",
    "description": "Bilevel Railcar Fully Enclosed",
    "page": 28
  },
  {
    "code": "BG",
    "description": "Bogie",
    "page": 28
  },
  {
    "code": "BH",
    "description": "Bilevel Railcar Screened with Roof",
    "page": 28
  },
  {
    "code": "BJ",
    "description": "Bilevel Railcar Screened, No Roof",
    "page": 28
  },
  {
    "code": "BK",
    "description": "Container, Bulk",
    "page": 28
  },
  {
    "code": "BO",
    "description": "Barge, Open",
    "page": 28
  },
  {
    "code": "BR",
    "description": "Barge",
    "page": 28
  },
  {
    "code": "BX",
    "description": "Boxcar",
    "page": 28
  },
  {
    "code": "CA",
    "description": "Caboose",
    "page": 28
  },
  {
    "code": "CB",
    "description": "Chassie, Goose neck",
    "page": 28
  },
  {
    "code": "CC",
    "description": "Container Resting on a Chassis",
    "page": 28
  },
  {
    "code": "CD",
    "description": "Container with Bag Hangers - Rings or bars located in upper part of container walls to suspend bulk bags within the ocean container",
    "page": 28
  },
  {
    "code": "CG",
    "description": "Container, Tank (Gas)",
    "page": 28
  },
  {
    "code": "CH",
    "description": "Chassis",
    "page": 28
  },
  {
    "code": "CI",
    "description": "Container, Insulated",
    "page": 28
  },
  {
    "code": "CJ",
    "description": "Container, Insulated/Ventilated",
    "page": 28
  },
  {
    "code": "CK",
    "description": "Container, Heated/Insulated/ Ventilated",
    "page": 28
  },
  {
    "code": "CL",
    "description": "Container (Closed Top Length Unspecified)",
    "page": 28
  },
  {
    "code": "CM",
    "description": "Container, Open-Sided",
    "page": 28
  },
  {
    "code": "CN",
    "description": "Container",
    "page": 28
  },
  {
    "code": "CP",
    "description": "Coil Car Open",
    "page": 28
  },
  {
    "code": "CQ",
    "description": "Container, Tank (Food Grade - Liquid)",
    "page": 28
  },
  {
    "code": "CR",
    "description": "Coil Car Covered",
    "page": 28
  },
  {
    "code": "CS",
    "description": "Container - Low Side Open Top",
    "page": 28
  },
  {
    "code": "CT",
    "description": "Container - High Side Open top",
    "page": 28
  },
  {
    "code": "CU",
    "description": "Container (Open Top - Length Unspecified)",
    "page": 28
  },
  {
    "code": "CV",
    "description": "Closed Van",
    "page": 28
  },
  {
    "code": "CW",
    "description": "Container, Tank (Chemicals)",
    "page": 28
  },
  {
    "code": "CX",
    "description": "Container, Tank",
    "page": 28
  },
  {
    "code": "CZ",
    "description": "Refrigerated Container",
    "page": 28
  },
  {
    "code": "DD",
    "description": "Double Drop Tailer - A flatbed with two drop decks",
    "page": 29
  },
  {
    "code": "DF",
    "description": "Container with Flush Doors - Container doors must be flush with the inside walls of the ocean-type containers",
    "page": 29
  },
  {
    "code": "DT",
    "description": "Drop Back Trailer",
    "page": 29
  },
  {
    "code": "DX",
    "description": "Boxcar, Damage Free Equipped",
    "page": 29
  },
  {
    "code": "ET",
    "description": "End of Train Device",
    "page": 29
  },
  {
    "code": "FH",
    "description": "Flat Bed Trailer with Headboards",
    "page": 29
  },
  {
    "code": "FN",
    "description": "Flat Bed Trailer with No Headboards",
    "page": 29
  },
  {
    "code": "FP",
    "description": "Flatcar with Pedestal",
    "page": 29
  },
  {
    "code": "FR",
    "description": "Flat Bed Trailer - Removable Sides",
    "page": 29
  },
  {
    "code": "FS",
    "description": "Container with Floor Securing Rings - Appliances at floor level that can be used to secure cargo",
    "page": 29
  },
  {
    "code": "FT",
    "description": "Flat Bed Trailer",
    "page": 29
  },
  {
    "code": "FX",
    "description": "Boxcar Cushion Under Frame of",
    "page": 29
  },
  {
    "code": "GS",
    "description": "Generator Set",
    "page": 29
  },
  {
    "code": "HB",
    "description": "Container with Hangar Bars - Container must be equipped with hangar beams/bars for garment shipments",
    "page": 29
  },
  {
    "code": "HC",
    "description": "Hopper Car (Covered)",
    "page": 29
  },
  {
    "code": "HO",
    "description": "Hopper Car (Open)",
    "page": 29
  },
  {
    "code": "HP",
    "description": "Hopper Car (Covered: Pneumatic Discharge)",
    "page": 29
  },
  {
    "code": "HT",
    "description": "Head of Train Device",
    "page": 29
  },
  {
    "code": "HV",
    "description": "High Cube Van",
    "page": 29
  },
  {
    "code": "HY",
    "description": "Hydrant Cart \u2013 Used at large airports with installed distribution systems to make into plane deliveries; distinguished from other types of fueling vehicles",
    "page": 29
  },
  {
    "code": "ID",
    "description": "Idler Car",
    "page": 29
  },
  {
    "code": "IX",
    "description": "Boxcar (Insulated)",
    "page": 29
  },
  {
    "code": "LO",
    "description": "Locomotive",
    "page": 29
  },
  {
    "code": "LS",
    "description": "Half Height Flat Rack",
    "page": 29
  },
  {
    "code": "LU",
    "description": "Load/Unload Device on Equipment",
    "page": 29
  },
  {
    "code": "NC",
    "description": "Non-containerized or No Equipment",
    "page": 29
  },
  {
    "code": "NX",
    "description": "Boxcar (Interior Bulkheads)",
    "page": 29
  },
  {
    "code": "OB",
    "description": "Ocean Vessel",
    "page": 29
  },
  {
    "code": "OT",
    "description": "Open Top Flat Bed Trailer",
    "page": 29
  },
  {
    "code": "OV",
    "description": "Open Top Van",
    "page": 29
  },
  {
    "code": "PL",
    "description": "Container Platform",
    "page": 29
  },
  {
    "code": "PP",
    "description": "Power Pack \u2013 A container holding a motor, generator, and fuel tank; used to provide power to refrigerated containers on a double stack train",
    "page": 29
  },
  {
    "code": "PT",
    "description": "Protected Trailer",
    "page": 29
  },
  {
    "code": "PU",
    "description": "Pick-up Truck",
    "page": 29
  },
  {
    "code": "RA",
    "description": "Fixed Rack",
    "page": 29
  },
  {
    "code": "RC",
    "description": "Refrigerated (Reefer) Car",
    "page": 29
  },
  {
    "code": "RD",
    "description": "Fixed Rack, Double Drop Trailer \u2013 A double drop flat bed with an A-frame.",
    "page": 29
  },
  {
    "code": "RE",
    "description": "Flat Car (End Bulkheads)",
    "page": 29
  },
  {
    "code": "RF",
    "description": "Flat Car",
    "page": 29
  },
  {
    "code": "RG",
    "description": "Gondola Covered",
    "page": 29
  },
  {
    "code": "RI",
    "description": "Gondola Car (Covered \u2013 Interior Bulkheads)",
    "page": 30
  },
  {
    "code": "RO",
    "description": "Gondola Car (Open)",
    "page": 30
  },
  {
    "code": "RR",
    "description": "Rail Car",
    "page": 30
  },
  {
    "code": "RS",
    "description": "Fixed Rack Single Drop Trailer \u2013 A single drop flat bed with an A-frame.",
    "page": 30
  },
  {
    "code": "RT",
    "description": "Controlled Temperature Trailer (Reefer)",
    "page": 30
  },
  {
    "code": "SA",
    "description": "Saddle \u2013 Device to stack container on a rail car.",
    "page": 30
  },
  {
    "code": "SC",
    "description": "Service Car",
    "page": 30
  },
  {
    "code": "SD",
    "description": "Single Drop Trailer \u2013 A flatbed trailer with one-drop deck.",
    "page": 30
  },
  {
    "code": "SK",
    "description": "Stack Car",
    "page": 30
  },
  {
    "code": "SL",
    "description": "Container, Steel - Container must be made of steel.",
    "page": 30
  },
  {
    "code": "SR",
    "description": "Stak-Rak - A device upon which empty chassis may be stacked for movement \u201cEn Bloc\u201d on a railcar, stack train, trailer, or water-borne vessel.",
    "page": 30
  },
  {
    "code": "SS",
    "description": "Container with Smooth Sides - Walls in ocean container must be flat/smooth.",
    "page": 30
  },
  {
    "code": "ST",
    "description": "Removable Side Trailer",
    "page": 30
  },
  {
    "code": "SV",
    "description": "Van - Special inside length, width, or height requirements.",
    "page": 30
  },
  {
    "code": "TA",
    "description": "Trailer, Heated/Insulated/Ventilated",
    "page": 30
  },
  {
    "code": "TB",
    "description": "Trailer, Boat",
    "page": 30
  },
  {
    "code": "TC",
    "description": "Trailer, Car",
    "page": 30
  },
  {
    "code": "TF",
    "description": "Trailer, Dry Freight",
    "page": 30
  },
  {
    "code": "TG",
    "description": "Trailer, Tank (Gas)",
    "page": 30
  },
  {
    "code": "TH",
    "description": "Truck, Open Top High Side",
    "page": 30
  },
  {
    "code": "TI",
    "description": "Trailer, Insulated",
    "page": 30
  },
  {
    "code": "TJ",
    "description": "Trailer, Tank (Chemicals)",
    "page": 30
  },
  {
    "code": "TK",
    "description": "Trailer, Tank (Food Grade Liquid)",
    "page": 30
  },
  {
    "code": "TL",
    "description": "Trailer (Not Otherwise Specified)",
    "page": 30
  },
  {
    "code": "TM",
    "description": "Trailer, Insulated/Ventilated",
    "page": 30
  },
  {
    "code": "TN",
    "description": "Tank Car",
    "page": 30
  },
  {
    "code": "TO",
    "description": "Truck, Open Top",
    "page": 30
  },
  {
    "code": "TP",
    "description": "Trailer, Pneumatic - A specialized trailer with a pneumatic device for loading or unloading.",
    "page": 30
  },
  {
    "code": "TQ",
    "description": "Trailer, Electric Heat - A trailer with electric heat to keep product from freezing.",
    "page": 30
  },
  {
    "code": "TR",
    "description": "Tractor",
    "page": 30
  },
  {
    "code": "TT",
    "description": "Telescoping Trailer",
    "page": 30
  },
  {
    "code": "TU",
    "description": "Truck, Open Top Low Side",
    "page": 30
  },
  {
    "code": "TV",
    "description": "Truck, Van",
    "page": 30
  },
  {
    "code": "TW",
    "description": "Trailer, Refrigerated - A refrigerated trailer capable of keeping product cold. Different from a temperature controlled trailer which is able to keep product at a constant temperature.",
    "page": 30
  },
  {
    "code": "UA",
    "description": "Trilevel Railcar 20 Feet",
    "page": 30
  },
  {
    "code": "UB",
    "description": "Trilevel Railcar Screened, Fully Enclosed",
    "page": 30
  },
  {
    "code": "UC",
    "description": "Trilevel Railcar Screened, With Roof",
    "page": 30
  },
  {
    "code": "UD",
    "description": "Trilevel Railcar Screened, No Roof",
    "page": 30
  },
  {
    "code": "UE",
    "description": "Trilevel Railcar Screened, With Door, No Roof",
    "page": 30
  },
  {
    "code": "UL",
    "description": "Unit Load Device (ULD)",
    "page": 30
  },
  {
    "code": "UP",
    "description": "Container, Upgraded - Container must be upgraded for higher weights.",
    "page": 31
  },
  {
    "code": "VA",
    "description": "Container, Vented - Dry container must have vent openings for air exchange.",
    "page": 31
  },
  {
    "code": "VE",
    "description": "Vessel, Ocean",
    "page": 31
  },
  {
    "code": "VL",
    "description": "Vessel, Lake",
    "page": 31
  },
  {
    "code": "VR",
    "description": "Vessel, Ocean, Roll on-Roll off",
    "page": 31
  },
  {
    "code": "VS",
    "description": "Vessel, Ocean, Lash",
    "page": 31
  },
  {
    "code": "VT",
    "description": "Vessel, Ocean, Containership",
    "page": 31
  },
  {
    "code": "WR",
    "description": "Container with Wavy or Ripple Sides",
    "page": 31
  },
  {
    "code": "WY",
    "description": "Railroad Maintenance of Way Car",
    "page": 31
  }
];

/**
 * Map of 2-character equipment description code to entry for fast O(1) lookup.
 */
export const ABI_EQUIPMENT_DESCRIPTION_CODE_MAP: ReadonlyMap<string, EquipmentDescriptionCodeEntry> = new Map(
  ABI_EQUIPMENT_DESCRIPTION_CODES.map((entry) => [entry.code, entry])
);

/**
 * Set of all valid 2-character equipment description codes for fast O(1) validation.
 */
export const ABI_EQUIPMENT_DESCRIPTION_CODE_SET: ReadonlySet<string> = new Set(
  ABI_EQUIPMENT_DESCRIPTION_CODES.map((entry) => entry.code)
);

/**
 * Look up an Equipment Description Code entry by 2-character code (case-insensitive).
 */
export function getEquipmentDescriptionCodeEntry(code: string): EquipmentDescriptionCodeEntry | undefined {
  if (!code) return undefined;
  return ABI_EQUIPMENT_DESCRIPTION_CODE_MAP.get(code.trim().toUpperCase());
}

/**
 * Check if a code is a valid Equipment Description Code (case-insensitive).
 */
export function isValidEquipmentDescriptionCode(code: string): boolean {
  if (!code) return false;
  return ABI_EQUIPMENT_DESCRIPTION_CODE_SET.has(code.trim().toUpperCase());
}
