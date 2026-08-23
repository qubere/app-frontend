import { db } from "@qubere/db";
import {
  extractFreightDocument,
  parseStoredFreightExtraction,
} from "../../documents/services/documentFreightExtraction";
import {
  asState,
  createAgentDecision,
  loadJob,
  type StepResult,
} from "../shared/pipelineShared";

export async function runDocumentIntake(
  job: Awaited<ReturnType<typeof loadJob>>,
  documentId: string
): Promise<StepResult> {
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

function toPrismaDocType(docType: string): any {
  if (docType === "BOOKING_REQUEST" || docType === "BOOKING_CONFIRMATION") return "BILL_OF_LADING";
  if (["BILL_OF_LADING", "AIR_WAYBILL", "COMMERCIAL_INVOICE", "PACKING_LIST", "PROOF_OF_DELIVERY", "CARRIER_INVOICE"].includes(docType)) {
    return docType;
  }
  return "OTHER";
}

  const extraction = result.extraction;
  const confidencePct = extraction.confidence <= 1.0 ? Math.round(extraction.confidence * 100) : Math.round(extraction.confidence);
  const needsReview = confidencePct < 80 || extraction.warnings.length > 0;
  const prismaDocType = toPrismaDocType(extraction.documentType);
  await db.shipmentDocument.update({
    where: { id: document.id },
    data: {
      docType: prismaDocType,
      documentType: prismaDocType,
      documentTypeConfidence: confidencePct / 100,
      confidence: confidencePct,
      status: needsReview ? "Review Required" : "Processed",
      extractedJson: JSON.stringify(extraction),
    },
  });
  const summary = `Classified ${document.fileName} as ${extraction.documentType.replaceAll("_", " ")} and extracted ${extraction.evidence.length} evidenced freight fields at ${confidencePct}% confidence.`;
  const decision = await createAgentDecision({
    accountId: job.accountId,
    shipmentId: job.shipmentId,
    documentId,
    agentName: "Document Intake Agent",
    summary,
    confidence: confidencePct,
    needsReview,
    purpose: "Classify and extract operational freight facts from the uploaded document.",
    sources: [document.fileName, result.model],
    evidence: { fields: extraction.evidence, warnings: extraction.warnings },
  });
  let parsedRawMetadata: Record<string, any> = {};
  if (extraction.rawMetadataJson) {
    try {
      parsedRawMetadata = JSON.parse(extraction.rawMetadataJson);
    } catch {
      parsedRawMetadata = {};
    }
  }

  return {
    status: needsReview ? "REVIEW_REQUIRED" : "SUCCESS",
    summary,
    confidence: confidencePct,
    decisionId: decision.id,
    details: {
      documentType: extraction.documentType,
      confidence: confidencePct,
      shipperName: extraction.shipperName,
      consigneeName: extraction.consigneeName,
      carrierName: extraction.carrierName,
      bookingNumber: extraction.bookingNumber,
      masterBillNumber: extraction.masterBillNumber,
      mode: extraction.mode,
      originName: extraction.originName,
      originCountry: extraction.originCountry,
      originUnlocode: extraction.originUnlocode,
      destinationName: extraction.destinationName,
      destinationCountry: extraction.destinationCountry,
      destinationUnlocode: extraction.destinationUnlocode,
      containerNumbers: extraction.containerNumbers,
      incoterm: extraction.incoterm,
      ...parsedRawMetadata,
      warningCount: extraction.warnings.length,
      warnings: extraction.warnings,
    },
  };
}
