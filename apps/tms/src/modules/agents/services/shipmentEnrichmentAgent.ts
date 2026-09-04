import { db } from "@qubere/db";
import {
  parseStoredFreightExtraction,
  type TmsDocumentExtraction,
} from "../../documents/services/documentFreightExtraction";
import {
  cleanString,
  createAgentDecision,
  loadJob,
  parseDate,
  type StepResult,
} from "../shared/pipelineShared";

function shipmentPatch(shipment: Record<string, unknown>, extraction: TmsDocumentExtraction) {
  const patch: Record<string, unknown> = {};
  const setIfMissing = (field: string, value: unknown) => {
    const current = shipment[field];
    const isMissing = current == null || current === "" || current === "-" || current === "Not provided";
    if (isMissing && value != null && value !== "" && value !== "-") patch[field] = value;
  };
  const setExtracted = (field: string, value: unknown) => {
    if (value != null && value !== "" && value !== "-") patch[field] = value;
  };
  setIfMissing("poReference", cleanString(extraction.poReference || extraction.customerReference));
  setIfMissing("importerName", cleanString(extraction.consigneeName));
  setIfMissing("incoterm", cleanString(extraction.incoterm));
  setIfMissing("carrierName", cleanString(extraction.carrierName));
  setExtracted("transportMode", cleanString(extraction.mode));
  setExtracted("countryOfExport", cleanString(extraction.originCountry || extraction.originName));
  setExtracted("destinationCountry", cleanString(extraction.destinationCountry || extraction.destinationName));
  setExtracted("portOfEntry", cleanString(extraction.destinationUnlocode || extraction.destinationName));
  setIfMissing("estimatedArrival", parseDate(extraction.estimatedArrival));
  setIfMissing("customerPromiseDate", parseDate(extraction.customerPromiseDate));
  setIfMissing("lastFreeDay", parseDate(extraction.lastFreeDay));
  return patch;
}

async function upsertExtractedReferences(job: NonNullable<Awaited<ReturnType<typeof loadJob>>>, extraction: TmsDocumentExtraction) {
  const identifiers: Array<{ type: "MBL" | "HBL" | "BOOKING" | "MAWB" | "HAWB" | "PRO" | "CONTAINER"; value: string | null }> = [
    { type: "MBL", value: cleanString(extraction.masterBillNumber) },
    { type: "HBL", value: cleanString(extraction.houseBillNumber) },
    { type: "BOOKING", value: cleanString(extraction.bookingNumber) },
    { type: extraction.mode === "AIR" ? "MAWB" : "HAWB", value: cleanString(extraction.airWaybillNumber) },
    { type: "PRO", value: cleanString(extraction.proNumber) },
    ...extraction.containerNumbers.map((value) => ({ type: "CONTAINER" as const, value: cleanString(value) })),
  ];
  for (const identifier of identifiers.filter((item) => item.value)) {
    await db.shipmentTrackingIdentifier.upsert({
      where: {
        shipmentId_type_value_issuer: {
          shipmentId: job.shipmentId,
          type: identifier.type,
          value: identifier.value as string,
          issuer: extraction.carrierCode || "DOCUMENT",
        },
      },
      update: {},
      create: {
        accountId: job.accountId,
        shipmentId: job.shipmentId,
        type: identifier.type,
        value: identifier.value as string,
        issuer: extraction.carrierCode || "DOCUMENT",
        isPrimary: identifier.type !== "CONTAINER",
      },
    });
  }
  for (let index = 0; index < extraction.containerNumbers.length; index++) {
    const containerNumber = cleanString(extraction.containerNumbers[index]);
    if (!containerNumber) continue;
    await db.shipmentEquipment.upsert({
      where: { shipmentId_containerNumber: { shipmentId: job.shipmentId, containerNumber } },
      update: { type: extraction.equipmentTypes[index] || extraction.equipmentTypes[0] || "CONTAINER" },
      create: {
        accountId: job.accountId,
        shipmentId: job.shipmentId,
        containerNumber,
        type: extraction.equipmentTypes[index] || extraction.equipmentTypes[0] || "CONTAINER",
      },
    });
  }
}

