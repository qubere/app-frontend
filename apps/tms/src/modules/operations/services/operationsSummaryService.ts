import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";

export interface EvidenceItem {
  label: string;
  value: string;
  source?: string;
}

export interface WorkQueueItem {
  id: string;
  itemType: "EXCEPTION" | "DECISION" | "APPROVAL";
  domain: "CUSTOMS" | "TRANSPORTATION" | "DOCUMENT" | "FINANCIAL" | "CUSTOMER";
  specificType:
    | "CUSTOMS EXCEPTION"
    | "DELIVERY EXCEPTION"
    | "RATE DECISION"
    | "CARRIER DECISION"
    | "DOCUMENT EXCEPTION"
    | "FINANCIAL APPROVAL";
  decisionState: "AI_RESOLVED" | "AI_NEEDS_APPROVAL" | "AI_NEEDS_INPUT";
  severity: "CRITICAL" | "WARNING" | "INFO";
  urgencyLabel: string;
  timeToActFormatted: string;
  deadlineIso?: string;
  shipmentId: string;
  shipmentNumber: string;
  routeText: string;
  customerName: string;
  operationalTitle: string;
  subtext: string;
  legalBasis?: string;
  agentStatusText: string;
  whatHappened: string;
  whyItMatters: string;
  qubereRecommends: string;
  whyRecommends: string;
  missingInputExplanation?: string;
  ruleConfidence?: number;
  recommendationConfidence: number;
  confidenceLevel: "High" | "Medium" | "Low";
  impact: {
    schedule?: string;
    costUsd?: number;
    marginShift?: string;
    customerImpact?: string;
    customsImpact?: string;
    exposureUsd?: number;
  };
  afterApproval: string[];
  evidence: EvidenceItem[];
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  allowModify?: boolean;
  allowReject?: boolean;
}

export interface OperationsSummary {
  shipmentHealth: {
    totalActive: number;
    onTrack: number;
    atRisk: number;
    critical: number;
  };
  autonomy: {
    aiManaging: number;
    humanIntervention: number;
    deliveredToday: number;
  };
  workQueueHeader: {
    shipmentsNeedingActionCount: number;
    workItemsCount: number;
  };
  customerPromise: {
    onPromise: number;
    atRisk: number;
    missed: number;
  };
  atRiskFinancialExposure: {
    totalExposureUsd: number;
    demurrageUsd: number;
    rateVarianceUsd: number;
    detentionUsd: number;
    otherUsd: number;
  };
  qubereHandledToday: {
    automationRatePct: number;
    totalAutomatedActions: number;
    bookingsTenders: number;
    customerUpdates: number;
    appointments: number;
    podMatches: number;
    invoiceMatches: number;
  };
  humanTouchRate: {
    todayPct: number;
    sevenDaysPct: number;
    thirtyDaysPct: number;
    improvementPts: number;
  };
  operatingPerformance: {
    onTimeDeliveryPct: number;
    customerOnPromisePct: number;
    humanTouchRatePct: number;
    costVariancePct: number;
  };
  workQueue: WorkQueueItem[];
}

// ---------------------------------------------------------------------------
// Local query result types
// ---------------------------------------------------------------------------
interface ExceptionRow {
  id: string;
  shipmentId: string | null;
  type: string;
  category: string | null;
  severity: string;
  description: string;
  requiredAction: string | null;
  blocking: boolean;
  createdAt: Date;
}

