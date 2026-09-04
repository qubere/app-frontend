// JZ-Record ("Returned Condition") condition code narratives, per the Entry
// Summary Query chapter's own Note 1 table.
// Source: docs/plans/catair-source-docs/03-entry-summary-query-2026-05-v26.pdf

export const CONDITION_CODES: Record<string, string> = {
  X34: "UNKNOWN RECORD ID FOUND IN GROUPING",
  X35: "OUT OF SEQUENCE RECORD FOUND IN GROUPING",
  X37: "MISSING DATA RECORD FOUND IN GROUPING",
  X38: "NON-CONTIGUOUS ITEM FOUND IN GROUPING",
  X39: "DATA FOUND IN FILLER",
  X41: "MULTIPLE QUERIES IN BATCH NOT ALLOWED",
  "001": "RETURN DETAIL REQUEST IND MUST BE Y",
  "002": "QUERY REQUEST MISSING",
  "003": "ENTRY FILER CODE MISSING",
  "004": "ENTRY NUMBER MISSING",
  "005": "CRITERIA QUERY TYPE CODE MISSING",
  "006": "CRITERIA QUERY TYPE CODE UNKNOWN",
  "007": "REQUESTED FROM DATE TIME MISSING",
  "008": "REQUESTED FROM DATE TIME UNKNOWN",
  "009": "REQUESTED TO DATE TIME MISSING",
  "010": "REQUESTED TO DATE TIME UNKNOWN",
  "011": "REQUESTED TO DATE < REQUESTED FROM DATE",
  "012": "DATE RANGE DAY LIMIT EXCEEDED",
  "013": "ENTRY SUMMARY NOT FOUND FOR QUERY",
  "014": "QUERY NOT PERMITTED FOR ENTRY NUMBER",
  "015": "QUERY COMPLETE - NO SUMMARIES FOUND",
  "016": "OUTPUT LIMIT REACHED; ADDTNL ES FOUND",
  "017": "FUTURE REQUESTED TO DATE NOT ALLOWED",
};

export function lookupConditionNarrative(code: string): string | undefined {
  return CONDITION_CODES[code];
}

// JD-Record ("Liquidation Reason Code") narratives, per that record's Note 2.
export const LIQUIDATION_REASON_CODES: Record<string, string> = {
  "01": "Valuation",
  "02": "Classification",
  "03": "Quantity",
  "04": "Antidumping Duties",
  "05": "Countervailing Duties",
  "06": "Special Trade Programs",
  "07": "Interest Only",
  "08": "Non-Rev Change Liq",
  "09": "Other",
  "12": "Classification Post-Entry Amendment (PEA)",
  "13": "Quantity PEA",
  "16": "Special Trade Programs PEA",
  "18": "Non-Rev Change Liq PEA",
  "35": "GSP Retroactive Renewal",
  "36": "CAPE",
  "37": "Filer Request For Refund < $20",
  "39": "NAFTA Reconciliation",
  "40": "Other Reconciliation",
  "42": "No Change 2 Week Liq",
  "52": "Closed With Compliance",
  "53": "Closed With Non-Compliance",
  "54": "Breach of Bond",
  "55": "AP Drawback/Over Claimed",
  "56": "Drawback Clerical Error",
  "57": "Drawback Refd/Non-AP Claim",
  "58": "AP Drawback/Under Claimed",
  "59": "Drawback/No Change/AP Paid",
  "60": "No Drawback/No Change",
  "61": "Vessel Repairs",
  "62": "Post Summary Correction",
  "63": "Protest Approved",
  "64": "Void Entry Type Change",
  "98": "System Liquidation",
  "99": "Auto-Liquidation",
};

export function lookupLiquidationReason(code: string): string | undefined {
  return LIQUIDATION_REASON_CODES[code];
}

// JC-Record ("Extension/Suspension Status Code") narratives.
export const LIQUIDATION_EXTENSION_SUSPENSION_CODES: Record<string, string> = {
  "43": "CVD Suspend",
  "44": "ADD Suspend",
  "45": "AD/CVD Suspend",
  "46": "Court Ordered Suspend",
  "47": "Actual Use Suspend",
  "48": "Other 1 Suspend",
  "49": "Customs Ext",
  "50": "Importer Ext",
  "51": "Other Ext",
  "65": "Subject to EAPA",
  "66": "Subject to Court Injunction",
};

export function lookupExtensionSuspensionReason(code: string): string | undefined {
  return LIQUIDATION_EXTENSION_SUSPENSION_CODES[code];
}
