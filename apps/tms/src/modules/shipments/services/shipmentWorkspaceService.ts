import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";
import { computeShipmentLifecycleStatus } from "./shipmentLifecycleStatus";

export interface JourneyMilestone {
  id: string;
  title: string;
  location: string;
  scheduledTime?: string;
  actualTime?: string;
  status: "COMPLETED" | "ACTIVE" | "UPCOMING" | "DELAYED" | "BLOCKED";
  source?: string;
  notes?: string;
}

export interface RiskDimension {
  key: string;
  label: string;
  status: "Healthy" | "At Risk" | "Critical" | "Cleared" | "Complete" | "On Promise" | "Unknown" | "Pending";
  value: string;
  cause?: string | null;
  impact?: string | null;
  explanation?: string;
}

export interface QubereAiActionState {
  needsHumanAction: boolean;
  headline: string;
  actionRequiredTitle?: string;
  reasoning: string;
  recommendedAction?: string;
  alternativeOption?: string;
  costImpactUsd?: number;
  marginBeforePct?: number;
  marginAfterPct?: number;
  customerImpact?: string;
  confidenceScore: number;
  monitoredItems: string[];
  nextAutoActions: string[];
}

export interface ShipmentHealthSnapshot {
  overallHealth: "ON_TRACK" | "AT_RISK" | "ACTION_REQUIRED" | "DELIVERED" | "CRITICAL" | "UNKNOWN";
  healthScore: number;
  eta: string;
  etaConfidence: number;
  customerPromiseDate: string;
  scheduleBufferHours: number | null;
  nextMilestone: {
    title: string;
    location: string;
    scheduledTime: string;
  };
  humanActionRequired: boolean;
  actionRequiredTitle?: string;
  route: {
    origin: string;
    portOfDischarge: string;
    finalDestination: string;
    fullRouteText: string;
    modes: string;
  };
  dimensions: RiskDimension[];
  qubereAi: QubereAiActionState;
}

