import { ShipmentPgaHolds } from "./ShipmentPgaHolds";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  CheckCircle2,
  Building2,
  Truck,
  Layers,
  ChevronRight,
} from "lucide-react";
import { CanonicalShipmentService } from "@/modules/shipment/canonicalShipmentService";
import { Badge } from "@/components/ui/Badge";
import { checkRequiredDocumentTypes } from "@/lib/requiredDocumentTypes";
import { ShipmentTitleEditor } from "./ShipmentTitleEditor";
import { ShipmentClientEditor } from "./ShipmentClientEditor";
import { DestinationCountryEditor } from "./DestinationCountryEditor";
import { ExceptionsDrawer } from "./ExceptionsDrawer";
import { LineItemsTable } from "./LineItemsTable";
import { ContainersTable } from "./ContainersTable";
import { CanonicalFactsSection } from "./CanonicalFactsSection";
import { ComplianceChecksPanel } from "./ComplianceChecksPanel";
import { ReasonableCareChecklistPanel } from "./ReasonableCareChecklistPanel";
import { evaluateShipmentReasonableCare } from "@/modules/compliance/reasonableCareShipment";
import { PartyScreeningPanel, type PartyScreeningRow } from "./PartyScreeningPanel";
import { AutomaticEmbargoScreeningPanel, type AutomaticEmbargoFinding, type AutomaticEmbargoStatus } from "./AutomaticEmbargoScreeningPanel";
import type { AuditCheckResult } from "@/modules/agents/complianceAuditAgent";
import { JourneyRibbon } from "@/components/journey/JourneyRibbon";
import { AddTransportLegButton } from "./AddTransportLegButton";
import { AgentExecutionTimeline } from "./AgentExecutionTimeline";
import { buildAgentInvocations } from "./agentInvocations";
import { displayCurrency } from "@/lib/honest";
import { extractedCurrency } from "@/modules/documents/extractedCurrency";
import { deriveDocumentParseState } from "./workspaceTypes";
import { DocumentWorkspacePanel } from "./DocumentWorkspacePanel";
import { ShipmentTabsPanel } from "./ShipmentTabsPanel";
import { ClientActionsPanel } from "./ClientActionsPanel";
import { DeadlineRail } from "@/components/deadlines/DeadlineRail";
import { computeReadinessBreakdown } from "@/lib/shipmentReadiness";
import {
  canonicalizeFieldKey,
  expectedFieldsForDocType,
  extractedValueFor,
  resolveField,
} from "@/lib/documents/fieldDictionary";
import { fieldKeyForRuleId } from "@/lib/reconciliation/reconciliationRules";
import type { FieldVerificationState } from "@/modules/documents/fieldVerification";
import type { ExtractedLineItem } from "./workspaceTypes";
import type { CategoryDetail } from "./PreFilingReadiness";
import type { ReadinessBreakdown } from "@/lib/shipmentReadiness";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";
import { ShipmentTrackingPanel } from "./ShipmentTrackingPanel";
import { ShipmentAuditTrail, type ShipmentAuditEntry } from "./ShipmentAuditTrail";

/**
 * Sums the quantities on a document's extracted line items.
 *
 * Returns 0 when the stored JSON carried no line-item array, which is what the
 * previous `?.reduce(...) || 0` did — an absent array and a zero total were
 * already indistinguishable here, and both mean "nothing to compare".
 */
function extractedQuantityTotal(lineItems: unknown): number {
  if (!Array.isArray(lineItems)) return 0;
  return (lineItems as ExtractedLineItem[]).reduce(
    (sum, li) => sum + Number(li.quantity || 0),
    0
  );
}

