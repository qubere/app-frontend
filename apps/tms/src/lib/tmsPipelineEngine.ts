import { Prisma } from "@prisma/client";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import {
  extractFreightDocument,
  parseStoredFreightExtraction,
  type TmsDocumentExtraction,
} from "../modules/documents/services/documentFreightExtraction";

export const TMS_WORKFLOW_TYPE = "TMS_DOCUMENT_PROCESSING";
export const TMS_WORKFLOW_VERSION = "tms-document-v1";
export const TMS_PIPELINE_STEPS = [
  { stepNumber: 1, agentName: "Document Intake Agent", surface: "document-intake" },
  { stepNumber: 2, agentName: "Shipment Enrichment Agent", surface: "shipment-enrichment" },
  { stepNumber: 3, agentName: "Document Readiness Agent", surface: "document-readiness" },
  { stepNumber: 4, agentName: "Movement Readiness Agent", surface: "movement-readiness" },
  { stepNumber: 5, agentName: "Cost & Carrier Readiness Agent", surface: "cost-carrier-readiness" },
  { stepNumber: 6, agentName: "Operational Risk Agent", surface: "operational-risk" },
] as const;

const STALL_THRESHOLD_MS = 5 * 60 * 1000;

type StepResult = {
  status: "SUCCESS" | "REVIEW_REQUIRED";
  summary: string;
  confidence: number | null;
  decisionId: string;
  details?: Record<string, unknown>;
};

type JobState = {
  workflowVersion?: string;
  trigger?: string;
  documentId?: string;
  fileName?: string;
  lastCompletedStep?: number;
  lastSummary?: string;
  forceExtraction?: boolean;
};

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function asState(value: Prisma.JsonValue): JobState {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JobState) : {};
}

function cleanString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

async function createAgentDecision(input: {
  accountId: string;
  shipmentId: string;
  documentId: string;
  agentName: string;
  summary: string;
  confidence: number | null;
  needsReview: boolean;
  purpose: string;
  sources: string[];
  evidence?: unknown;
  blockedReason?: string | null;
}) {
  return db.agentDecision.create({
    data: {
      accountId: input.accountId,
      shipmentId: input.shipmentId,
      documentId: input.documentId,
      agentName: input.agentName,
      modelVersion: process.env.TMS_DOCUMENT_MODEL || "gemini-2.5-flash",
      purpose: input.purpose,
      decisionSummary: input.summary,
      status: input.needsReview ? "Review Required" : "Completed",
      triageState: input.needsReview ? "NEEDS_REVIEW" : "COMPLETED",
      blockedReason: input.blockedReason ?? null,
      autoApproved: false,
      confidence: input.confidence,
      dataSources: input.sources,
      regulations: [],
      rulesApplied: [TMS_WORKFLOW_VERSION],
      evidenceItems: input.evidence == null ? undefined : safeJson(input.evidence),
    },
  });
}

async function loadJob(jobId: string) {
  return db.pipelineJob.findUnique({
    where: { id: jobId },
    include: { stepExecutions: { orderBy: [{ attempt: "asc" }, { stepNumber: "asc" }] } },
  });
}

export async function enqueueTmsDocumentPipeline(input: {
  accountId: string;
  userId: string;
  shipmentId: string;
  documentId: string;
  correlationId: string;
  runKey?: string;
  forceExtraction?: boolean;
}) {
  const document = await db.shipmentDocument.findFirst({
    where: {
      id: input.documentId,
      accountId: input.accountId,
      shipmentId: input.shipmentId,
      shipment: { deletedAt: null },
    },
    select: { id: true, fileName: true, checksum: true, updatedAt: true },
  });
  if (!document) throw new Error("The document is not attached to this account's shipment.");

  const triggerVersion = document.checksum || document.updatedAt.toISOString();
  const idempotencyKey = `${TMS_WORKFLOW_VERSION}:${input.shipmentId}:${document.id}:${input.runKey ?? triggerVersion}`;
  const data = {
    accountId: input.accountId,
    userId: input.userId,
    shipmentId: input.shipmentId,
    workflowType: TMS_WORKFLOW_TYPE,
    idempotencyKey,
    correlationId: input.correlationId,
    status: "PENDING",
    currentStep: 0,
    totalSteps: TMS_PIPELINE_STEPS.length,
    priority: 10,
    maxAttempts: 3,
    state: {
      workflowVersion: TMS_WORKFLOW_VERSION,
      trigger: "DOCUMENT_UPLOADED",
      documentId: document.id,
      fileName: document.fileName,
      forceExtraction: input.forceExtraction ?? false,
    },
  };

  let job;
  try {
    job = await db.pipelineJob.create({ data });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    job = await db.pipelineJob.findFirst({ where: { accountId: input.accountId, idempotencyKey } });
    if (!job) throw error;
  }

  await createAuditLog({
    accountId: input.accountId,
    userId: input.userId,
    action: "TMS_PIPELINE_QUEUED",
    entity: "PipelineJob",
    entityId: job.id,
    source: "SYSTEM",
    correlationId: input.correlationId,
    metadata: {
      shipmentId: input.shipmentId,
      documentId: document.id,
      workflowType: TMS_WORKFLOW_TYPE,
      idempotencyKey,
    },
  });
  return job;
}

