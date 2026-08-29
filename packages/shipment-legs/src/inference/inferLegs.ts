import { LegMode, LegType } from "@prisma/client";

export interface DocumentInput {
  id: string;
  docType: string;
  documentType: string | null;
  fileName: string;
  extractedJson?: string | null;
}

export interface ShipmentInput {
  id: string;
  shipmentNumber: string;
  transportMode?: string | null;
  countryOfExport?: string | null;
  countryOfOrigin?: string | null;
  destinationCountry?: string | null;
  portOfEntry?: string | null;
}

export interface InferredLeg {
  sequence: number;
  legType: LegType;
  mode: LegMode;
  originName: string;
  originUnlocode: string | null;
  destinationName: string;
  destinationUnlocode: string | null;
  carrierName: string | null;
  carrierScac: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  billOfLadingNumber: string | null;
  bookingNumber: string | null;
  confidence: number;
  needsConfirmation: boolean;
}

export interface InferenceResult {
  runId: string;
  shipmentId: string;
  legs: InferredLeg[];
  overallConfidence: number;
  hasUnconfirmedChanges: boolean;
}

export function inferShipmentLegs(
  shipment: ShipmentInput,
  documents: DocumentInput[],
  identifiers: { type: string; value: string }[] = []
): InferenceResult {
  const legs: InferredLeg[] = [];
  let seq = 1;

  const mblDoc = documents.find(
    (d) =>
      d.docType.toLowerCase().includes("master") ||
      d.fileName.toLowerCase().includes("mbl") ||
      (d.documentType === "BILL_OF_LADING" && !d.docType.toLowerCase().includes("house"))
  );
  const houseDoc = documents.find(
    (d) => d.docType.toLowerCase().includes("house") || d.fileName.toLowerCase().includes("hbl") || d.docType.toLowerCase().includes("forwarder")
  );
  const arrivalNoticeDoc = documents.find(
    (d) => d.docType.toLowerCase().includes("arrival") || d.fileName.toLowerCase().includes("arrival")
  );
  const deliveryOrderDoc = documents.find(
    (d) => d.docType.toLowerCase().includes("delivery order") || d.fileName.toLowerCase().includes("delivery")
  );

  const mblNumber = identifiers.find((i) => i.type === "MBL")?.value || null;
  const bookingNumber = identifiers.find((i) => i.type === "BOOKING")?.value || null;

  // Rule 1: Export Haulage
  if (houseDoc || shipment.countryOfExport) {
    const origin = shipment.countryOfExport ? `${shipment.countryOfExport} Factory / Shipper Door` : "Shipper Factory Door";
    const dest = shipment.portOfEntry ? `Origin Port (${shipment.countryOfExport || "POL"})` : "Origin Port";
    legs.push({
      sequence: seq++,
      legType: LegType.EXPORT_HAULAGE,
      mode: LegMode.TRUCK,
      originName: origin,
      originUnlocode: null,
      destinationName: dest,
      destinationUnlocode: null,
      carrierName: "Origin Drayage Carrier",
      carrierScac: null,
      vesselName: null,
      voyageNumber: null,
      billOfLadingNumber: null,
      bookingNumber,
      confidence: 0.85,
      needsConfirmation: false,
    });
  }

  // Rule 2: Ocean / Air Main Carriage & Transshipment
  const mode = shipment.transportMode?.toUpperCase().includes("AIR") ? LegMode.AIR : LegMode.OCEAN;

  if (mblDoc) {
    // Check if transshipment detected in document extractions
    const hasTransshipment = mblDoc.extractedJson?.includes("transshipment") || mblDoc.extractedJson?.includes("via");

    if (hasTransshipment) {
      legs.push({
        sequence: seq++,
        legType: LegType.MAIN_CARRIAGE,
        mode,
        originName: "Origin Port",
        originUnlocode: null,
        destinationName: "Transshipment Hub",
        destinationUnlocode: null,
        carrierName: "Ocean Carrier",
        carrierScac: null,
        vesselName: "Main Vessel A",
        voyageNumber: "V.01E",
        billOfLadingNumber: mblNumber,
        bookingNumber,
        confidence: 0.9,
        needsConfirmation: false,
      });

      legs.push({
        sequence: seq++,
        legType: LegType.TRANSSHIPMENT,
        mode,
        originName: "Transshipment Hub",
        originUnlocode: null,
        destinationName: shipment.portOfEntry ? `Port of Entry (${shipment.portOfEntry})` : "Destination Port",
        destinationUnlocode: shipment.portOfEntry || null,
        carrierName: "Ocean Carrier",
        carrierScac: null,
        vesselName: "Connecting Vessel B",
        voyageNumber: "V.02E",
        billOfLadingNumber: mblNumber,
        bookingNumber,
        confidence: 0.88,
        needsConfirmation: false,
      });
    } else {
      legs.push({
        sequence: seq++,
        legType: LegType.MAIN_CARRIAGE,
        mode,
        originName: "Origin Port",
        originUnlocode: null,
        destinationName: shipment.portOfEntry ? `Port of Entry (${shipment.portOfEntry})` : "Destination Port",
        destinationUnlocode: shipment.portOfEntry || null,
        carrierName: "Main Carrier",
        carrierScac: null,
        vesselName: "Main Conveyance",
        voyageNumber: "V.100",
        billOfLadingNumber: mblNumber,
        bookingNumber,
        confidence: 0.95,
        needsConfirmation: false,
      });
    }
  } else {
    // Fallback main carriage
    legs.push({
      sequence: seq++,
      legType: LegType.MAIN_CARRIAGE,
      mode,
      originName: "Origin Terminal",
      originUnlocode: null,
      destinationName: shipment.portOfEntry ? `Port of Entry (${shipment.portOfEntry})` : "Destination Terminal",
      destinationUnlocode: shipment.portOfEntry || null,
      carrierName: null,
      carrierScac: null,
      vesselName: null,
      voyageNumber: null,
      billOfLadingNumber: mblNumber,
      bookingNumber,
      confidence: 0.5,
      needsConfirmation: true,
    });
  }

  // Rule 3: Import Haulage
  if (arrivalNoticeDoc || deliveryOrderDoc || shipment.destinationCountry) {
    const dest = shipment.destinationCountry ? `${shipment.destinationCountry} Consignee DC / Door` : "Importer DC";
    legs.push({
      sequence: seq++,
      legType: LegType.IMPORT_HAULAGE,
      mode: LegMode.TRUCK,
      originName: legs[legs.length - 1].destinationName,
      originUnlocode: legs[legs.length - 1].destinationUnlocode,
      destinationName: dest,
      destinationUnlocode: null,
      carrierName: "Import Drayage Carrier",
      carrierScac: null,
      vesselName: null,
      voyageNumber: null,
      billOfLadingNumber: null,
      bookingNumber: null,
      confidence: arrivalNoticeDoc || deliveryOrderDoc ? 0.88 : 0.65,
      needsConfirmation: !arrivalNoticeDoc && !deliveryOrderDoc,
    });
  }

  const avgConfidence = legs.reduce((acc, l) => acc + l.confidence, 0) / (legs.length || 1);

  return {
    runId: `run-${Date.now()}`,
    shipmentId: shipment.id,
    legs,
    overallConfidence: Math.round(avgConfidence * 100) / 100,
    hasUnconfirmedChanges: legs.some((l) => l.needsConfirmation),
  };
}
