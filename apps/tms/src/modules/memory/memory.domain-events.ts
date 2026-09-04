import { db } from "@qubere/db";
import type {
  TmsAgentTask,
  TmsMemoryCandidate,
  TmsMemoryDomainEvent,
  TmsMemoryScope,
  TmsMemorySubjectType,
} from "./memory.types";

function endpointLabel(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const endpoint = value as Record<string, unknown>;
  return [endpoint.unlocode, endpoint.city, endpoint.state, endpoint.country]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join("/") || undefined;
}

export function buildLaneKey(input: {
  mode?: string | null;
  equipment?: string | null;
  origin?: unknown;
  destination?: unknown;
}): string | undefined {
  const origin = endpointLabel(input.origin);
  const destination = endpointLabel(input.destination);
  if (!origin && !destination) return undefined;
  return [input.mode?.toUpperCase() ?? "ANY", input.equipment ?? "ANY", origin ?? "ANY", destination ?? "ANY"].join("|");
}

function taskForAgent(agentName: string): TmsAgentTask {
  if (/Intake/i.test(agentName)) return "FREIGHT_INTAKE";
  if (/Movement/i.test(agentName)) return "MOVEMENT_PLANNING";
  if (/CarrierRecommendation|Carrier Selection/i.test(agentName)) return "CARRIER_SELECTION";
  if (/Rate|Quote/i.test(agentName)) return "RATE_QUOTING";
  if (/Tender/i.test(agentName)) return "TENDER_DISPATCH";
  if (/Tracking|ETA/i.test(agentName)) return "ETA_PREDICTION";
  if (/Risk/i.test(agentName)) return "RISK_DETECTION";
  if (/Exception/i.test(agentName)) return "EXCEPTION_RESOLUTION";
  if (/Audit/i.test(agentName)) return "FREIGHT_AUDIT";
  return "EXCEPTION_RESOLUTION";
}

export async function candidateFromDomainEvent(event: TmsMemoryDomainEvent): Promise<TmsMemoryCandidate | null> {
  if (event.kind === "DECISION_REVIEWED") return candidateFromDecision(event);
  if (event.kind === "EXCEPTION_RESOLVED") return candidateFromException(event.accountId, event.exceptionId);
  if (event.kind === "TENDER_OUTCOME_RECORDED") return candidateFromTender(event.accountId, event.tenderId);
  return candidateFromInvoiceAudit(event.accountId, event.carrierInvoiceId, event.decisionId);
}

