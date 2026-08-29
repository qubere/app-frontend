import { DocumentType, LegDocumentRequirement, LegMode, LegType } from "@prisma/client";

/**
 * A single expected-document slot on a leg. `slotKey` is the stable identity
 * of the slot (uniqueness is `@@unique([legId, slotKey])`), because many real
 * transport documents share the coarse `DocumentType.OTHER`. `expectedDocType`
 * is only used to match uploaded documents to the slot.
 */
export interface LegChecklistSlot {
  slotKey: string;
  slotLabel: string;
  expectedDocType: DocumentType;
  requirement: LegDocumentRequirement;
  requirementReason: string;
}

export interface LegDocumentChecklistResult {
  legType: LegType;
  mode: LegMode;
  slots: LegChecklistSlot[];
}

export interface LegDocumentContext {
  /** US import move — drives ISF / CBP release requirements. Defaults true. */
  isUsImport?: boolean;
  /** Shipment contains hazardous material. */
  isHazmat?: boolean;
  /** A preferential tariff treatment (USMCA etc.) is being claimed. */
  hasPreferenceClaim?: boolean;
  /** Wood packaging present — ISPM-15 fumigation certificate applies. */
  hasWoodPackaging?: boolean;
  /** This is the final leg of the journey — POD applies. */
  isFinalLeg?: boolean;
}

function slot(
  slotKey: string,
  slotLabel: string,
  expectedDocType: DocumentType,
  requirement: LegDocumentRequirement,
  requirementReason: string
): LegChecklistSlot {
  return { slotKey, slotLabel, expectedDocType, requirement, requirementReason };
}

/**
 * The set of documents a leg needs, keyed by leg type × mode × shipment
 * characteristics. Returns checklist slots (documentId is filled later, when a
 * matching document is uploaded/attached).
 */
export function inferLegDocuments(
  legType: LegType,
  mode: LegMode,
  context: LegDocumentContext = {}
): LegDocumentChecklistResult {
  const { isUsImport = true, isHazmat, hasPreferenceClaim, hasWoodPackaging, isFinalLeg } = context;
  const slots: LegChecklistSlot[] = [];

  switch (legType) {
    case LegType.EXPORT_HAULAGE:
      slots.push(
        slot("BOOKING_CONFIRMATION", "Booking Confirmation", DocumentType.OTHER, LegDocumentRequirement.REQUIRED,
          "Carrier booking confirmation for the export move"),
        slot("SHIPPING_INSTRUCTIONS", "Shipping Instructions", DocumentType.OTHER, LegDocumentRequirement.REQUIRED,
          "Forwarder shipping instructions / dispatch order for origin drayage"),
        slot("PACKING_LIST", "Packing List", DocumentType.PACKING_LIST, LegDocumentRequirement.REQUIRED,
          "Container load manifest and packing list"),
      );
      if (isHazmat) {
        slots.push(slot("DG_DECLARATION", "Dangerous Goods Declaration", DocumentType.OTHER,
          LegDocumentRequirement.REQUIRED, "Required for hazardous-material haulage"));
      }
      if (hasWoodPackaging) {
        slots.push(slot("FUMIGATION_CERT", "Fumigation Certificate", DocumentType.FUMIGATION_CERTIFICATE,
          LegDocumentRequirement.CONDITIONAL, "ISPM-15 treatment certificate for wood packaging"));
      }
      break;

    case LegType.MAIN_CARRIAGE:
      if (mode === LegMode.AIR) {
        slots.push(slot("MAWB", "Master Air Waybill", DocumentType.AIR_WAYBILL, LegDocumentRequirement.REQUIRED,
          "Master Air Waybill (MAWB) for the main flight"));
      } else {
        slots.push(slot("MBL", "Master Bill of Lading", DocumentType.BILL_OF_LADING, LegDocumentRequirement.REQUIRED,
          "Master ocean bill of lading (MBL) for the main carriage"));
        if (isUsImport) {
          slots.push(slot("ISF_10_2", "ISF 10+2 Filing", DocumentType.ISF, LegDocumentRequirement.REQUIRED,
            "CBP Importer Security Filing, due 24h before lading (ocean imports)"));
        }
      }
      if (hasPreferenceClaim) {
        slots.push(slot("CERT_OF_ORIGIN", "Certificate of Origin", DocumentType.CERTIFICATE_OF_ORIGIN,
          LegDocumentRequirement.REQUIRED, "Required to support the preferential tariff treatment claim"));
      }
      break;

    case LegType.TRANSSHIPMENT:
      // The transshipment leg rides the same master bill as its parent main
      // carriage — surfaced INFO_ONLY so the broker sees the linkage without a
      // duplicate "missing" gap.
      slots.push(slot("MBL", "Master Bill of Lading (shared)", DocumentType.BILL_OF_LADING,
        LegDocumentRequirement.INFO_ONLY, "Shared master bill of lading — carried from the main carriage leg"));
      break;

    case LegType.IMPORT_HAULAGE:
      slots.push(
        slot("ARRIVAL_NOTICE", "Arrival Notice", DocumentType.OTHER, LegDocumentRequirement.REQUIRED,
          "Carrier/terminal arrival notice — needed before the container can be picked up"),
        slot("DELIVERY_ORDER", "Delivery Order", DocumentType.OTHER, LegDocumentRequirement.REQUIRED,
          "Delivery order authorising terminal gate-out"),
        slot("CBP_RELEASE", "CBP Release / Entry Summary", DocumentType.ENTRY_SUMMARY, LegDocumentRequirement.REQUIRED,
          "CBP release (7501 / entry) — cargo cannot move inland until customs releases"),
      );
      if (isFinalLeg) {
        slots.push(slot("POD", "Proof of Delivery", DocumentType.PROOF_OF_DELIVERY, LegDocumentRequirement.OPTIONAL,
          "Signed proof of delivery from the consignee"));
      }
      break;

    case LegType.ON_CARRIAGE:
      slots.push(slot("CARTAGE_ORDER", "Dispatch / Cartage Order", DocumentType.OTHER, LegDocumentRequirement.REQUIRED,
        "Dispatch or cartage order for the inland connecting move"));
      if (isFinalLeg) {
        slots.push(slot("POD", "Proof of Delivery", DocumentType.PROOF_OF_DELIVERY, LegDocumentRequirement.OPTIONAL,
          "Signed proof of delivery from the consignee"));
      }
      break;
  }

  return { legType, mode, slots };
}

