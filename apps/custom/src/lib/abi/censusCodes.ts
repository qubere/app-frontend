/**
 * CATAIR Appendix H: Census Warning Messages and Override Codes for ACE Reference Data
 * Source: docs/plans/catair-source-docs/appendix-h-census-codes.pdf
 * Document Revision Date: May 30, 2008 (DRAFT H-2, 19 pages)
 *
 * This module exports reference data extracted from CATAIR Appendix H:
 * 1. ABI_CENSUS_OVERRIDE_CODES: All 30 Census Warning Override Codes (pages 18-19).
 * 2. ABI_CENSUS_WARNING_CONDITIONS: All 14 Census Warning Conditions (pages 6-17).
 *
 * This data supports Census warning override validations in Entry Summary (AE transaction)
 * and Census Warning Query / Override processing.
 */

export interface CensusOverrideCodeEntry {
  /** 2-character override code (e.g. "01", "02", ..., "51") */
  code: string;
  /** Short description / title of the override reason */
  description: string;
  /** Detailed comments and criteria from Appendix H */
  comments: string;
  /** Source PDF page number in Appendix H (18 or 19) */
  page: number;
}

export interface CensusRecordPositionReference {
  /** Record identifier in Entry Summary (e.g. "10", "20", "40", "50") */
  recordId: string;
  /** Data element name */
  dataElement: string;
  /** Character positions within the record identifier */
  position: string;
}

export interface CensusWarningConditionEntry {
  /** Warning condition code (e.g. "27A", "27B", "27M", "27C", "28E", "27D", "27F", "27G", "27H", "27I", "27J", "27P", "27Q") */
  warningCode: string;
  /** Full warning title string in CATAIR (e.g. "27A*CENSUS* IMPROBABLE COUNTRY") */
  fullWarningTitle: string;
  /** Short description of the warning condition */
  description: string;
  /** Technical reason triggering the Census warning */
  reason: string;
  /** Recommended resolution procedure for filers */
  resolution: string;
  /** List of 2-character Census override codes allowed for this warning condition */
  allowedOverrideCodes: readonly string[];
  /** Entry Summary record identifiers, data elements, and field positions evaluated */
  affectedRecordPositions: readonly CensusRecordPositionReference[];
  /** Source PDF page number in Appendix H (6 to 17) */
  page: number;
}

/**
 * All 30 Census Warning Override Codes extracted from CATAIR Appendix H (pages 18-19).
 */