async function runDocumentIntake(job: Awaited<ReturnType<typeof loadJob>>, documentId: string): Promise<StepResult> {
  if (!job) throw new Error("Pipeline job not found.");
  const document = await db.shipmentDocument.findFirst({
    where: { id: documentId, accountId: job.accountId, shipmentId: job.shipmentId },
  });
  if (!document) throw new Error("Pipeline source document was removed or detached.");

  const storedExtraction = parseStoredFreightExtraction(document.extractedJson);
  if (storedExtraction && !asState(job.state).forceExtraction) {
    const needsReview = storedExtraction.confidence < 80 || storedExtraction.warnings.length > 0;
    const summary = `Reused the validated ${storedExtraction.documentType.replaceAll("_", " ")} extraction already stored for ${document.fileName}.`;
    const decision = await createAgentDecision({
      accountId: job.accountId,
      shipmentId: job.shipmentId,
      documentId,
      agentName: "Document Intake Agent",
      summary,
      confidence: Math.round(storedExtraction.confidence),
      needsReview,
      purpose: "Classify and extract operational freight facts from the uploaded document.",
      sources: [document.fileName, "Stored validated extraction"],
      evidence: { fields: storedExtraction.evidence, warnings: storedExtraction.warnings, reused: true },
    });
    return {
      status: needsReview ? "REVIEW_REQUIRED" : "SUCCESS",
      summary,
      confidence: Math.round(storedExtraction.confidence),
      decisionId: decision.id,
      details: { documentType: storedExtraction.documentType, reused: true },
    };
  }

  const result = await extractFreightDocument({
    fileName: document.fileName,
    fileUrl: document.fileUrl,
    mimeType: document.mimeType,
  });
  if (!result.configured) {
    await db.shipmentDocument.update({
      where: { id: document.id },
      data: { status: "Review Required", confidence: null },
    });
    const decision = await createAgentDecision({
      accountId: job.accountId,
      shipmentId: job.shipmentId,
      documentId,
      agentName: "Document Intake Agent",
      summary: result.blocker,
      confidence: null,
      needsReview: true,
      purpose: "Classify and extract operational freight facts from the uploaded document.",
      sources: [document.fileName],
      blockedReason: "PROVIDER_NOT_CONFIGURED",
    });
    return { status: "REVIEW_REQUIRED", summary: result.blocker, confidence: null, decisionId: decision.id };
  }

  const extraction = result.extraction;
  const needsReview = extraction.confidence < 80 || extraction.warnings.length > 0;
  await db.shipmentDocument.update({
    where: { id: document.id },
    data: {
      docType: extraction.documentType,
      documentType: extraction.documentType,
      documentTypeConfidence: extraction.confidence / 100,
      confidence: Math.round(extraction.confidence),
      status: needsReview ? "Review Required" : "Processed",
      extractedJson: JSON.stringify(extraction),
    },
  });
  const summary = `Classified ${document.fileName} as ${extraction.documentType.replaceAll("_", " ")} and extracted ${extraction.evidence.length} evidenced freight fields at ${Math.round(extraction.confidence)}% confidence.`;
  const decision = await createAgentDecision({
    accountId: job.accountId,
    shipmentId: job.shipmentId,
    documentId,
    agentName: "Document Intake Agent",
    summary,
    confidence: Math.round(extraction.confidence),
    needsReview,
    purpose: "Classify and extract operational freight facts from the uploaded document.",
    sources: [document.fileName, result.model],
    evidence: { fields: extraction.evidence, warnings: extraction.warnings },
  });
  return {
    status: needsReview ? "REVIEW_REQUIRED" : "SUCCESS",
    summary,
    confidence: Math.round(extraction.confidence),
    decisionId: decision.id,
    details: { documentType: extraction.documentType, warningCount: extraction.warnings.length },
  };
}