async function candidateFromDecision(event: Extract<TmsMemoryDomainEvent, { kind: "DECISION_REVIEWED" }>): Promise<TmsMemoryCandidate | null> {
  const decision = await db.agentDecision.findFirst({
    where: { id: event.decisionId, accountId: event.accountId },
  });
  if (!decision) return null;

  const [order, quote, tender, shipment, invoice] = await Promise.all([
    db.transportationOrder.findFirst({ where: { accountId: event.accountId, agentDecisionId: decision.id } }),
    db.freightQuote.findFirst({ where: { accountId: event.accountId, agentDecisionId: decision.id } }),
    db.tender.findFirst({ where: { accountId: event.accountId, agentDecisionId: decision.id }, include: { carrier: true, freightQuote: true } }),
    decision.shipmentId ? db.shipment.findFirst({ where: { accountId: event.accountId, id: decision.shipmentId }, include: { client: true } }) : null,
    decision.shipmentId ? db.carrierInvoice.findFirst({ where: { accountId: event.accountId, shipmentId: decision.shipmentId }, orderBy: { createdAt: "desc" }, include: { carrier: true } }) : null,
  ]);

  const task = taskForAgent(decision.agentName);
  const selectedQuote = quote ?? tender?.freightQuote ?? null;
  const carrierId = selectedQuote?.carrierId ?? tender?.carrierId ?? invoice?.carrierId ?? undefined;
  const carrierName = selectedQuote?.carrierName ?? tender?.carrier?.legalName ?? invoice?.carrier?.legalName ?? undefined;
  const origin = selectedQuote?.laneOrigin ?? order?.origin ?? order?.originAddress;
  const destination = selectedQuote?.laneDestination ?? order?.destination ?? order?.destinationAddress;
  const equipment = selectedQuote?.equipment ?? ((order?.equipmentRequirements as string[] | null)?.[0]) ?? undefined;
  const mode = selectedQuote?.mode ?? order?.mode ?? shipment?.transportMode ?? undefined;
  const laneKey = buildLaneKey({ mode, equipment, origin, destination });
  const evidence = Array.isArray(decision.evidenceItems)
    ? decision.evidenceItems as Array<Record<string, unknown>>
    : [];
  const targetMargin = evidence?.find((item) => item.field === "targetMarginPct")?.extractedValue;
  const targetMarginPct = typeof targetMargin === "string" ? Number.parseFloat(targetMargin) : undefined;

  let subjectType: TmsMemorySubjectType = decision.shipmentId ? "SHIPMENT" : "CUSTOMER";
  let subjectId: string | null = decision.shipmentId ?? order?.clientId ?? null;
  if (task === "CARRIER_SELECTION" || task === "TENDER_DISPATCH") {
    subjectType = "CARRIER";
    subjectId = carrierId ?? decision.id;
  } else if (task === "RATE_QUOTING") {
    subjectType = "LANE";
    subjectId = laneKey ?? order?.clientId ?? decision.id;
  } else if (task === "FREIGHT_AUDIT") {
    subjectType = "INVOICE";
    subjectId = invoice?.id ?? decision.id;
  } else if (task === "FREIGHT_INTAKE") {
    subjectType = order?.clientId ? "CUSTOMER" : "LANE";
    subjectId = order?.clientId ?? laneKey ?? decision.id;
  } else if (task === "ETA_PREDICTION") {
    subjectType = "ETA";
    subjectId = laneKey ?? decision.shipmentId ?? decision.id;
  } else if (task === "MOVEMENT_PLANNING") {
    subjectType = "LANE";
    subjectId = laneKey ?? decision.shipmentId ?? decision.id;
  }

  const outcome = event.action === "approve" ? "APPROVED" : "REJECTED";
  const scope: TmsMemoryScope = {
    shipmentId: decision.shipmentId ?? undefined,
    transportationOrderId: order?.id,
    quoteId: selectedQuote?.id,
    tenderId: tender?.id,
    invoiceId: invoice?.id,
    customerId: order?.clientId ?? shipment?.clientId ?? undefined,
    customerName: shipment?.client?.name ?? undefined,
    carrierId,
    carrierName,
    laneKey,
    origin: endpointLabel(origin),
    destination: endpointLabel(destination),
    mode: mode ?? undefined,
    equipment,
    serviceLevel: order?.serviceLevel ?? undefined,
    incoterm: order?.incoterm ?? undefined,
    customsRequired: order?.customsRequired ?? undefined,
    targetMarginPct: Number.isFinite(targetMarginPct) ? targetMarginPct : undefined,
    outcome,
    ruleKey: `${task}:${subjectId ?? "account"}`,
  };

  return {
    accountId: event.accountId,
    task,
    agentName: decision.agentName,
    type: event.action === "approve" ? "PREFERENCE" : "EXCEPTION",
    subjectType,
    subjectId,
    content: `Account ${outcome.toLowerCase()} ${decision.agentName} recommendation: ${decision.decisionSummary}${event.note ? ` Operator note: ${event.note}` : ""}`,
    confidence: 1,
    sourceType: "HUMAN_DECISION",
    sourceId: event.eventId,
    evidenceExcerpt: event.note || decision.decisionSummary,
    scope,
  };
}

async function candidateFromException(accountId: string, exceptionId: string): Promise<TmsMemoryCandidate | null> {
  const exception = await db.exceptionItem.findFirst({ where: { id: exceptionId, accountId } });
  if (!exception?.resolutionNote) return null;
  const invoiceRelated = /invoice|billing|accessorial|detention|demurrage/i.test(`${exception.type} ${exception.category}`);
  return {
    accountId,
    task: "EXCEPTION_RESOLUTION",
    agentName: exception.sourceAgent ?? "Human Operations",
    type: "PROCEDURE",
    subjectType: invoiceRelated ? "ACCESSORIAL" : "TRACKING",
    subjectId: exception.type,
    content: `Account resolved ${exception.type} with: ${exception.resolutionNote}`,
    confidence: 1,
    sourceType: "HUMAN_DECISION",
    sourceId: `${exception.id}:${exception.resolvedAt?.toISOString() ?? "resolved"}`,
    evidenceExcerpt: exception.resolutionNote,
    scope: {
      shipmentId: exception.shipmentId ?? undefined,
      exceptionId: exception.id,
      exceptionType: exception.type,
      outcome: "RESOLVED",
      ruleKey: `EXCEPTION_RESOLUTION:${exception.type}`,
    },
    observedAt: exception.resolvedAt?.toISOString(),
  };
}