export const ABI_CENSUS_OVERRIDE_CODES: readonly CensusOverrideCodeEntry[] = [
  {
    code: "01",
    description: "Exception to Embargo",
    comments: "This commodity is exempt from the embargo of trade with this country.",
    page: 18
  },
  {
    code: "02",
    description: "Timing of Embargo",
    comments: "This shipment was made before or after the trade embargo with this country.",
    page: 18
  },
  {
    code: "03",
    description: "Country Verified as Correct",
    comments: "This country is currently producing or mining this particular commodity.",
    page: 18
  },
  {
    code: "04",
    description: "Prototype",
    comments: "References new product being developed that may have a higher cost reflecting new processes, materials or other costs involved in the production of the article by the manufacturer.",
    page: 18
  },
  {
    code: "05",
    description: "Sample",
    comments: "Small quantity of product, usually for product evaluation or selection.",
    page: 18
  },
  {
    code: "06",
    description: "Assist",
    comments: "An assist has been added to the value of the imported merchandise.",
    page: 18
  },
  {
    code: "07",
    description: "One-of-a-kind",
    comments: "The imported article is unique or the only one of its kind available.",
    page: 18
  },
  {
    code: "08",
    description: "Precision Made",
    comments: "The imported article is of a higher quality or is designed to perform with greater precision than similar articles.",
    page: 18
  },
  {
    code: "09",
    description: "Unique Material",
    comments: "Unique or very rare material was used to create the imported article.",
    page: 18
  },
  {
    code: "10",
    description: "Experimental Drug",
    comments: "Article reflects the development of the chemical composition.",
    page: 18
  },
  {
    code: "11",
    description: "Military Application",
    comments: "The imported article is made to military specifications or intended for military use.",
    page: 18
  },
  {
    code: "12",
    description: "Mass Produced",
    comments: "The imported article is produced in large quantities thereby lowering the cost of production.",
    page: 18
  },
  {
    code: "13",
    description: "Less Than Perfect",
    comments: "The imported article is of lower quality. It might be factory rejects or seconds.",
    page: 18
  },
  {
    code: "14",
    description: "Lower Quality Material",
    comments: "The imported article is made of inexpensive or lower grade materials, not common for this product.",
    page: 18
  },
  {
    code: "15",
    description: "Market Conditions",
    comments: "Due to consumer demand and/or supply, the imported article has a higher or lower value than normal for similar articles.",
    page: 18
  },
  {
    code: "16",
    description: "Special Handling Required",
    comments: "Unusually high cost was incurred to provide special handling needed for this commodity.",
    page: 18
  },
  {
    code: "17",
    description: "Chartered Transportation",
    comments: "Due to consumer demand, special transportation arrangements were made to insure timely delivery.",
    page: 18
  },
  {
    code: "18",
    description: "Insurance Costs Very High",
    comments: "Value or nature of shipment required higher than normal insurance.",
    page: 18
  },
  {
    code: "19",
    description: "Rush Delivery",
    comments: "Importer paid increased cost for speedy delivery of the article.",
    page: 18
  },
  {
    code: "20",
    description: "Weight of Article Heavier Than Normal",
    comments: "This article is made of heavier material than is normally used for similar articles.",
    page: 19
  },
  {
    code: "21",
    description: "Weight of Article Lighter Than Normal",
    comments: "This article is made of lighter material than normally used for similar articles.",
    page: 19
  },
  {
    code: "22",
    description: "Packaging Heavier Than Normal.",
    comments: "The weight of this article is heavier than normal due to packaging.",
    page: 19
  },
  {
    code: "23",
    description: "Packaging Lighter Than Normal",
    comments: "The weight of this article is lighter than normal due to packaging.",
    page: 19
  },
  {
    code: "24",
    description: "Non-product Line Item Needed to Conduct Business",
    comments: "Supplies imported one time or occasionally for the business process; not items for manufacture or selling.",
    page: 19
  },
  {
    code: "25",
    description: "Beginning to Import New Product Line",
    comments: "Beginning to Import New Product Line for Manufacturing or Selling.",
    page: 19
  },
  {
    code: "26",
    description: "Country of Export Verified as Correct",
    comments: "The country of origin is either United States (US) or unknown, and the merchandise was last a part of the commerce of the country of export.",
    page: 19
  },
  {
    code: "27",
    description: "FTZ Withdrawal Low Foreign Value",
    comments: "A low unit price may exist for this article because only foreign value, not U.S. value, was reported.",
    page: 19
  },
  {
    code: "49",
    description: "Parameter Change Request Pending",
    comments: "All data elements verified as correct. Filer initiated Parameter Change Request with Census Bureau.",
    page: 19
  },
  {
    code: "50",
    description: "Correct as Entered",
    comments: "All data elements verified correct. This article cannot be placed in any other override category.",
    page: 19
  },
  {
    code: "51",
    description: "Entered under Special Conditions",
    comments: "All data elements verified correct. Only to be used for extremely unlikely data values or extremely unlikely relationships between data elements.",
    page: 19
  }
];

/**
 * All 14 Census Warning Conditions extracted from CATAIR Appendix H (pages 6-17).
 */
