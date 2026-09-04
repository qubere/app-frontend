export interface RequiredDocRow {
  docType: string | null;
  fileName: string | null;
  status: string;
  fileUrl?: string | null;
}

export interface DocumentTypeCheckResult {
  requiredTypes: string[];
  missingTypes: string[];
  receivedCount: number;
  totalRequired: number;
}

export interface MissingDocument {
  type: string;
  reason: string;
  blocking: boolean;
}

export interface ConditionalDocFlags {
  preferentialTreatmentClaimed: boolean;
  livePlants: boolean;
  fdaRegulated: boolean;
  usdaRegulated: boolean;
}

const BASE_DOCS = ["Commercial Invoice", "Packing List", "Bill of Lading"] as const;

const ENTRY_TYPE_REQUIRED: Record<string, readonly string[]> = {
  "01": BASE_DOCS,
  "02": [...BASE_DOCS, "TIB Application"],
  "06": BASE_DOCS,
  "07": BASE_DOCS,
  "11": ["Commercial Invoice"],
  "23": ["Commercial Invoice"],
  "51": BASE_DOCS,
  "52": BASE_DOCS,
  "61": BASE_DOCS,
  "62": BASE_DOCS,
  "86": [],
};

const DEFAULT_REQUIRED = BASE_DOCS;

const CONDITIONAL_DOCS: Array<{
  type: string;
  reason: string;
  blocking: boolean;
  flag: keyof ConditionalDocFlags;
}> = [
  {
    type: "Certificate of Origin",
    reason: "Required when USMCA or other preferential tariff treatment is claimed",
    blocking: true,
    flag: "preferentialTreatmentClaimed",
  },
  {
    type: "Phytosanitary Certificate",
    reason: "Required for live plants and propagative material (USDA APHIS)",
    blocking: true,
    flag: "livePlants",
  },
  {
    type: "FDA Prior Notice",
    reason: "Required for FDA-regulated food, beverage, or dietary supplement imports",
    blocking: true,
    flag: "fdaRegulated",
  },
  {
    type: "USDA FSIS Import Permit",
    reason: "Required for meat and poultry products (USDA FSIS)",
    blocking: true,
    flag: "usdaRegulated",
  },
];

const isDocReceived = (d: RequiredDocRow) =>
  d.status !== "Missing" &&
  Boolean(
    d.fileUrl ||
      d.status === "Received" ||
      d.status === "Processed" ||
      d.status === "Review Required" ||
      d.status === "Completed" ||
      d.status === "READY" ||
      d.status === "NEEDS_REVIEW"
  );

function docMatchesType(d: RequiredDocRow, requiredType: string): boolean {
  if (!isDocReceived(d)) return false;
  const type = (d.docType || "").toLowerCase();
  const name = (d.fileName || "").toLowerCase();
  const rt = requiredType.toLowerCase();

  if (rt.includes("invoice")) return type.includes("invoice") || name.includes("invoice");
  if (rt.includes("packing")) return type.includes("packing") || name.includes("packing");
  if (rt.includes("lading"))
    return (
      type.includes("lading") ||
      type.includes("transport") ||
      name.includes("lading") ||
      name.includes("instructions") ||
      name.includes("waybill")
    );
  if (rt.includes("certificate of origin") || rt.includes("coo"))
    return type.includes("origin") || type.includes("coo") || name.includes("origin") || name.includes("coo");
  if (rt.includes("tib"))
    return type.includes("tib") || type.includes("temporary import") || name.includes("tib");
  if (rt.includes("phytosanitary"))
    return type.includes("phytosanitary") || name.includes("phytosanitary");
  if (rt.includes("fda prior notice"))
    return type.includes("fda") || type.includes("prior notice") || name.includes("prior notice");
  if (rt.includes("fsis") || rt.includes("usda"))
    return type.includes("fsis") || type.includes("usda") || name.includes("fsis");
  return type.includes(rt) || name.includes(rt);
}

export function checkRequiredDocumentTypes(
  documents: RequiredDocRow[],
  includeCertificateOfOrigin: boolean,
  entryType?: string | null,
  conditionalFlags?: Partial<ConditionalDocFlags>
): DocumentTypeCheckResult {
  const baseTypes =
    entryType && ENTRY_TYPE_REQUIRED[entryType]
      ? [...ENTRY_TYPE_REQUIRED[entryType]]
      : [...DEFAULT_REQUIRED];

  if (includeCertificateOfOrigin && !baseTypes.includes("Certificate of Origin")) {
    baseTypes.push("Certificate of Origin");
  }

  const flags = conditionalFlags ?? {};
  for (const cond of CONDITIONAL_DOCS) {
    if (cond.flag === "preferentialTreatmentClaimed") continue;
    if (flags[cond.flag] && !baseTypes.includes(cond.type)) {
      baseTypes.push(cond.type);
    }
  }

  const requiredTypes = baseTypes;
  const missingTypes = requiredTypes.filter(
    (req) => !documents.some((d) => docMatchesType(d, req))
  );

  return {
    requiredTypes,
    missingTypes,
    receivedCount: requiredTypes.length - missingTypes.length,
    totalRequired: requiredTypes.length,
  };
}
