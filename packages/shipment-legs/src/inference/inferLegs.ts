import { createHash } from "node:crypto";
import { LegMode, LegType } from "@prisma/client";

export interface DocumentInput {
  id: string;
  docType: string;
  documentType: string | null;
  fileName: string;
  extractedJson?: string | null;
}

export interface IdentifierInput {
  type: string;
  value: string;
}

export interface ShipmentInput {
  id: string;
  shipmentNumber: string;
  transportMode?: string | null;
  countryOfExport?: string | null;
  countryOfOrigin?: string | null;
  destinationCountry?: string | null;
  portOfEntry?: string | null;
  incoterm?: string | null;
}

export interface InferredLeg {
  sequence: number;
  legType: LegType;
  mode: LegMode;
  originName: string;
  originUnlocode: string | null;
  originRole: string;
  destinationName: string;
  destinationUnlocode: string | null;
  destinationRole: string;
  carrierName: string | null;
  carrierScac: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  billOfLadingNumber: string | null;
  billOfLadingType: string | null;
  bookingNumber: string | null;
  confidence: number;
  needsConfirmation: boolean;
  /** Which document(s) drove this leg — for provenance display. */
  evidenceDocIds: string[];
}

export interface InferenceResult {
  inputsHash: string;
  shipmentId: string;
  legs: InferredLeg[];
  overallConfidence: number;
  hasUnconfirmedChanges: boolean;
}

const AIR_HINT = /air|awb|mawb|flight/i;

function detectMode(shipment: ShipmentInput, documents: DocumentInput[]): LegMode {
  if (shipment.transportMode) {
    const m = shipment.transportMode.toUpperCase();
    if (m.includes("AIR")) return LegMode.AIR;
    if (m.includes("RAIL")) return LegMode.RAIL;
    if (m.includes("OCEAN") || m.includes("SEA")) return LegMode.OCEAN;
  }
  if (documents.some((d) => AIR_HINT.test(`${d.docType} ${d.fileName}`) || d.documentType === "AIR_WAYBILL")) {
    return LegMode.AIR;
  }
  return LegMode.OCEAN;
}

