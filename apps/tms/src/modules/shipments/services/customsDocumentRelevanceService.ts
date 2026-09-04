export interface MinimalDocument {
  id: string;
  docType?: string | null;
  documentType?: string | null;
  fileName?: string | null;
  status?: string | null;
  checksum?: string | null;
  extractedJson?: string | null;
}

export interface DocumentRelevanceResult {
  relevant: boolean;
  recommendation: "INCLUDE" | "REVIEW" | "EXCLUDE";
  documentRole: string;
  confidence: number;
  reasons: string[];
  policyVersion: string;
}

const POLICY_VERSION = "2026.1.0";

const HIGH_RELEVANCE_TYPES = new Set([
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "BILL_OF_LADING",
  "AIR_WAYBILL",
  "CERTIFICATE_OF_ORIGIN",
  "PHYTOSANITARY_CERTIFICATE",
  "FUMIGATION_CERTIFICATE",
  "CUSTOMS_BOND",
  "POWER_OF_ATTORNEY",
  "ENTRY_SUMMARY",
  "ISF",
]);

const HIGH_RELEVANCE_DOC_TYPES = [
  "commercial invoice",
  "packing list",
  "bill of lading",
  "air waybill",
  "certificate of origin",
  "arrival notice",
  "pga certificate",
  "import license",
  "product specification",
  "purchase order",
  "valuation evidence",
];

const EXCLUDED_DOC_TYPES = [
  "carrier rate confirmation",
  "rate confirmation",
  "tender response",
  "dispatch sheet",
  "internal routing",
  "internal margin",
  "tms operational note",
  "carrier invoice",
  "proof of delivery",
];

export function evaluateDocumentRelevance(doc: MinimalDocument): DocumentRelevanceResult {
  const enumType = doc.documentType ? String(doc.documentType).toUpperCase() : "";
  const docType = (doc.docType || "").toLowerCase().trim();
  const fileName = (doc.fileName || "").toLowerCase().trim();

  // Check explicit exclusions first
  for (const excludedKeyword of EXCLUDED_DOC_TYPES) {
    if (docType.includes(excludedKeyword) || fileName.includes(excludedKeyword)) {
      return {
        relevant: false,
        recommendation: "EXCLUDE",
        documentRole: doc.docType || "TMS Operational Document",
        confidence: 0.95,
        reasons: [`Document type matches TMS operational exclusion pattern: "${excludedKeyword}"`],
        policyVersion: POLICY_VERSION,
      };
    }
  }

  // Check enum match
  if (enumType && HIGH_RELEVANCE_TYPES.has(enumType)) {
    return {
      relevant: true,
      recommendation: "INCLUDE",
      documentRole: enumType,
      confidence: 1.0,
      reasons: [`Document type code "${enumType}" is standard Customs entry evidence.`],
      policyVersion: POLICY_VERSION,
    };
  }

  // Check text docType match
  for (const relKeyword of HIGH_RELEVANCE_DOC_TYPES) {
    if (docType.includes(relKeyword) || fileName.includes(relKeyword)) {
      return {
        relevant: true,
        recommendation: "INCLUDE",
        documentRole: doc.docType || relKeyword.toUpperCase(),
        confidence: 0.9,
        reasons: [`Document title/type matches Customs evidence pattern: "${relKeyword}"`],
        policyVersion: POLICY_VERSION,
      };
    }
  }

  // Default to review for unknown/other trade documents
  return {
    relevant: false,
    recommendation: "REVIEW",
    documentRole: doc.docType || "Other",
    confidence: 0.5,
    reasons: ["Document requires manual customs broker review to determine applicability."],
    policyVersion: POLICY_VERSION,
  };
}
