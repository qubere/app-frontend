import { DocumentType, LegDocumentRequirement, LegMode, LegType } from "@prisma/client";

export interface LegChecklistSlot {
  expectedDocType: DocumentType;
  requirement: LegDocumentRequirement;
  requirementReason: string;
}

export interface LegDocumentChecklistResult {
  legType: LegType;
  mode: LegMode;
  slots: LegChecklistSlot[];
}

export function inferLegRequiredDocuments(
  legType: LegType,
  mode: LegMode,
  context: {
    isUsImport?: boolean;
    isHazmat?: boolean;
    hasPreferenceClaim?: boolean;
    isFinalLeg?: boolean;
  } = {}
): LegDocumentChecklistResult {
  const slots: LegChecklistSlot[] = [];

  switch (legType) {
    case LegType.EXPORT_HAULAGE:
      slots.push({
        expectedDocType: DocumentType.OTHER,
        requirement: LegDocumentRequirement.REQUIRED,
        requirementReason: "Booking Confirmation / Shipping Instructions",
      });
      slots.push({
        expectedDocType: DocumentType.PACKING_LIST,
        requirement: LegDocumentRequirement.REQUIRED,
        requirementReason: "Container load manifest & packing list",
      });
      if (context.isHazmat) {
        slots.push({
          expectedDocType: DocumentType.OTHER,
          requirement: LegDocumentRequirement.REQUIRED,
          requirementReason: "Dangerous Goods Declaration required for hazmat haulage",
        });
      }
      break;

    case LegType.MAIN_CARRIAGE:
      if (mode === LegMode.AIR) {
        slots.push({
          expectedDocType: DocumentType.AIR_WAYBILL,
          requirement: LegDocumentRequirement.REQUIRED,
          requirementReason: "Master Air Waybill (MAWB)",
        });
      } else {
        slots.push({
          expectedDocType: DocumentType.BILL_OF_LADING,
          requirement: LegDocumentRequirement.REQUIRED,
          requirementReason: "Master Ocean Bill of Lading (MBL)",
        });
        if (context.isUsImport !== false) {
          slots.push({
            expectedDocType: DocumentType.ISF,
            requirement: LegDocumentRequirement.REQUIRED,
            requirementReason: "CBP 24h ISF 10+2 Filing",
          });
        }
      }

      if (context.hasPreferenceClaim) {
        slots.push({
          expectedDocType: DocumentType.CERTIFICATE_OF_ORIGIN,
          requirement: LegDocumentRequirement.REQUIRED,
          requirementReason: "Certificate of Origin for tariff preference claim",
        });
      }
      break;

    case LegType.TRANSSHIPMENT:
      slots.push({
        expectedDocType: DocumentType.BILL_OF_LADING,
        requirement: LegDocumentRequirement.REQUIRED,
        requirementReason: "Shared Master Bill of Lading for transshipment leg",
      });
      break;

    case LegType.IMPORT_HAULAGE:
      slots.push({
        expectedDocType: DocumentType.OTHER,
        requirement: LegDocumentRequirement.REQUIRED,
        requirementReason: "Arrival Notice from carrier/terminal",
      });
      slots.push({
        expectedDocType: DocumentType.OTHER,
        requirement: LegDocumentRequirement.REQUIRED,
        requirementReason: "Delivery Order for terminal pickup",
      });
      slots.push({
        expectedDocType: DocumentType.ENTRY_SUMMARY,
        requirement: LegDocumentRequirement.REQUIRED,
        requirementReason: "CBP Entry Summary (Form 7501) / Customs Release",
      });

      if (context.isFinalLeg) {
        slots.push({
          expectedDocType: DocumentType.PROOF_OF_DELIVERY,
          requirement: LegDocumentRequirement.OPTIONAL,
          requirementReason: "Proof of Delivery (POD) signed by consignee",
        });
      }
      break;

    case LegType.ON_CARRIAGE:
      slots.push({
        expectedDocType: DocumentType.OTHER,
        requirement: LegDocumentRequirement.REQUIRED,
        requirementReason: "Dispatch / Cartage order",
      });
      break;
  }

  return { legType, mode, slots };
}
