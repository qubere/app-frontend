import { db } from "@/lib/db";

export interface Isf10Plus2Elements {
  // 10 Importer Elements
  sellerNameAddress: string;
  buyerNameAddress: string;
  importerOfRecordNumber: string;
  consigneeNumber: string;
  manufacturerNameAddress: string;
  shipToPartyNameAddress: string;
  countryOfOrigin: string;
  commodityHtsNumber: string;
  containerStuffingLocation?: string;
  consolidatorNameAddress?: string;

  // 2 Carrier Elements
  vesselStowPlan?: string;
  containerStatusMessages?: string;
}

export interface IsfFilingDeadline {
  ladingDate: string; // Foreign port departure / lading timestamp
  isfFilingDeadline: string; // Must be filed >= 24 hours prior to lading
  isLate: boolean;
  hoursUntilDeadline: number;
  potentialLiquidatedDamagesPenalty: number; // $5,000 per late/inaccurate filing, max $10,000
}

/**
 * Calculates ISF 10+2 filing deadline and potential liquidated damages risk.
 */
export function calculateIsfFilingDeadline(ladingDateStr: string, filedAtStr?: string): IsfFilingDeadline {
  const ladingDate = new Date(ladingDateStr);
  const deadline = new Date(ladingDate.getTime() - 24 * 3600 * 1000);
  const now = filedAtStr ? new Date(filedAtStr) : new Date();

  const isLate = now > deadline;
  const hoursUntil = (deadline.getTime() - now.getTime()) / 3600000;
  const penalty = isLate ? 5000 : 0;

  return {
    ladingDate: ladingDate.toISOString(),
    isfFilingDeadline: deadline.toISOString(),
    isLate,
    hoursUntilDeadline: Math.round(hoursUntil * 10) / 10,
    potentialLiquidatedDamagesPenalty: penalty,
  };
}

/**
 * Validates ISF 10+2 element completeness and bond coverage.
 */
export function validateIsfTransaction(
  elements: Partial<Isf10Plus2Elements>,
  hasActiveBond: boolean
): { valid: boolean; missingElements: string[]; bondRequired: boolean; errors: string[] } {
  const required: Array<keyof Isf10Plus2Elements> = [
    "sellerNameAddress",
    "buyerNameAddress",
    "importerOfRecordNumber",
    "consigneeNumber",
    "manufacturerNameAddress",
    "shipToPartyNameAddress",
    "countryOfOrigin",
    "commodityHtsNumber",
  ];

  const missing = required.filter((field) => !elements[field] || String(elements[field]).trim() === "");
  const errors: string[] = [];

  if (missing.length > 0) {
    errors.push(`Missing mandatory ISF 10+2 elements: ${missing.join(", ")}.`);
  }

  if (!hasActiveBond) {
    errors.push("No active Continuous Bond (Activity Code 1) or ISF Standalone Bond (Activity Code 16) on file.");
  }

  return {
    valid: errors.length === 0,
    missingElements: missing as string[],
    bondRequired: !hasActiveBond,
    errors,
  };
}