export async function runShipmentEnrichment(
  job: Awaited<ReturnType<typeof loadJob>>,
  documentId: string
): Promise<StepResult> {
  if (!job) throw new Error("Pipeline job not found.");
  const [document, shipment] = await Promise.all([
    db.shipmentDocument.findFirst({ where: { id: documentId, accountId: job.accountId, shipmentId: job.shipmentId } }),
    db.shipment.findFirst({ where: { id: job.shipmentId, accountId: job.accountId, deletedAt: null } }),
  ]);
  if (!document || !shipment) throw new Error("Pipeline shipment or source document is unavailable.");
  const extraction = parseStoredFreightExtraction(document.extractedJson);
  if (!extraction) {
    const summary = "Shipment enrichment is waiting for a validated document extraction.";
    const decision = await createAgentDecision({
      accountId: job.accountId, shipmentId: job.shipmentId, documentId,
      agentName: "Shipment Enrichment Agent", summary, confidence: null, needsReview: true,
      purpose: "Promote evidenced document facts into the shipment's operational record.",
      sources: [document.fileName], blockedReason: "WAITING_FOR_EXTRACTION",
    });
    return { status: "REVIEW_REQUIRED", summary, confidence: null, decisionId: decision.id };
  }

  const patch = shipmentPatch(shipment as unknown as Record<string, unknown>, extraction);
  if (Object.keys(patch).length > 0) await db.shipment.update({ where: { id: shipment.id }, data: patch });
  await upsertExtractedReferences(job, extraction);

  const externalReference = `document:${document.id}`;
  const orderData = {
    customerReference: extraction.customerReference,
    poReferences: extraction.poReference ? [extraction.poReference] : undefined,
    requestedBy: extraction.shipperName,
    commodityDescription: extraction.commodityDescription,
    cargoSummary: extraction.commodityDescription,
    totalWeight: extraction.totalWeight,
    totalVolume: extraction.totalVolume,
    packageInfo: extraction.packageCount == null ? undefined : { packageCount: extraction.packageCount },
    equipmentRequirements: extraction.equipmentTypes.length ? extraction.equipmentTypes : undefined,
    specialRequirements:
      extraction.hazmat == null && !extraction.temperatureRequirement
        ? undefined
        : { hazmat: extraction.hazmat, temperatureRequirement: extraction.temperatureRequirement },
    incoterm: extraction.incoterm,
    origin: { name: extraction.originName, country: extraction.originCountry, unlocode: extraction.originUnlocode },
    destination: { name: extraction.destinationName, country: extraction.destinationCountry, unlocode: extraction.destinationUnlocode },
    mode: extraction.mode,
    serviceLevel: extraction.serviceLevel,
    confidence: extraction.confidence,
    status: extraction.confidence >= 80 ? "UNDERSTOOD" : "NEEDS_REVIEW",
  };
  const existingOrder = await db.transportationOrder.findFirst({ where: { accountId: job.accountId, externalReference } });
  if (existingOrder) await db.transportationOrder.update({ where: { id: existingOrder.id }, data: orderData });
  else {
    await db.transportationOrder.create({
      data: {
        accountId: job.accountId,
        shipmentId: job.shipmentId,
        source: "DOCUMENT",
        externalReference,
        createdByUserId: job.userId,
        ...orderData,
      },
    });
  }

  const updatedFields = Object.keys(patch);
  const summary = updatedFields.length
    ? `Promoted ${updatedFields.length} evidenced field(s) to the shipment and synchronized references, equipment, and cargo details.`
    : "No shipment fields were overwritten; existing operator-entered values remain authoritative. Extracted cargo details were retained on the transportation order.";
  const decision = await createAgentDecision({
    accountId: job.accountId, shipmentId: job.shipmentId, documentId,
    agentName: "Shipment Enrichment Agent", summary, confidence: Math.round(extraction.confidence), needsReview: false,
    purpose: "Promote evidenced document facts without overwriting operator-entered shipment data.",
    sources: [document.fileName, "Shipment", "TransportationOrder"],
    evidence: { updatedFields, protectedExistingFields: Object.keys(patch).length === 0 },
  });
  return { status: "SUCCESS", summary, confidence: Math.round(extraction.confidence), decisionId: decision.id, details: { updatedFields } };
}
