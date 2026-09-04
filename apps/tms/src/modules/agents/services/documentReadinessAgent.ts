import { db } from "@qubere/db";
import {
  buildStepMemory,
  createAgentDecision,
  loadJob,
  memoryLineage,
  trustedMemories,
  type StepResult,
} from "../shared/pipelineShared";

function canonicalDocType(value: string) {
  return value.toUpperCase().replaceAll(" ", "_");
}

export async function runDocumentReadiness(
  job: Awaited<ReturnType<typeof loadJob>>,
  documentId: string
): Promise<StepResult> {
  if (!job) throw new Error("Pipeline job not found.");
  const shipment = await db.shipment.findFirst({
    where: { id: job.shipmentId, accountId: job.accountId },
    include: { documents: true, transportationOrders: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!shipment) throw new Error("Shipment not found.");
  const order = shipment.transportationOrders[0];
  const accountMemory = await buildStepMemory({
    accountId: job.accountId,
    task: "FREIGHT_INTAKE",
    shipment: shipment as unknown as Record<string, unknown>,
    order: order as unknown as Record<string, unknown> | undefined,
    queryParts: [shipment.transportMode, shipment.importerName, shipment.countryOfExport, shipment.destinationCountry, "required freight documents"],
  });
  const customsRequired = order?.customsRequired ?? true;
  const required = shipment.transportMode === "AIR" ? ["AIR_WAYBILL", "PACKING_LIST"] : ["BILL_OF_LADING", "PACKING_LIST"];
  if (customsRequired) required.push("COMMERCIAL_INVOICE");
  for (const memory of trustedMemories(accountMemory)) {
    const remembered = Array.isArray(memory.scope?.requiredDocuments) ? memory.scope.requiredDocuments : [];
    for (const docType of remembered.map(canonicalDocType)) {
      if (/^[A-Z0-9_]{2,80}$/.test(docType) && !required.includes(docType)) required.push(docType);
    }
  }
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
    sources: shipment.documents.map((doc) => doc.fileName),
    evidence: {
      required,
      present: [...present],
      missing,
      memoryRetrievalStatus: accountMemory.retrievalStatus,
      memories: memoryLineage(accountMemory),
    },
  });
  return {
    status: missing.length ? "REVIEW_REQUIRED" : "SUCCESS",
    summary,
    confidence: 100,
    decisionId: decision.id,
    details: { required, missing, memoryRetrievalStatus: accountMemory.retrievalStatus, memories: memoryLineage(accountMemory) },
  };
}