function shipmentPatch(shipment: Record<string, unknown>, extraction: TmsDocumentExtraction) {
  const patch: Record<string, unknown> = {};
  const setIfMissing = (field: string, value: unknown) => {
    if ((shipment[field] == null || shipment[field] === "") && value != null && value !== "") patch[field] = value;
  };
  setIfMissing("poReference", cleanString(extraction.poReference || extraction.customerReference));
  setIfMissing("importerName", cleanString(extraction.consigneeName));
  setIfMissing("incoterm", cleanString(extraction.incoterm));
  setIfMissing("carrierName", cleanString(extraction.carrierName));
  setIfMissing("transportMode", cleanString(extraction.mode));
  setIfMissing("countryOfExport", cleanString(extraction.originCountry || extraction.originName));
  setIfMissing("destinationCountry", cleanString(extraction.destinationCountry || extraction.destinationName));
  setIfMissing("portOfEntry", cleanString(extraction.destinationUnlocode || extraction.destinationName));
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

async function runShipmentEnrichment(job: Awaited<ReturnType<typeof loadJob>>, documentId: string): Promise<StepResult> {
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

function canonicalDocType(value: string) {
  return value.toUpperCase().replaceAll(" ", "_");
}

async function runDocumentReadiness(job: Awaited<ReturnType<typeof loadJob>>, documentId: string): Promise<StepResult> {
  if (!job) throw new Error("Pipeline job not found.");
  const shipment = await db.shipment.findFirst({
    where: { id: job.shipmentId, accountId: job.accountId },
    include: { documents: true, transportationOrders: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!shipment) throw new Error("Shipment not found.");
  const customsRequired = shipment.transportationOrders[0]?.customsRequired ?? true;
  const required = shipment.transportMode === "AIR" ? ["AIR_WAYBILL", "PACKING_LIST"] : ["BILL_OF_LADING", "PACKING_LIST"];
  if (customsRequired) required.push("COMMERCIAL_INVOICE");
  const present = new Set(shipment.documents.map((doc) => canonicalDocType(doc.docType)));
  const missing = required.filter((type) => !present.has(type));

  for (const type of required) {
    const code = `TMS_MISSING_${type}`;
    const existing = await db.exceptionItem.findFirst({
      where: { accountId: job.accountId, shipmentId: job.shipmentId, code, status: { in: ["Open", "OPEN"] } },
    });
    if (missing.includes(type) && !existing) {
      await db.exceptionItem.create({
        data: {
          accountId: job.accountId,
          shipmentId: job.shipmentId,
          documentId,
          code,
          category: "DOCUMENT",
          type: "TMS_MISSING_DOCUMENT",
          severity: "High",
          description: `${type.replaceAll("_", " ")} is required for this shipment but is not on file.`,
          requiredAction: `Upload or attach the ${type.replaceAll("_", " ").toLowerCase()}.`,
          blocking: true,
          sourceAgent: "Document Readiness Agent",
        },
      });
    } else if (!missing.includes(type) && existing) {
      await db.exceptionItem.update({
        where: { id: existing.id },
        data: { status: "Resolved", resolvedAt: new Date(), resolvedBy: "SYSTEM", resolutionNote: "Required document received." },
      });
    }
  }

  const summary = missing.length
    ? `${required.length - missing.length} of ${required.length} operational documents are present. Missing: ${missing.map((v) => v.replaceAll("_", " ")).join(", ")}.`
    : `All ${required.length} required operational documents are present.`;
  const decision = await createAgentDecision({
    accountId: job.accountId, shipmentId: job.shipmentId, documentId,
    agentName: "Document Readiness Agent", summary,
    confidence: 100, needsReview: missing.length > 0,
    purpose: "Check mode- and customs-dependent operational document completeness.",
    sources: shipment.documents.map((doc) => doc.fileName), evidence: { required, present: [...present], missing },
  });
  return { status: missing.length ? "REVIEW_REQUIRED" : "SUCCESS", summary, confidence: 100, decisionId: decision.id, details: { required, missing } };
}

async function runMovementReadiness(job: Awaited<ReturnType<typeof loadJob>>, documentId: string): Promise<StepResult> {
  if (!job) throw new Error("Pipeline job not found.");
  const shipment = await db.shipment.findFirst({
    where: { id: job.shipmentId, accountId: job.accountId },
    include: {
      transportationOrders: { orderBy: { createdAt: "desc" }, take: 1 },
      shipmentMovements: { include: { movement: { include: { stops: true } } } },
      trackingIdentifiers: true,
      trackingEquipment: true,
    },
  });
  if (!shipment) throw new Error("Shipment not found.");
  const order = shipment.transportationOrders[0];
  const missing: string[] = [];
  if (!shipment.transportMode && !order?.mode) missing.push("transport mode");
  if (!shipment.countryOfExport && !order?.origin) missing.push("origin");
  if (!shipment.destinationCountry && !order?.destination) missing.push("destination");
  if (!order?.equipmentRequirements && shipment.trackingEquipment.length === 0) missing.push("equipment requirement");
  if (shipment.trackingIdentifiers.length === 0) missing.push("carrier tracking reference");
  const hasPlan = shipment.shipmentMovements.length > 0;
  if (!hasPlan) missing.push("movement plan");
  const summary = missing.length
    ? `Movement is not execution-ready. Missing ${missing.join(", ")}. No carrier action was taken.`
    : `${shipment.shipmentMovements.length} movement plan(s) and ${shipment.trackingIdentifiers.length} tracking reference(s) are ready for execution.`;
  const decision = await createAgentDecision({
    accountId: job.accountId, shipmentId: job.shipmentId, documentId,
    agentName: "Movement Readiness Agent", summary, confidence: missing.length ? null : 100, needsReview: missing.length > 0,
    purpose: "Verify that route, equipment, stops, and tracking references are sufficient to execute movement.",
    sources: ["Shipment", "TransportationOrder", "Movement", "TrackingIdentifier"], evidence: { missing, movementCount: shipment.shipmentMovements.length },
  });
  return { status: missing.length ? "REVIEW_REQUIRED" : "SUCCESS", summary, confidence: missing.length ? null : 100, decisionId: decision.id, details: { missing } };
}

async function runCostCarrierReadiness(job: Awaited<ReturnType<typeof loadJob>>, documentId: string): Promise<StepResult> {
  if (!job) throw new Error("Pipeline job not found.");
  const shipment = await db.shipment.findFirst({
    where: { id: job.shipmentId, accountId: job.accountId },
    include: { freightQuotes: { orderBy: { createdAt: "desc" } }, tenders: { orderBy: { createdAt: "desc" } }, shipmentCharges: true, shipmentCosts: true },
  });
  if (!shipment) throw new Error("Shipment not found.");
  const acceptedQuote = shipment.freightQuotes.find((quote) => quote.status === "ACCEPTED");
  const activeTender = shipment.tenders.find((tender) => ["SENT", "ACCEPTED"].includes(tender.status));
  const missing: string[] = [];
  if (!acceptedQuote) missing.push("accepted freight quote");
  if (!activeTender) missing.push("active carrier tender");
  if (shipment.shipmentCosts.length === 0 && shipment.expectedBuyCost == null) missing.push("expected buy cost");
  const summary = missing.length
    ? `Commercial execution is incomplete: ${missing.join(", ")}. No rate or tender was fabricated.`
    : `Accepted quote, carrier tender, and expected cost are present. Gross margin is ${shipment.grossMarginPct == null ? "not yet calculated" : `${Number(shipment.grossMarginPct).toFixed(1)}%`}.`;
  const decision = await createAgentDecision({
    accountId: job.accountId, shipmentId: job.shipmentId, documentId,
    agentName: "Cost & Carrier Readiness Agent", summary, confidence: missing.length ? null : 100, needsReview: missing.length > 0,
    purpose: "Verify rate, cost, margin, and carrier commitment before execution.",
    sources: ["FreightQuote", "Tender", "ShipmentCost"], evidence: { missing, acceptedQuoteId: acceptedQuote?.id, activeTenderId: activeTender?.id },
  });
  return { status: missing.length ? "REVIEW_REQUIRED" : "SUCCESS", summary, confidence: missing.length ? null : 100, decisionId: decision.id, details: { missing } };
}

async function runOperationalRisk(job: Awaited<ReturnType<typeof loadJob>>, documentId: string): Promise<StepResult> {
  if (!job) throw new Error("Pipeline job not found.");
  const shipment = await db.shipment.findFirst({
    where: { id: job.shipmentId, accountId: job.accountId },
    include: { trackingEvents: { orderBy: { receivedAt: "desc" }, take: 1 }, exceptionItems: { where: { status: { in: ["Open", "OPEN"] } } }, customsFilings: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!shipment) throw new Error("Shipment not found.");
  const latestTracking = shipment.trackingEvents[0];
  const trackingAgeHours = latestTracking ? (Date.now() - latestTracking.receivedAt.getTime()) / 3_600_000 : null;
  const eta = shipment.estimatedArrival;
  const promise = shipment.customerPromiseDate;
  const bufferHours = eta && promise ? (promise.getTime() - eta.getTime()) / 3_600_000 : null;
  const promiseState = bufferHours == null ? null : bufferHours < 0 ? "MISSED" : bufferHours < 4 ? "AT_RISK" : "ON_PROMISE";
  const hoursToLfd = shipment.lastFreeDay ? (shipment.lastFreeDay.getTime() - Date.now()) / 3_600_000 : null;
  const released = shipment.customsFilings[0]?.filingStatus?.toUpperCase() === "RELEASED";
  const riskReasons: string[] = [];
  if (trackingAgeHours == null) riskReasons.push("no tracking signal");
  else if (trackingAgeHours > 24) riskReasons.push(`tracking data is ${Math.round(trackingAgeHours)}h old`);
  if (promiseState === "MISSED") riskReasons.push("customer promise missed");
  else if (promiseState === "AT_RISK") riskReasons.push("customer promise buffer below 4h");
  if (hoursToLfd != null && hoursToLfd < 48 && !released) riskReasons.push("last free day within 48h without customs release");
  if (shipment.exceptionItems.length > 0) riskReasons.push(`${shipment.exceptionItems.length} open exception(s)`);
  const healthStatus = riskReasons.length === 0 ? "Healthy" : promiseState === "MISSED" || (hoursToLfd != null && hoursToLfd < 12) ? "Critical" : "At Risk";
  await db.shipment.update({ where: { id: shipment.id }, data: { promiseState, healthStatus } });
  const summary = riskReasons.length ? `Operational review found: ${riskReasons.join("; ")}.` : "No current schedule, LFD, tracking-freshness, customs, or exception risk was detected.";
  const decision = await createAgentDecision({
    accountId: job.accountId, shipmentId: job.shipmentId, documentId,
    agentName: "Operational Risk Agent", summary, confidence: latestTracking?.confidence == null ? null : Math.round(latestTracking.confidence), needsReview: riskReasons.length > 0,
    purpose: "Evaluate tracking freshness, customer promise, last free day, customs release, and active exceptions.",
    sources: ["TrackingEvent", "Shipment", "CustomsFiling", "ExceptionItem"], evidence: { trackingAgeHours, bufferHours, hoursToLfd, riskReasons },
  });
  return { status: riskReasons.length ? "REVIEW_REQUIRED" : "SUCCESS", summary, confidence: latestTracking?.confidence == null ? null : Math.round(latestTracking.confidence), decisionId: decision.id, details: { riskReasons, healthStatus } };
}

const stepRunners = [runDocumentIntake, runShipmentEnrichment, runDocumentReadiness, runMovementReadiness, runCostCarrierReadiness, runOperationalRisk];

export async function executeTmsPipelineJob(jobId: string) {
  const initial = await loadJob(jobId);
  if (!initial || initial.workflowType !== TMS_WORKFLOW_TYPE) throw new Error("TMS pipeline job not found.");
  if (initial.status === "COMPLETED") return initial;
  if (initial.attemptCount >= initial.maxAttempts) throw new Error("TMS pipeline exhausted its retry budget.");
  if (initial.status === "PROCESSING" && initial.heartbeatAt && Date.now() - initial.heartbeatAt.getTime() <= STALL_THRESHOLD_MS) return initial;
  if (initial.status === "FAILED" && initial.nextRetryAt && initial.nextRetryAt.getTime() > Date.now()) {
    throw new Error(`TMS pipeline retry is scheduled for ${initial.nextRetryAt.toISOString()}.`);
  }

  const claimed = await db.pipelineJob.updateMany({
    where: {
      id: jobId,
      attemptCount: { lt: initial.maxAttempts },
      OR: [
        { status: "PENDING" },
        { status: "FAILED", OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }] },
        { status: "PROCESSING", heartbeatAt: { lt: new Date(Date.now() - STALL_THRESHOLD_MS) } },
      ],
    },
    data: {
      status: "PROCESSING",
      errorMessage: null,
      startedAt: initial.startedAt ?? new Date(),
      completedAt: null,
      lockedAt: new Date(),
      heartbeatAt: new Date(),
      nextRetryAt: null,
      attemptCount: { increment: 1 },
    },
  });
  if (claimed.count !== 1) return loadJob(jobId);

  const job = await loadJob(jobId);
  if (!job) throw new Error("TMS pipeline disappeared after claim.");
  const state = asState(job.state);
  if (!state.documentId) throw new Error("TMS pipeline is missing its document trigger.");
  const completedSteps = new Set(job.stepExecutions.filter((step) => ["SUCCESS", "REVIEW_REQUIRED"].includes(step.status)).map((step) => step.stepNumber));

  await createAuditLog({
    accountId: job.accountId, userId: job.userId, action: "TMS_PIPELINE_STARTED",
    entity: "PipelineJob", entityId: job.id, source: "SYSTEM", correlationId: job.correlationId,
    metadata: { shipmentId: job.shipmentId, documentId: state.documentId, attempt: job.attemptCount },
  });

  try {
    for (let index = 0; index < TMS_PIPELINE_STEPS.length; index++) {
      const definition = TMS_PIPELINE_STEPS[index];
      if (completedSteps.has(definition.stepNumber)) continue;
      await db.pipelineJob.update({ where: { id: job.id }, data: { currentStep: definition.stepNumber, heartbeatAt: new Date(), lockedAt: new Date() } });
      const execution = await db.pipelineStepExecution.create({
        data: { jobId: job.id, stepNumber: definition.stepNumber, agentName: definition.agentName, status: "RUNNING", attempt: job.attemptCount },
      });
      try {
        const result = await stepRunners[index](job, state.documentId);
        await db.pipelineStepExecution.update({
          where: { id: execution.id },
          data: { status: result.status, completedAt: new Date(), output: safeJson({ summary: result.summary, confidence: result.confidence, decisionId: result.decisionId, ...result.details }) },
        });
        await db.pipelineJob.update({
          where: { id: job.id },
          data: {
            heartbeatAt: new Date(),
            state: safeJson({ ...state, lastCompletedStep: definition.stepNumber, lastSummary: result.summary }),
          },
        });
        await createAuditLog({
          accountId: job.accountId, userId: job.userId, action: "TMS_AGENT_STEP_COMPLETED",
          entity: "Shipment", entityId: job.shipmentId, source: "AGENT", correlationId: job.correlationId,
          metadata: { jobId: job.id, documentId: state.documentId, stepNumber: definition.stepNumber, agentName: definition.agentName, status: result.status, summary: result.summary, decisionId: result.decisionId },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.pipelineStepExecution.update({ where: { id: execution.id }, data: { status: "FAILED", completedAt: new Date(), errorMessage: message.slice(0, 2000) } });
        throw error;
      }
    }

    const completed = await db.pipelineJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", currentStep: TMS_PIPELINE_STEPS.length, completedAt: new Date(), lockedAt: null, heartbeatAt: new Date(), errorMessage: null },
      include: { stepExecutions: true },
    });
    await createAuditLog({
      accountId: job.accountId, userId: job.userId, action: "TMS_PIPELINE_COMPLETED",
      entity: "PipelineJob", entityId: job.id, source: "SYSTEM", correlationId: job.correlationId,
      metadata: { shipmentId: job.shipmentId, documentId: state.documentId, attempt: job.attemptCount },
    });
    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retryable = job.attemptCount < job.maxAttempts;
    const nextRetryAt = retryable ? new Date(Date.now() + Math.min(60_000, 5_000 * 2 ** Math.max(0, job.attemptCount - 1))) : null;
    await db.pipelineJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 2000), completedAt: new Date(), lockedAt: null, heartbeatAt: new Date(), nextRetryAt },
    });
    await createAuditLog({
      accountId: job.accountId, userId: job.userId, action: "TMS_PIPELINE_FAILED",
      entity: "PipelineJob", entityId: job.id, source: "SYSTEM", correlationId: job.correlationId, success: false,
      metadata: { shipmentId: job.shipmentId, documentId: state.documentId, attempt: job.attemptCount, retryable, nextRetryAt: nextRetryAt?.toISOString(), error: message },
    });
    throw error;
  }
}