export async function getShipmentWorkspaceDetails(
  ctx: AccountContext,
  shipmentId: string
) {
  const shipment = await db.shipment.findFirst({
    where: {
      accountId: ctx.accountId,
      id: shipmentId,
    },
    include: {
      client: true,
      importerOfRecord: true,
      assignedBroker: true,
      documents: { orderBy: { createdAt: "desc" } },
      lineItems: true,
      customsFilings: {
        orderBy: { createdAt: "desc" },
        include: { responses: true },
      },
      exceptionItems: { orderBy: { createdAt: "desc" } },
      agentDecisions: { orderBy: { createdAt: "desc" } },
      transportLegs: { orderBy: { sequence: "asc" } },
      legs: {
        orderBy: { sequence: "asc" },
        include: { originStop: { select: { name: true } }, destinationStop: { select: { name: true } } },
      },
      trackingStops: { orderBy: { sequence: "asc" } },
      trackingEvents: { orderBy: { occurredAt: "desc" } },
      trackingIdentifiers: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      trackingEquipment: { orderBy: { createdAt: "asc" } },
      etaObservations: { orderBy: { estimatedAt: "desc" }, take: 1 },
      transportationOrders: { orderBy: { createdAt: "desc" } },
      shipmentMovements: {
        orderBy: { sequence: "asc" },
        include: { movement: { include: { stops: { orderBy: { sequence: "asc" } }, carrierParty: { include: { names: true } } } } },
      },
      transportationEvents: { orderBy: { occurredAt: "desc" }, take: 50 },
      freightQuotes: { orderBy: { createdAt: "desc" } },
      tenders: { orderBy: { createdAt: "desc" } },
      proofOfDeliveries: { orderBy: { createdAt: "desc" } },
      carrierInvoices: { orderBy: { createdAt: "desc" }, include: { lines: true } },
      shipmentCharges: true,
      shipmentCosts: true,
    },
  }).catch(() => null);

  if (!shipment) {
    return null;
  }

  const pipelineJobs = await (db as any).pipelineJob?.findMany({
    where: { accountId: ctx.accountId, shipmentId, workflowType: "TMS_DOCUMENT_PROCESSING" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { stepExecutions: { orderBy: [{ attempt: "desc" }, { stepNumber: "asc" }] } },
  }) ?? [];
  const auditEntityIds = [
    shipment.id,
    ...((shipment as any).documents ?? []).map((document: any) => document.id),
    ...pipelineJobs.map((job: any) => job.id),
  ];
  const auditLogs = await (db as any).auditLog?.findMany({
    where: { accountId: ctx.accountId, entityId: { in: auditEntityIds } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  }) ?? [];

  const journey = computeMultimodalJourney(shipment);
  const crossDomainRisks = evaluateCrossDomainRisks(shipment);
  const healthSnapshot = computeShipmentHealthSnapshot(shipment);
  const lifecycleStatus = computeShipmentLifecycleStatus(shipment);

  // Use Decimal-safe number conversion, fall back to cached Shipment fields
  const sellAmount =
    (shipment as any).shipmentCharges?.reduce(
      (acc: number, c: any) => acc + Number(c.netAmount ?? c.grossAmount ?? 0),
      0
    ) ?? Number(shipment.sellAmount ?? 0);

  const costAmount =
    (shipment as any).shipmentCosts?.reduce(
      (acc: number, c: any) => acc + Number(c.amount ?? 0),
      0
    ) ?? Number(shipment.expectedBuyCost ?? 0);

  const grossProfit = sellAmount - costAmount;
  const grossMarginPct = sellAmount > 0 ? (grossProfit / sellAmount) * 100 : 0;
  const markupOnCostPct = costAmount > 0 ? (grossProfit / costAmount) * 100 : 0;

  const workspace = {
    shipment: { ...shipment, pipelineJobs, auditLogs },
    journey,
    crossDomainRisks,
    healthSnapshot,
    lifecycleStatus,
    financials: {
      totalSellAmount: sellAmount,
      totalBuyAmount: costAmount,
      grossProfit,
      margin: grossProfit,
      grossMarginPct: Number(grossMarginPct.toFixed(2)),
      markupOnCostPct: Number(markupOnCostPct.toFixed(2)),
      currency: (shipment as any).invoiceCurrency ?? "USD",
    },
  };

  return JSON.parse(JSON.stringify(workspace));
}

export function computeShipmentHealthSnapshot(shipment: any): ShipmentHealthSnapshot {
  const latestFiling = shipment.customsFilings?.[0];
  const isCustomsReleased =
    latestFiling?.filingStatus === "RELEASED" ||
    latestFiling?.filingStatus === "ACCEPTED" ||
    latestFiling?.filingStatus === "Released";
  const hasCustomsHold =
    latestFiling?.filingStatus === "CustomsHold" ||
    latestFiling?.filingStatus === "HOLD" ||
    shipment.exceptionItems?.some((e: any) => e.type === "CUSTOMS_HOLD");
  const openExceptions =
    shipment.exceptionItems?.filter(
      (e: any) => e.status === "Open" || e.status === "OPEN"
    ) ?? [];

  // ---------------------------------------------------------------------------
  // ETA — use latest EtaObservation, fall back to Shipment.estimatedArrival
  // ---------------------------------------------------------------------------
  const latestEtaObs = shipment.etaObservations?.[0];
  const etaDate: Date | null = latestEtaObs?.eta ?? shipment.estimatedArrival ?? null;
  const etaConfidence: number = latestEtaObs?.confidence ?? 0;
  const etaStr = etaDate
    ? etaDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " • " +
      etaDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "ETA unknown";

  // ---------------------------------------------------------------------------
  // Customer promise & buffer
  // ---------------------------------------------------------------------------
  const promiseDate: Date | null = shipment.customerPromiseDate ?? null;
  const promiseDateStr = promiseDate
    ? promiseDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " • " +
      promiseDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "No promise date";

  const bufferHours =
    etaDate && promiseDate
      ? (promiseDate.getTime() - etaDate.getTime()) / (1000 * 60 * 60)
      : null;

  const promiseState: string = shipment.promiseState ?? "UNKNOWN";
  const isDelayDetected =
    promiseState === "AT_RISK" || promiseState === "MISSED" || openExceptions.length > 0;
  const needsAction = isDelayDetected || hasCustomsHold;

  // ---------------------------------------------------------------------------
  // Route text — use real DB fields
  // ---------------------------------------------------------------------------
  const latestOrder = shipment.transportationOrders?.[0];
  const orderOrigin = latestOrder?.origin && typeof latestOrder.origin === "object" ? latestOrder.origin : {};
  const orderDestination = latestOrder?.destination && typeof latestOrder.destination === "object" ? latestOrder.destination : {};
  const origin: string = shipment.countryOfExport ?? orderOrigin.unlocode ?? orderOrigin.name ?? "Origin not provided";
  const portOfDischarge: string = shipment.portOfEntry ?? orderDestination.unlocode ?? orderDestination.name ?? "Destination port not provided";
  const finalDestination: string =
    shipment.destinationCountry ?? shipment.destination ?? portOfDischarge;

  // ---------------------------------------------------------------------------
  // Financials — use cached Shipment columns (set by financialLedgerService)
  // ---------------------------------------------------------------------------
  const grossMarginPct = shipment.grossMarginPct != null ? Number(shipment.grossMarginPct) : null;
  const costVariancePct = shipment.costVariancePct != null ? Number(shipment.costVariancePct) : null;

  // Documents
  const totalDocs = shipment.documents?.length ?? 0;
  const verifiedDocs =
    shipment.documents?.filter(
      (d: any) => d.status === "VERIFIED" || d.status === "Verified"
    ).length ?? 0;

  // Carrier info from tracking data
  const latestTrackingEvent = shipment.trackingEvents?.[0];
  const carrierName = shipment.carrierName ?? shipment.transportLegs?.find((leg: any) => leg.carrierName)?.carrierName ?? null;

  // ---------------------------------------------------------------------------
  // Risk dimensions — derived from real data
  // ---------------------------------------------------------------------------
  const dimensions: RiskDimension[] = [
    {
      key: "schedule",
      label: "Schedule",
      status: promiseState === "MISSED" ? "Critical" : promiseState === "AT_RISK" || openExceptions.length > 0 ? "At Risk" : promiseState === "UNKNOWN" ? "Unknown" : "Healthy",
      value:
        bufferHours != null
          ? bufferHours < 0
            ? `ETA slipped ${Math.abs(bufferHours).toFixed(1)}h past promise`
            : `${bufferHours.toFixed(1)}h ahead of customer promise`
          : etaStr,
      cause: openExceptions.some((e: any) => e.type === "PORT_DELAY") ? "Vessel arrival delay" : undefined,
      explanation:
        promiseState === "MISSED"
          ? "ETA has passed customer promise date — rescheduling required"
          : promiseState === "AT_RISK"
            ? "Schedule buffer is below threshold"
            : promiseState === "UNKNOWN" ? "ETA and customer promise are required before schedule health can be evaluated" : "Shipment on schedule",
    },
    {
      key: "cost",
      label: "Cost",
      status:
        costVariancePct != null && Math.abs(costVariancePct) > 5
          ? "At Risk"
          : grossMarginPct != null && grossMarginPct < 10
            ? "At Risk"
            : grossMarginPct == null && costVariancePct == null ? "Unknown" : "Healthy",
      value:
        grossMarginPct != null
          ? `Gross margin ${grossMarginPct.toFixed(1)}%`
          : "Financials not yet computed",
      explanation:
        costVariancePct != null && costVariancePct > 0
          ? `Cost variance +${costVariancePct.toFixed(1)}% vs expected`
          : "Within financial budget",
    },
    {
      key: "carrier",
      label: "Carrier",
      status: carrierName ? "Healthy" : "Unknown",
      value: carrierName ?? "Carrier not assigned",
      explanation: carrierName ? "No active carrier service exceptions" : "Carrier service health cannot be evaluated yet",
    },
    {
      key: "customs",
      label: "Customs",
      status: hasCustomsHold ? "Critical" : isCustomsReleased ? "Cleared" : latestFiling ? "Pending" : "Unknown",
      value: isCustomsReleased
        ? "Customs Released"
        : hasCustomsHold
          ? "Customs Hold — Action Required"
          : latestFiling
            ? "Entry Submitted"
            : "No filing yet",
      explanation: isCustomsReleased
        ? "CBP Entry released"
        : hasCustomsHold
          ? "CBP hold active — drayage blocked"
          : "Awaiting customs clearance",
    },
    {
      key: "documents",
      label: "Documents",
      status: totalDocs === 0 ? "Unknown" : verifiedDocs === totalDocs ? "Complete" : "Pending",
      value: totalDocs > 0 ? `${verifiedDocs}/${totalDocs} Verified` : "No documents uploaded",
      explanation:
        verifiedDocs < totalDocs
          ? `${totalDocs - verifiedDocs} document(s) pending verification`
          : "All documents verified",
    },
    {
      key: "delivery",
      label: "Delivery",
      status: hasCustomsHold ? "Critical" : shipment.status === "Completed" ? "Complete" : "Pending",
      value: shipment.status === "Completed" ? "Delivered" : isCustomsReleased ? "Eligible for delivery planning" : "Awaiting delivery prerequisites",
      explanation: isCustomsReleased
        ? "Customs is no longer a delivery blocker; carrier confirmation is still required"
        : "Delivery execution has not been confirmed",
    },
    {
      key: "customerCommitment",
      label: "Customer",
      status:
        promiseState === "MISSED"
          ? "Critical"
          : promiseState === "AT_RISK"
            ? "At Risk"
            : promiseState === "UNKNOWN" ? "Unknown" : "On Promise",
      value:
        bufferHours != null
          ? bufferHours < 0
            ? `Promise missed by ${Math.abs(bufferHours).toFixed(1)}h`
            : `${bufferHours.toFixed(1)}h buffer remaining`
          : promiseDateStr,
      explanation:
        promiseState === "MISSED"
          ? "ETA is past the customer promise date"
          : promiseState === "AT_RISK"
            ? "Buffer below threshold — notify customer"
            : "On track to meet customer promise",
    },
  ];

  // Qubere AI state — reflect pending agent decisions needing review
  const pendingDecision = shipment.agentDecisions?.find(
    (d: any) => d.triageState === "NEEDS_REVIEW" || d.status === "Review Required"
  );

  const qubereAi: QubereAiActionState = pendingDecision
    ? {
        needsHumanAction: true,
        headline: "QUBERE NEEDS YOU",
        actionRequiredTitle: pendingDecision.decisionSummary ?? "Agent decision requires your review.",
        reasoning: pendingDecision.purpose ?? pendingDecision.decisionSummary ?? "",
        recommendedAction: pendingDecision.proposedDescription ?? undefined,
        confidenceScore: pendingDecision.confidence ?? 0,
        monitoredItems: pendingDecision.dataSources ?? [],
        nextAutoActions: ["Approve or reject the pending decision to unblock the agent workflow"],
      }
    : {
        needsHumanAction: false,
        headline: needsAction ? "QUBERE — Monitoring active exceptions." : latestTrackingEvent ? "QUBERE — Monitoring current shipment signals." : "QUBERE — Waiting for operational signals.",
        reasoning:
          openExceptions.length > 0
            ? `${openExceptions.length} open exception(s) under review. Monitoring for resolution.`
            : latestTrackingEvent ? "No active exception is present in the current recorded signals." : "Tracking and ETA data have not been connected yet.",
        confidenceScore: etaConfidence,
        monitoredItems: latestTrackingEvent ? ["Latest tracking event", "Customer promise", "Last Free Day", "Customs status"] : [],
        nextAutoActions: latestTrackingEvent ? ["Re-evaluate risk when the next tracking event arrives"] : ["Connect a tracking reference or provider"],
      };

  const aiSummary = {
    headline: qubereAi.headline,
    reasoning: qubereAi.reasoning,
    recommendedAction: openExceptions.some((e: any) => e.type === "PORT_DELAY")
      ? "Reschedule delivery appointment"
      : (qubereAi.recommendedAction ?? "Monitor shipment progress"),
    customerImpact: openExceptions.some((e: any) => e.type === "PORT_DELAY") ? "+1 day" : "On Schedule",
    confidenceScore: qubereAi.confidenceScore,
  };

  const overallHealth: ShipmentHealthSnapshot["overallHealth"] = (() => {
    if (shipment.status === "Completed") return "DELIVERED";
    if (hasCustomsHold) return "CRITICAL";
    if (promiseState === "MISSED") return "CRITICAL";
    if (shipment.status === "At Risk" || promiseState === "AT_RISK" || openExceptions.length > 0) return "AT_RISK";
    if (needsAction) return "ACTION_REQUIRED";
    if (!shipment.healthStatus && !etaDate && !latestTrackingEvent) return "UNKNOWN";
    return "ON_TRACK";
  })();

  const healthScore =
    overallHealth === "DELIVERED"
      ? 100
      : overallHealth === "CRITICAL"
        ? 30
        : overallHealth === "ACTION_REQUIRED"
          ? 55
          : overallHealth === "AT_RISK"
            ? 78
            : overallHealth === "UNKNOWN" ? 0 : shipment.healthStatus === "Healthy" ? 95 : 0;

  // Next upcoming milestone from transport legs
  const nextLeg = shipment.transportLegs?.find((l: any) => !l.actualArrival);
  const nextMilestone = nextLeg
    ? {
        title: `${nextLeg.mode ?? "Transport"} arrival`,
        location: nextLeg.destinationName ?? nextLeg.destinationUnlocode ?? "Destination not provided",
        scheduledTime: (nextLeg.estimatedArrival ?? nextLeg.plannedArrival)
          ? new Date(nextLeg.estimatedArrival ?? nextLeg.plannedArrival).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }) +
            " • " +
            new Date(nextLeg.estimatedArrival ?? nextLeg.plannedArrival).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })
          : "TBD",
      }
    : {
        title: "Delivery",
        location: finalDestination,
        scheduledTime: etaStr,
      };

  return {
    overallHealth,
    healthScore,
    eta: etaStr,
    etaConfidence,
    customerPromiseDate: promiseDateStr,
    scheduleBufferHours: bufferHours,
    nextMilestone,
    humanActionRequired: needsAction,
    actionRequiredTitle: pendingDecision?.decisionSummary ?? (needsAction ? "Exception requires your review" : undefined),
    route: {
      origin,
      portOfDischarge,
      finalDestination,
      fullRouteText: `${origin} → ${portOfDischarge} → ${finalDestination}`,
      modes: shipment.transportMode ? String(shipment.transportMode).replace(/_/g, " + ") : latestOrder?.mode ?? "Mode not provided",
    },
    dimensions,
    qubereAi,
    aiSummary,
  } as any;
}

