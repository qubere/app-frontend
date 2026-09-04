/**
 * Maps free-text document type strings (as returned by the AI classifier) to
 * the canonical DocumentType Prisma enum. The AI prompt never guarantees a
 * controlled vocabulary, so the lookup is keyword-based and case-insensitive.
 *
 * Unknown types resolve to "OTHER". The caller decides what to do when the
 * mapping confidence is below CLASSIFICATION_CONFIDENCE_THRESHOLD.
 */
import type { DocumentType } from "@prisma/client";

/** Confidence below this (0–1 scale) routes the document to human review. */
export const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.7;

type Matcher = { keywords: string[]; type: DocumentType };

const MATCHERS: Matcher[] = [
  { keywords: ["carrier invoice", "freight invoice", "freight bill"], type: "CARRIER_INVOICE" },
  { keywords: ["commercial invoice", "invoice"], type: "COMMERCIAL_INVOICE" },
  { keywords: ["packing list", "packing slip", "weight list"], type: "PACKING_LIST" },
  { keywords: ["bill of lading", "bl", "ocean bill", "master bill", "house bill"], type: "BILL_OF_LADING" },
  { keywords: ["air waybill", "airway bill", "awb", "mawb", "hawb"], type: "AIR_WAYBILL" },
  { keywords: ["certificate of origin", "coo", "usmca", "nafta", "form a", "gsp certificate"], type: "CERTIFICATE_OF_ORIGIN" },
  { keywords: ["phytosanitary", "plant health", "plant certificate"], type: "PHYTOSANITARY_CERTIFICATE" },
  { keywords: ["fumigation", "treatment certificate", "heat treatment"], type: "FUMIGATION_CERTIFICATE" },
  { keywords: ["customs bond", "surety bond", "import bond"], type: "CUSTOMS_BOND" },
  { keywords: ["power of attorney", "poa"], type: "POWER_OF_ATTORNEY" },
  { keywords: ["entry summary", "cbp form 7501", "7501", "entry type"], type: "ENTRY_SUMMARY" },
  { keywords: ["bill of entry", "customs entry", "customs declaration"], type: "CUSTOMS_ENTRY" },
  { keywords: ["importer security filing", "isf", "10+2", "10 2"], type: "ISF" },
  { keywords: ["proof of delivery", "delivery receipt", "signed pod"], type: "PROOF_OF_DELIVERY" },
  { keywords: ["forwarding instruction"], type: "FORWARDING_INSTRUCTION" },
  { keywords: ["booking request", "booking confirmation"], type: "BOOKING_REQUEST" },
  { keywords: ["arrival notice"], type: "ARRIVAL_NOTICE" },
  { keywords: ["purchase order"], type: "PURCHASE_ORDER" },
  { keywords: ["delivery note"], type: "DELIVERY_NOTE" },
  { keywords: ["shipping instruction", "shipper's letter of instruction", "shippers letter of instruction"], type: "SHIPPING_INSTRUCTION" },
  { keywords: ["cmr", "consignment note", "international consignment note"], type: "CMR" },
  { keywords: ["sea waybill", "seaway bill", "seaway bill of lading"], type: "SEA_WAYBILL" },
  { keywords: ["eur.1", "eur1", "movement certificate eur"], type: "EUR1_CERTIFICATE" },
  { keywords: ["a.tr certificate", "atr certificate", "movement certificate a.tr"], type: "ATR_CERTIFICATE" },
  { keywords: ["export declaration"], type: "EXPORT_DECLARATION" },
  { keywords: ["import declaration"], type: "IMPORT_DECLARATION" },
];

/**
 * Maps a raw classifier string to a DocumentType enum value.
 * Returns "OTHER" when no matcher fires.
 */
export function mapToDocumentType(raw: string): DocumentType {
  const lower = raw.toLowerCase().trim();
  for (const { keywords, type } of MATCHERS) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return "OTHER";
}

/**
 * Canonical display string for each DocumentType enum value. This is what
 * ShipmentDocument.docType (the free-text field reconciliation rules match
 * against) gets synced to once classification succeeds -- see
 * documentIntelligenceAgent.ts's classification-write step.
 */
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  COMMERCIAL_INVOICE: "Commercial Invoice",
  PACKING_LIST: "Packing List",
  BILL_OF_LADING: "Bill of Lading",
  AIR_WAYBILL: "Air Waybill",
  CERTIFICATE_OF_ORIGIN: "Certificate of Origin",
  PHYTOSANITARY_CERTIFICATE: "Phytosanitary Certificate",
  FUMIGATION_CERTIFICATE: "Fumigation Certificate",
  CUSTOMS_BOND: "Customs Bond",
  POWER_OF_ATTORNEY: "Power of Attorney",
  ENTRY_SUMMARY: "Entry Summary",
  ISF: "ISF",
  PROOF_OF_DELIVERY: "Proof of Delivery",
  CARRIER_INVOICE: "Carrier Invoice",
  FORWARDING_INSTRUCTION: "Forwarding Instruction",
  BOOKING_REQUEST: "Booking Request",
  ARRIVAL_NOTICE: "Arrival Notice",
  PURCHASE_ORDER: "Purchase Order",
  DELIVERY_NOTE: "Delivery Note",
  SHIPPING_INSTRUCTION: "Shipping Instruction",
  CMR: "CMR Consignment Note",
  SEA_WAYBILL: "Sea Waybill",
  CUSTOMS_ENTRY: "Customs Entry",
  EUR1_CERTIFICATE: "EUR.1 Certificate",
  ATR_CERTIFICATE: "A.TR Certificate",
  EXPORT_DECLARATION: "Export Declaration",
  IMPORT_DECLARATION: "Import Declaration",
  OTHER: "Other",
};

/**
 * Normalises a classifier confidence value to the 0–1 scale this module
 * uses. The AI returns 0–100; everything else is clamped.
 */
export function normaliseConfidence(raw: number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (raw > 1) return Math.min(raw / 100, 1);
  return Math.min(Math.max(raw, 0), 1);
}