export async function getTmsPipelineStatus(accountId: string, shipmentId: string) {
  const job = await db.pipelineJob.findFirst({
    where: { accountId, shipmentId, workflowType: TMS_WORKFLOW_TYPE },
    orderBy: { createdAt: "desc" },
    include: { stepExecutions: { orderBy: [{ attempt: "desc" }, { stepNumber: "asc" }] } },
  });
  if (!job) return null;
  const latestByStep = new Map<number, (typeof job.stepExecutions)[number]>();
  for (const execution of job.stepExecutions) {
    const current = latestByStep.get(execution.stepNumber);
    if (!current || execution.attempt > current.attempt) latestByStep.set(execution.stepNumber, execution);
  }
  const stalled = job.status === "PROCESSING" && !!job.heartbeatAt && Date.now() - job.heartbeatAt.getTime() > STALL_THRESHOLD_MS;
  return {
    jobId: job.id,
    workflowType: job.workflowType,
    status: job.status,
    currentStep: job.currentStep,
    totalSteps: job.totalSteps,
    progressPercent: job.status === "COMPLETED" ? 100 : Math.round((Math.max(0, job.currentStep - (job.status === "PROCESSING" ? 1 : 0)) / job.totalSteps) * 100),
    activeAgent: job.status === "PROCESSING" ? TMS_PIPELINE_STEPS.find((step) => step.stepNumber === job.currentStep)?.agentName ?? null : null,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    stalled,
    errorMessage: job.errorMessage,
    nextRetryAt: job.nextRetryAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    correlationId: job.correlationId,
    steps: TMS_PIPELINE_STEPS.map((definition) => {
      const execution = latestByStep.get(definition.stepNumber);
      return {
        ...definition,
        status: execution?.status ?? "PENDING",
        attempt: execution?.attempt ?? null,
        startedAt: execution?.startedAt ?? null,
        completedAt: execution?.completedAt ?? null,
        errorMessage: execution?.errorMessage ?? null,
        output: execution?.output ?? null,
      };
    }),
  };
}