export const ABI_CENSUS_WARNING_CONDITIONS: readonly CensusWarningConditionEntry[] = [
  {
    warningCode: "27A",
    fullWarningTitle: "27A*CENSUS* IMPROBABLE COUNTRY",
    description: "Improbable Country of Origin / Export",
    reason: "An Improbable Country of Origin warning occurs when trade is unlikely with certain countries such as Cuba (CU) or North Korea (KP), or when both the country of origin and country of export are the United States (US). Also, this warning can result when a country of origin is unlikely to produce, mine or manufacture certain commodities.",
    resolution: "Commercial invoices or other evidence should be examined to verify that the country of origin, the country of export, and the tariff are correct as reported.",
    allowedOverrideCodes: ["01", "02", "03", "49", "50"],
    affectedRecordPositions: [
      { recordId: "40", dataElement: "Country of Origin Code", position: "9-10" },
      { recordId: "40", dataElement: "Country of Export Code", position: "11-12" },
      { recordId: "50", dataElement: "HTS Number", position: "3-12" }
    ],
    page: 6
  },
  {
    warningCode: "27B",
    fullWarningTitle: "27B*CENSUS* QTY1/QTY2",
    description: "Quantity 1 / Quantity 2 Ratio Warning",
    reason: "A quantity ratio warning occurs when the relationship between the two quantities Quantity 1 and Quantity 2 is above or below the Census range based on historical data.",
    resolution: "The Census Bureau has determined that there is a relationship between the first quantity and the second quantity as illustrated by the warning. Verify product tariff classification, Quantity 1, and Quantity 2 units of measure and conversions.",
    allowedOverrideCodes: ["09", "20", "21", "49", "50"],
    affectedRecordPositions: [
      { recordId: "50", dataElement: "HTS Number", position: "3-12" },
      { recordId: "50", dataElement: "Quantity (1)", position: "36-47" },
      { recordId: "50", dataElement: "Unit of Measure Code (1)", position: "48-50" },
      { recordId: "50", dataElement: "Quantity (2)", position: "51-62" },
      { recordId: "50", dataElement: "Unit of Measure Code (2)", position: "63-65" }
    ],
    page: 7
  },
  {
    warningCode: "27M",
    fullWarningTitle: "27M*CENSUS* QTY2/QTY1",
    description: "Quantity 2 / Quantity 1 Ratio Warning",
    reason: "A quantity ratio warning occurs when the relationship between the two quantities Quantity 1 and Quantity 2 is above or below the Census range based on historical data.",
    resolution: "The Census Bureau has determined that there is a relationship between the first quantity and the second quantity as illustrated by the warning. Verify product tariff classification, Quantity 1, and Quantity 2 units of measure and conversions.",
    allowedOverrideCodes: ["09", "20", "21", "49", "50"],
    affectedRecordPositions: [
      { recordId: "50", dataElement: "HTS Number", position: "3-12" },
      { recordId: "50", dataElement: "Quantity (1)", position: "36-47" },
      { recordId: "50", dataElement: "Unit of Measure Code (1)", position: "48-50" },
      { recordId: "50", dataElement: "Quantity (2)", position: "51-62" },
      { recordId: "50", dataElement: "Unit of Measure Code (2)", position: "63-65" }
    ],
    page: 7
  },
  {
    warningCode: "27C",
    fullWarningTitle: "27C*CENSUS* OR-LO VAL/QTY (1)",
    description: "Low Value / Quantity (1) Ratio",
    reason: "For the reported tariff number, the value divided by the Quantity 1 (value / Quantity 1) ratio is below the Census range based on historical data.",
    resolution: "Verify tariff classification, reported value (checking conversion from foreign currency to whole US dollars), and Quantity 1 (unit of measure and conversions).",
    allowedOverrideCodes: ["09", "12", "13", "14", "15", "20", "27", "49", "50"],
    affectedRecordPositions: [
      { recordId: "50", dataElement: "HTS Number", position: "3-12" },
      { recordId: "50", dataElement: "Value of Goods Amount", position: "25-34" },
      { recordId: "50", dataElement: "Quantity (1)", position: "36-47" },
      { recordId: "50", dataElement: "Unit of Measure (1)", position: "48-50" }
    ],
    page: 8
  },
  {
    warningCode: "28E",
    fullWarningTitle: "28E*CENSUS* OR-LO VAL/QTY (2)",
    description: "Low Value / Quantity (2) Ratio",
    reason: "For the reported tariff number, the value divided by the Quantity 2 (value / Quantity 2) ratio is below the Census range based on historical data.",
    resolution: "Verify tariff classification, reported value (checking conversion from foreign currency to whole US dollars), and Quantity 2 (unit of measure and conversions).",
    allowedOverrideCodes: ["09", "12", "13", "14", "15", "20", "27", "49", "50"],
    affectedRecordPositions: [
      { recordId: "50", dataElement: "HTS Number", position: "3-12" },
      { recordId: "50", dataElement: "Value of Goods Amount", position: "25-34" },
      { recordId: "50", dataElement: "Quantity (2)", position: "51-62" },
      { recordId: "50", dataElement: "Unit of Measure (2)", position: "63-65" }
    ],
    page: 9
  },
  {
    warningCode: "27D",
    fullWarningTitle: "27D*CENSUS* OR-HI VAL/QTY (1)",
    description: "High Value / Quantity (1) Ratio",
    reason: "For the reported tariff number, the value divided by the Quantity 1 (value / Quantity 1) ratio is above the Census range based on historical data.",
    resolution: "Verify tariff classification, reported value (checking conversion from foreign currency to whole US dollars), and Quantity 1 (unit of measure and conversions).",
    allowedOverrideCodes: ["04", "05", "06", "07", "08", "09", "10", "11", "15", "21", "49", "50"],
    affectedRecordPositions: [
      { recordId: "50", dataElement: "HTS Number", position: "3-12" },
      { recordId: "50", dataElement: "Value of Goods Amount", position: "25-34" },
      { recordId: "50", dataElement: "Quantity (1)", position: "36-47" },
      { recordId: "50", dataElement: "Unit of Measure (1)", position: "48-50" }
    ],
    page: 10
  },
  {
    warningCode: "27F",
    fullWarningTitle: "27F*CENSUS* OR-HI VAL/QTY (2)",
    description: "High Value / Quantity (2) Ratio",
    reason: "For the reported tariff number, the value divided by the Quantity 2 (value / Quantity 2) ratio is above the Census range based on historical data.",
    resolution: "Verify tariff classification, reported value (checking conversion from foreign currency to whole US dollars), and Quantity 2 (unit of measure and conversions).",
    allowedOverrideCodes: ["04", "05", "06", "07", "08", "09", "10", "11", "15", "21", "49", "50"],
    affectedRecordPositions: [
      { recordId: "50", dataElement: "HTS Number", position: "3-12" },
      { recordId: "50", dataElement: "Value of Goods Amount", position: "25-34" },
      { recordId: "50", dataElement: "Quantity (2)", position: "51-62" },
      { recordId: "50", dataElement: "Unit of Measure (2)", position: "63-65" }
    ],
    page: 11
  },
  {
    warningCode: "27G",
    fullWarningTitle: "27G*CENSUS* IMPROBABLE AIR TARIFF",
    description: "Improbable Air Tariff",
    reason: "A Mode of Transportation (MOT) Code of 40 or 41 (Air) is unlikely for this tariff (e.g. transporting coal by air transportation is highly improbable).",
    resolution: "Verify tariff classification and MOT code. Update related transportation data elements if MOT code is changed.",
    allowedOverrideCodes: ["05", "49", "50"],
    affectedRecordPositions: [
      { recordId: "10", dataElement: "Mode of Transportation (MOT) Code", position: "36-37" },
      { recordId: "20", dataElement: "Carrier Code", position: "3-6" },
      { recordId: "50", dataElement: "HTS Number", position: "3-12" }
    ],
    page: 12
  },
  {
    warningCode: "27H",
    fullWarningTitle: "27H*CENSUS* GROSS WEIGHT – AIR",
    description: "Gross Weight Exceeded – Air Shipment",
    reason: "Occurs for air shipments when gross weight reported for tariff exceeds normal air shipping weight limitations (102,060 kilograms).",
    resolution: "Examine commercial invoices or other competent evidence to verify gross weight, mode of transportation, and tariff number.",
    allowedOverrideCodes: ["20", "22", "49", "50"],
    affectedRecordPositions: [
      { recordId: "10", dataElement: "Mode of Transportation (MOT) Code", position: "36-37" },
      { recordId: "40", dataElement: "Gross Shipping Weight", position: "42-51" }
    ],
    page: 13
  },
  {
    warningCode: "27I",
    fullWarningTitle: "27I*CENSUS* GROSS WEIGHT – VESSEL",
    description: "Gross Weight Exceeded – Vessel / Non-Air Shipment",
    reason: "Occurs for vessel and non-air shipments when gross weight reported for tariff exceeds normal shipping weight limitations (22,680,000 kilograms).",
    resolution: "Examine commercial invoices or other competent evidence to verify tariff number and shipping weight.",
    allowedOverrideCodes: ["20", "22", "49", "50"],
    affectedRecordPositions: [
      { recordId: "10", dataElement: "Mode of Transportation (MOT) Code", position: "36-37" },
      { recordId: "40", dataElement: "Gross Shipping Weight", position: "42-51" }
    ],
    page: 14
  },
  {
    warningCode: "27J",
    fullWarningTitle: "27J*CENSUS* OR-AGR CHARGES/VALUE",
    description: "Agreed Charges / Value Ratio Outside Range",
    reason: "For reported tariff number, charges amount divided by value ratio is above Census range based on historical data, or charges/weight ratio is too high for air, or no charges reported.",
    resolution: "Examine commercial invoices or other evidence to verify value, charges, tariff number, MOT, and shipping weight. Check currency conversions.",
    allowedOverrideCodes: ["05", "12", "13", "14", "15", "16", "17", "18", "19", "20", "22", "49", "50"],
    affectedRecordPositions: [
      { recordId: "10", dataElement: "Mode of Transportation (MOT) Code", position: "36-37" },
      { recordId: "40", dataElement: "Charges Amount", position: "27-36" },
      { recordId: "40", dataElement: "Gross Shipping Weight", position: "42-51" },
      { recordId: "50", dataElement: "HTS Number", position: "3-12" },
      { recordId: "50", dataElement: "Value of Goods Amount", position: "25-34" }
    ],
    page: 15
  },
  {
    warningCode: "27P",
    fullWarningTitle: "27P*CENSUS* MAXIMUM VALUE EXCEEDED",
    description: "Maximum Line Item Value Exceeded ($100M)",
    reason: "Occurs when total entered value for line item exceeds $100 million, regardless of tariff number and quantities reported.",
    resolution: "Examine commercial invoices and other evidence to verify value is correct. Check currency conversions.",
    allowedOverrideCodes: ["51"],
    affectedRecordPositions: [
      { recordId: "50", dataElement: "Value of Goods Amount", position: "25-34" }
    ],
    page: 16
  },
  {
    warningCode: "27Q",
    fullWarningTitle: "27Q*CENSUS* MAXIMUM CHARGES EXCEEDED",
    description: "Maximum Line Item Charges Exceeded ($8M)",
    reason: "Results when charges amount for any line item in ACE exceeds $8 million for vessel or air shipments.",
    resolution: "Check currency conversions and shipping charges supplied by importing carrier, making changes where applicable.",
    allowedOverrideCodes: ["51"],
    affectedRecordPositions: [
      { recordId: "40", dataElement: "Charges Amount", position: "27-36" }
    ],
    page: 17
  }
];