export function computeMultimodalJourney(shipment: any): any[] {
  const latestFiling = shipment.customsFilings?.[0];
  const isCustomsReleased =
    latestFiling?.filingStatus === "RELEASED" ||
    latestFiling?.filingStatus === "ACCEPTED" ||
    latestFiling?.filingStatus === "Released";

  const legs = (shipment.transportLegs ?? []).map((leg: any) => ({
    id: leg.id,
    name: `${leg.mode ?? "Transport"} leg`,
    title: `${leg.mode ?? "Transport"} · ${leg.originName ?? "Origin not provided"} to ${leg.destinationName ?? "Destination not provided"}`,
    location: leg.destinationUnlocode ?? leg.destinationName ?? "Destination not provided",
    scheduledTime: leg.estimatedArrival ?? leg.plannedArrival ?? undefined,
    actualTime: leg.actualArrival ?? undefined,
    status: leg.actualArrival ? "COMPLETED" : leg.status === "DELAYED" ? "DELAYED" : "UPCOMING",
    source: "TransportLeg",
  }));

  const journey = legs.length > 0
    ? legs
    : (shipment.trackingStops ?? []).map((stop: any) => ({
        id: stop.id,
        name: stop.type,
        title: stop.type.replaceAll("_", " "),
        location: stop.unlocode ?? stop.name,
        scheduledTime: stop.estimatedArrival ?? stop.plannedArrival ?? undefined,
        actualTime: stop.actualArrival ?? undefined,
        status: stop.actualArrival ? "COMPLETED" : "UPCOMING",
        source: "ShipmentStop",
      }));

  if (latestFiling) {
    journey.push({
      id: `customs-${latestFiling.id}`,
      name: "Customs Clearance",
      title: "Customs Clearance",
      location: shipment.portOfEntry ?? "Port of entry not provided",
      status: isCustomsReleased ? "COMPLETED" : latestFiling.filingStatus?.toUpperCase().includes("HOLD") ? "BLOCKED" : "UPCOMING",
      source: "CustomsFiling",
    });
  }
  if (shipment.status === "Completed") {
    journey.push({
      id: "shipment-delivered",
      name: "Final Delivery",
      title: "Final Delivery",
      location: shipment.destinationCountry ?? "Destination not provided",
      status: "COMPLETED",
      source: "Shipment",
    });
  }
  return journey;
}