export async function retryTmsPipeline(accountId: string, shipmentId: string, userId: string) {
  const job = await db.pipelineJob.findFirst({
    where: { accountId, shipmentId, workflowType: TMS_WORKFLOW_TYPE },
    orderBy: { createdAt: "desc" },
  });
  if (!job) throw new Error("No TMS pipeline run exists for this shipment.");
  const stalled = job.status === "PROCESSING" && !!job.heartbeatAt && Date.now() - job.heartbeatAt.getTime() > STALL_THRESHOLD_MS;
  if (job.status !== "FAILED" && !stalled) throw new Error(`The latest TMS pipeline is ${job.status} and cannot be retried.`);
  if (job.attemptCount >= job.maxAttempts) throw new Error("The TMS pipeline exhausted its retry budget.");
  await db.pipelineJob.update({ where: { id: job.id }, data: { status: "PENDING", errorMessage: null, nextRetryAt: null, lockedAt: null, heartbeatAt: null, completedAt: null } });
  await createAuditLog({
    accountId, userId, action: "TMS_PIPELINE_RETRY_REQUESTED", entity: "PipelineJob", entityId: job.id, source: "UI",
    correlationId: job.correlationId, metadata: { shipmentId, previousStatus: job.status, stalled },
  });
  return job.id;
}
