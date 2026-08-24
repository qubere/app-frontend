import { Prisma } from "@prisma/client";
import { db } from "@qubere/db";
import { TmsAccountContextBuilder } from "../../memory/memory.context-builder";
import { buildLaneKey } from "../../memory/memory.domain-events";
import type {
  ScoredTmsMemory,
  TmsAccountMemoryContext,
  TmsAgentTask,
  TmsMemoryScope,
} from "../../memory/memory.types";

export const TMS_WORKFLOW_TYPE = "TMS_DOCUMENT_PROCESSING";
export const TMS_WORKFLOW_VERSION = "tms-document-v1";
export const TMS_PIPELINE_OUTBOX_EVENT = "tms.pipeline.requested";
export const TMS_PIPELINE_STEPS = [
  { stepNumber: 1, agentName: "Document Intake Agent", surface: "document-intake" },
  { stepNumber: 2, agentName: "Shipment Enrichment Agent", surface: "shipment-enrichment" },
  { stepNumber: 3, agentName: "Document Readiness Agent", surface: "document-readiness" },
  { stepNumber: 4, agentName: "Movement Readiness Agent", surface: "movement-readiness" },
  { stepNumber: 5, agentName: "Cost & Carrier Readiness Agent", surface: "cost-carrier-readiness" },
  { stepNumber: 6, agentName: "Operational Risk Agent", surface: "operational-risk" },
] as const;

export const STALL_THRESHOLD_MS = 5 * 60 * 1000;
export const PENDING_STALL_THRESHOLD_MS = 2 * 60 * 1000;

export type StepResult = {
  status: "SUCCESS" | "REVIEW_REQUIRED";
  summary: string;
  confidence: number | null;
  decisionId: string;
  details?: Record<string, unknown>;
};

export type JobState = {
  workflowVersion?: string;
  trigger?: string;
  documentId?: string;
  fileName?: string;
  lastCompletedStep?: number;
  lastSummary?: string;
  forceExtraction?: boolean;
};

export function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export function asState(value: Prisma.JsonValue): JobState {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JobState) : {};
}

export function cleanString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export const AUTHORITATIVE_MEMORY_SOURCES = new Set(["HUMAN_DECISION", "CUSTOMER_INSTRUCTION"]);

export function memoryScopeForShipment(shipment: Record<string, unknown>, order?: Record<string, unknown> | null): TmsMemoryScope {
  const mode = cleanString((shipment.transportMode ?? order?.mode) as string | null | undefined) ?? undefined;
  const equipment = Array.isArray(order?.equipmentRequirements)
    ? cleanString(order.equipmentRequirements[0] as string | undefined) ?? undefined
    : undefined;
  const origin = order?.origin ?? (shipment.countryOfExport ? { country: shipment.countryOfExport } : undefined);
  const destination = order?.destination ?? (shipment.destinationCountry ? { country: shipment.destinationCountry } : undefined);
  return {
    shipmentId: shipment.id as string,
    customerId: cleanString(shipment.clientId as string | null | undefined) ?? undefined,
    customerName: cleanString(shipment.importerName as string | null | undefined) ?? undefined,
    carrierName: cleanString(shipment.carrierName as string | null | undefined) ?? undefined,
    mode,
    equipment,
    origin: cleanString(shipment.countryOfExport as string | null | undefined) ?? undefined,
    destination: cleanString(shipment.destinationCountry as string | null | undefined) ?? undefined,
    laneKey: buildLaneKey({ mode, equipment, origin, destination }),
  };
}

export async function buildStepMemory(input: {
  accountId: string;
  task: TmsAgentTask;
  shipment: Record<string, unknown>;
  order?: Record<string, unknown> | null;
  queryParts: Array<string | null | undefined>;
  limit?: number;
}): Promise<TmsAccountMemoryContext> {
  return TmsAccountContextBuilder.build({
    accountId: input.accountId,
    task: input.task,
    query: input.queryParts.filter(Boolean).join(" "),
    scope: memoryScopeForShipment(input.shipment, input.order),
    limit: input.limit ?? 6,
  });
}

export function trustedMemories(context: TmsAccountMemoryContext): ScoredTmsMemory[] {
  return context.memories.filter((memory) => AUTHORITATIVE_MEMORY_SOURCES.has(memory.sourceType));
}

export function memoryLineage(...contexts: TmsAccountMemoryContext[]) {
  const byId = new Map<string, ReturnType<typeof TmsAccountContextBuilder.summarizeForEvidence>[number]>();
  for (const context of contexts) {
    for (const memory of TmsAccountContextBuilder.summarizeForEvidence(context)) byId.set(memory.memoryId, memory);
  }
  return [...byId.values()];
}

export async function createAgentDecision(input: {
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

export async function loadJob(jobId: string) {
  return db.pipelineJob.findUnique({
    where: { id: jobId },
    include: { stepExecutions: { orderBy: [{ attempt: "asc" }, { stepNumber: "asc" }] } },
  });
}