function computeInputsHash(shipment: ShipmentInput, documents: DocumentInput[], identifiers: IdentifierInput[]): string {
  const payload = JSON.stringify({
    s: {
      transportMode: shipment.transportMode ?? null,
      countryOfExport: shipment.countryOfExport ?? null,
      countryOfOrigin: shipment.countryOfOrigin ?? null,
      destinationCountry: shipment.destinationCountry ?? null,
      portOfEntry: shipment.portOfEntry ?? null,
      incoterm: shipment.incoterm ?? null,
    },
    d: documents
      .map((d) => `${d.documentType ?? d.docType}:${d.fileName}`)
      .sort(),
    i: identifiers.map((i) => `${i.type}:${i.value}`).sort(),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

/**
 * Rule-based journey inference. Deterministic: given the same documents /
 * identifiers / shipment fields it always produces the same legs (and the same
 * `inputsHash`, so a re-run is a no-op). Values that cannot be derived from the
 * inputs are left null rather than invented — the broker fills them in on
 * confirmation.
 */
export function inferShipmentLegs(
  shipment: ShipmentInput,
  documents: DocumentInput[],
  identifiers: IdentifierInput[] = []
): InferenceResult {
  const legs: InferredLeg[] = [];
  let seq = 1;

  const findDoc = (re: RegExp) =>
    documents.find((d) => re.test(`${d.docType} ${d.fileName}`));

  const houseDoc =
    findDoc(/house|hbl|hawb|forwarder|cargo receipt/i) ??
    documents.find((d) => /forwarding instruction|shipping instruction|booking/i.test(`${d.docType} ${d.fileName}`));
  const mblDoc =
    documents.find((d) => d.documentType === "BILL_OF_LADING" && !/house/i.test(`${d.docType} ${d.fileName}`)) ??
    findDoc(/master b\/?l|mbl|master bill|master air ?waybill|mawb/i) ??
    documents.find((d) => d.documentType === "AIR_WAYBILL");
  const arrivalNoticeDoc = findDoc(/arrival notice/i);
  const deliveryOrderDoc = findDoc(/delivery order/i);
  const isfDoc = documents.find((d) => d.documentType === "ISF" || /isf|10\+2/i.test(`${d.docType} ${d.fileName}`));

  const id = (t: string) => identifiers.find((i) => i.type === t)?.value ?? null;
  const mblNumber = id("MBL") ?? id("MAWB");
  const hblNumber = id("HBL") ?? id("HAWB");
  const bookingNumber = id("BOOKING");

  const mode = detectMode(shipment, documents);
  const exportCountry = shipment.countryOfExport || shipment.countryOfOrigin || null;
  const poe = shipment.portOfEntry || null;
  const destCountry = shipment.destinationCountry || null;

  const originPortName = exportCountry ? `Origin port (${exportCountry})` : "Origin port";
  const poeName = poe ? `Port of entry ${poe}` : "Destination port";

  // --- Rule 1: Export haulage (shipper door -> origin port) ---------------
  if (houseDoc || exportCountry) {
    legs.push({
      sequence: seq++,
      legType: LegType.EXPORT_HAULAGE,
      mode: LegMode.TRUCK,
      originName: exportCountry ? `Shipper facility (${exportCountry})` : "Shipper facility",
      originUnlocode: null,
      originRole: "ORIGIN",
      destinationName: originPortName,
      destinationUnlocode: null,
      destinationRole: mode === LegMode.AIR ? "AIRPORT" : "PORT_OF_LADING",
      carrierName: null,
      carrierScac: null,
      vesselName: null,
      voyageNumber: null,
      billOfLadingNumber: hblNumber,
      billOfLadingType: hblNumber ? "HOUSE" : null,
      bookingNumber,
      confidence: houseDoc ? 0.82 : 0.55,
      needsConfirmation: !houseDoc,
      evidenceDocIds: houseDoc ? [houseDoc.id] : [],
    });
  }

  // --- Rule 2: Main carriage (+ transshipment if detected) ---------------
  const transshipRe = /transshipment|trans-shipment|\bvia\b|t\/s port|feeder/i;
  const hasTransship =
    !!mblDoc?.extractedJson && transshipRe.test(mblDoc.extractedJson);
  const mainOrigin = legs.length > 0 ? legs[legs.length - 1].destinationName : originPortName;
  const mainOriginRole = mode === LegMode.AIR ? "AIRPORT" : "PORT_OF_LADING";

  if (hasTransship) {
    legs.push({
      sequence: seq++,
      legType: LegType.MAIN_CARRIAGE,
      mode,
      originName: mainOrigin,
      originUnlocode: null,
      originRole: mainOriginRole,
      destinationName: "Transshipment hub",
      destinationUnlocode: null,
      destinationRole: "TRANSSHIPMENT",
      carrierName: null,
      carrierScac: null,
      vesselName: null,
      voyageNumber: null,
      billOfLadingNumber: mblNumber,
      billOfLadingType: mblNumber ? "MASTER" : null,
      bookingNumber,
      confidence: 0.75,
      needsConfirmation: true,
      evidenceDocIds: mblDoc ? [mblDoc.id] : [],
    });
    legs.push({
      sequence: seq++,
      legType: LegType.TRANSSHIPMENT,
      mode,
      originName: "Transshipment hub",
      originUnlocode: null,
      originRole: "TRANSSHIPMENT",
      destinationName: poeName,
      destinationUnlocode: poe,
      destinationRole: mode === LegMode.AIR ? "AIRPORT" : "PORT_OF_DISCHARGE",
      carrierName: null,
      carrierScac: null,
      vesselName: null,
      voyageNumber: null,
      billOfLadingNumber: mblNumber,
      billOfLadingType: mblNumber ? "MASTER" : null,
      bookingNumber,
      confidence: 0.72,
      needsConfirmation: true,
      evidenceDocIds: mblDoc ? [mblDoc.id] : [],
    });
  } else {
    legs.push({
      sequence: seq++,
      legType: LegType.MAIN_CARRIAGE,
      mode,
      originName: mainOrigin,
      originUnlocode: null,
      originRole: mainOriginRole,
      destinationName: poeName,
      destinationUnlocode: poe,
      destinationRole: mode === LegMode.AIR ? "AIRPORT" : "PORT_OF_DISCHARGE",
      carrierName: null,
      carrierScac: null,
      vesselName: null,
      voyageNumber: null,
      billOfLadingNumber: mblNumber,
      billOfLadingType: mblNumber ? "MASTER" : null,
      bookingNumber,
      confidence: mblDoc ? 0.9 : 0.5,
      needsConfirmation: !mblDoc,
      evidenceDocIds: [mblDoc?.id, isfDoc?.id].filter(Boolean) as string[],
    });
  }

  // --- Rule 3: Import haulage (destination port -> consignee door) -------
  if (arrivalNoticeDoc || deliveryOrderDoc || destCountry) {
    const prev = legs[legs.length - 1];
    legs.push({
      sequence: seq++,
      legType: LegType.IMPORT_HAULAGE,
      mode: LegMode.TRUCK,
      originName: prev.destinationName,
      originUnlocode: prev.destinationUnlocode,
      originRole: prev.destinationRole,
      destinationName: destCountry ? `Consignee facility (${destCountry})` : "Consignee facility",
      destinationUnlocode: null,
      destinationRole: "DESTINATION",
      carrierName: null,
      carrierScac: null,
      vesselName: null,
      voyageNumber: null,
      billOfLadingNumber: null,
      billOfLadingType: null,
      bookingNumber: null,
      confidence: arrivalNoticeDoc || deliveryOrderDoc ? 0.8 : 0.5,
      needsConfirmation: !arrivalNoticeDoc && !deliveryOrderDoc,
      evidenceDocIds: [arrivalNoticeDoc?.id, deliveryOrderDoc?.id].filter(Boolean) as string[],
    });
  }

  const overallConfidence =
    legs.length > 0
      ? Math.round((legs.reduce((a, l) => a + l.confidence, 0) / legs.length) * 100) / 100
      : 0;

  return {
    inputsHash: computeInputsHash(shipment, documents, identifiers),
    shipmentId: shipment.id,
    legs,
    overallConfidence,
    hasUnconfirmedChanges: legs.some((l) => l.needsConfirmation),
  };
}