/**
 * Best-effort match of an uploaded document to a checklist slot on a leg.
 * Returns the slotKey it fills, or null when nothing matches (caller then
 * creates an OPTIONAL ad-hoc slot).
 */
export function matchDocumentToSlot(
  doc: { docType?: string | null; documentType?: string | null; fileName?: string | null },
  slots: LegChecklistSlot[]
): string | null {
  const hay = `${doc.docType ?? ""} ${doc.fileName ?? ""}`.toLowerCase();
  const dt = doc.documentType ?? null;

  const byKeyword: Array<[RegExp, string]> = [
    [/booking/, "BOOKING_CONFIRMATION"],
    [/shipping instruction|forwarding instruction|dispatch/, "SHIPPING_INSTRUCTIONS"],
    [/packing/, "PACKING_LIST"],
    [/arrival notice|arrival-notice/, "ARRIVAL_NOTICE"],
    [/delivery order/, "DELIVERY_ORDER"],
    [/dangerous goods|hazmat|imo dec/, "DG_DECLARATION"],
    [/fumigat|ispm/, "FUMIGATION_CERT"],
    [/proof of delivery|\bpod\b/, "POD"],
    [/cartage/, "CARTAGE_ORDER"],
  ];
  for (const [re, key] of byKeyword) {
    if (re.test(hay) && slots.some((s) => s.slotKey === key)) return key;
  }

  const byType: Partial<Record<string, string[]>> = {
    BILL_OF_LADING: ["MBL"],
    AIR_WAYBILL: ["MAWB"],
    ISF: ["ISF_10_2"],
    CERTIFICATE_OF_ORIGIN: ["CERT_OF_ORIGIN"],
    ENTRY_SUMMARY: ["CBP_RELEASE"],
    PACKING_LIST: ["PACKING_LIST"],
    PROOF_OF_DELIVERY: ["POD"],
    FUMIGATION_CERTIFICATE: ["FUMIGATION_CERT"],
  };
  if (dt && byType[dt]) {
    for (const key of byType[dt]!) {
      if (slots.some((s) => s.slotKey === key)) return key;
    }
  }
  return null;
}