export default async function ShipmentWorkspacePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ docId?: string; view?: string; pgaHold?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const activeTab = searchParams.view || "workspace";
  const docId = searchParams.docId;

  const context = await getAccountContext();
  if (!context) return null;

  // Shipment (and nearly everything queried below it) carries an Account
  // relation, dataMode-scoped -- without this wrapper the queries silently
  // default to PRODUCTION isolation and this page 404s for any DEMO/SANDBOX
  // account even though the data genuinely exists.
  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () => {

  const shipment = await db.shipment.findFirst({
    where: {
      accountId: context.accountId,
      OR: [{ id: params.id }, { shipmentNumber: params.id }],
      deletedAt: null,
    },
  });

  if (!shipment) notFound();

  const [canReadPga, canUpdatePga] = await Promise.all([hasPermission("pga.read"), hasPermission("pga.update")]);

  const isEnterpriseAdmin =
    context.accountType === "ENTERPRISE" &&
    (context.roleNames.includes("ADMIN") || context.roleNames.includes("OWNER"));

  const canEditClient =
    isEnterpriseAdmin ||
    (context.roleNames.includes("PLANNER") && shipment.assignedBrokerId === context.userId);

  // Journey/leg management mirrors the write permission the
  // /api/shipments/[id]/legs routes enforce, so the UI never shows an action
  // the API will reject.
  const canManageJourney =
    context.isPlatformAdmin ||
    isEnterpriseAdmin ||
    context.permissions.includes("shipment.update");

  // On-demand compliance checks -- mirror each route's own permission so the
  // panel never offers an action the API will 403: embargo + PGA screen gate on
  // `ai.use`, reconciliation on `shipments.manage`.
  const isAccountAdmin = context.isPlatformAdmin || isEnterpriseAdmin;
  const canRunAiChecks = isAccountAdmin || context.permissions.includes("ai.use");
  const canRunReconciliation = isAccountAdmin || context.permissions.includes("shipments.manage");

  // Restricted-party screening runs automatically via the Compliance Audit
  // Agent (pipelineOrchestrator on upload / field edits); this page only
  // ever reads its persisted results, so it mirrors the read permission the
  // account-wide Compliance workspace already gates on.
  const canReadPartyScreening = isAccountAdmin || context.permissions.includes("compliance.restrictedParty.read");


  // Document audit logs are keyed by ShipmentDocument.id (not shipment.id),
  // so the auditLog query below needs this shipment's document ids up front
  // to scope the "ShipmentDocument" entity clause -- without it, that clause
  // pulled in every document event for the whole account.
  const shipmentDocumentIds = (
    await db.shipmentDocument.findMany({
      where: { shipmentId: shipment.id },
      select: { id: true },
    })
  ).map((d) => d.id);

  // None of these eleven depend on each other; run them in parallel.
  const [
    canonical,
    clients,
    fieldApprovals,
    reconciliationIssues,
    trackingProjection,
    dbAuditLogs,
    customsFilings,
    resolvedExceptions,
    resolvedReconciliations,
    shipmentChangeEvents,
    customerRequests,
    pipelineJobs,
    pgaRequirementCount,
    shipmentPartiesForScreening,
    restrictedPartyScreeningResults,
    latestComplianceAgentDecision,
  ] = await Promise.all([
    CanonicalShipmentService.getCanonicalState(shipment.id),
    canEditClient
      ? db.client.findMany({
          where: { accountId: context.accountId },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    // Real per-field approval provenance — ordered desc so the first entry
    // found for a given key is always the latest.
    db.fieldApproval.findMany({
      where: { shipmentId: shipment.id },
      orderBy: { approvedAt: "desc" },
    }),
    // Open cross-document reconciliation conflicts for the CONFLICT drawer cards.
    db.reconciliationIssue.findMany({
      where: { shipmentId: shipment.id, accountId: context.accountId, status: "Open" },
      orderBy: { createdAt: "desc" },
    }),
    getShipmentTrackingProjection(context.accountId, shipment.id),
    db.auditLog.findMany({
      where: {
        accountId: context.accountId,
        OR: [
          { entityId: shipment.id },
          { entityId: params.id },
          { entity: "ShipmentDocument", entityId: { in: shipmentDocumentIds } },
        ],
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.customsFiling.findMany({
      where: { shipmentId: shipment.id, accountId: context.accountId },
      orderBy: { createdAt: "desc" },
    }),
    db.exceptionItem.findMany({
      where: {
        shipmentId: shipment.id,
        accountId: context.accountId,
        status: { in: ["Resolved", "RESOLVED", "ResolvedManual", "ResolvedAuto", "WAIVED", "Waived", "CLOSED", "Closed"] },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.reconciliationIssue.findMany({
      where: {
        shipmentId: shipment.id,
        accountId: context.accountId,
        status: { in: ["Resolved", "RESOLVED", "Ignored", "IGNORED"] },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.shipmentChangeEvent.findMany({
      where: { shipmentId: shipment.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.customerRequest.findMany({
      where: { shipmentId: shipment.id },
      orderBy: { createdAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            authorUser: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          include: {
            document: { select: { id: true, fileName: true, fileUrl: true, status: true, docType: true } },
          },
        },
      },
    }),
    db.pipelineJob.findMany({
      where: { shipmentId: shipment.id, accountId: context.accountId },
      orderBy: { createdAt: "desc" },
    }),
    db.pgaRequirement.count({
      where: { shipmentLineItem: { shipmentId: shipment.id, accountId: context.accountId } },
    }),
    canReadPartyScreening
      ? db.shipmentParty.findMany({
          where: { shipmentId: shipment.id },
          include: { legalEntity: { select: { legalName: true, tradeName: true, partyId: true } } },
        })
      : Promise.resolve([]),
    // Latest run per party -- screening is keyed to the ShipmentParty via
    // `externalReference` (see getShipmentPartiesForScreening/shipmentScreening.ts),
    // so this reads the same rows the automatic pipeline already wrote instead
    // of re-screening anything from this page.
    canReadPartyScreening
      ? db.restrictedPartyScreeningResult.findMany({
          where: { shipmentId: shipment.id, accountId: context.accountId },
          include: { disposition: true },
          orderBy: { screeningDate: "desc" },
        })
      : Promise.resolve([]),
    // ComplianceAuditAgent's own run -- broader than the on-demand embargo
    // tile (per-line-item + destination + private-embargo rules, see
    // AutomaticEmbargoScreeningPanel). Read-only: this page never re-runs it.
    db.agentDecision.findFirst({
      where: { shipmentId: shipment.id, accountId: context.accountId, agentName: "Compliance Agent" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!trackingProjection) notFound();

  const { metrics, facts, agentExecutionLogs } = canonical;
  const fullShipment = canonical.shipment;
  const documents = fullShipment.documents || [];
  const lineItemCurrency = extractedCurrency(documents);

  // Merges AgentExecutionRecord (selective re-runs) and AgentExecutionLog
  // (the real 10-agent upload pipeline) into one waterfall-ready list
  const agentInvocations = buildAgentInvocations(
    fullShipment.agentExecutionRecords || [],
    agentExecutionLogs || [],
    pipelineJobs || []
  );

  // Load display line items
  const displayLineItems = (fullShipment.lineItems || []).map((item) => ({
    id: item.id,
    lineNumber: item.lineNumber,
    partNumber: item.partNumber || "",
    description: item.description,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    totalValue: Number(item.totalValue),
    countryOfOrigin: item.countryOfOrigin || "",
    htsCode: item.htsCode || "",
    htsConfidence: item.htsConfidence ?? null,
    status: item.status || "Extracted",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

  // Real, un-defaulted classification confidence per line -- displayLineItems
  // above already substitutes 95 for a null htsConfidence (classification
  // hasn't run yet), so a per-document HS score needs this raw map instead
  // to tell "actually 95% confident" apart from "never classified."
  const rawHtsConfidenceByLine = new Map(
    (fullShipment.lineItems || []).map(
      (item) => [item.lineNumber, { description: item.description, htsConfidence: item.htsConfidence }] as const
    )
  );

  // Load display containers
  const displayContainers = (fullShipment.containers || []).map((container) => ({
    id: container.id,
    containerNumber: container.containerNumber,
    sealNumbers: container.sealNumbers,
    containerType: container.containerType,
    containerSize: container.containerSize,
    packageCount: container.packageCount,
    descriptionOfGoods: container.descriptionOfGoods,
    grossWeight: container.grossWeight != null ? Number(container.grossWeight) : null,
    weightUom: container.weightUom,
    status: container.status,
  }));

  const totalInvoiceAmount = displayLineItems.reduce(
    (acc: number, item) => acc + Number(item.quantity) * Number(item.unitPrice),
    0
  );

  // One row per shipment party, joined to its latest restricted-party
  // screening run (if any). `externalReference` is how shipmentScreening.ts
  // stamps the ShipmentParty.id on the row it persists, so it's the reliable
  // join key -- `partyId` is only ever set when the party is linked to a
  // Party Master record.
  const latestScreeningByShipmentPartyId = new Map<string, (typeof restrictedPartyScreeningResults)[number]>();
  for (const result of restrictedPartyScreeningResults) {
    if (!result.externalReference) continue;
    if (!latestScreeningByShipmentPartyId.has(result.externalReference)) {
      latestScreeningByShipmentPartyId.set(result.externalReference, result);
    }
  }
  const partyScreeningRows: PartyScreeningRow[] = shipmentPartiesForScreening.map((sp) => {
    const latest = latestScreeningByShipmentPartyId.get(sp.id);
    return {
      shipmentPartyId: sp.id,
      role: sp.role,
      partyName: sp.legalEntity.tradeName || sp.legalEntity.legalName,
      partyId: sp.legalEntity.partyId,
      status: latest?.status ?? "NOT_SCREENED",
      screeningDate: latest?.screeningDate.toISOString() ?? null,
      hitCount: latest?.hitCount ?? 0,
      redFlagCount: latest?.redFlagCount ?? 0,
      dispositionStatus: latest?.disposition?.status ?? null,
    };
  });

  // Embargo-relevant slice of the Compliance Audit Agent's last run --
  // everything else in its evidenceItems (PGA/ADD-CVD/UFLPA/end-use/etc.) is
  // out of scope for this panel, which mirrors the on-demand embargo tile.
  // A generic "SCREENING_GAP" only counts here when it's actually about
  // embargo/sanctions data -- the same category also covers unrelated gaps
  // (end-use, anti-boycott, etc.) that this panel shouldn't surface.
  const complianceAgentEvidence = latestComplianceAgentDecision?.evidenceItems as
    | { auditResults?: AuditCheckResult[] }
    | null
    | undefined;
  const automaticEmbargoFindings: AutomaticEmbargoFinding[] = (complianceAgentEvidence?.auditResults ?? [])
    .filter(
      (r) =>
        r.category === "COUNTRY_EMBARGO" ||
        r.category === "PRIVATE_EMBARGO" ||
        (r.category === "SCREENING_GAP" && /embargo|sanction/i.test(r.ruleName))
    )
    .map((r) => ({ ruleName: r.ruleName, severity: r.severity, details: r.details, lineNumber: r.lineNumber }));
  const automaticEmbargoStatus: AutomaticEmbargoStatus = !latestComplianceAgentDecision
    ? "not-run"
    : automaticEmbargoFindings.some((f) => f.severity === "CRITICAL")
      ? "blocked"
      : automaticEmbargoFindings.length > 0
        ? "attention"
        : "clear";

  // Formatted once: this figure is shown in the readiness evidence panel and the
  // filing summary, and both used to prefix it with "$" regardless of the
  // currency the invoice was actually written in.
  const totalInvoiceDisplay = lineItemCurrency
    ? displayCurrency(totalInvoiceAmount, lineItemCurrency)
    : totalInvoiceAmount.toLocaleString();

  const activeExceptions = fullShipment.exceptionItems || [];

  // FieldApproval rows are written under whatever key form the surface used
  // (canonical `shipment.originCountry`, tradeMetadata `portOfDischarge`, ...);
  // index them by canonical id so a lookup matches regardless.
  type ApprovalSnapshot = { name: string; approvedAt: string; value: string; action: string | null };
  const latestApprovalByField: Record<string, ApprovalSnapshot> = {};
  const approvalByDocField = new Map<string, ApprovalSnapshot>();
  for (const fa of fieldApprovals) {
    const snapshot: ApprovalSnapshot = {
      name: fa.approvedByName,
      approvedAt: fa.approvedAt.toISOString(),
      value: fa.value,
      action: fa.action,
    };
    const canon = canonicalizeFieldKey(fa.fieldKey) ?? fa.fieldKey;
    if (!latestApprovalByField[canon]) latestApprovalByField[canon] = snapshot;
    if (!latestApprovalByField[fa.fieldKey]) latestApprovalByField[fa.fieldKey] = snapshot;
    for (const k of new Set([`${fa.documentId}:${canon}`, `${fa.documentId}:${fa.fieldKey}`])) {
      if (!approvalByDocField.has(k)) approvalByDocField.set(k, snapshot);
    }
  }

  // Canonical keys of fields with an open cross-document conflict -- never
  // bulk-accepted, per the reconciliation-before-approval rule (a value that
  // disagrees with another document must be resolved, not silently approved
  // as part of a batch). `issue.field` on a ReconciliationIssue row is the
  // rule id (e.g. "QTY_INV_PACK"), not the field itself, so resolve it back
  // through the rule table before comparing against document field keys.
  const conflictedFieldKeys = new Set(
    reconciliationIssues
      .filter((issue) => issue.status === "Open")
      .map((issue) => fieldKeyForRuleId(issue.field))
      .filter((key): key is string => Boolean(key))
      .map((key) => canonicalizeFieldKey(key) ?? key)
  );

  // "What fields do we expect from THIS document type, and did we get them" --
  // driven by the shared field dictionary (fieldDictionary.ts), so a Packing
  // List is asked for weight/carton count and a Bill of Lading for vessel /
  // ports / B-L number, instead of every document getting the same 13-field
  // checklist (finding #7). HTS is a line-item concern, reviewed in
  // LineItemsTable, so the dictionary deliberately excludes it here (finding #3).
  //
  // Status is resolved through a single precedence order so this is the one
  // place a field's review state is decided -- ExceptionsDrawer/
  // DocumentFieldReviewModal just render whichever of the 8
  // FieldVerificationState values comes back:
  //   1. approval sentinel value "[NOT_APPLICABLE]" -> NOT_APPLICABLE
  //   2. approval sentinel value "[REJECTED]"       -> REJECTED
  //   3. no extracted value                          -> MISSING_REQUIRED
  //   4. open cross-document conflict                -> CONFLICT
  //   5. approved, and that approval was an EDIT      -> HUMAN_CORRECTED
  //   6. approved otherwise                            -> HUMAN_CONFIRMED
  //   7. else                                          -> NEEDS_REVIEW
  const documentFieldSummaries = documents
    .filter((d) => Boolean(d.extractedJson))
    .map((d) => {
      let tradeMetadata: Record<string, unknown> = {};
      let extractedLineItems: unknown[] = [];
      try {
        const parsed = JSON.parse(d.extractedJson ?? "{}");
        tradeMetadata = parsed.tradeMetadata || {};
        extractedLineItems = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
      } catch {
        // Stored JSON that no longer parses leaves every field reading MISSING_REQUIRED.
      }

      const fields = expectedFieldsForDocType(d.docType).map((spec) => {
        const key = spec.tradeMetadataKey ?? spec.canonicalKey;
        const value = extractedValueFor(spec.canonicalKey, tradeMetadata, extractedLineItems as never[]);
        const approval =
          approvalByDocField.get(`${d.id}:${spec.canonicalKey}`) ??
          approvalByDocField.get(`${d.id}:${key}`);
        const isConflicted = conflictedFieldKeys.has(canonicalizeFieldKey(key) ?? key);

        let status: FieldVerificationState;
        if (approval?.value === "[NOT_APPLICABLE]") {
          status = "NOT_APPLICABLE";
        } else if (approval?.value === "[REJECTED]") {
          status = "REJECTED";
        } else if (!value) {
          status = "MISSING_REQUIRED";
        } else if (isConflicted) {
          status = "CONFLICT";
        } else if (approval) {
          status = approval.action === "EDIT" ? "HUMAN_CORRECTED" : "HUMAN_CONFIRMED";
        } else {
          status = "NEEDS_REVIEW";
        }

        return {
          key,
          label: spec.label,
          value,
          status,
          approvedByName: approval?.name,
          approvedAt: approval?.approvedAt,
        };
      });

      const settledCount = fields.filter(
        (f) =>
          f.status === "HUMAN_CONFIRMED" ||
          f.status === "HUMAN_CORRECTED" ||
          f.status === "REJECTED" ||
          f.status === "NOT_APPLICABLE"
      ).length;

      return {
        documentId: d.id as string,
        fileName: d.fileName as string,
        confirmedCount: settledCount,
        totalCount: fields.length,
        fields,
      };
    });

  // Importer display can fall back from the legal Importer of Record down
  // to the (unrelated, business-relationship) Client, then the free-text
  // importerName field -- surface which source is actually being shown so
  // it's never silently mistaken for a verified legal entity.
  const importerOfRecord = fullShipment.importerOfRecord;
  const importerDisplay = importerOfRecord?.name
    ? { name: importerOfRecord.name, sourceLabel: null }
    : fullShipment.client?.name
      ? { name: fullShipment.client.name, sourceLabel: "via Client, not a verified Importer of Record" }
      : shipment.importerName
        ? { name: shipment.importerName, sourceLabel: "unverified, entered on shipment" }
        : { name: null, sourceLabel: null };

  const poaRecords = importerOfRecord?.powersOfAttorney || [];
  const activePoa = poaRecords.find(
    (poa) => poa.status === "Active" && (!poa.expirationDate || new Date(poa.expirationDate) >= new Date())
  );
  const expiredPoa = poaRecords.find(
    (poa) => poa.status === "Expired" || (poa.expirationDate && new Date(poa.expirationDate) < new Date())
  );
  const poaStatusDisplay = importerOfRecord ? (activePoa ? "VALID" : "NOT ON FILE") : "NO IMPORTER LINKED";

  const bondTypeDisplay = importerOfRecord?.bond
    ? importerOfRecord.bond.bondType === "continuous"
      ? "Continuous Bond"
      : "Single Transaction Bond"
    : null;

  // ---------------------------------------------------------------------
  // Pre-Filing Readiness ribbon: 11 category statuses computed from real
  // shipment/document/line-item/importer data (not the multi-dimensional
  // metrics bar above, which is a coarser 4-number summary -- this is the
  // detailed, per-category breakdown used to drive the ribbon UI).
  // ---------------------------------------------------------------------

  // 1. Importer & Filing Authority
  let importerStatus: "Ready" | "Blocked" | "Needs Information" = "Ready";
  let importerResult = "CBP Importer Number & Active Bond verified";
  let importerDetails = "Active customs bond and registered importer credentials are valid on file.";
  let importerActionRequired = "";
  let importerActionOwner = "Broker";
  let importerWhyItMatters =
    "CBP regulations mandate a valid power of attorney to establish filing authority. Transmitting without a valid POA is a severe regulatory violation.";

  if (!shipment.importerName || shipment.importerName === "To Order" || !importerOfRecord) {
    importerStatus = "Needs Information";
    importerResult = "Consigned 'To Order' - Importer of Record missing";
    importerDetails = "The shipment is consigned 'To Order'. A registered Importer of Record with active bond must be nominated before filing.";
    importerActionRequired = "Provide importer entity details and CBP Importer Number.";
    importerActionOwner = "Importer";
    importerWhyItMatters =
      "CBP requires every entry to name a registered Importer of Record with an active bond. A shipment consigned 'To Order' has no declarant of record and cannot be filed until one is nominated.";
  } else if (!importerOfRecord.irsEin || !importerOfRecord.cbpImporterNumber) {
    importerStatus = "Needs Information";
    importerResult = "Importer registered credentials missing";
    importerDetails = `IRS EIN or CBP Importer Number for importer ${shipment.importerName} is not set.`;
    importerActionRequired = "Provide CBP Importer Number and IRS EIN verification.";
    importerActionOwner = "Importer";
    importerWhyItMatters =
      "CBP identifies the importer of record by IRS EIN and CBP Importer Number on every entry filing; without both on file, the entry cannot be transmitted.";
  } else if (
    !importerOfRecord.bond ||
    importerOfRecord.bond.status !== "Active" ||
    (importerOfRecord.bond.expirationDate && new Date(importerOfRecord.bond.expirationDate) < new Date())
  ) {
    importerStatus = "Blocked";
    importerResult = "Customs Bond Missing or Expired";
    importerDetails = `Importer ${shipment.importerName} does not have an active Customs Bond on file with CBP. Continuous bond is required for consumption entry.`;
    importerActionRequired = "Procure continuous customs bond (Form 301) and update surety record.";
    importerActionOwner = "Importer";
    importerWhyItMatters =
      "A continuous customs bond guarantees payment of duties, taxes, and penalties to CBP. Entry cannot be filed without an active bond on record.";
  } else if (poaRecords.length === 0) {
    importerStatus = "Blocked";
    importerResult = "Broker Power of Attorney Missing";
    importerDetails = `No Broker Power of Attorney (POA) exists for importer ${shipment.importerName}. A signed POA must be established before transmission.`;
    importerActionRequired = "Execute a new Customs Power of Attorney (Form 5291) with signed corporate officer verification.";
    importerActionOwner = "Importer";
    importerWhyItMatters =
      "CBP regulations mandate a valid power of attorney to establish filing authority. Transmitting without a valid POA is a severe regulatory violation.";
  } else if (expiredPoa && !activePoa) {
    importerStatus = "Blocked";
    importerResult = "POA Expired";
    importerDetails = `Customs power of attorney for importer ${shipment.importerName} expired on ${new Date(expiredPoa.expirationDate!).toLocaleDateString()}.`;
    importerActionRequired = "Execute a new Customs Power of Attorney (Form 5291) with signed corporate officer verification.";
    importerActionOwner = "Importer";
    importerWhyItMatters =
      "CBP regulations mandate a valid power of attorney to establish filing authority. Transmitting without a valid POA is a severe regulatory violation.";
  }

  // Extract key-value pairs from documents dynamically
  let extractedVessel = "";
  let extractedVoyage = "";
  let extractedBookingRef = "";
  let extractedPortOfLoading = "";
  let extractedPortOfDischarge = "";
  let extractedContainerNo = "";
  let extractedGrossWeight = "";
  let extractedShipper = "";
  let extractedConsignee = "";
  let extractedNotifyParty = "";
  let extractedMethodOfDespatch = "";

  // Gemini's freeform `keyValuePairs` labels vary by document (casing,
  // spacing, punctuation, and even which synonym the document itself uses),
  // so each field is matched against a list of label spellings with
  // whitespace/punctuation/case ignored, instead of one brittle exact string.
  const normalizeLabel = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const kvLookup = (kv: Record<string, unknown>, ...labels: string[]): string => {
    const byNormalizedLabel = new Map(Object.entries(kv).map(([k, v]) => [normalizeLabel(k), v]));
    for (const label of labels) {
      const v = byNormalizedLabel.get(normalizeLabel(label));
      if (v) return String(v);
    }
    return "";
  };

  for (const doc of documents) {
    if (!doc.extractedJson) continue;
    try {
      const parsed = JSON.parse(doc.extractedJson);
      const kv = parsed.keyValuePairs || {};

      // Prefer the structured tradeMetadata (stable keys) and fall back to the
      // raw key-value pairs (Gemini's freeform labels). Reading only `kv`
      // false-flagged fields as "not extracted" that were sitting in
      // tradeMetadata all along (findings #3, #5).
      const tm = parsed.tradeMetadata || {};
      extractedVessel = extractedVessel || tm.vesselName || kvLookup(kv, "Vessel", "Vessel/Aircraft") || "";
      extractedVoyage = extractedVoyage || tm.voyageNumber || kvLookup(kv, "Voyage Number") || "";
      extractedBookingRef =
        extractedBookingRef ||
        tm.transportDocumentNumber ||
        tm.bookingNumber ||
        kvLookup(kv, "Booking Reference", "Booking Number", "BOL / AWB Number", "BOL Number", "AWB Number") ||
        "";
      extractedPortOfLoading = extractedPortOfLoading || tm.portOfLoading || kvLookup(kv, "Port of Loading") || "";
      extractedPortOfDischarge = extractedPortOfDischarge || tm.portOfDischarge || kvLookup(kv, "Port of Discharge") || "";
      extractedContainerNo = extractedContainerNo || tm.containerNumber || kvLookup(kv, "Container No", "Container Number") || "";
      extractedGrossWeight = extractedGrossWeight || tm.totalWeight || kvLookup(kv, "Gross Weight") || "";
      extractedShipper = extractedShipper || tm.exporterName || tm.shipper || kvLookup(kv, "Shipper") || "";
      extractedConsignee = extractedConsignee || tm.importerName || tm.consignee || kvLookup(kv, "Consignee") || "";
      extractedNotifyParty = extractedNotifyParty || tm.notifyParty || kvLookup(kv, "Notify Party") || "";
      extractedMethodOfDespatch =
        extractedMethodOfDespatch ||
        tm.modeOfTransport ||
        kvLookup(kv, "Method of Despatch", "Mode of Transport", "Mode of Transportation") ||
        "";
    } catch { }
  }

  // 2. Shipment & Entry Details
  // Two different sources feed this category, and the reviewer flagged that
  // conflating them tells a user to "re-check the documents" for data that was
  // never on a document (finding #6). Keep them separate.
  const missingEntryRecordFields = []; // set on the shipment record, not extracted
  if (!shipment.carrierName) missingEntryRecordFields.push("Carrier");
  if (!shipment.portOfEntry) missingEntryRecordFields.push("Port of Entry");
  if (!shipment.entryType) missingEntryRecordFields.push("Entry Type");
  if (!shipment.incoterm) missingEntryRecordFields.push("Incoterm");

  const missingTransportDocFields = []; // read off the uploaded transport document
  if (documents.length > 0) {
    if (!extractedBookingRef) missingTransportDocFields.push("Bill of Lading / Booking Reference");
    if (!extractedVessel) missingTransportDocFields.push("Vessel Name");
    if (!extractedVoyage) missingTransportDocFields.push("Voyage Number");
    if (!extractedPortOfLoading) missingTransportDocFields.push("Port of Loading");
    if (!extractedPortOfDischarge) missingTransportDocFields.push("Port of Discharge");
    if (!extractedMethodOfDespatch) missingTransportDocFields.push("Mode of Transport");
    if (!extractedContainerNo) missingTransportDocFields.push("Container Number");
    if (!extractedGrossWeight) missingTransportDocFields.push("Gross Weight");
  }
  const missingShipmentFields = [...missingEntryRecordFields, ...missingTransportDocFields];

  let shipmentStatus: "Ready" | "Needs Information" = "Ready";
  let shipmentResult = "All transport parameters matched";
  let shipmentDetails = "Vessel manifest data, carrier SCAC codes, and ports of entry/discharge are fully matched.";
  let shipmentActionRequired = "";

  if (documents.length === 0) {
    shipmentStatus = "Needs Information";
    shipmentResult = "Transport details pending document ingestion";
    shipmentDetails = "Entry and transportation metadata must be declared for manifest matching. Mode of transport, vessel, port, container, and weight details are missing.";
    shipmentActionRequired = "Upload Bill of Lading or Forwarding Instructions.";
  } else if (missingShipmentFields.length > 0) {
    shipmentStatus = "Needs Information";
    shipmentResult = `${missingShipmentFields.length} transport field${missingShipmentFields.length > 1 ? "s" : ""} outstanding`;
    const parts: string[] = [];
    if (missingEntryRecordFields.length > 0) {
      parts.push(`Not yet set on the shipment record: ${missingEntryRecordFields.join(", ")}.`);
    }
    if (missingTransportDocFields.length > 0) {
      parts.push(`Not found on the uploaded transport document: ${missingTransportDocFields.join(", ")}.`);
    }
    shipmentDetails = parts.join(" ");
    shipmentActionRequired =
      missingEntryRecordFields.length > 0 && missingTransportDocFields.length > 0
        ? `Set ${missingEntryRecordFields.join(", ")} on the shipment; provide ${missingTransportDocFields.join(", ")} from the transport document.`
        : missingEntryRecordFields.length > 0
          ? `Set on the shipment record: ${missingEntryRecordFields.join(", ")}.`
          : `Provide from the transport document: ${missingTransportDocFields.join(", ")}.`;
  }

  // 3. Transaction Parties
  const missingPartyFields = [];
  if (documents.length > 0) {
    if (!extractedShipper) missingPartyFields.push("Shipper / Exporter");
    if (!extractedConsignee) missingPartyFields.push("Consignee");
    if (!extractedNotifyParty) missingPartyFields.push("Notify Party");
  }

  let partyStatus: "Ready" | "Needs Information" = "Ready";
  let partyResult = "Shipper, Seller, and Buyer verified";
  let partyDetails = "Exporters, manufacturers, and buyers are fully declared with valid address records.";
  let partyActionRequired = "";

  if (documents.length === 0) {
    partyStatus = "Needs Information";
    partyResult = "Party details pending document ingestion";
    partyDetails = "Seller, Buyer, Exporter, and Manufacturer identities must be verified for security screening and customs valuation.";
    partyActionRequired = "Upload Commercial Invoice or Bill of Lading.";
  } else if (extractedConsignee === "To Order") {
    partyStatus = "Needs Information";
    partyResult = "Consigned 'To Order' - Ultimate Consignee required";
    partyDetails = "The transport document consigns the cargo 'To Order'. For customs clearance, the actual ultimate consignee (buyer/recipient) must be nominated with a valid name, address, and EIN.";
    partyActionRequired = "Nominate the ultimate consignee details (EIN, name, and address).";
  } else if (missingPartyFields.length > 0) {
    partyStatus = "Needs Information";
    partyResult = `Missing party fields: ${missingPartyFields.join(", ")}`;
    partyDetails = `The following required transaction parties are not declared: ${missingPartyFields.join(", ")}.`;
    partyActionRequired = `Provide details for: ${missingPartyFields.join(", ")}`;
  }

  // Document lookups reused below to link "Evidence" on Ready categories
  // to the actual uploaded document (opened in-app, in the workspace
  // viewer), instead of showing fabricated supporting data.
  const invoiceDoc = documents.find(
    (d) => d.docType?.toLowerCase().includes("invoice") || d.fileName.toLowerCase().includes("invoice")
  );
  const packingDoc = documents.find(
    (d) => d.docType?.toLowerCase().includes("packing") || d.fileName.toLowerCase().includes("packing")
  );
  const bolDoc = documents.find(
    (d) =>
      d.docType?.toLowerCase().includes("lading") ||
      d.docType?.toLowerCase().includes("transport") ||
      d.fileName.toLowerCase().includes("lading") ||
      d.fileName.toLowerCase().includes("instructions") ||
      d.fileName.toLowerCase().includes("waybill")
  );
  const docEvidenceUrl = (doc: { id: string } | undefined) =>
    doc ? `/app/shipments/${shipment.id}?view=workspace&docId=${doc.id}` : undefined;
  // For categories whose "evidence" is a live database field rather than an
  // uploaded document -- links into the tab/section that actually renders it.
  const filingAnchorUrl = (anchor: string) => `/app/shipments/${shipment.id}?view=filing#${anchor}`;
  // Surfaces real human-approval provenance (see FieldApproval, and the new
  // field-review flow in ExceptionsDrawer) directly in a category's evidence
  // panel, instead of the evidence only ever showing where the raw agent
  // extraction came from.
  const approvedByRow = (fieldKey: string, label: string) => {
    const approval = latestApprovalByField[fieldKey];
    return approval ? [{ label, value: `${approval.name} · ${new Date(approval.approvedAt).toLocaleDateString()}` }] : [];
  };

  // 4. Required Documents
  const hasInvoice = Boolean(invoiceDoc);
  const docStatus = hasInvoice ? "Ready" : "Needs Information";
  const docResult = hasInvoice ? `${documents.length}/${documents.length} required documents received` : "Commercial Invoice Missing";
  const docDetails = hasInvoice
    ? "Required transaction documents (Commercial Invoice, Packing List) are present in the document vault."
    : "Commercial Invoice document is missing. A copy must be uploaded to run vision extraction.";
  const docActionRequired = hasInvoice ? "" : "Upload Commercial Invoice file (PDF format).";

  // 5. Merchandise & HTS Classification
  let merchandiseStatus: "Ready" | "Needs Review" | "Needs Information" = "Ready";
  let merchandiseResult = "HTS codes verified";
  let merchandiseDetails = "All products have resolved HTSUS codes with high classification confidence.";
  let merchandiseActionRequired = "";
  let htsQuestionnaire: string[] = [];

  const vagueItems = displayLineItems.filter((item) => item.htsConfidence && item.htsConfidence < 80);
  // Line items can exist with a stored confidence value even after their
  // source document has been detached -- that stored number is stale, not
  // a live claim, so treat "line items but no attached document" as
  // needing review rather than trusting it as Ready.
  const classificationUnverified = displayLineItems.length > 0 && documents.length === 0;

  if (displayLineItems.length === 0) {
    merchandiseStatus = "Needs Information";
    merchandiseResult = "Classification pending document extraction";
    merchandiseDetails = "Product descriptions and HTS classifications cannot be verified until the Commercial Invoice is uploaded and processed.";
    merchandiseActionRequired = "Upload Commercial Invoice to extract line items.";
  } else if (classificationUnverified) {
    merchandiseStatus = "Needs Review";
    merchandiseResult = "Classification unverified — no document attached";
    merchandiseDetails = "Line items exist for this shipment, but no document is currently attached to substantiate their HTS classification. Their stored confidence scores predate detachment and can't be trusted as current.";
    merchandiseActionRequired = "Attach the commercial invoice or supporting document that backs this classification.";
  } else if (displayLineItems.some((item) => !item.htsCode)) {
    // "HTS codes verified" must not show while a line still has no code at all
    // (finding #3 — summary said READY while every document's HTS read Missing).
    const missing = displayLineItems.filter((item) => !item.htsCode);
    merchandiseStatus = "Needs Review";
    merchandiseResult = `${missing.length} line item${missing.length > 1 ? "s" : ""} not classified`;
    merchandiseDetails = `Line ${missing.map((m) => m.lineNumber).join(", ")} ${missing.length > 1 ? "have" : "has"} no HTS code assigned yet.`;
    merchandiseActionRequired = "Classify the remaining line items in the Verified Line Items table.";
  } else if (vagueItems.length > 0) {
    merchandiseStatus = "Needs Review";
    merchandiseResult = `Line ${vagueItems[0].lineNumber} classification review required`;
    merchandiseDetails = `Description '${vagueItems[0].description}' has low classification confidence (${vagueItems[0].htsConfidence}%) for HTSUS ${vagueItems[0].htsCode || "code"}.`;
    merchandiseActionRequired = "Answer classification verification questionnaire and upload product datasheet.";
    htsQuestionnaire = [
      "What does it control?",
      "Material and construction",
      "Operating method",
      "Principal function",
      "Model/part number",
      "Technical datasheet",
      "Product image or engineering drawing",
    ];
  }

  // 6. Quantity, Packaging & Reconciliation
  let qtyInvoice = 0;
  let qtyPacking = 0;
  let hasInv = false;
  let hasPack = false;
  for (const doc of documents) {
    if (!doc.extractedJson) continue;
    try {
      const parsed = JSON.parse(doc.extractedJson);
      const docType = doc.docType || parsed.metadata?.docType || "";
      if (docType.toLowerCase().includes("invoice")) {
        hasInv = true;
        qtyInvoice += extractedQuantityTotal(parsed.lineItems);
      } else if (docType.toLowerCase().includes("packing")) {
        hasPack = true;
        qtyPacking += extractedQuantityTotal(parsed.lineItems);
      }
    } catch { }
  }
  let qtyStatus: "Ready" | "Blocked" | "Needs Review" | "Needs Information" = "Ready";
  let qtyResult = "Reconciled";
  let qtyDetails = "Invoice commercial quantities match packing list package counts.";
  let qtyActionRequired = "";

  if (documents.length === 0) {
    qtyStatus = "Needs Information";
    qtyResult = "Quantities not declared";
    qtyDetails = "Quantity and package count reconciliation requires both Commercial Invoice and Packing List documents.";
    qtyActionRequired = "Upload invoice and packing list documents.";
  } else if (hasInv && hasPack && qtyInvoice !== qtyPacking) {
    qtyStatus = "Blocked";
    qtyResult = `${qtyInvoice} PCS vs ${qtyPacking} PCS`;
    qtyDetails = `Quantity mismatch detected across documents. Commercial Invoice declares ${qtyInvoice} PCS, but Packing List declares ${qtyPacking} PCS.`;
    qtyActionRequired = "Resolve invoice vs packing list quantity mismatch. Select the correct count or upload corrected files.";
  } else if (!hasInv || !hasPack) {
    // Documents are attached, but not one of each type needed to actually
    // reconcile quantities -- there is nothing to compare, so this can't be
    // reported as "Reconciled."
    qtyStatus = "Needs Review";
    const missingType = !hasInv && !hasPack ? "Commercial Invoice and Packing List" : !hasInv ? "Commercial Invoice" : "Packing List";
    qtyResult = `Reconciliation unverified — ${missingType} not identified`;
    qtyDetails = `Quantity reconciliation requires both a Commercial Invoice and a Packing List with extracted data. ${missingType} could not be identified among the attached documents, so no comparison could be made.`;
    qtyActionRequired = `Attach or correctly classify the ${missingType} so quantities can be reconciled.`;
  }

  // 7. Customs Value & Commercial Terms
  let valueStatus: "Ready" | "Needs Review" | "Needs Information" = "Ready";
  let valueResult = "Reconciled";
  let valueDetails = "Transaction currency, unit values, and declared transaction amounts are consistent.";
  let valueActionRequired = "";

  if (displayLineItems.length === 0) {
    valueStatus = "Needs Information";
    valueResult = "Valuation pending document extraction";
    valueDetails = "Declared customs values and commercial terms cannot be validated without line items.";
    valueActionRequired = "Upload Commercial Invoice to run valuation extraction.";
  } else if (documents.length === 0) {
    // Same class of bug as HTS Confidence: stored unitPrice on a line item
    // survives document detachment, so it can't be trusted as a live,
    // currently-substantiated value without a document backing it.
    valueStatus = "Needs Review";
    valueResult = "Valuation unverified — no document attached";
    valueDetails = "Line items carry stored transaction values, but no document is currently attached to substantiate them. These figures predate detachment and can't be trusted as current.";
    valueActionRequired = "Attach the commercial invoice that backs these declared values.";
  } else {
    const hasValueMissing = displayLineItems.some((item) => !item.unitPrice || Number(item.unitPrice) <= 0);
    if (hasValueMissing) {
      valueStatus = "Needs Information";
      valueResult = "Line value missing";
      valueDetails = "Merchandise valuation is missing for one or more line items.";
      valueActionRequired = "Provide commercial transaction values for all line items.";
    }
  }

  // 8. Origin, Marking & Trade Programs
  const hasPreferentialHTS = displayLineItems.some((item) => item.htsCode?.startsWith("02"));
  const cooDoc = documents.find(
    (d) => d.docType?.toLowerCase().includes("certificate of origin") || d.docType?.toLowerCase().includes("coo")
  );
  const hasCoODoc = Boolean(cooDoc);

  let originStatus: "Ready" | "Needs Information" | "Not Applicable" = "Not Applicable";
  let originResult = "Not Applicable";
  let originDetails = "No preferential tariff treatment claimed; standard duties apply.";
  let originActionRequired = "";

  if (documents.length === 0) {
    originStatus = "Needs Information";
    originResult = "Origin verification pending";
    originDetails = "Country of origin declarations for each line item must be extracted from the Commercial Invoice.";
    originActionRequired = "Upload Commercial Invoice to check preference eligibility.";
  } else if (hasPreferentialHTS) {
    if (hasCoODoc) {
      originStatus = "Ready";
      originResult = "Origin support verified";
      originDetails = "Preferential trade agreement claim supported by an active Certificate of Origin.";
    } else {
      originStatus = "Needs Information";
      originResult = "Origin support required";
      originDetails = "A preferential duty claim is implied by the classification. Provide the certification or manufacturing evidence needed to substantiate it.";
      originActionRequired = "Provide the certification or manufacturing evidence needed to substantiate the requested preferential-duty claim.";
    }
  }

  // Required document types not yet uploaded -- computed the same way
  // ShipmentDocumentsSection does, so its "Missing required" callout and
  // the Exceptions panel above always agree instead of being two
  // independently-computed, silently-diverging checks.
  const { missingTypes: missingDocTypes } = checkRequiredDocumentTypes(
    documents,
    originStatus !== "Not Applicable"
  );

  // 9. Admissibility, PGA & Trade Restrictions
  let pgaStatus: "Ready" | "Needs Review" | "Needs Information" = "Ready";
  let pgaResult = "No additional agency data identified";
  let pgaDetails = "No PGA restrictions identified for this entry classification.";
  let pgaActionRequired = "";

  if (documents.length === 0) {
    pgaStatus = "Needs Information";
    pgaResult = "PGA admissibility analysis pending";
    pgaDetails = "Partner Government Agency checks require product classifications to determine eligibility and required permits.";
    pgaActionRequired = "Upload Commercial Invoice to run PGA assessment.";
  } else {
    const requiresPgaUSDA = displayLineItems.some((item) => item.htsCode?.startsWith("02"));
    if (requiresPgaUSDA) {
      pgaStatus = "Needs Review";
      pgaResult = "USDA FSIS permit required";
      pgaDetails = "Meat products require USDA Food Safety and Inspection Service (FSIS) import permit and FDA Prior Notice.";
      pgaActionRequired = "Submit USDA FSIS permit and file FDA Prior Notice.";
    }
  }

  // 10. Duties, Fees, Bond & Payment
  // There is no real duty calculation engine wired to shipment line items --
  // ShipmentLineItem has no duty field, and CustomsFiling.totalDuties only
  // exists after a shipment has already been filed (the very thing this
  // ribbon gates). So this category can never honestly report a computed
  // number pre-filing; it can only report that the calculation hasn't run.
  const dutyStatus = "Needs Information" as const;
  const dutyResult = "Not yet calculated";
  const dutyDetails = "Customs duties, harbor maintenance fees (HMF), and merchandise processing fees (MPF) are not calculated pre-filing. No duty computation is currently wired to this shipment's line items.";
  const dutyActionRequired = "Duty estimation is not yet available for this shipment; final duties will be assessed by CBP after filing.";

  // 11. Final Review & Filing Authorization
  const isBlocked = importerStatus === "Blocked" || qtyStatus === "Blocked";
  const hasReviews =
    merchandiseStatus === "Needs Review" ||
    pgaStatus === "Needs Review" ||
    qtyStatus === "Needs Review" ||
    valueStatus === "Needs Review";
  const hasMissingInfo =
    importerStatus === "Needs Information" ||
    shipmentStatus === "Needs Information" ||
    partyStatus === "Needs Information" ||
    valueStatus === "Needs Information" ||
    originStatus === "Needs Information" ||
    qtyStatus === "Needs Information" ||
    merchandiseStatus === "Needs Information" ||
    pgaStatus === "Needs Information" ||
    dutyStatus === "Needs Information" ||
    docStatus === "Needs Information";

  let finalStatus: "Pending" | "Ready" = "Pending";
  let finalResult = "Pending resolution of exceptions";
  let finalDetails = "All pre-filing compliance category blockers and reviews must be resolved before authorization.";
  let finalActionRequired = "Resolve open blockers and reviews to sign final declaration.";

  if (!isBlocked && !hasReviews && !hasMissingInfo) {
    finalStatus = "Ready";
    finalResult = "Ready to File";
    finalDetails = "All 10 preceding compliance categories are cleared. Licensed broker review and importer attestation are ready for signature.";
    finalActionRequired = "Review and sign the filing authorization declaration.";
  }

  const readinessCategories: CategoryDetail[] = [
    {
      id: "importer",
      name: "1. Importer & Filing Authority",
      status: importerStatus,
      result: importerResult,
      details: importerDetails,
      whyItMatters: importerWhyItMatters,
      actionOwner: importerActionOwner,
      actionRequired: importerActionRequired,
      source: "Importer of record master data",
      timestamp: shipment.updatedAt.toISOString(),
      evidence:
        importerStatus === "Ready"
          ? {
            sourceName: "Importer of Record Entity",
            fields: [
              { label: "CBP Importer #", value: importerOfRecord?.cbpImporterNumber || "N/A" },
              { label: "POA Status", value: poaStatusDisplay },
              { label: "Bond Type", value: bondTypeDisplay || "N/A" },
            ],
            documentUrl: filingAnchorUrl("importer-of-record-card"),
            documentName: "Importer of Record Entity — Filing Data",
          }
          : undefined,
    },
    {
      id: "shipment",
      name: "2. Shipment & Entry Details",
      status: shipmentStatus,
      result: shipmentResult,
      details: shipmentDetails,
      whyItMatters: "Carrier name, SCAC codes, bill numbers, and arrival dates are required for vessel manifest matching and cargo release authorization.",
      actionOwner: "Importer",
      actionRequired: shipmentActionRequired,
      source: "Shipment record + transport document",
      timestamp: shipment.updatedAt.toISOString(),
      evidence:
        shipmentStatus === "Ready" && bolDoc
          ? {
            sourceName: "Bill of Lading / Forwarding Instructions",
            fields: [
              { label: "Vessel / Voyage", value: extractedVessel ? `${extractedVessel} / ${extractedVoyage}` : "N/A" },
              { label: "Booking Reference", value: extractedBookingRef || "N/A" },
              { label: "Port of Loading / Discharge", value: `${extractedPortOfLoading || "N/A"} / ${extractedPortOfDischarge || "N/A"}` },
            ],
            documentUrl: docEvidenceUrl(bolDoc),
            documentName: bolDoc.fileName,
          }
          : undefined,
    },
    {
      id: "parties",
      name: "3. Transaction Parties",
      status: partyStatus,
      result: partyResult,
      details: partyDetails,
      whyItMatters: "Party identity validation prevents shipping to denied/sanctioned entities and ensures correct customs valuation.",
      actionOwner: "Importer",
      actionRequired: partyActionRequired,
      source: "Denied Watchlist sync module",
      timestamp: shipment.updatedAt.toISOString(),
      evidence:
        partyStatus === "Ready" && bolDoc
          ? {
            sourceName: "Bill of Lading / Forwarding Instructions",
            fields: [
              { label: "Shipper / Exporter", value: extractedShipper || "N/A" },
              { label: "Consignee", value: extractedConsignee || "N/A" },
              { label: "Notify Party", value: extractedNotifyParty || "N/A" },
              ...approvedByRow("exporterName", "Exporter Approved By"),
              ...approvedByRow("importerName", "Importer Approved By"),
            ],
            documentUrl: docEvidenceUrl(bolDoc),
            documentName: bolDoc.fileName,
          }
          : undefined,
    },
    {
      id: "documents",
      name: "4. Required Documents",
      status: docStatus,
      result: docResult,
      details: docDetails,
      whyItMatters: "CBP requires Commercial Invoice and Packing List to be kept on file for 5 years post-entry under the recordkeeping rule.",
      actionOwner: "Importer",
      actionRequired: docActionRequired,
      source: "Document Vault",
      timestamp: shipment.createdAt.toISOString(),
      evidence:
        docStatus === "Ready" && invoiceDoc
          ? {
            sourceName: "Document Vault",
            fields: [
              { label: "Total Documents", value: `${documents.length} Files` },
              { label: "Commercial Invoice", value: invoiceDoc.fileName },
              { label: "Packing List", value: packingDoc?.fileName || "Not on file" },
            ],
            documentUrl: docEvidenceUrl(invoiceDoc),
            documentName: invoiceDoc.fileName,
          }
          : undefined,
    },
    {
      id: "merchandise",
      name: "5. Merchandise & HTS Classification",
      status: merchandiseStatus,
      result: merchandiseResult,
      details: merchandiseDetails,
      whyItMatters: "Importers must exercise 'reasonable care' under 19 USC 1484 to ensure accurate HTSUS classification. Vague descriptions lead to penalties.",
      actionOwner: "Broker",
      actionRequired: merchandiseActionRequired,
      source: "HTS Master Release Database",
      timestamp: shipment.updatedAt.toISOString(),
      questionnaire: htsQuestionnaire.length > 0 ? htsQuestionnaire : undefined,
      evidence:
        merchandiseStatus === "Ready"
          ? {
            sourceName: "Verified Line Items",
            fields: [
              { label: "Line Items", value: `${displayLineItems.length} Lines` },
              { label: "Avg. Classification Confidence", value: `${metrics.classificationConfidenceScore}%` },
            ],
            documentUrl: filingAnchorUrl("verified-line-items-section"),
            documentName: "Verified Line Items — Filing Data",
          }
          : undefined,
    },
    {
      id: "quantity",
      name: "6. Quantity, Packaging & Reconciliation",
      status: qtyStatus,
      result: qtyResult,
      details: qtyDetails,
      whyItMatters: "Quantity discrepancies between invoice and packing list affect entered quantity value and CBP statistical reporting.",
      actionOwner: "Importer",
      actionRequired: qtyActionRequired,
      source: "Document Intelligence Extraction Client",
      timestamp: shipment.updatedAt.toISOString(),
      evidence:
        qtyStatus === "Ready" && hasInv && hasPack
          ? {
            sourceName: "Invoice vs. Packing List Reconciliation",
            fields: [
              { label: "Invoice Quantity", value: `${qtyInvoice} PCS` },
              { label: "Packing List Quantity", value: `${qtyPacking} PCS` },
            ],
            documentUrl: docEvidenceUrl(packingDoc || invoiceDoc),
            documentName: (packingDoc || invoiceDoc)?.fileName,
          }
          : undefined,
    },
    {
      id: "value",
      name: "7. Customs Value & Commercial Terms",
      status: valueStatus,
      result: valueResult,
      details: valueDetails,
      whyItMatters: "Correct valuation ensures proper duty calculations. Unreported assists or incorrect Incoterms result in duty underpayments.",
      actionOwner: "Importer",
      actionRequired: valueActionRequired,
      source: "Invoice Price Parser Module",
      timestamp: shipment.updatedAt.toISOString(),
      evidence:
        valueStatus === "Ready" && invoiceDoc
          ? {
            sourceName: "Commercial Invoice",
            fields: [
              { label: "Total Invoice Value", value: totalInvoiceDisplay },
              { label: "Incoterm", value: shipment.incoterm || "N/A" },
            ],
            documentUrl: docEvidenceUrl(invoiceDoc),
            documentName: invoiceDoc.fileName,
          }
          : undefined,
    },
    {
      id: "origin",
      name: "8. Origin, Marking & Trade Programs",
      status: originStatus,
      result: originResult,
      details: originDetails,
      whyItMatters: "Trade agreement preferential duty claims must be substantiated with valid certificates of origin or manufacturing records.",
      actionOwner: "Importer",
      actionRequired: originActionRequired,
      source: "Origin determination advice router",
      timestamp: shipment.updatedAt.toISOString(),
      evidence:
        originStatus === "Ready" && cooDoc
          ? {
            sourceName: "Certificate of Origin",
            fields: [
              { label: "Country of Origin", value: shipment.countryOfOrigin || "N/A" },
              ...approvedByRow("originCountry", "Approved By"),
            ],
            documentUrl: docEvidenceUrl(cooDoc),
            documentName: cooDoc.fileName,
          }
          : undefined,
    },
    {
      id: "pga",
      name: "9. Admissibility, PGA & Trade Restrictions",
      status: pgaStatus,
      result: pgaResult,
      details: pgaDetails,
      whyItMatters: "Non-CBP agency admissibility reviews (FDA, USDA FSIS) must pass before cargo release.",
      actionOwner: "Broker",
      actionRequired: pgaActionRequired,
      source: "CBP PGA cross-reference rules engine",
      timestamp: shipment.updatedAt.toISOString(),
      evidence:
        pgaStatus === "Ready"
          ? {
            sourceName: "PGA Cross-Reference Screening",
            fields: [
              { label: "Line Items Screened", value: `${displayLineItems.length} Lines` },
              { label: "HTS Codes Checked", value: displayLineItems.map((li) => li.htsCode).filter(Boolean).join(", ") || "N/A" },
              { label: "Result", value: "No PGA-restricted HTS prefixes matched" },
            ],
            documentUrl: filingAnchorUrl("verified-line-items-section"),
            documentName: "Verified Line Items — Filing Data",
          }
          : undefined,
    },
    {
      id: "duties",
      name: "10. Duties, Fees, Bond & Payment",
      status: dutyStatus,
      result: dutyResult,
      details: dutyDetails,
      whyItMatters: "Duties must be correctly estimated to determine bond sufficiency. Insufficient customs bond coverage blocks entry processing.",
      actionOwner: "Broker",
      actionRequired: dutyActionRequired,
      source: "Duty calculator engine",
      timestamp: shipment.updatedAt.toISOString(),
    },
    {
      id: "final",
      name: "11. Final Review & Filing Authorization",
      status: finalStatus,
      result: finalResult,
      details: finalDetails,
      whyItMatters: "Importers must sign off and authorize final filing summaries. Stale approvals post-revision violate reasonable care compliance.",
      actionOwner: "Broker",
      actionRequired: finalActionRequired,
      source: "Broker Signoff attestation ledger",
      timestamp: shipment.updatedAt.toISOString(),
    },
  ];

  const totalCategories = 11;
  const readyCount = readinessCategories.filter((c) => c.status === "Ready" || c.status === "Not Applicable").length;
  const blockedCount = readinessCategories.filter((c) => c.status === "Blocked").length;
  const reviewCount = readinessCategories.filter((c) => c.status === "Needs Review").length;
  const infoCount = readinessCategories.filter((c) => c.status === "Needs Information").length;

  const missingDocExceptionsCount = missingDocTypes.filter(
    (type) => !activeExceptions.some((ex) => ex.description?.toLowerCase().includes(type.toLowerCase()))
  ).length;
  const blockingReconciliationCount = reconciliationIssues.filter((i) => i.severity === "Critical").length;
  const totalActionableExceptionsCount = activeExceptions.length + missingDocExceptionsCount + blockingReconciliationCount;
  const displayBlockerCount = Math.max(blockedCount, totalActionableExceptionsCount);

  let overallStatusText = "Ready to File";
  let overallStatusSubtext = "All categories ready and validated.";
  let overallStatusType: "BLOCKED" | "REVIEW_REQUIRED" | "INFO_REQUIRED" | "WARNINGS" | "READY" = "READY";

  if (displayBlockerCount > 0) {
    overallStatusText = "Not Ready to File";
    overallStatusSubtext = `${readyCount} of ${totalCategories} categories ready · ${displayBlockerCount} blockers · ${reviewCount} reviews required`;
    overallStatusType = "BLOCKED";
  } else if (reviewCount > 0) {
    overallStatusText = "Not Ready to File";
    overallStatusSubtext = `${readyCount} of ${totalCategories} categories ready · ${reviewCount} reviews open · ${infoCount} missing fields`;
    overallStatusType = "REVIEW_REQUIRED";
  } else if (infoCount > 0) {
    overallStatusText = "Not Ready to File";
    overallStatusSubtext = `${readyCount} of ${totalCategories} categories ready · ${infoCount} missing information fields`;
    overallStatusType = "INFO_REQUIRED";
  } else {
    overallStatusText = "Ready to File";
    overallStatusSubtext = "All pre-filing compliance checks passed cleanly.";
    overallStatusType = "READY";
  }

  const avgExtractionConfidence =
    documents.length === 0
      ? null
      : documents.reduce((sum, d) => sum + (d.confidence ?? 0), 0) / documents.length;

  const readinessBreakdown: ReadinessBreakdown = computeReadinessBreakdown({
    documents: documents.map((d) => ({ docType: d.docType ?? "", status: d.status ?? "" })),
    lineItems: displayLineItems.map((li) => ({
      htsCode: li.htsCode,
      countryOfOrigin: li.countryOfOrigin,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      status: li.status,
    })),
    exceptionItems: activeExceptions.map((e) => ({
      status: e.status ?? "Open",
      severity: e.severity ?? "Medium",
      blocking: e.severity === "Critical" || e.severity === "High",
    })),
    avgExtractionConfidence: avgExtractionConfidence ?? undefined,
    blockingReconciliationIssues: blockingReconciliationCount,
    // Same signal the "6. Quantity, Packaging & Reconciliation" category uses,
    // so the readiness factor and that category can never contradict each
    // other (finding #3).
    liveQuantityMismatch: qtyStatus === "Blocked",
  });

  // The stored `shipment.readinessScore` / `healthStatus` columns are only
  // written by a handful of routes and go stale after any other mutation
  // (resolving an exception, editing a line item). The ribbon below already
  // recomputes the score every render — show that number in the header badge
  // and health pill too, so the page never disagrees with itself (finding #3).
  const freshReadinessScore = readinessBreakdown.totalScore;
  const freshHealthStatus =
    freshReadinessScore >= 80 ? "Healthy" : freshReadinessScore >= 50 ? "At Risk" : "Critical";

  // 5-item reasonable-care checklist — the same evaluation embedded in the
  // exported reasonable-care defense package, surfaced here so a broker sees it
  // in the shipment workspace and not only in a downloaded ZIP.
  const reasonableCareEvaluation = await evaluateShipmentReasonableCare(context.accountId, shipment.id);

  // Pre-built once here (not inline in the ternary they replaced) so
  // `ShipmentTabsPanel` -- a Client Component -- can hold which tab is active
  // in local state and just toggle which of these three already-rendered
  // trees is mounted, instead of a `?view=` searchParam driving this Server
  // Component to re-fetch and re-render the entire page on every tab click.
  const filingContent = (
    <>
      {/* Shipment Identity & Importer Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="apple-card p-6 rounded-3xl border border-border bg-white shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center space-x-2">
            <Truck className="w-4 h-4 text-brand" />
            <span>Logistics & Entry Identity</span>
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-surface-muted">
              <span className="text-ink-muted font-bold">Entry Type</span>
              <span className="font-mono text-ink font-bold">
                {shipment.entryType || <span className="text-ink-muted/70 italic font-normal">Not set</span>}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-muted">
              <span className="text-ink-muted font-bold">Port of Entry</span>
              <span className="font-medium text-ink">
                {shipment.portOfEntry || <span className="text-ink-muted/70 italic font-normal">Not set</span>}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-muted">
              <span className="text-ink-muted font-bold">Carrier</span>
              <span className="font-medium text-ink">
                {shipment.carrierName || <span className="text-ink-muted/70 italic font-normal">Not set</span>}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-muted font-bold">Incoterm</span>
              <span className="font-mono font-bold text-brand">
                {shipment.incoterm || <span className="text-ink-muted/70 italic font-normal">Not set</span>}
              </span>
            </div>
          </div>
        </div>

        <div id="importer-of-record-card" className="apple-card p-6 rounded-3xl border border-border bg-white shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-brand" />
            <span>Importer of Record Entity</span>
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-surface-muted items-start">
              <span className="text-ink-muted font-bold">Importer</span>
              <span className="text-right">
                <span className="font-bold text-ink block">
                  {importerDisplay.name || <span className="text-ink-muted/70 italic font-normal">Not set</span>}
                </span>
                {importerDisplay.sourceLabel && (
                  <span className="text-[9px] text-amber-600 font-semibold uppercase tracking-wide">
                    {importerDisplay.sourceLabel}
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-muted">
              <span className="text-ink-muted font-bold">CBP Importer #</span>
              <span className="font-mono text-ink">
                {importerOfRecord?.cbpImporterNumber || (
                  <span className="text-ink-muted/70 italic font-normal font-sans">Not set</span>
                )}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-muted">
              <span className="text-ink-muted font-bold">POA Status</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${poaStatusDisplay === "VALID"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
              >
                {poaStatusDisplay}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-muted font-bold">Bond Type</span>
              <span className="font-medium text-ink">
                {bondTypeDisplay || <span className="text-ink-muted/70 italic font-normal">Not on file</span>}
              </span>
            </div>
          </div>
        </div>

        <div className="apple-card p-6 rounded-3xl border border-border bg-white shadow-sm space-y-4">
          <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center space-x-2">
            <FileText className="w-4 h-4 text-brand" />
            <span>Commercial Summary</span>
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-surface-muted">
              <span className="text-ink-muted font-bold">Line Items</span>
              <span className="font-mono text-ink font-bold">{displayLineItems.length} Lines</span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-muted">
              <span className="text-ink-muted font-bold">Classification Approval</span>
              <span
                className={
                  displayLineItems.length === 0
                    ? "text-ink-muted/70 italic font-normal"
                    : classificationUnverified
                      ? "font-extrabold text-slate-500 uppercase text-[10px] tracking-wider"
                      : vagueItems.length > 0
                        ? "font-extrabold text-amber-600 uppercase text-[10px] tracking-wider"
                        : "font-extrabold text-emerald-600 uppercase text-[10px] tracking-wider"
                }
              >
                {displayLineItems.length === 0
                  ? "N/A"
                  : classificationUnverified
                    ? "Unverified"
                    : vagueItems.length > 0
                      ? "Pending"
                      : "Approved"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-muted">
              <span className="text-ink-muted font-bold">Total Invoice Value</span>
              <span className="font-mono font-bold text-ink">{totalInvoiceDisplay}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-muted">
              <span className="text-ink-muted font-bold">Country of Export</span>
              <span className="font-medium text-ink">
                {shipment.countryOfExport || <span className="text-ink-muted/70 italic font-normal">Not set</span>}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-muted font-bold">Documents Vault</span>
              <span className="font-mono font-bold text-brand">{documents.length} Files</span>
            </div>
          </div>
        </div>
      </div>

      {/* Canonical Facts & Provenance */}
      <CanonicalFactsSection
        shipmentId={shipment.id}
        facts={facts}
        currentCountryOfOrigin={shipment.countryOfOrigin}
      />

      {/* Verified Line Items -- ground truth canonical line items */}
      <div id="verified-line-items-section" className="bg-white p-6 rounded-3xl border border-border shadow-sm space-y-4">
        <div>
          <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center space-x-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-brand" />
            <span>Verified Line Items</span>
          </h3>
          <p className="text-[11px] text-ink-muted">
            This shipment&apos;s confirmed line items, regardless of which document is selected in the viewer.
          </p>
        </div>
        <LineItemsTable
          shipmentId={shipment.id}
          initialLineItems={displayLineItems}
          isEnterpriseAdmin={isEnterpriseAdmin}
          currency={lineItemCurrency}
        />
        <ContainersTable containers={displayContainers} />
      </div>
    </>
  );

  const workspaceContent = (
    /* Main Workspace: Documents + Embedded Viewer -- document
       selection lives entirely client-side in this panel so
       switching documents never re-runs this server component
       (which would re-fetch and re-render the whole page). */
    <DocumentWorkspacePanel
      shipmentId={shipment.id}
      shipmentNumber={shipment.shipmentNumber}
      documents={documents.map((d) => ({
        ...d,
        parseState: deriveDocumentParseState(d),
      }))}
      originStatus={originStatus}
      displayLineItems={displayLineItems}
      rawHtsConfidenceByLine={Array.from(rawHtsConfidenceByLine.entries())}
      lineItemCurrency={lineItemCurrency}
      initialDocId={docId}
    />
  );

  const combinedAuditEntries: ShipmentAuditEntry[] = [
    // 1. Audit Logs (UI, Copilot CHAT, External API — excluding SYSTEM background noise)
    ...dbAuditLogs
      .filter((log) => {
        const isSystemSource = log.source === "SYSTEM";
        const isSystemWorkerAction =
          log.action.toUpperCase().startsWith("SYSTEM_") ||
          log.action.toUpperCase().startsWith("AUTOMATED_") ||
          log.action.toUpperCase().startsWith("NORMALIZE_") ||
          log.action.toUpperCase().startsWith("RECONCILE_") ||
          log.action.toUpperCase().startsWith("AGENT_") ||
          log.action.toUpperCase().includes("PRODUCT_INTELLIGENCE");
        return !isSystemSource && !isSystemWorkerAction;
      })
      .map((log) => {
        const userName = log.user
          ? [log.user.firstName, log.user.lastName].filter(Boolean).join(" ") || log.user.email
          : log.source === "CHAT"
          ? "Copilot AI"
          : log.source === "API"
          ? "API Integration"
          : "User";
        const validSource: "UI" | "CHAT" | "SYSTEM" | "API" =
          log.source === "CHAT"
            ? "CHAT"
            : log.source === "API"
            ? "API"
            : "UI";
        return {
          id: `audit-${log.id}`,
          action: log.action,
          category: "SYSTEM_AUDIT" as const,
          title: log.action.replace(/_/g, " "),
          description:
            (log.metadata as Record<string, unknown> | null)?.description &&
            typeof (log.metadata as Record<string, unknown>).description === "string"
              ? ((log.metadata as Record<string, unknown>).description as string)
              : `Executed action ${log.action.replace(/_/g, " ")}`,
          source: validSource,
          user: { name: userName, email: log.user?.email },
          timestamp: log.createdAt.toISOString(),
          beforeValue: (log.metadata as Record<string, unknown> | null)?.beforeJson
            ? JSON.stringify((log.metadata as Record<string, unknown>).beforeJson)
            : null,
          afterValue: (log.metadata as Record<string, unknown> | null)?.afterJson
            ? JSON.stringify((log.metadata as Record<string, unknown>).afterJson)
            : null,
          metadata: log.metadata as Record<string, unknown> | null,
        };
      }),

    // 2. Human Field Edits & Approvals (from FieldApproval)
    ...fieldApprovals.map((fa) => {
      const label = resolveField(fa.fieldKey)?.label || fa.fieldKey.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
      return {
        id: `field-approval-${fa.id}`,
        action: "FIELD_APPROVED",
        category: "FIELD_APPROVAL" as const,
        title: "Field Approved",
        description: `Approved value "${fa.value || "Confirmed"}" for field ${label}`,
        source: "UI" as const,
        user: { name: fa.approvedByName || "Customs Broker" },
        timestamp: fa.approvedAt.toISOString(),
        afterValue: `${label}: ${fa.value}`,
      };
    }),

    // 3. Human Field Updates & Provenance Changes (from ShipmentChangeEvent)
    ...shipmentChangeEvents.map((sce) => {
      const userName = sce.user
        ? [sce.user.firstName, sce.user.lastName].filter(Boolean).join(" ") || sce.user.email
        : "User";
      const fieldLabel = resolveField(sce.field)?.label || sce.field.replace(/([A-Z])/g, " $1").trim();
      return {
        id: `change-event-${sce.id}`,
        action: sce.changeType || "FIELD_UPDATED",
        category: "FIELD_APPROVAL" as const,
        title: "Field Updated",
        description: `Updated ${fieldLabel} to "${sce.newValue || "Set"}"${sce.previousValue ? ` (was "${sce.previousValue}")` : ""}${sce.reason ? ` — ${sce.reason}` : ""}`,
        source: "UI" as const,
        user: { name: userName, email: sce.user?.email },
        timestamp: sce.createdAt.toISOString(),
        beforeValue: sce.previousValue ? `${fieldLabel}: ${sce.previousValue}` : null,
        afterValue: `${fieldLabel}: ${sce.newValue || "Set"}`,
        metadata: { field: sce.field, changeType: sce.changeType, reason: sce.reason },
      };
    }),

    // 4. Human Trade Document Uploads
    ...documents.map((doc) => ({
      id: `doc-ingest-${doc.id}`,
      action: "DOCUMENT_UPLOADED",
      category: "DOCUMENT_INGESTION" as const,
      title: `Trade Document Uploaded`,
      description: `Document '${doc.fileName}' (${doc.docType || "Trade Document"}) uploaded to vault`,
      source: "UI" as const,
      user: { name: "Document Vault User" },
      timestamp: doc.createdAt.toISOString(),
      metadata: { docType: doc.docType, status: doc.status, pageCount: doc.pageCount },
    })),

    // 5. Human Exception & Conflict Resolutions
    ...resolvedExceptions.map((ex) => ({
      id: `exception-resolved-${ex.id}`,
      action: "EXCEPTION_RESOLVED",
      category: "EXCEPTION_RESOLVED" as const,
      title: "Exception Resolved",
      description: `Resolved exception "${ex.description}"${ex.resolutionNote ? ` — ${ex.resolutionNote}` : ""}`,
      source: "UI" as const,
      user: { name: ex.resolvedByName || "Platform Admin" },
      timestamp: (ex.resolvedAt || ex.createdAt).toISOString(),
      beforeValue: "Status: Open",
      afterValue: `Status: ${ex.status}${ex.resolutionReasonCode ? ` (${ex.resolutionReasonCode})` : ""}`,
      metadata: { description: ex.description, type: ex.type, severity: ex.severity, resolutionNote: ex.resolutionNote, resolutionReasonCode: ex.resolutionReasonCode },
    })),
    ...resolvedReconciliations.map((rec) => ({
      id: `reconciliation-resolved-${rec.id}`,
      action: "RECONCILIATION_RESOLVED",
      category: "EXCEPTION_RESOLVED" as const,
      title: "Conflict Resolved",
      description: `Resolved data conflict on field '${rec.field}' (Expected: ${rec.expectedValue}, Actual: ${rec.actualValue})${rec.note ? ` — Note: ${rec.note}` : ""}`,
      source: "UI" as const,
      user: { name: rec.resolvedByUserName || "User" },
      timestamp: (rec.resolvedAt || rec.createdAt).toISOString(),
      beforeValue: `Expected: ${rec.expectedValue} vs Actual: ${rec.actualValue}`,
      afterValue: `Resolved: ${rec.resolution || "Confirmed"}`,
      metadata: { field: rec.field, resolution: rec.resolution, note: rec.note },
    })),

    // 6. Human Customs Filing Submissions
    ...customsFilings.map((filing) => ({
      id: `filing-submit-${filing.id}`,
      action: "FILING_SUBMITTED",
      category: "FILING_SUBMISSION" as const,
      title: `Submitted for Customs Filing`,
      description: `Submitted customs declaration entry summary ${filing.entryNumber || filing.localReferenceNumber || filing.id} for ${filing.country || "CBP"} processing`,
      source: "UI" as const,
      user: { name: "Customs Broker" },
      timestamp: (filing as unknown as { createdAt?: Date }).createdAt
        ? new Date((filing as unknown as { createdAt: Date }).createdAt).toISOString()
        : shipment.updatedAt.toISOString(),
      metadata: { entryNumber: filing.entryNumber, procedureCode: filing.procedureCode, country: filing.country },
    })),

    // 7. Human Shipment Creation
    {
      id: `shipment-created-${shipment.id}`,
      action: "SHIPMENT_CREATED",
      category: "SHIPMENT_MUTATION" as const,
      title: `Shipment Created`,
      description: `Shipment ${shipment.shipmentNumber} initialized in Operational Workspace`,
      source: "UI" as const,
      user: { name: fullShipment.client?.name || "Client User" },
      timestamp: shipment.createdAt.toISOString(),
    },
  ];

  combinedAuditEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const auditContent = (
    /* Secondary Audit Tab: Agent Executions & Event Logs */
    <div className="space-y-6">
      {/* Incremental Audit Log Table */}
      <ShipmentAuditTrail entries={combinedAuditEntries} />

      {/* Agent Execution Waterfall */}
      <div id="waterfall-view" className="apple-card p-6 rounded-3xl border border-border bg-white shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold text-ink flex items-center space-x-2">
            <Layers className="w-5 h-5 text-brand" />
            <span>Agent Execution Runs</span>
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Every agent run on this shipment, grouped by invocation. Expand a run to see the per-agent waterfall.
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-extrabold uppercase text-ink-muted tracking-wider">
            Run History ({agentInvocations.length})
          </h4>
          <AgentExecutionTimeline invocations={agentInvocations} shipmentId={shipment.id} />
        </div>
      </div>
    </div>
  );

  const trackingContent = <ShipmentTrackingPanel projection={trackingProjection} />;

  const clientActionsContent = (
    <ClientActionsPanel shipmentId={shipment.id} initialRequests={customerRequests as any} />
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner & Multi-Dimensional Readiness Header */}
      <div className="bg-white p-6 rounded-3xl border border-border shadow-2xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <ShipmentTitleEditor
              shipmentId={shipment.id}
              initialShipmentNumber={shipment.shipmentNumber}
              isEnterpriseAdmin={isEnterpriseAdmin}
            />
            <Badge variant="success" className="text-xs tracking-normal">
              {shipment.status}
            </Badge>
            <ShipmentClientEditor
              shipmentId={shipment.id}
              initialClientId={shipment.clientId}
              initialClientName={fullShipment.client?.name ?? null}
              clients={clients.map((c) => ({ id: c.id, name: c.name }))}
              canEdit={canEditClient}
            />
            <DestinationCountryEditor
              shipmentId={shipment.id}
              initialDestinationCountry={shipment.destinationCountry}
              canEdit={canEditClient}
            />
            {trackingProjection?.movement && trackingProjection.movement.status !== "UNKNOWN" && (
              <span
                className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-2xs border transition-all cursor-help ${
                  trackingProjection.movement.status === "IN_TRANSIT"
                    ? "bg-blue-50 text-blue-800 border-blue-200/80"
                    : trackingProjection.movement.status === "DELIVERED"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                    : trackingProjection.movement.status === "CANCELLED"
                    ? "bg-rose-50 text-rose-800 border-rose-200/80"
                    : "bg-slate-50 text-slate-700 border-slate-200/80"
                }`}
                title={trackingProjection.journey?.journeyStatus.headline || "Live tracking status"}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    trackingProjection.movement.status === "IN_TRANSIT"
                      ? "bg-blue-600 animate-pulse"
                      : trackingProjection.movement.status === "DELIVERED"
                      ? "bg-emerald-600"
                      : "bg-slate-400"
                  }`}
                />
                <span>{trackingProjection.movement.status.replace(/_/g, " ")}</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            {/* Health status badge — derived by CanonicalShipmentService or last reconciliation. */}
            <span
              title={
                freshHealthStatus === "Critical"
                  ? "Blocking exceptions or reconciliation conflicts prevent filing"
                  : freshHealthStatus === "At Risk"
                    ? "Open exceptions or missing data require attention before filing"
                    : "No blocking issues detected"
              }
              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border cursor-help ${freshHealthStatus === "Critical"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : freshHealthStatus === "At Risk"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
            >
              {freshHealthStatus}
            </span>

            {canManageJourney && (!trackingProjection?.journey?.legs || trackingProjection.journey.legs.length === 0) && (
              <AddTransportLegButton shipmentId={shipment.id} />
            )}

            {/* Readiness score — progress bar with percentage (recomputed live). */}
            <div className="flex items-center space-x-2" title={`Filing readiness: ${freshReadinessScore}%`}>
              <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${freshReadinessScore >= 80
                      ? "bg-emerald-500"
                      : freshReadinessScore >= 50
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                  style={{ width: `${freshReadinessScore}%` }}
                />
              </div>
              <span className="text-[10px] font-extrabold text-ink-muted tabular-nums">
                {freshReadinessScore}%
              </span>
            </div>

            {metrics.isReadyForFiling ? (
              <Link
                href={`/app/filing?shipmentId=${shipment.id}`}
                className="px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center space-x-2 bg-brand text-white hover:bg-brand/90"
              >
                <span>Send to Customs Filing</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              // Why it's disabled is already covered by the readiness
              // ribbon directly below (status headline + Compliance Risk
              // pill with its own "view" link) -- repeating it here was
              // duplicate messaging.
              <span
                aria-disabled="true"
                title="Resolve the blockers shown below to enable filing"
                className="px-4 py-2 text-xs font-bold rounded-xl shadow-2xs flex items-center space-x-2 bg-slate-100 text-slate-400 cursor-not-allowed"
              >
                <span>Send to Customs Filing</span>
              </span>
            )}
          </div>
        </div>

        {/* Unified Master Journey & Compliance Command Ribbon */}
        <JourneyRibbon
          data={trackingProjection?.journey}
          canManage={canManageJourney}
          documents={documents.map((d) => ({ id: d.id, fileName: d.fileName, docType: d.docType }))}
          readiness={{
            categories: readinessCategories,
            overallStatus: {
              text: overallStatusText,
              subtext: overallStatusSubtext,
              type: overallStatusType,
            },
            readinessBreakdown,
          }}
        />

        {/* On-demand compliance checks — embargo, PGA and reconciliation used to
            run only from the pipeline; a broker can now trigger each and see the
            result feed straight back into the readiness ribbon above. */}
        <ComplianceChecksPanel
          shipmentId={shipment.id}
          embargoInputs={{
            countryOfOrigin: shipment.countryOfOrigin ?? null,
            transshipmentPort: shipment.countryOfExport ?? null,
            // Shipment carries no manufacturer field; origin + transshipment are
            // the shipment-level signals the embargo rules match on.
            manufacturerLocation: null,
          }}
          initial={{
            pgaRequirementCount,
            openReconciliationIssues: reconciliationIssues.length,
            criticalReconciliationIssues: reconciliationIssues.filter((i) => i.severity === "Critical").length,
          }}
          canRunAiChecks={canRunAiChecks}
          canRunReconciliation={canRunReconciliation}
        />

        {/* The tile above only checks 3 shipment-level fields on demand;
            ComplianceAuditAgent already runs a broader embargo/sanctions
            pass automatically on upload/field edits -- surface that result
            too instead of leaving it reachable only via the raw AgentDecision
            row. */}
        <AutomaticEmbargoScreeningPanel
          status={automaticEmbargoStatus}
          findings={automaticEmbargoFindings}
          lastRunAt={latestComplianceAgentDecision?.createdAt.toISOString() ?? null}
        />

        {/* 5-item reasonable-care checklist (19 U.S.C. 1484) — classification,
            valuation, origin, PGA, recordkeeping. Recomputed from current
            shipment data; identical to the evaluation in the exported
            reasonable-care defense package. */}
        <ReasonableCareChecklistPanel evaluation={reasonableCareEvaluation} />

        {/* Restricted-party screening already runs automatically (Compliance
            Audit Agent, on upload / field edits) -- this surfaces its results
            here instead of only in the account-wide Compliance workspace. */}
        {canReadPartyScreening && <PartyScreeningPanel rows={partyScreeningRows} />}

        {/* Compliance Deadline Rail — every statutory and commercial clock for this
            shipment. Sits above the Exceptions/Field Review ribbon so it stays
            visible no matter which tab a broker is working in below it. */}
        <div className="bg-white p-5 rounded-3xl border border-border shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-3">Compliance Deadlines</h2>
          <DeadlineRail shipmentId={shipment.id} transportMode={shipment.transportMode} />
        </div>

        {/* Action Items -- unifies real DB-backed exceptions with missing
            required documents in one place, since these used to live in
            two independently-computed, silently-diverging spots */}
        <div id="exceptions-panel">
          <ExceptionsDrawer
            shipmentId={shipment.id}
            exceptionItems={activeExceptions}
            lineItems={displayLineItems}
            missingDocumentTypes={missingDocTypes}
            documentFieldSummaries={documentFieldSummaries}
            reconciliationIssues={reconciliationIssues}
          />
        </div>
      </div>

      {canReadPga && <ShipmentPgaHolds shipmentId={shipment.id} initialHoldId={searchParams.pgaHold} canUpdate={canUpdatePga} />}

      <ShipmentTabsPanel
        initialTab={activeTab}
        auditCount={combinedAuditEntries.length}
        clientActionCount={customerRequests.filter((r) => r.status !== "RESOLVED").length}
        workspaceContent={workspaceContent}
        trackingContent={trackingContent}
        clientActionsContent={clientActionsContent}
        filingContent={filingContent}
        auditContent={auditContent}
      />
    </div>
  );
  });
}