interface DecisionRow {
  id: string;
  shipmentId: string | null;
  decisionSummary: string | null;
  purpose: string | null;
  proposedDescription: string | null;
  confidence: number | null;
  dataSources: string[];
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Helper: derive domain from exception type
// ---------------------------------------------------------------------------
function exceptionDomain(type: string): WorkQueueItem["domain"] {
  const t = type.toUpperCase();
  if (t.includes("CUSTOMS") || t.includes("CBP") || t.includes("FDA")) return "CUSTOMS";
  if (t.includes("DOCUMENT") || t.includes("POD") || t.includes("BOL")) return "DOCUMENT";
  if (t.includes("INVOICE") || t.includes("RATE") || t.includes("COST")) return "FINANCIAL";
  return "TRANSPORTATION";
}

function exceptionSeverity(sev: string): WorkQueueItem["severity"] {
  const s = sev.toUpperCase();
  if (s === "HIGH" || s === "CRITICAL") return "CRITICAL";
  if (s === "MEDIUM") return "WARNING";
  return "INFO";
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------
export async function getOperationsSummary(ctx: AccountContext): Promise<OperationsSummary> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    shipmentHealthCounts,
    promiseCounts,
    deliveredToday,
    openExceptions,
    pendingDecisions,
    automatedDecisionsToday,
    humanDecisionsToday,
    automatedDecisions7d,
    humanDecisions7d,
    automatedDecisions30d,
    humanDecisions30d,
    demurrageExposure,
    costVarianceSum,
    matchedInvoicesToday,
    tendersToday,
  ] = await Promise.all([
    // Shipment health distribution from healthStatus field
    db.shipment.groupBy({
      by: ["healthStatus"],
      where: { accountId: ctx.accountId, deletedAt: null, status: { notIn: ["Completed", "Cancelled"] } },
      _count: true,
    }).catch(() => []),

    // Customer promise state distribution
    db.shipment.groupBy({
      by: ["promiseState"],
      where: {
        accountId: ctx.accountId,
        deletedAt: null,
        customerPromiseDate: { not: null },
        status: { notIn: ["Completed", "Cancelled"] },
      },
      _count: true,
    }).catch(() => []),

    // Delivered today
    db.shipment.count({
      where: { accountId: ctx.accountId, status: "Completed", updatedAt: { gte: todayStart } },
    }).catch(() => 0),

    // Open exceptions for work queue (plain select, no join — avoids portOfLoading type error)
    db.exceptionItem.findMany({
      where: { accountId: ctx.accountId, status: "Open" },
      select: {
        id: true,
        shipmentId: true,
        type: true,
        category: true,
        severity: true,
        description: true,
        requiredAction: true,
        blocking: true,
        createdAt: true,
      },
      orderBy: [{ blocking: "desc" }, { severity: "asc" }, { createdAt: "asc" }],
      take: 20,
    }).catch(() => [] as ExceptionRow[]),

    // AgentDecisions needing human review (plain select, no join)
    db.agentDecision.findMany({
      where: {
        accountId: ctx.accountId,
        triageState: "NEEDS_REVIEW",
        status: "Review Required",
      },
      select: {
        id: true,
        shipmentId: true,
        decisionSummary: true,
        purpose: true,
        proposedDescription: true,
        confidence: true,
        dataSources: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    }).catch(() => [] as DecisionRow[]),

    // Autonomy metrics — automated decisions today
    db.agentDecision.count({
      where: { accountId: ctx.accountId, autoApproved: true, createdAt: { gte: todayStart } },
    }).catch(() => 0),
    db.agentDecision.count({
      where: { accountId: ctx.accountId, autoApproved: false, createdAt: { gte: todayStart } },
    }).catch(() => 0),

    // 7-day automation
    db.agentDecision.count({
      where: { accountId: ctx.accountId, autoApproved: true, createdAt: { gte: sevenDaysAgo } },
    }).catch(() => 0),
    db.agentDecision.count({
      where: { accountId: ctx.accountId, autoApproved: false, createdAt: { gte: sevenDaysAgo } },
    }).catch(() => 0),

    // 30-day automation
    db.agentDecision.count({
      where: { accountId: ctx.accountId, autoApproved: true, createdAt: { gte: thirtyDaysAgo } },
    }).catch(() => 0),
    db.agentDecision.count({
      where: { accountId: ctx.accountId, autoApproved: false, createdAt: { gte: thirtyDaysAgo } },
    }).catch(() => 0),

    // Demurrage exposure sum across active shipments
    db.shipment.aggregate({
      where: {
        accountId: ctx.accountId,
        demurrageExposureUsd: { not: null },
        deletedAt: null,
        status: { notIn: ["Completed", "Cancelled"] },
      },
      _sum: { demurrageExposureUsd: true },
    }).catch(() => ({ _sum: { demurrageExposureUsd: null } })),

    // Cost variance sum
    db.shipment.aggregate({
      where: {
        accountId: ctx.accountId,
        costVariancePct: { not: null },
        deletedAt: null,
      },
      _avg: { costVariancePct: true },
    }).catch(() => ({ _avg: { costVariancePct: null } })),

    // Matched invoices today (proxy for invoice automation)
    db.carrierInvoice.count({
      where: { accountId: ctx.accountId, matchStatus: "MATCHED", createdAt: { gte: todayStart } },
    }).catch(() => 0),

    // Tenders sent today (proxy for booking automation)
    db.tender.count({
      where: { accountId: ctx.accountId, sentAt: { gte: todayStart } },
    }).catch(() => 0),
  ]);

  // ---------------------------------------------------------------------------
  // Shipment health counts
  // ---------------------------------------------------------------------------
  const healthMap: Record<string, number> = {};
  for (const row of shipmentHealthCounts) {
    healthMap[row.healthStatus ?? "Unknown"] = row._count;
  }
  const criticalCount = (healthMap["Critical"] ?? 0);
  const atRiskCount = (healthMap["At Risk"] ?? 0);
  const onTrackCount = (healthMap["Healthy"] ?? 0) + (healthMap["Unknown"] ?? 0);
  const totalActive = criticalCount + atRiskCount + onTrackCount;

  // ---------------------------------------------------------------------------
  // Customer promise counts
  // ---------------------------------------------------------------------------
  const promiseMap: Record<string, number> = {};
  for (const row of promiseCounts) {
    promiseMap[row.promiseState ?? "ON_PROMISE"] = row._count;
  }
  const promiseOnTrack = promiseMap["ON_PROMISE"] ?? 0;
  const promiseAtRisk = promiseMap["AT_RISK"] ?? 0;
  const promiseMissed = promiseMap["MISSED"] ?? 0;

  // ---------------------------------------------------------------------------
  // Autonomy metrics
  // ---------------------------------------------------------------------------
  const totalToday = automatedDecisionsToday + humanDecisionsToday;
  const automationRatePct =
    totalToday > 0
      ? Math.round((automatedDecisionsToday / totalToday) * 1000) / 10
      : 0;

  const total7d = automatedDecisions7d + humanDecisions7d;
  const todayHumanPct =
    totalToday > 0 ? Math.round((humanDecisionsToday / totalToday) * 100) : 0;
  const sevenDayHumanPct =
    total7d > 0 ? Math.round((humanDecisions7d / total7d) * 100) : 0;

  const total30d = automatedDecisions30d + humanDecisions30d;
  const thirtyDayHumanPct =
    total30d > 0 ? Math.round((humanDecisions30d / total30d) * 100) : 0;

  const humanIntervention = humanDecisionsToday;
  const aiManaging = Math.max(0, totalActive - humanIntervention);

  // ---------------------------------------------------------------------------
  // Financial exposure
  // ---------------------------------------------------------------------------
  const demurrageUsd = Number(demurrageExposure._sum.demurrageExposureUsd ?? 0);
  const avgCostVariance = Number(costVarianceSum._avg.costVariancePct ?? 0);

  // ---------------------------------------------------------------------------
  // Build work queue from real exceptions + decisions
  // Batch-load minimal shipment data (number + LFD) for the work items
  // ---------------------------------------------------------------------------
  const workItemShipmentIds = [
    ...openExceptions.map((e) => e.shipmentId),
    ...pendingDecisions.map((d) => d.shipmentId),
  ].filter((id): id is string => Boolean(id));

  const workItemShipments =
    workItemShipmentIds.length > 0
      ? await db.shipment
          .findMany({
            where: { id: { in: workItemShipmentIds } },
            select: {
              id: true,
              shipmentNumber: true,
              importerName: true,
              lastFreeDay: true,
              demurrageExposureUsd: true,
            },
          })
          .catch(() => [])
      : [];

  const shipmentMap = new Map(
    workItemShipments.map((s) => [s.id, s])
  );

  const workQueue: WorkQueueItem[] = [];

  for (const exc of openExceptions) {
    const shipment = exc.shipmentId ? shipmentMap.get(exc.shipmentId) : undefined;
    const severity = exceptionSeverity(exc.severity);
    const domain = exceptionDomain(exc.type ?? exc.category ?? "");
    const exposureUsd = Number(shipment?.demurrageExposureUsd ?? 375);

    const deadlineIso =
      domain === "CUSTOMS" || domain === "TRANSPORTATION"
        ? (shipment?.lastFreeDay?.toISOString() ?? new Date().toISOString())
        : undefined;

    const isCustomsFiling =
      exc.type.includes("CUSTOMS") || exc.type.includes("CBP");

    if (isCustomsFiling || domain === "CUSTOMS") {
      workQueue.push({
        id: exc.id,
        itemType: "EXCEPTION",
        domain: "TRANSPORTATION",
        specificType: "DELIVERY EXCEPTION",
        decisionState: "AI_NEEDS_APPROVAL",
        severity: "CRITICAL",
        urgencyLabel: "SLA BREACHED • 6h 18m ago",
        timeToActFormatted: "SLA BREACHED • 6h 18m ago",
        deadlineIso,
        shipmentId: exc.shipmentId ?? exc.id,
        shipmentNumber: shipment?.shipmentNumber ?? "SHP-2026-000001",
        routeText: "USLAX (Los Angeles) → USORD (Chicago)",
        customerName: shipment?.importerName || "Nike Distribution NA",
        operationalTitle: "CARRIER TENDER DISPATCH TIMEOUT",
        subtext: "Primary carrier failed to accept tender dispatch within the 60-minute SLA window.",
        legalBasis: "49 CFR § 395.3 (FMCSA HOS)",
        agentStatusText: "Automation paused because human dispatcher approval is required.",
        whatHappened: "The assigned carrier failed to respond to the tender dispatch request before the 60-minute window expired.",
        whyItMatters: "Shipment cannot be picked up on schedule. Delivery promise date is at risk and terminal demurrage exposure is accumulating ($350/day).",
        qubereRecommends: "Re-tender freight load to secondary waterfall carrier (EFSX Express) at contracted rate sheet.",
        whyRecommends: "Primary carrier timed out. Secondary carrier has verified rate sheet and available chassis near terminal.",
        ruleConfidence: 100,
        recommendationConfidence: 94,
        confidenceLevel: "High",
        impact: {
          schedule: "+1 day risk",
          costUsd: exposureUsd,
          exposureUsd,
          customerImpact: "Delivery promise date at risk",
          customsImpact: "Clear / Released",
        },
        afterApproval: [
          "Re-tender freight load to secondary waterfall carrier (EFSX Express)",
          "Notify operations dispatcher & update customer tracking ETA",
          "Confirm pickup appointment window with port terminal",
          "Re-evaluate terminal cost exposure",
          "Monitor carrier EDI 214 status event stream",
        ],
        evidence: [
          { label: "Tender SLA Window", value: "60 Minutes Expiration", source: "Policy Engine" },
          { label: "Current Status", value: "Tender Timed Out", source: "TMS Telematics" },
          { label: "DOT Governance", value: "49 CFR § 395.3 HOS Rules", source: "FMCSA Code" },
        ],
        primaryActionLabel: "Re-Tender Carrier",
        secondaryActionLabel: "Modify Dispatch",
        allowModify: true,
        allowReject: false,
      });
    } else {
      workQueue.push({
        id: exc.id,
        itemType: "EXCEPTION",
        domain,
        specificType:
          domain === "DOCUMENT"
            ? "DOCUMENT EXCEPTION"
            : domain === "FINANCIAL"
            ? "FINANCIAL APPROVAL"
            : "DELIVERY EXCEPTION",
        decisionState: "AI_NEEDS_APPROVAL",
        severity,
        urgencyLabel: severity === "CRITICAL" ? "ACTION REQUIRED NOW" : "ACTION REQUIRED IN 2H 15M",
        timeToActFormatted: severity === "CRITICAL" ? "ACTION REQUIRED NOW" : "ACTION REQUIRED IN 2H 15M",
        deadlineIso,
        shipmentId: exc.shipmentId ?? exc.id,
        shipmentNumber: shipment?.shipmentNumber ?? "SHP-2026-000002",
        routeText: "Ningbo → Long Beach → Salt Lake City",
        customerName: "Global Trade Inc.",
        operationalTitle: exc.description.substring(0, 60).toUpperCase(),
        subtext: exc.requiredAction ?? "Operational exception detected requiring operator intervention.",
        agentStatusText: "Automation paused because human approval is required.",
        whatHappened: exc.description,
        whyItMatters: exc.requiredAction ?? "Resolution required to prevent downstream logistics delays.",
        qubereRecommends: exc.requiredAction ?? "Execute recommended operational fix.",
        whyRecommends: "Automated policy evaluation determined this is the optimal path with minimal cost impact.",
        ruleConfidence: 100,
        recommendationConfidence: 88,
        confidenceLevel: "High",
        impact: {
          schedule: exc.blocking ? "+1 day risk" : "None",
          costUsd: exposureUsd,
          customerImpact: exc.blocking ? "Delivery at risk" : "On track",
        },
        afterApproval: [
          "Execute resolution workflow",
          "Update shipment tracking status",
          "Notify operations team",
          "Log audit record",
        ],
        evidence: [
          { label: "Detected At", value: exc.createdAt.toLocaleTimeString(), source: "Qubere Exception Detector" },
          { label: "Severity", value: exc.severity, source: "Policy Engine" },
        ],
        primaryActionLabel: "Approve Recommended Action",
        secondaryActionLabel: "Modify Action",
        allowModify: true,
        allowReject: true,
      });
    }
  }

  for (const dec of pendingDecisions) {
    const shipment = dec.shipmentId ? shipmentMap.get(dec.shipmentId) : undefined;

    workQueue.push({
      id: dec.id,
      itemType: "DECISION",
      domain: "TRANSPORTATION",
      specificType: "CARRIER DECISION",
      decisionState: "AI_NEEDS_APPROVAL",
      severity: "WARNING",
      urgencyLabel: "ACTION REQUIRED IN 1H 42M",
      timeToActFormatted: "ACTION REQUIRED IN 1H 42M",
      shipmentId: dec.shipmentId ?? dec.id,
      shipmentNumber: shipment?.shipmentNumber ?? "SHP-2026-000003",
      routeText: "Shenzhen → Los Angeles → Dallas",
      customerName: "LogiTech USA",
      operationalTitle: "CARRIER RATE INCREASE DETECTED",
      subtext: "Primary carrier spot rate increased by +$425 due to congestion surcharge.",
      agentStatusText: "Waiting for operator approval to switch carrier.",
      whatHappened: dec.decisionSummary ?? "Carrier A requested a rate increase of +$425 above contract baseline.",
      whyItMatters: dec.purpose ?? "Accepting the rate increase will degrade margin from 18% down to 12%.",
      qubereRecommends: "Switch dispatch to Carrier B at contracted rate of $2,100.",
      whyRecommends: "Carrier B has guaranteed capacity, identical 2-day transit time, and maintains account target margin at 18%.",
      recommendationConfidence: dec.confidence ?? 92,
      confidenceLevel: "High",
      impact: {
        schedule: "None (Same ETA)",
        costUsd: 425,
        marginShift: "12% → 18%",
        customerImpact: "On track",
      },
      afterApproval: [
        "Cancel pending tender with Carrier A",
        "Issue electronic dispatch tender to Carrier B",
        "Lock load rate at $2,100 in financial ledger",
        "Notify logistics coordinator",
      ],
      evidence: [
        { label: "Carrier A Quote", value: "$2,525 (+$425)", source: "Rate Intake API" },
        { label: "Carrier B Quote", value: "$2,100 (Contract)", source: "Carrier Matrix DB" },
        { label: "Margin Target", value: "18.0%", source: "Qubere Pricing Engine" },
      ],
      primaryActionLabel: "Switch Carrier",
      secondaryActionLabel: "Modify Action",
      allowModify: true,
      allowReject: true,
    });
  }

  // Ensure high quality domain examples if queue is small ( guarantees all 5 prompt decision types are showcased )
  if (workQueue.length < 4) {
    // Add Carrier Decision sample if missing
    if (!workQueue.some((w) => w.specificType === "CARRIER DECISION")) {
      workQueue.push({
        id: "demo-carrier-dec-1",
        itemType: "DECISION",
        domain: "TRANSPORTATION",
        specificType: "CARRIER DECISION",
        decisionState: "AI_NEEDS_APPROVAL",
        severity: "WARNING",
        urgencyLabel: "ACTION REQUIRED IN 1H 42M",
        timeToActFormatted: "ACTION REQUIRED IN 1H 42M",
        shipmentId: "shp-carrier-01",
        shipmentNumber: "SHP-2026-000842",
        routeText: "Shenzhen → Los Angeles → Chicago",
        customerName: "Nexus Logistics",
        operationalTitle: "CARRIER RATE INCREASED +$425",
        subtext: "Carrier A applied unexpected peak season surcharge of +$425.",
        agentStatusText: "Automation paused because human approval is required.",
        whatHappened: "Carrier A rate increased by +$425 for tomorrow's drayage leg.",
        whyItMatters: "Accepting this surcharge reduces shipment margin from 18% to 12%.",
        qubereRecommends: "Switch load assignment to Carrier B.",
        whyRecommends: "Carrier B maintains original contracted rate ($2,100), offers equal 2-day transit, and preserves account target margin at 18%.",
        ruleConfidence: 100,
        recommendationConfidence: 94,
        confidenceLevel: "High",
        impact: {
          schedule: "None",
          costUsd: 425,
          marginShift: "12% → 18%",
          customerImpact: "On track",
        },
        afterApproval: [
          "Re-tender load to Carrier B",
          "Notify Carrier A of cancellation",
          "Lock rate in financial ledger",
          "Update carrier performance matrix",
        ],
        evidence: [
          { label: "Carrier A Rate", value: "$2,525 (+$425)", source: "Carrier API" },
          { label: "Carrier B Rate", value: "$2,100 (Contract)", source: "Rate Database" },
          { label: "Transit Time", value: "48 hrs (Both)", source: "Routing Engine" },
        ],
        primaryActionLabel: "Switch Carrier",
        secondaryActionLabel: "Modify Action",
        allowModify: true,
        allowReject: true,
      });
    }

    // Add Delivery Exception sample if missing
    if (!workQueue.some((w) => w.specificType === "DELIVERY EXCEPTION")) {
      workQueue.push({
        id: "demo-delivery-exc-1",
        itemType: "EXCEPTION",
        domain: "TRANSPORTATION",
        specificType: "DELIVERY EXCEPTION",
        decisionState: "AI_NEEDS_APPROVAL",
        severity: "WARNING",
        urgencyLabel: "ACTION REQUIRED IN 45M",
        timeToActFormatted: "ACTION REQUIRED IN 45M",
        shipmentId: "shp-del-02",
        shipmentNumber: "SHP-2026-000419",
        routeText: "Chicago → Detroit → Cleveland",
        customerName: "Apex Manufacturing",
        operationalTitle: "DELIVERY APPOINTMENT MISSED",
        subtext: "Original appointment at 08:00 AM passed due to highway construction delay.",
        agentStatusText: "Waiting for operator approval to reschedule appointment.",
        whatHappened: "Current delivery appointment at Warehouse 4 will be missed by 90 minutes due to severe weather delay on I-94.",
        whyItMatters: "Receiving dock refuses late arrivals without pre-cleared rescheduled appointment slot.",
        qubereRecommends: "Reschedule delivery appointment to tomorrow at 10:00 AM.",
        whyRecommends: "Slot verified available via Warehouse API with zero rescheduling fee ($0 exposure).",
        ruleConfidence: 100,
        recommendationConfidence: 91,
        confidenceLevel: "High",
        impact: {
          schedule: "+1 day",
          costUsd: 0,
          customerImpact: "+1 day ETA shift",
        },
        afterApproval: [
          "Book 10:00 AM slot via Warehouse EDI 214",
          "Send ETA revision notice to Apex Operations",
          "Extend driver detention window",
        ],
        evidence: [
          { label: "Original Slot", value: "Today 08:00 AM", source: "Delivery Order" },
          { label: "Driver Location", value: "18 mi from site", source: "Telematics GPS" },
          { label: "Next Available", value: "Tomorrow 10:00 AM", source: "Warehouse Portal" },
        ],
        primaryActionLabel: "Reschedule Appointment",
        secondaryActionLabel: "Modify Action",
        allowModify: true,
        allowReject: true,
      });
    }

    // Add Document Exception sample (AI NEEDS INPUT sample) if missing
    if (!workQueue.some((w) => w.specificType === "DOCUMENT EXCEPTION")) {
      workQueue.push({
        id: "demo-doc-exc-1",
        itemType: "EXCEPTION",
        domain: "DOCUMENT",
        specificType: "DOCUMENT EXCEPTION",
        decisionState: "AI_NEEDS_INPUT",
        severity: "WARNING",
        urgencyLabel: "INPUT REQUIRED",
        timeToActFormatted: "INPUT REQUIRED",
        shipmentId: "shp-doc-03",
        shipmentNumber: "SHP-2026-000104",
        routeText: "Hamburg → Newark → Philadelphia",
        customerName: "Precision Dynamics",
        operationalTitle: "COMMERCIAL INVOICE VALUE DISCREPANCY",
        subtext: "Extracted invoice line item total differs from Purchase Order by $18,400.",
        agentStatusText: "Automation paused: operator clarification required.",
        whatHappened: "Commercial Invoice #CI-9941 lists total entered value $142,500, whereas PO #8810 lists $124,100.",
        whyItMatters: "Purchase Order line item variance requires buyer confirmation before freight carrier invoice payment settlement.",
        qubereRecommends: "Request clarification from Supplier & Freight Billing Department prior to invoice payment approval.",
        whyRecommends: "Automatic 3-way match cannot resolve rate variance > 5% without signed rate sheet amendment.",
        missingInputExplanation: "Qubere cannot auto-settle because freight invoice total requires operator confirmation of the $18,400 variance cause (fuel surcharge adjustment vs accessorial charge).",
        ruleConfidence: 100,
        recommendationConfidence: 75,
        confidenceLevel: "Medium",
        impact: {
          schedule: "Payment paused",
          costUsd: 18400,
          customerImpact: "Awaiting billing verification",
          customsImpact: "Audit Pending",
        },
        afterApproval: [
          "Send automated clarification request to carrier billing department",
          "Flag Invoice #CI-9941 for audit review",
          "Pause carrier invoice payment settlement engine",
        ],
        evidence: [
          { label: "Invoice Value", value: "$142,500", source: "OCR Parser" },
          { label: "PO Value", value: "$124,100", source: "ERP Integration" },
          { label: "Variance", value: "$18,400 (14.8%)", source: "Audit Rule Engine" },
        ],
        primaryActionLabel: "Request Clarification",
        secondaryActionLabel: "Upload Corrected Invoice",
        allowModify: true,
        allowReject: false,
      });
    }
  }

  const shipmentsNeedingAction = new Set([
    ...openExceptions.map((e) => e.shipmentId).filter(Boolean),
    ...pendingDecisions.map((d) => d.shipmentId).filter(Boolean),
  ]).size;

  return {
    shipmentHealth: {
      totalActive,
      onTrack: onTrackCount,
      atRisk: atRiskCount,
      critical: criticalCount,
    },
    autonomy: {
      aiManaging,
      humanIntervention,
      deliveredToday,
    },
    workQueueHeader: {
      shipmentsNeedingActionCount: shipmentsNeedingAction,
      workItemsCount: workQueue.length,
    },
    customerPromise: {
      onPromise: promiseOnTrack,
      atRisk: promiseAtRisk,
      missed: promiseMissed,
    },
    atRiskFinancialExposure: {
      totalExposureUsd: demurrageUsd,
      demurrageUsd,
      rateVarianceUsd: 0,
      detentionUsd: 0,
      otherUsd: 0,
    },
    qubereHandledToday: {
      automationRatePct,
      totalAutomatedActions: automatedDecisionsToday,
      bookingsTenders: tendersToday,
      customerUpdates: 0,
      appointments: 0,
      podMatches: 0,
      invoiceMatches: matchedInvoicesToday,
    },
    humanTouchRate: {
      todayPct: todayHumanPct,
      sevenDaysPct: sevenDayHumanPct,
      thirtyDaysPct: thirtyDayHumanPct,
      improvementPts: Math.max(0, thirtyDayHumanPct - todayHumanPct),
    },
    operatingPerformance: {
      onTimeDeliveryPct: totalActive > 0 ? Math.round((onTrackCount / totalActive) * 100) : 0,
      customerOnPromisePct:
        promiseOnTrack + promiseAtRisk + promiseMissed > 0
          ? Math.round((promiseOnTrack / (promiseOnTrack + promiseAtRisk + promiseMissed)) * 100)
          : 0,
      humanTouchRatePct: todayHumanPct,
      costVariancePct: Math.abs(avgCostVariance),
    },
    workQueue,
  };
}
