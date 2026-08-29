import { inferShipmentLegs, inferLegRequiredDocuments, generateDiffProposal } from "../packages/shipment-legs/src";
import { DocumentType, LegMode, LegType } from "@prisma/client";

async function main() {
  console.log("🧪 Running Chunk 2 Leg Inference Engine Unit Tests...");

  const sampleShipment = {
    id: "shp-123",
    shipmentNumber: "SHP-TEST-001",
    transportMode: "Ocean",
    countryOfExport: "CN",
    destinationCountry: "US",
    portOfEntry: "2704",
  };

  const sampleDocs = [
    {
      id: "doc-1",
      docType: "House Bill of Lading",
      documentType: DocumentType.BILL_OF_LADING,
      fileName: "HBL_123.pdf",
    },
    {
      id: "doc-2",
      docType: "Master Bill of Lading",
      documentType: DocumentType.BILL_OF_LADING,
      fileName: "MBL_COSCO.pdf",
      extractedJson: JSON.stringify({ routing: "via Busan transshipment" }),
    },
    {
      id: "doc-3",
      docType: "Arrival Notice",
      documentType: DocumentType.OTHER,
      fileName: "Arrival_Notice_LA.pdf",
    },
  ];

  const sampleIdentifiers = [
    { type: "MBL", value: "COSU123456" },
    { type: "BOOKING", value: "BKG-789" },
  ];

  // 1. Test leg structure inference
  const inference = inferShipmentLegs(sampleShipment, sampleDocs, sampleIdentifiers);
  console.log(`  Inferred ${inference.legs.length} legs with overall confidence ${inference.overallConfidence}`);

  if (inference.legs.length !== 4) {
    throw new Error(`❌ Expected 4 legs (Export, Main, Transshipment, Import), got ${inference.legs.length}`);
  }

  const [leg1, leg2, leg3, leg4] = inference.legs;

  if (leg1.legType !== LegType.EXPORT_HAULAGE) throw new Error("Leg 1 type mismatch");
  if (leg2.legType !== LegType.MAIN_CARRIAGE) throw new Error("Leg 2 type mismatch");
  if (leg3.legType !== LegType.TRANSSHIPMENT) throw new Error("Leg 3 type mismatch");
  if (leg4.legType !== LegType.IMPORT_HAULAGE) throw new Error("Leg 4 type mismatch");

  console.log("  ✅ Leg structure inference verified.");

  // 2. Test document checklist inference
  const oceanChecklist = inferLegRequiredDocuments(LegType.MAIN_CARRIAGE, LegMode.OCEAN, { isUsImport: true, hasPreferenceClaim: true });
  console.log(`  Main Carriage Ocean Checklist slots: ${oceanChecklist.slots.length}`);

  const hasISF = oceanChecklist.slots.some((s) => s.expectedDocType === DocumentType.ISF);
  const hasMBL = oceanChecklist.slots.some((s) => s.expectedDocType === DocumentType.BILL_OF_LADING);
  const hasCOO = oceanChecklist.slots.some((s) => s.expectedDocType === DocumentType.CERTIFICATE_OF_ORIGIN);

  if (!hasISF || !hasMBL || !hasCOO) {
    throw new Error("❌ Missing required document slot in ocean checklist!");
  }
  console.log("  ✅ Document checklist rules verified.");

  // 3. Test diff proposal generation
  const proposal = generateDiffProposal("shp-123", 0, inference.legs, inference.overallConfidence);
  console.log(`  Diff proposal generated with ${proposal.changes.length} proposed changes.`);

  if (proposal.changes.length !== 4) {
    throw new Error("❌ Proposal changes length mismatch!");
  }
  console.log("  ✅ Diff proposal generator verified.");

  console.log("✅ Chunk 2 Inference Engine Tests PASSED 100%!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