// Map lookup for O(1) override code retrieval
const OVERRIDE_CODE_MAP = new Map<string, CensusOverrideCodeEntry>(
  ABI_CENSUS_OVERRIDE_CODES.map((entry) => [entry.code, entry])
);

// Map lookup for O(1) warning condition retrieval
const WARNING_CONDITION_MAP = new Map<string, CensusWarningConditionEntry>(
  ABI_CENSUS_WARNING_CONDITIONS.map((entry) => [entry.warningCode, entry])
);

/**
 * Retrieves the Census Warning Override Code entry by code string.
 * @param code 2-digit override code (e.g. "01", "50")
 */
export function getCensusOverrideCode(code: string): CensusOverrideCodeEntry | undefined {
  return OVERRIDE_CODE_MAP.get(code.trim());
}

/**
 * Checks if a given string is a valid Census Warning Override Code.
 * @param code 2-digit override code
 */
export function isValidCensusOverrideCode(code: string): boolean {
  return OVERRIDE_CODE_MAP.has(code.trim());
}

/**
 * Retrieves the Census Warning Condition entry by warning code.
 * @param warningCode Condition code (e.g. "27A", "27B", "27M", "27P")
 */
export function getCensusWarningCondition(warningCode: string): CensusWarningConditionEntry | undefined {
  return WARNING_CONDITION_MAP.get(warningCode.trim().toUpperCase());
}

/**
 * Returns the list of allowed Census override codes for a given warning condition code.
 * @param warningCode Condition code (e.g. "27A")
 */
export function getValidOverrideCodesForWarning(warningCode: string): readonly string[] {
  const condition = getCensusWarningCondition(warningCode);
  return condition ? condition.allowedOverrideCodes : [];
}

/**
 * Validates whether a specific override code is permitted to override a specific Census warning condition.
 * @param warningCode Census warning condition code (e.g. "27A", "27P")
 * @param overrideCode Census override code (e.g. "01", "51")
 */
export function isOverrideValidForWarning(warningCode: string, overrideCode: string): boolean {
  const allowed = getValidOverrideCodesForWarning(warningCode);
  return allowed.includes(overrideCode.trim());
}