async function candidateFromTender(accountId: string, tenderId: string): Promise<TmsMemoryCandidate | null> {
  const tender = await db.tender.findFirst({
    where: { id: tenderId, accountId },
    include: { carrier: true, freightQuote: true },
  });
  if (!tender || !["ACCEPTED", "REJECTED", "EXPIRED"].includes(tender.status)) return null;
  const quote = tender.freightQuote;
  const laneKey = buildLaneKey({ mode: quote?.mode, equipment: quote?.equipment, origin: quote?.laneOrigin, destination: quote?.laneDestination });
  return {
    accountId,
    task: "TENDER_DISPATCH",
    agentName: "Tender Dispatch Agent",
    type: "PATTERN",
    subjectType: "CARRIER",
    subjectId: tender.carrierId ?? tender.id,
    content: `Carrier ${tender.carrier?.legalName ?? tender.carrierId ?? "unknown"} ${tender.status.toLowerCase()} a ${quote?.mode ?? "freight"} tender${laneKey ? ` on ${laneKey}` : ""}.`,
    confidence: 0.95,
    sourceType: "TENDER_OUTCOME",
    sourceId: tender.id,
    evidenceExcerpt: `Tender ${tender.id} status ${tender.status}`,
    scope: {
      shipmentId: tender.shipmentId ?? undefined,
      quoteId: tender.freightQuoteId ?? undefined,
      tenderId: tender.id,
      carrierId: tender.carrierId ?? undefined,
      carrierName: tender.carrier?.legalName,
      laneKey,
      mode: quote?.mode ?? undefined,
      equipment: quote?.equipment ?? undefined,
      outcome: tender.status as "ACCEPTED" | "REJECTED" | "EXPIRED",
    },
    observedAt: tender.respondedAt?.toISOString() ?? tender.updatedAt.toISOString(),
  };
}

async function candidateFromInvoiceAudit(accountId: string, carrierInvoiceId: string, decisionId: string): Promise<TmsMemoryCandidate | null> {
  const invoice = await db.carrierInvoice.findFirst({
    where: { id: carrierInvoiceId, accountId },
    include: { carrier: true, lines: true },
  });
  if (!invoice || !["MATCHED", "DISPUTED", "EXCEPTION"].includes(invoice.matchStatus)) return null;
  const outcome = invoice.matchStatus === "MATCHED" ? "APPROVED" : "DISPUTED";
  const chargeCodes = invoice.lines.map((line) => line.chargeType).join(", ");
  return {
    accountId,
    task: "FREIGHT_AUDIT",
    agentName: "Freight Audit Agent",
    type: invoice.matchStatus === "MATCHED" ? "FACT" : "EXCEPTION",
    subjectType: invoice.carrierId ? "CARRIER" : "INVOICE",
    subjectId: invoice.carrierId ?? invoice.id,
    content: `Carrier invoice ${invoice.invoiceNumber ?? invoice.id} was ${invoice.matchStatus.toLowerCase()}${chargeCodes ? ` for charges ${chargeCodes}` : ""}.`,
    confidence: 0.95,
    sourceType: "INVOICE_AUDIT",
    sourceId: decisionId,
    evidenceExcerpt: `Invoice ${invoice.id}; status ${invoice.matchStatus}; total ${invoice.totalAmount} ${invoice.currency}`,
    scope: {
      shipmentId: invoice.shipmentId,
      invoiceId: invoice.id,
      carrierId: invoice.carrierId ?? undefined,
      carrierName: invoice.carrier?.legalName,
      chargeCode: chargeCodes || undefined,
      outcome,
    },
  };
}