export const computeShipmentJourney = computeMultimodalJourney;

export function evaluateCrossDomainRisks(shipment: any) {
  const risks: Array<{ code: string; title: string; severity: "CRITICAL" | "WARNING" | "INFO"; description: string }> = [];

  const latestFiling = shipment.customsFilings?.[0];
  const isCustomsReleased = latestFiling?.filingStatus === "RELEASED" || latestFiling?.filingStatus === "ACCEPTED" || latestFiling?.filingStatus === "Released";

  const hasCustomsHold = latestFiling?.filingStatus?.toUpperCase().includes("HOLD") ||
    shipment.exceptionItems?.some((item: any) => item.type === "CUSTOMS_HOLD" && ["Open", "OPEN"].includes(item.status));
  if (latestFiling && !isCustomsReleased && (hasCustomsHold || shipment.arrivalDate || shipment.lastFreeDay)) {
    risks.push({
      code: "CUSTOMS_BLOCKING_DELIVERY",
      title: "Customs Clearance Awaiting Release — Drayage Blocked",
      severity: "CRITICAL",
      description: hasCustomsHold
        ? "A recorded customs hold is blocking downstream delivery execution."
        : "Cargo is approaching or has reached the port while the linked customs filing is not released.",
    });
  }

  const lastFreeDay = shipment.lastFreeDay ?? shipment.complianceDeadlines?.find((c: any) => c.deadlineType === "LAST_FREE_DAY" && c.status === "OPEN")?.dueAt;
  const hoursToLfd = lastFreeDay ? (new Date(lastFreeDay).getTime() - Date.now()) / 3_600_000 : null;
  const hasLfdRisk = hoursToLfd != null && hoursToLfd < 48;
  if (hasLfdRisk) {
    risks.push({
      code: "LAST_FREE_DAY_RISK",
      title: "Last Free Day Risk — Demurrage Exposure",
      severity: hoursToLfd < 12 ? "CRITICAL" : "WARNING",
      description: `Last Free Day is ${hoursToLfd < 0 ? `${Math.abs(hoursToLfd).toFixed(1)} hours overdue` : `${hoursToLfd.toFixed(1)} hours away`}.`,
    });
  }

  return risks;
}
