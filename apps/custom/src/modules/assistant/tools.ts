import { Type, type FunctionDeclaration, type Schema } from "@google/genai";
import { z } from "zod";
import type { AccountContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveTeamMembers } from "@/lib/team";
// Lazy dynamic imports for route handlers to avoid compiling all routes on startup/first chat message
const getShipmentsRoute = () => import("@/app/api/shipments/route");
const getShipmentDetailRoute = () => import("@/app/api/shipments/[id]/route");
const getProductsRoute = () => import("@/app/api/products/route");
const getProductDetailRoute = () => import("@/app/api/products/[id]/route");
const getClassificationsRoute = () => import("@/app/api/products/[id]/classifications/route");
const getClassificationReviewRoute = () => import("@/app/api/products/[id]/classifications/[classificationId]/route");
const getPartiesRoute = () => import("@/app/api/parties/route");
const getDocumentsRoute = () => import("@/app/api/documents/route");
const getDocumentExtractionsRoute = () => import("@/app/api/documents/[id]/extractions/route");
const getDecisionsRoute = () => import("@/app/api/decisions/route");
const getExceptionsRoute = () => import("@/app/api/exceptions/[id]/route");
const getFilingRoute = () => import("@/app/api/filing/[id]/route");
const getCommunityScreeningListRoute = () => import("@/app/api/compliance/community-screening/route");
const getCommunityScreeningDetailRoute = () => import("@/app/api/compliance/community-screening/[id]/route");
const getCommunityScreeningResultsRoute = () => import("@/app/api/compliance/community-screening/[id]/results/route");
const getCommunityScreeningRescreenRoute = () => import("@/app/api/compliance/community-screening/[id]/rescreen/route");
const getCommunityScreeningExportRoute = () => import("@/app/api/compliance/community-screening/[id]/export/route");
import { ExceptionService } from "@/modules/exceptions/exception.service";
import { HtsSearchService } from "@/modules/hts/htsSearchService";
import { RulingService } from "@/modules/classification/rulingService";
import { calculateDutyStack, loadHtsCodesMap, parsePublishedDutyRate, type TariffLineInput } from "@/lib/tariff/dutyEngine";
import { ImpactAnalysisService } from "@/modules/regulatory/impactAnalysisService";
import { canUseTool } from "@/modules/assistant/shared/toolAccess";
import type { CopilotToolAccess } from "@/modules/assistant/shared/toolTypes";
import { holdsPermission } from "@/modules/product/productActor";
import { productActor } from "@/modules/product/productActor";
import { resolveOriginPosition, type CountryFactInput } from "@/modules/assistant/shared/origin";
import {
  resolveOwnedShipmentId as resolveOwnedShipmentIdByAccount,
  latestEmbargoScreening as latestEmbargoScreeningByAccount,
  buildScreeningResult,
  buildScreeningDetails,
} from "@/modules/agents/compliance/embargo/screeningQuery";
// Lazy import: pulls in the full agent pipeline, only needed when a rescreen is actually triggered.
const getPipelineOrchestrator = () => import("@/modules/agents/pipelineOrchestrator");
import { getProductHistory as getProductHistoryService } from "@/modules/product/productService";
import { getParty, getPartyHistory as getPartyHistoryService } from "@/modules/party/partyService";
import { partyActor } from "@/modules/party/partyActor";
import { partyDisplayName } from "@/modules/party/partyDisplay";
import { openStatusVariants } from "@/modules/exceptions/exceptionState";
import { getActionableDecisionWhereFilter } from "@/modules/decisions/decisionState";
import {
  DOCUMENT_ACTIONABLE_STATUSES,
  FILING_ACTIONABLE_STATUSES,
  FINDING_ACTIONABLE_STATUSES,
  buildWorkQueue,
  countByKind,
  countByPriority,
} from "@/modules/work/workQueue";
import {
  FILING_READINESS_MAX_CHECKS,
  evaluateFilingReadiness,
} from "@/modules/filing/filingReadiness";
import { doEmbargoCheck } from "@/modules/agents/compliance/embargo/doEmbargoCheck";
import { getAccountEmbargoConfig } from "@/modules/agents/compliance/embargo/embargoRepository";
import {
  rescreenParty,
  PartyHasNoActiveNameError,
} from "@/modules/agents/compliance/restrictedParty/partyScreeningLifecycle";
import { runRestrictedPartyScreening } from "@/modules/agents/compliance/restrictedParty/restrictedPartyScreening";
import { persistScreeningRun } from "@/modules/agents/compliance/restrictedParty/persistResult";
import { checkPreApprovalGate } from "@/modules/agents/compliance/restrictedParty/preApproval";
import { getNotificationStatusForScreeningResult } from "@/modules/compliance/notifications/notificationQueries";
import {
  getRun,
  listOutcomesForRun,
  listAlerts,
  listReferenceChanges,
  getReportsSummary,
  getPartyMonitoringHistory,
  triggerManualScan,
  RdpsFullPopulationAlreadyRunningError,
} from "@/modules/compliance/rdps/rdpsQueryService";
import { recordRdpsOutcome } from "@/modules/compliance/rdps/outcomeRecorder";
import { createAuditLog, AuditAction } from "@/lib/audit";

/**
 * Helper to convert Zod Object Schema into Gemini-compatible Schema object
 */
export function zodToGeminiSchema(zodSchema: z.ZodObject<any>): Schema {
  const shape = zodSchema.shape;
  const properties: Record<string, Schema> = {};
  const required: string[] = [];

  for (const [key, prop] of Object.entries(shape)) {
    let unwrapped: any = prop;
    let isOptional = false;
    const desc: string | undefined = (prop as any).description;

    while (unwrapped._def?.innerType || unwrapped._def?.schema) {
      if (unwrapped._def?.typeName === "ZodOptional" || unwrapped._def?.typeName === "ZodDefault") {
        if (unwrapped._def?.typeName === "ZodOptional") isOptional = true;
        unwrapped = unwrapped._def.innerType || unwrapped._def.schema;
      } else {
        break;
      }
    }

    if (!isOptional && (prop as any)._def?.typeName !== "ZodOptional" && (prop as any)._def?.typeName !== "ZodDefault") {
      required.push(key);
    }

    const typeName = unwrapped._def?.typeName;
    let type = Type.STRING;
    if (typeName === "ZodNumber") type = Type.NUMBER;
    else if (typeName === "ZodBoolean") type = Type.BOOLEAN;
    else if (typeName === "ZodArray") type = Type.ARRAY;
    else if (typeName === "ZodObject") type = Type.OBJECT;

    properties[key] = {
      type,
      ...(desc && { description: desc }),
    };
  }

  return {
    type: Type.OBJECT,
    properties,
    ...(required.length > 0 && { required }),
  };
}

export interface AssistantTool {
  declaration: FunctionDeclaration;
  schema: z.ZodObject<any>;
  access?: CopilotToolAccess;
  execute: (ctx: AccountContext, args: Record<string, unknown>) => Promise<unknown>;
}

// ---- shared shipment fetch (backs list_shipments and get_value_at_risk) ----

interface FetchedShipment {
  id: string;
  shipmentNumber: string;
  importerName: string;
  status: string;
  healthStatus: string | null;
  readinessScore: number | null;
  riskScore: number | null;
  assignedBrokerId: string | null;
  assignedBroker: { id: string; firstName: string | null; lastName: string | null } | null;
  clientId: string | null;
  client: { id: string; name: string } | null;
  estimatedArrival: string | null;
  lineItems: { totalValue: string | number }[];
  exceptionItems: { status: string; severity: string }[];
}

const SHIPMENT_FETCH_PAGE_SIZE = 100;
const SHIPMENT_FETCH_MAX_PAGES = 5;

async function fetchAllShipments(): Promise<FetchedShipment[]> {
  const all: FetchedShipment[] = [];
  const shipmentsGET = (await getShipmentsRoute()).GET;
  for (let page = 1; page <= SHIPMENT_FETCH_MAX_PAGES; page++) {
    const res = await shipmentsGET(
      new Request(`http://internal.local/api/shipments?pageSize=${SHIPMENT_FETCH_PAGE_SIZE}&page=${page}`)
    );
    if (!res.ok) break;
    const data = (await res.json()) as { shipments: FetchedShipment[] };
    all.push(...(data.shipments ?? []));
    if (!data.shipments || data.shipments.length < SHIPMENT_FETCH_PAGE_SIZE) break;
  }
  return all;
}

function shipmentValue(s: FetchedShipment): number {
  return s.lineItems.reduce((sum, li) => sum + Number(li.totalValue), 0);
}

const AT_RISK_READINESS_THRESHOLD = 85;
function isAtRisk(s: FetchedShipment): boolean {
  return (s.readinessScore ?? 100) < AT_RISK_READINESS_THRESHOLD;
}

function isOpenException(e: { status: string }): boolean {
  return e.status !== "RESOLVED" && e.status !== "WAIVED" && e.status !== "Resolved" && e.status !== "Waived";
}

function shipmentUrl(s: { id: string }): string {
  return `/app/shipments/${s.id}`;
}

// ---- deadline lookup ----

interface DeadlineInfo {
  deadlineType: string;
  dueAt: string;
  msRemaining: number;
  breached: boolean;
  estimated: boolean;
  exposureUsd: number | null;
}

const CRITICAL_WINDOW_MS = 24 * 60 * 60 * 1000;

async function fetchOpenDeadlinesByShipmentNumber(accountId: string): Promise<Map<string, DeadlineInfo>> {
  const rows = await db.complianceDeadline.findMany({
    where: { accountId, status: "OPEN", dueAt: { not: null } },
    select: {
      type: true,
      dueAt: true,
      estimated: true,
      penaltyEstimate: true,
      shipment: { select: { shipmentNumber: true } },
    },
    orderBy: { dueAt: "asc" },
  });

  const now = Date.now();
  const map = new Map<string, DeadlineInfo>();
  for (const d of rows) {
    const num = d.shipment?.shipmentNumber;
    if (!num || map.has(num) || !d.dueAt) continue;
    const msRemaining = d.dueAt.getTime() - now;
    map.set(num, {
      deadlineType: d.type,
      dueAt: d.dueAt.toISOString(),
      msRemaining,
      breached: msRemaining <= 0,
      estimated: d.estimated,
      exposureUsd: d.penaltyEstimate != null ? Number(d.penaltyEstimate) : null,
    });
  }
  return map;
}

function isCritical(info: DeadlineInfo | undefined): boolean {
  return info != null && info.msRemaining <= CRITICAL_WINDOW_MS;
}

// ---- tool: list_shipments ----

const listShipmentsSchema = z.object({
  unassigned: z.boolean().optional().describe("Only shipments with no assigned broker."),
  atRisk: z.boolean().optional().describe("Only shipments with a readiness score below 85."),
  critical: z.boolean().optional().describe("Only shipments with an open compliance deadline due within 24 hours."),
  clientId: z.string().optional().describe("Restrict to one client."),
  assignedToUserId: z.string().optional().describe("Restrict to one team member."),
});

const listShipments: AssistantTool = {
  schema: listShipmentsSchema,
  declaration: {
    name: "list_shipments",
    description: "List shipments, optionally filtered by assignment, risk, urgency, client, or assignee.",
    parameters: zodToGeminiSchema(listShipmentsSchema),
  },
  access: { navHref: "/app/shipments" },
  execute: async (ctx, rawArgs) => {
    const parsed = listShipmentsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const args = parsed.data;

    const shipments = await fetchAllShipments();
    const deadlines = args.critical ? await fetchOpenDeadlinesByShipmentNumber(ctx.accountId) : null;

    const filtered = shipments.filter((s) => {
      if (args.unassigned && s.assignedBrokerId) return false;
      if (args.atRisk && !isAtRisk(s)) return false;
      if (args.critical && !isCritical(deadlines?.get(s.shipmentNumber))) return false;
      if (args.clientId && s.clientId !== args.clientId) return false;
      if (args.assignedToUserId && s.assignedBrokerId !== args.assignedToUserId) return false;
      return true;
    });

    return {
      count: filtered.length,
      shipments: filtered.map((s) => ({
        shipmentNumber: s.shipmentNumber,
        importerName: s.importerName,
        status: s.status,
        healthStatus: s.healthStatus,
        readinessScore: s.readinessScore,
        value: shipmentValue(s),
        assignedBroker: s.assignedBroker
          ? [s.assignedBroker.firstName, s.assignedBroker.lastName].filter(Boolean).join(" ") || null
          : null,
        client: s.client?.name ?? null,
        estimatedArrival: s.estimatedArrival,
        openExceptionCount: s.exceptionItems.filter(isOpenException).length,
        deadline: args.critical ? (deadlines?.get(s.shipmentNumber) ?? null) : undefined,
        url: shipmentUrl(s),
      })),
    };
  },
};

// ---- tool: get_value_at_risk ----

const getValueAtRiskSchema = z.object({});

const getValueAtRisk: AssistantTool = {
  schema: getValueAtRiskSchema,
  declaration: {
    name: "get_value_at_risk",
    description: "Total declared value across shipments currently at risk (readiness score below 85) aligned with Command Center metrics.",
    parameters: zodToGeminiSchema(getValueAtRiskSchema),
  },
  access: { navHref: "/app/shipments" },
  execute: async (ctx) => {
    const shipments = await fetchAllShipments();
    const atRisk = shipments.filter(isAtRisk);
    const computeAnalyticsMetrics = (await import("@/lib/analytics/metricComputer")).computeAnalyticsMetrics;
    const analytics = await computeAnalyticsMetrics(ctx.accountId);
    return {
      shipmentCount: atRisk.length,
      totalValueAtRisk: atRisk.reduce((sum, s) => sum + shipmentValue(s), 0),
      openExceptions: analytics.openExceptions,
      filedEntries: analytics.filedEntries,
      shipments: atRisk.map((s) => ({
        shipmentNumber: s.shipmentNumber,
        importerName: s.importerName,
        status: s.status,
        assignedBroker: s.assignedBroker
          ? [s.assignedBroker.firstName, s.assignedBroker.lastName].filter(Boolean).join(" ") || null
          : null,
        readinessScore: s.readinessScore,
        value: shipmentValue(s),
        url: shipmentUrl(s),
      })),
    };
  },
};

// ---- tool: get_team_members ----

const getTeamMembersSchema = z.object({});

const getTeamMembers: AssistantTool = {
  schema: getTeamMembersSchema,
  declaration: {
    name: "get_team_members",
    description: "List active members of the current account (name, email, userId).",
    parameters: zodToGeminiSchema(getTeamMembersSchema),
  },
  execute: async (ctx) => {
    const members = await getActiveTeamMembers(ctx.accountId);
    return {
      count: members.length,
      members: members.map((m) => ({
        name: [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email,
        email: m.email,
        userId: m.userId,
      })),
    };
  },
};

// ---- tool: create_shipment ----

const createShipmentSchema = z.object({
  importerName: z.string().describe("Importer of record. Only required field."),
  clientId: z.string().optional(),
  poReference: z.string().optional(),
  entryType: z.string().optional(),
  incoterm: z.string().optional(),
  portOfEntry: z.string().optional(),
  carrierName: z.string().optional(),
  countryOfExport: z.string().optional(),
  estimatedArrival: z.string().optional().describe("ISO 8601 date."),
});

const createShipment: AssistantTool = {
  schema: createShipmentSchema,
  declaration: {
    name: "create_shipment",
    description: "Create a new shipment. Only call after explicit confirmation.",
    parameters: zodToGeminiSchema(createShipmentSchema),
  },
  access: { navHref: "/app/shipments", permission: "shipments.create" },
  execute: async (_ctx, rawArgs) => {
    const parsed = createShipmentSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const shipmentsPOST = (await getShipmentsRoute()).POST;
    const res = await shipmentsPOST(
      new Request("http://internal.local/api/shipments", {
        method: "POST",
        headers: { "content-type": "application/json", "x-qubere-source": "CHAT" },
        body: JSON.stringify(parsed.data),
      })
    );
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error ?? "Failed to create shipment" };
    return {
      success: true,
      shipmentId: data.shipment.id,
      shipmentNumber: data.shipment.shipmentNumber,
      url: `/app/shipments/${data.shipment.id}`,
    };
  },
};

// ---- tool: search_products ----

const searchProductsSchema = z.object({
  query: z.string().optional().describe("Free-text query matched against productName, sku, or description."),
  status: z.string().optional().describe("Filter by product status e.g. ACTIVE."),
});

const searchProducts: AssistantTool = {
  schema: searchProductsSchema,
  declaration: {
    name: "search_products",
    description: "Search products by name, SKU, description, or status.",
    parameters: zodToGeminiSchema(searchProductsSchema),
  },
  access: { navHref: "/app/products" },
  execute: async (_ctx, rawArgs) => {
    const parsed = searchProductsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { query, status } = parsed.data;

    const productsGET = (await getProductsRoute()).GET;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);

    const res = await productsGET(
      new Request(`http://internal.local/api/products?${params.toString()}`)
    );
    if (!res.ok) return { error: "Failed to fetch products" };
    const data = (await res.json()) as { products: { id: string; productName: string; sku: string | null; status: string }[]; total: number };
    return {
      total: data.total,
      products: (data.products ?? []).map((p) => ({
        id: p.id,
        name: p.productName,
        sku: p.sku,
        status: p.status,
        url: `/app/products/${p.id}`,
      })),
    };
  },
};

// ---- tool: search_parties ----

const searchPartiesSchema = z.object({
  query: z.string().optional().describe("Search query matched against legal name, party code, or tax identifier."),
  role: z.string().optional().describe("Role filter e.g. SUPPLIER, SELLER, IMPORTER."),
});

const searchParties: AssistantTool = {
  schema: searchPartiesSchema,
  declaration: {
    name: "search_parties",
    description: "Search trade parties by name, code, or role.",
    parameters: zodToGeminiSchema(searchPartiesSchema),
  },
  access: { navHref: "/app/parties" },
  execute: async (_ctx, rawArgs) => {
    const parsed = searchPartiesSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { query, role } = parsed.data;

    const partiesGET = (await getPartiesRoute()).GET;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (role) params.set("role", role);

    const res = await partiesGET(
      new Request(`http://internal.local/api/parties?${params.toString()}`)
    );
    if (!res.ok) return { error: "Failed to fetch parties" };
    const data = (await res.json()) as { parties: { id: string; legalName: string; partyCode: string | null; roles: string[]; status: string }[]; total: number };
    return {
      total: data.total,
      parties: (data.parties ?? []).map((p) => ({
        id: p.id,
        name: p.legalName,
        code: p.partyCode,
        roles: p.roles,
        status: p.status,
        url: `/app/parties/${p.id}`,
      })),
    };
  },
};

// ---- tool: search_documents ----

const searchDocumentsSchema = z.object({
  query: z.string().optional().describe("Search query matched against file name."),
  docType: z.string().optional().describe("Document type filter e.g. COMMERCIAL_INVOICE, PACKING_LIST."),
  shipmentId: z.string().optional().describe("Restrict search to a single shipment UUID."),
});

const searchDocuments: AssistantTool = {
  schema: searchDocumentsSchema,
  declaration: {
    name: "search_documents",
    description: "Search uploaded compliance documents by file name, docType, or shipmentId.",
    parameters: zodToGeminiSchema(searchDocumentsSchema),
  },
  access: { navHref: "/app/documents" },
  execute: async (_ctx, rawArgs) => {
    const parsed = searchDocumentsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { query, docType, shipmentId } = parsed.data;

    const documentsGET = (await getDocumentsRoute()).GET;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (docType) params.set("docType", docType);
    if (shipmentId) params.set("shipmentId", shipmentId);

    const res = await documentsGET(
      new Request(`http://internal.local/api/documents?${params.toString()}`)
    );
    if (!res.ok) return { error: "Failed to fetch documents" };
    const data = (await res.json()) as { documents: { id: string; fileName: string; docType: string | null; status: string; shipment: { shipmentNumber: string } | null }[]; total: number };
    return {
      total: data.total,
      documents: (data.documents ?? []).map((d) => ({
        id: d.id,
        fileName: d.fileName,
        docType: d.docType,
        status: d.status,
        shipmentNumber: d.shipment?.shipmentNumber ?? null,
      })),
    };
  },
};

// ---- tool: generate_reasonable_care_record ----

const generateReasonableCareRecordSchema = z.object({
  shipmentId: z.string().describe("Shipment UUID."),
});

const generateReasonableCareRecord: AssistantTool = {
  schema: generateReasonableCareRecordSchema,
  declaration: {
    name: "generate_reasonable_care_record",
    description: "Generate a Reasonable Care audit checklist and defense package for a shipment.",
    parameters: zodToGeminiSchema(generateReasonableCareRecordSchema),
  },
  access: { permission: "documents.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = generateReasonableCareRecordSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { shipmentId } = parsed.data;

    const pkgRoute = await import("@/app/api/audit/package/[shipmentId]/route");
    const res = await pkgRoute.GET(
      new Request(`http://internal.local/api/audit/package/${shipmentId}`),
      { params: Promise.resolve({ shipmentId }) }
    );
    if (!res.ok) return { error: "Shipment or audit package not found" };
    return res.json();
  },
};

// ---- tool: export_compliance_record ----

const exportComplianceRecordSchema = z.object({
  shipmentId: z.string().describe("Shipment UUID."),
});

const exportComplianceRecord: AssistantTool = {
  schema: exportComplianceRecordSchema,
  declaration: {
    name: "export_compliance_record",
    description: "Generate a signed ZIP archive export containing all compliance artifacts for a shipment.",
    parameters: zodToGeminiSchema(exportComplianceRecordSchema),
  },
  access: { navHref: "/app/documents" },
  execute: async (ctx, rawArgs) => {
    const parsed = exportComplianceRecordSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { shipmentId } = parsed.data;

    const exportRoute = await import("@/app/api/audit/export/route");
    const res = await exportRoute.POST(
      new Request("http://internal.local/api/audit/export", {
        method: "POST",
        headers: { "content-type": "application/json", "x-qubere-source": "CHAT" },
        body: JSON.stringify({ shipmentId }),
      })
    );
    if (!res.ok) return { error: "Failed to generate export archive" };
    return res.json();
  },
};

// ---- tool: get_shipment ----

const getShipmentSchema = z.object({
  shipmentId: z.string().describe("Shipment UUID or shipment number."),
});

const getShipment: AssistantTool = {
  schema: getShipmentSchema,
  declaration: {
    name: "get_shipment",
    description: "Fetch full details for one shipment by UUID or shipment number.",
    parameters: zodToGeminiSchema(getShipmentSchema),
  },
  access: { navHref: "/app/shipments" },
  execute: async (ctx, rawArgs) => {
    const parsed = getShipmentSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    let { shipmentId } = parsed.data;

    if (!shipmentId.includes("-")) {
      const match = await db.shipment.findFirst({
        where: { accountId: ctx.accountId, shipmentNumber: shipmentId },
        select: { id: true },
      });
      if (match) shipmentId = match.id;
    }

    const shipmentDetailGET = (await getShipmentDetailRoute()).GET;
    const res = await shipmentDetailGET(
      new Request(`http://internal.local/api/shipments/${shipmentId}`),
      { params: Promise.resolve({ id: shipmentId }) }
    );
    if (!res.ok) return { error: "Shipment not found" };
    return res.json();
  },
};

// ---- shared: Country Embargo Screening evidence lookup ----
//
// Country Embargo Screening (src/modules/agents/compliance/embargo/*) is a
// deterministic engine, never an LLM. These two tools are a read/explain
// layer over its persisted evidence -- they never re-derive or guess an
// embargo determination themselves. The lookup/presentation logic itself
// lives in screeningQuery.ts, shared with the partner-facing v1 API, so the
// two surfaces cannot drift apart on status semantics or presentation.

function resolveOwnedShipmentId(ctx: AccountContext, shipmentIdOrNumber: string) {
  return resolveOwnedShipmentIdByAccount(ctx.accountId, shipmentIdOrNumber);
}

function latestEmbargoScreening(ctx: AccountContext, shipmentId: string) {
  return latestEmbargoScreeningByAccount(ctx.accountId, shipmentId);
}

// ---- tool: screen_shipment_embargo ----

const screenShipmentEmbargoSchema = z.object({
  shipmentId: z.string().describe("Shipment UUID or shipment number."),
  forceRescreen: z
    .boolean()
    .optional()
    .describe(
      "Set true ONLY when the user explicitly asks to run or rescreen embargo screening again. Leave unset/false for explanatory questions -- the last completed screening is reused."
    ),
});

const screenShipmentEmbargo: AssistantTool = {
  schema: screenShipmentEmbargoSchema,
  declaration: {
    name: "screen_shipment_embargo",
    description:
      "Get the current deterministic Country Embargo Screening result for a shipment: status, hits, skipped checks, errors. Reuses the last completed screening unless forceRescreen is true or the shipment has never been screened. Use for 'is X embargoed', 'run embargo screening', 'rescreen shipment' questions -- not for explaining an existing result (use get_embargo_screening_details instead).",
    parameters: zodToGeminiSchema(screenShipmentEmbargoSchema),
  },
  access: { navHref: "/app/shipments" },
  execute: async (ctx, rawArgs) => {
    const parsed = screenShipmentEmbargoSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { shipmentId: rawShipmentId, forceRescreen } = parsed.data;

    const shipment = await resolveOwnedShipmentId(ctx, rawShipmentId);
    if (!shipment) return { error: "Shipment not found." };

    let evidence = await latestEmbargoScreening(ctx, shipment.id);
    let rescreened = false;
    let rescreenDenied = false;

    if (forceRescreen || !evidence) {
      // Triggering a fresh Compliance Audit Agent run is the same authorized
      // action as the existing "reconcile" control, so it is gated behind the
      // same permission -- a user who cannot manually rerun the pipeline in
      // the app cannot do it by asking the Copilot to either. Read-only
      // reuse of an existing result above is not gated by this permission.
      if (holdsPermission(ctx, "shipments.manage")) {
        const { PipelineOrchestrator } = await getPipelineOrchestrator();
        await PipelineOrchestrator.processEvent({
          shipmentId: shipment.id,
          accountId: ctx.accountId,
          userId: ctx.userId,
          triggerEvent: "RECONCILIATION_REQUESTED",
        });
        evidence = await latestEmbargoScreening(ctx, shipment.id);
        rescreened = true;
      } else if (forceRescreen) {
        rescreenDenied = true;
      }
    }

    return buildScreeningResult(shipment, evidence, { rescreened, rescreenDenied });
  },
};

// ---- tool: get_embargo_screening_details ----

const embargoScreeningLevelEnum = z.enum(["TRANSACTION", "PARTY", "LINE"]);
const embargoDirectionEnum = z.enum(["D", "O"]);
const embargoCheckResultEnum = z.enum(["HIT", "CLEAR", "SKIPPED", "ERROR"]);

const getEmbargoScreeningDetailsSchema = z.object({
  shipmentId: z.string().describe("Shipment UUID or shipment number."),
  lineItemId: z.string().optional().describe("Filter to embargo checks for one line item."),
  partyId: z.string().optional().describe("Filter to embargo checks for one party."),
  screeningLevel: embargoScreeningLevelEnum
    .optional()
    .describe("Filter to TRANSACTION, PARTY, or LINE level checks."),
  type: embargoDirectionEnum.optional().describe("Filter to D (destination) or O (origin) checks."),
  result: embargoCheckResultEnum.optional().describe("Filter to checks with this outcome."),
});

const getEmbargoScreeningDetails: AssistantTool = {
  schema: getEmbargoScreeningDetailsSchema,
  declaration: {
    name: "get_embargo_screening_details",
    description:
      "Investigate an already-completed Country Embargo Screening run for a shipment: why a check hit or cleared, which country/party/line was involved, audit counts (checks performed/passed/failed), skipped checks, and whether parties were screened. Reads persisted evidence only -- never reruns screening. Use for 'why did it fail', 'which checks passed', 'were all parties screened', 'show the audit' questions.",
    parameters: zodToGeminiSchema(getEmbargoScreeningDetailsSchema),
  },
  access: { navHref: "/app/shipments" },
  execute: async (ctx, rawArgs) => {
    const parsed = getEmbargoScreeningDetailsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { shipmentId: rawShipmentId, lineItemId, partyId, screeningLevel, type, result } = parsed.data;

    const shipment = await resolveOwnedShipmentId(ctx, rawShipmentId);
    if (!shipment) return { error: "Shipment not found." };

    const evidence = await latestEmbargoScreening(ctx, shipment.id);
    return buildScreeningDetails(shipment, evidence, { lineItemId, partyId, screeningLevel, type, result });
  },
};

// ---- shared: Community Screening lookups ----
//
// Community Screening (backend module already complete; routes built in
// parallel) screens restricted-party and embargo status for a bulk set of
// parties supplied via a spreadsheet/API upload. License Determination is
// explicitly out of scope for this feature -- any tool below that surfaces a
// screening outcome must make that clear rather than let the assistant imply
// a license check ran.

const COMMUNITY_SCREENING_LICENSE_NOTE =
  "License determination was not evaluated for this screening.";

interface CommunityScreeningRunSummary {
  id: string;
  status: string;
  source: string;
  inputMode: string;
  totalParties: number;
  passedCount: number;
  failedCount: number;
  incompleteCount: number;
  errorCount: number;
  createdAt: string;
  completedAt: string | null;
}

async function resolveLatestCommunityScreeningRun(
  status?: string
): Promise<CommunityScreeningRunSummary | null> {
  const listGET = (await getCommunityScreeningListRoute()).GET;
  const params = new URLSearchParams({ page: "1", pageSize: "1" });
  if (status) params.set("status", status);

  const res = await listGET(
    new Request(`http://internal.local/api/compliance/community-screening?${params.toString()}`)
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { runs: CommunityScreeningRunSummary[] };
  return data.runs?.[0] ?? null;
}

// ---- tool: get_latest_community_screening_run ----

const getLatestCommunityScreeningRunSchema = z.object({
  status: z.string().optional().describe("Optional run status filter, e.g. COMPLETED, RUNNING, FAILED."),
});

const getLatestCommunityScreeningRun: AssistantTool = {
  schema: getLatestCommunityScreeningRunSchema,
  declaration: {
    name: "get_latest_community_screening_run",
    description:
      "Get the most recent Community Screening run for the account (bulk restricted-party/embargo screening of a " +
      "party list), including totals passed/failed/incomplete/error. Use as a first step when the user doesn't " +
      "name a specific run id.",
    parameters: zodToGeminiSchema(getLatestCommunityScreeningRunSchema),
  },
  access: { navHref: "/app/compliance?tab=community-screening", permission: "compliance.communityScreening.read" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getLatestCommunityScreeningRunSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };

    const run = await resolveLatestCommunityScreeningRun(parsed.data.status);
    if (!run) return { error: "No community screening runs found" };
    return { run };
  },
};

// ---- tool: list_failed_community_screening_parties ----

const FAILED_COMMUNITY_SCREENING_STATUSES = new Set(["FAILED", "ERROR", "INCOMPLETE"]);
// Fetched with a single large page rather than one call per status to avoid
// three round trips; if a run's party count can plausibly exceed this, raise
// pageSize or paginate instead of relying on a single page.
const COMMUNITY_SCREENING_RESULTS_FETCH_PAGE_SIZE = 500;

const listFailedCommunityScreeningPartiesSchema = z.object({
  runId: z.string().describe("Community Screening run UUID; use get_latest_community_screening_run first if the user doesn't specify one."),
});

const listFailedCommunityScreeningParties: AssistantTool = {
  schema: listFailedCommunityScreeningPartiesSchema,
  declaration: {
    name: "list_failed_community_screening_parties",
    description:
      "List the parties in a Community Screening run whose aggregate status is FAILED, ERROR, or INCOMPLETE -- the " +
      "candidates for rescreening or manual review.",
    parameters: zodToGeminiSchema(listFailedCommunityScreeningPartiesSchema),
  },
  access: { navHref: "/app/compliance?tab=community-screening", permission: "compliance.communityScreening.read" },
  execute: async (_ctx, rawArgs) => {
    const parsed = listFailedCommunityScreeningPartiesSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { runId } = parsed.data;

    const resultsGET = (await getCommunityScreeningResultsRoute()).GET;
    const res = await resultsGET(
      new Request(
        `http://internal.local/api/compliance/community-screening/${runId}/results?page=1&pageSize=${COMMUNITY_SCREENING_RESULTS_FETCH_PAGE_SIZE}`
      ),
      { params: Promise.resolve({ id: runId }) }
    );
    if (!res.ok) return { error: "Community screening run not found" };

    const data = (await res.json()) as {
      run: unknown;
      results: Array<{
        id: string;
        rowNumber: number;
        snapshotName: string;
        snapshotCountry: string | null;
        externalReference: string | null;
        aggregateStatus: string;
        failureReason: string | null;
        errorMessage: string | null;
        restrictedPartyMatchFound: boolean | null;
        restrictedPartyRedFlagFound: boolean | null;
        restrictedPartyFindingCategory: string | null;
      }>;
      total: number;
    };

    const failed = (data.results ?? []).filter((r) => FAILED_COMMUNITY_SCREENING_STATUSES.has(r.aggregateStatus));
    return {
      runId,
      totalInRun: data.total,
      failedCount: failed.length,
      parties: failed.map((r) => ({
        partyRowId: r.id,
        rowNumber: r.rowNumber,
        name: r.snapshotName,
        country: r.snapshotCountry,
        externalReference: r.externalReference,
        status: r.aggregateStatus,
        failureReason: r.failureReason,
        errorMessage: r.errorMessage,
        // Independent findings -- a red flag never implies a denied-party
        // match and vice versa; see CommunityScreeningFindingCategory.
        restrictedPartyMatchFound: r.restrictedPartyMatchFound,
        restrictedPartyRedFlagFound: r.restrictedPartyRedFlagFound,
        restrictedPartyFindingCategory: r.restrictedPartyFindingCategory,
      })),
      licenseDeterminationNote: COMMUNITY_SCREENING_LICENSE_NOTE,
    };
  },
};

// ---- tool: explain_community_screening_party_failure ----
//
// Evidence-only, same convention as get_embargo_screening_details: reads a
// persisted CommunityScreeningPartyResult row and returns it verbatim. Never
// re-derives or guesses a determination.

const explainCommunityScreeningPartyFailureSchema = z.object({
  runId: z.string().describe("Community Screening run UUID."),
  partyRowId: z.string().optional().describe("The CommunityScreeningPartyResult id. Provide this or partyName."),
  partyName: z.string().optional().describe("Party name to match case-insensitively against the run's results. Provide this or partyRowId."),
});

const explainCommunityScreeningPartyFailure: AssistantTool = {
  schema: explainCommunityScreeningPartyFailureSchema,
  declaration: {
    name: "explain_community_screening_party_failure",
    description:
      "Evidence-only explanation of why one party in a Community Screening run failed, errored, or was incomplete: " +
      "restricted-party status, embargo status, overall status, and any failure/error message. Reads persisted " +
      "results only -- never re-derives or guesses a determination, and license determination is explicitly out " +
      "of scope for this feature.",
    parameters: zodToGeminiSchema(explainCommunityScreeningPartyFailureSchema),
  },
  access: { navHref: "/app/compliance?tab=community-screening", permission: "compliance.communityScreening.read" },
  execute: async (_ctx, rawArgs) => {
    const parsed = explainCommunityScreeningPartyFailureSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { runId, partyRowId, partyName } = parsed.data;

    if (!partyRowId && !partyName) {
      return { error: "Either partyRowId or partyName must be provided." };
    }

    const resultsGET = (await getCommunityScreeningResultsRoute()).GET;
    const res = await resultsGET(
      new Request(
        `http://internal.local/api/compliance/community-screening/${runId}/results?page=1&pageSize=${COMMUNITY_SCREENING_RESULTS_FETCH_PAGE_SIZE}`
      ),
      { params: Promise.resolve({ id: runId }) }
    );
    if (!res.ok) return { error: "Community screening run not found" };

    const data = (await res.json()) as {
      results: Array<{
        id: string;
        snapshotName: string;
        snapshotCountry: string | null;
        restrictedPartyStatus: string | null;
        embargoStatus: string | null;
        aggregateStatus: string;
        failureReason: string | null;
        errorMessage: string | null;
        restrictedPartyMatchFound: boolean | null;
        restrictedPartyRedFlagFound: boolean | null;
        restrictedPartyFindingCategory: string | null;
      }>;
    };

    const match = partyRowId
      ? data.results.find((r) => r.id === partyRowId)
      : data.results.find((r) => r.snapshotName?.toLowerCase() === partyName!.toLowerCase());

    if (!match) return { error: "Party result not found in this community screening run." };

    return {
      partyName: match.snapshotName,
      country: match.snapshotCountry,
      restrictedPartyStatus: match.restrictedPartyStatus,
      embargoStatus: match.embargoStatus,
      overallStatus: match.aggregateStatus,
      failureReason: match.failureReason,
      errorMessage: match.errorMessage,
      // Independent findings -- a denied-party match and a red flag are
      // never the same thing, and a PAL-suppressed row never ran the
      // matcher at all. See CommunityScreeningFindingCategory.
      restrictedPartyMatchFound: match.restrictedPartyMatchFound,
      restrictedPartyRedFlagFound: match.restrictedPartyRedFlagFound,
      restrictedPartyFindingCategory: match.restrictedPartyFindingCategory,
      licenseDeterminationNote: COMMUNITY_SCREENING_LICENSE_NOTE,
    };
  },
};

// ---- tool: rescreen_failed_community_screening_parties ----

const rescreenFailedCommunityScreeningPartiesSchema = z.object({
  runId: z.string().describe("Community Screening run UUID to rescreen. Only its FAILED/ERROR/INCOMPLETE rows are re-run, in place."),
});

const rescreenFailedCommunityScreeningParties: AssistantTool = {
  schema: rescreenFailedCommunityScreeningPartiesSchema,
  declaration: {
    name: "rescreen_failed_community_screening_parties",
    description:
      "Re-run screening for only the FAILED/ERROR/INCOMPLETE rows of a Community Screening run, in place. " +
      "Only call after explicit confirmation. License determination is not part of what runs.",
    parameters: zodToGeminiSchema(rescreenFailedCommunityScreeningPartiesSchema),
  },
  access: { navHref: "/app/compliance?tab=community-screening", permission: "compliance.communityScreening.screen" },
  execute: async (_ctx, rawArgs) => {
    const parsed = rescreenFailedCommunityScreeningPartiesSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { runId } = parsed.data;

    const rescreenPOST = (await getCommunityScreeningRescreenRoute()).POST;
    const res = await rescreenPOST(
      new Request(`http://internal.local/api/compliance/community-screening/${runId}/rescreen`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: runId }) }
    );
    if (!res.ok) return { error: "Community screening run not found" };
    const data = await res.json();
    return { run: data.run, licenseDeterminationNote: COMMUNITY_SCREENING_LICENSE_NOTE };
  },
};

// ---- tool: export_latest_community_screening_run ----
//
// The underlying export route returns a raw file body (Content-Disposition
// attachment), not JSON with a link -- unlike export_compliance_record's
// route, which returns JSON containing a downloadUrl. A tool result can't
// hand the user a literal file, so this returns file metadata plus the bytes
// base64-encoded; the description tells the assistant to point users at the
// results page's Export button for an actual download.

const exportLatestCommunityScreeningRunSchema = z.object({
  format: z.enum(["csv", "xlsx"]).optional().describe("Export file format. Defaults to csv."),
  runId: z.string().optional().describe("Community Screening run UUID. Defaults to the latest run if omitted."),
});

const exportLatestCommunityScreeningRun: AssistantTool = {
  schema: exportLatestCommunityScreeningRunSchema,
  declaration: {
    name: "export_latest_community_screening_run",
    description:
      "Export a Community Screening run's results as CSV or XLSX. Returns export metadata (file name, content " +
      "type, size) rather than a downloadable file -- direct users to the results page's Export button to " +
      "download the file themselves.",
    parameters: zodToGeminiSchema(exportLatestCommunityScreeningRunSchema),
  },
  access: { navHref: "/app/compliance?tab=community-screening", permission: "compliance.communityScreening.read" },
  execute: async (_ctx, rawArgs) => {
    const parsed = exportLatestCommunityScreeningRunSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { format, runId: providedRunId } = parsed.data;

    let runId = providedRunId;
    if (!runId) {
      const latest = await resolveLatestCommunityScreeningRun();
      if (!latest) return { error: "No community screening runs found" };
      runId = latest.id;
    }

    const exportGET = (await getCommunityScreeningExportRoute()).GET;
    const res = await exportGET(
      new Request(
        `http://internal.local/api/compliance/community-screening/${runId}/export?format=${format ?? "csv"}`
      ),
      { params: Promise.resolve({ id: runId }) }
    );
    if (!res.ok) return { error: "Community screening run not found" };

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const disposition = res.headers.get("content-disposition") ?? "";
    const fileNameMatch = disposition.match(/filename="?([^"]+)"?/);
    const fileName = fileNameMatch?.[1] ?? `community-screening-${runId}.${format ?? "csv"}`;
    const bytes = Buffer.from(await res.arrayBuffer());

    return {
      runId,
      fileName,
      contentType,
      sizeBytes: bytes.length,
      contentBase64: bytes.toString("base64"),
      downloadNote: "This tool cannot hand you the file directly -- use the Export button on the community screening results page to download it.",
      licenseDeterminationNote: COMMUNITY_SCREENING_LICENSE_NOTE,
    };
  },
};

// ---- tool: list_exceptions ----

const listExceptionsSchema = z.object({
  shipmentId: z.string().optional().describe("Optional shipment UUID filter."),
});

const listExceptions: AssistantTool = {
  schema: listExceptionsSchema,
  declaration: {
    name: "list_exceptions",
    description: "List unresolved compliance exceptions for the account or for a specific shipment.",
    parameters: zodToGeminiSchema(listExceptionsSchema),
  },
  access: { navHref: "/app/exceptions" },
  execute: async (ctx, rawArgs) => {
    const parsed = listExceptionsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { shipmentId } = parsed.data;

    const { exceptions: items } = await ExceptionService.listExceptions(ctx.accountId, ctx.userId, {
      ...(shipmentId && { shipmentId }),
      status: "OPEN",
    });
    return {
      count: items.length,
      exceptions: items.map((e) => ({
        id: e.id,
        category: e.category,
        title: e.description,
        severity: e.severity,
        status: e.status,
        version: e.version,
        shipmentNumber: e.shipment?.shipmentNumber ?? null,
        url: `/app/exceptions/${e.id}`,
      })),
    };
  },
};

// ---- tool: get_document ----

const getDocumentSchema = z.object({
  documentId: z.string().describe("Document UUID."),
});

const getDocument: AssistantTool = {
  schema: getDocumentSchema,
  declaration: {
    name: "get_document",
    description: "Fetch metadata and extracted fields for a document.",
    parameters: zodToGeminiSchema(getDocumentSchema),
  },
  access: { navHref: "/app/documents" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getDocumentSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { documentId } = parsed.data;

    const extractionsGET = (await getDocumentExtractionsRoute()).GET;
    const res = await extractionsGET(
      new Request(`http://internal.local/api/documents/${documentId}/extractions`),
      { params: Promise.resolve({ id: documentId }) }
    );
    if (!res.ok) return { error: "Document not found" };
    return res.json();
  },
};

// ---- tool: list_decisions ----

const listDecisionsSchema = z.object({
  shipmentId: z.string().optional().describe("Optional shipment UUID filter."),
});

const listDecisions: AssistantTool = {
  schema: listDecisionsSchema,
  declaration: {
    name: "list_decisions",
    description: "List pending AI-proposed decisions awaiting human review.",
    parameters: zodToGeminiSchema(listDecisionsSchema),
  },
  access: { navHref: "/app/decisions" },
  execute: async (_ctx, rawArgs) => {
    const parsed = listDecisionsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { shipmentId } = parsed.data;

    const decisionsGET = (await getDecisionsRoute()).GET;
    const params = new URLSearchParams();
    if (shipmentId) params.set("shipmentId", shipmentId);

    const res = await decisionsGET(
      new Request(`http://internal.local/api/decisions?${params.toString()}`)
    );
    if (!res.ok) return { error: "Failed to fetch decisions" };
    return res.json();
  },
};

// ---- tool: get_product ----

const getProductSchema = z.object({
  productId: z.string().describe("Product UUID."),
});

const getProduct: AssistantTool = {
  schema: getProductSchema,
  declaration: {
    name: "get_product",
    description: "Fetch full product master record, classifications, and value history.",
    parameters: zodToGeminiSchema(getProductSchema),
  },
  access: { navHref: "/app/products" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getProductSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { productId } = parsed.data;

    const productDetailGET = (await getProductDetailRoute()).GET;
    const res = await productDetailGET(
      new Request(`http://internal.local/api/products/${productId}`),
      { params: Promise.resolve({ id: productId }) }
    );
    if (!res.ok) return { error: "Product not found" };
    return res.json();
  },
};

// ---- tool: get_product_origin_position ----

const getProductOriginPositionSchema = z.object({
  productId: z.string().describe("Product UUID."),
});

const getProductOriginPosition: AssistantTool = {
  schema: getProductOriginPositionSchema,
  declaration: {
    name: "get_product_origin_position",
    description:
      "Resolve a product's legal country-of-origin position from its recorded country facts. " +
      "This is the only source of truth for country of origin -- never infer it from manufacturing, " +
      "production, supplier, or ship-from country. Returns a finished statement to quote verbatim.",
    parameters: zodToGeminiSchema(getProductOriginPositionSchema),
  },
  access: { navHref: "/app/products", permission: "products.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = getProductOriginPositionSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { productId } = parsed.data;

    const facts = await db.productCountryFact.findMany({
      where: { accountId: ctx.accountId, productId },
      select: {
        factType: true,
        rawCountry: true,
        countryCode: true,
        status: true,
        effectiveTo: true,
        reviewedAt: true,
      },
    });
    if (facts.length === 0) return { error: "No country facts recorded for this product." };

    return resolveOriginPosition(facts as CountryFactInput[]);
  },
};

// ---- tool: search_hts ----

const searchHtsSchema = z.object({
  query: z.string().describe("HTS code or keyword search query."),
});

const searchHts: AssistantTool = {
  schema: searchHtsSchema,
  declaration: {
    name: "search_hts",
    description: "Search the Harmonized Tariff Schedule (HTSUS) by code or keyword.",
    parameters: zodToGeminiSchema(searchHtsSchema),
  },
  access: { navHref: "/app/hts" },
  execute: async (_ctx, rawArgs) => {
    const parsed = searchHtsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { query } = parsed.data;

    return HtsSearchService.search({ q: query, limit: 10 });
  },
};

// ---- tool: search_rulings ----

const searchRulingsSchema = z.object({
  query: z.string().describe("Keyword query for CBP rulings."),
});

const searchRulings: AssistantTool = {
  schema: searchRulingsSchema,
  declaration: {
    name: "search_rulings",
    description: "Search CBP CROSS administrative rulings database.",
    parameters: zodToGeminiSchema(searchRulingsSchema),
  },
  access: { navHref: "/app/rulings" },
  execute: async (_ctx, rawArgs) => {
    const parsed = searchRulingsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { query } = parsed.data;

    return RulingService.searchRulings({ query, limit: 10 });
  },
};

// ---- tool: get_duty_stack ----

const getDutyStackSchema = z.object({
  htsCode: z.string().describe("HTS classification code."),
  countryOfOrigin: z.string().optional().describe("2-letter ISO country code."),
  enteredValueUsd: z.number().optional().describe("Entered value in USD."),
});

const getDutyStack: AssistantTool = {
  schema: getDutyStackSchema,
  declaration: {
    name: "get_duty_stack",
    description: "Calculate full duty stack (Chapter 1-97, Section 301, AD/CVD, MPF, HMF).",
    parameters: zodToGeminiSchema(getDutyStackSchema),
  },
  access: { navHref: "/app/duty-calculator" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getDutyStackSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { htsCode, countryOfOrigin, enteredValueUsd } = parsed.data;

    const line: TariffLineInput = {
      htsCode,
      countryOfOrigin: countryOfOrigin ?? "CN",
      totalValue: enteredValueUsd ?? 10000,
    };
    const htsMap = await loadHtsCodesMap([line]);
    return calculateDutyStack(line, htsMap[htsCode ?? ""] ?? null);
  },
};

// ---- tool: get_regulatory_updates ----

const getRegulatoryUpdatesSchema = z.object({
  limit: z.number().optional().default(5).describe("Max updates to return."),
});

const getRegulatoryUpdates: AssistantTool = {
  schema: getRegulatoryUpdatesSchema,
  declaration: {
    name: "get_regulatory_updates",
    description: "Fetch recent trade regulatory updates and Federal Register notices.",
    parameters: zodToGeminiSchema(getRegulatoryUpdatesSchema),
  },
  access: { navHref: "/app/regulatory" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getRegulatoryUpdatesSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const limit = parsed.data.limit ?? 5;

    const updates = await db.regulatoryUpdate.findMany({
      orderBy: { effectiveDate: "desc" },
      take: limit,
    });
    return { count: updates.length, updates };
  },
};

// ---- tool: get_filing_status ----

const getFilingStatusSchema = z.object({
  shipmentId: z.string().optional().describe("Shipment UUID."),
  filingId: z.string().optional().describe("Filing UUID."),
});

const getFilingStatus: AssistantTool = {
  schema: getFilingStatusSchema,
  declaration: {
    name: "get_filing_status",
    description: "Get CBP Form 7501 filing status and entry summary details.",
    parameters: zodToGeminiSchema(getFilingStatusSchema),
  },
  access: { navHref: "/app/filing" },
  execute: async (ctx, rawArgs) => {
    const parsed = getFilingStatusSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { shipmentId } = parsed.data;
    let { filingId } = parsed.data;

    if (!filingId && shipmentId) {
      const match = await db.customsFiling.findFirst({
        where: { accountId: ctx.accountId, shipmentId },
        select: { id: true },
      });
      if (match) filingId = match.id;
    }
    if (!filingId) return { error: "Filing not found for shipment" };

    const filingGET = (await getFilingRoute()).GET;
    const res = await filingGET(
      new Request(`http://internal.local/api/filing/${filingId}`),
      { params: Promise.resolve({ id: filingId }) }
    );
    if (!res.ok) return { error: "Filing not found" };
    return res.json();
  },
};

// ---- tool: run_impact_analysis ----

const runImpactAnalysisSchema = z.object({});

const runImpactAnalysis: AssistantTool = {
  schema: runImpactAnalysisSchema,
  declaration: {
    name: "run_impact_analysis",
    description: "Run portfolio-wide regulatory impact analysis across shipments and products.",
    parameters: zodToGeminiSchema(runImpactAnalysisSchema),
  },
  access: { permission: "regulatory.review" },
  execute: async (ctx) => {
    return ImpactAnalysisService.analyzePortfolioImpact({ accountId: ctx.accountId });
  },
};

// ---- tool: approve_decision ----

const approveDecisionSchema = z.object({
  decisionId: z.string().describe("AgentDecision UUID."),
  humanNotes: z.string().optional().describe("Optional note explaining the approval."),
});

const approveDecision: AssistantTool = {
  schema: approveDecisionSchema,
  declaration: {
    name: "approve_decision",
    description: "Approve a proposed decision, applying its classification/value to the shipment.",
    parameters: zodToGeminiSchema(approveDecisionSchema),
  },
  access: { permission: "decisions.approve" },
  execute: async (_ctx, rawArgs) => {
    const parsed = approveDecisionSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { decisionId, humanNotes } = parsed.data;

    const decisionsPOST = (await getDecisionsRoute()).POST;
    const res = await decisionsPOST(
      new Request("http://internal.local/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json", "x-qubere-source": "CHAT" },
        body: JSON.stringify({ decisionId, action: "APPROVE", humanNotes, source: "CHAT" }),
      })
    );
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error ?? "Failed to approve decision" };
    return { success: true, decision: data.decision, classificationApplied: data.classificationApplied };
  },
};

// ---- tool: reject_decision ----

const rejectDecisionSchema = z.object({
  decisionId: z.string().describe("AgentDecision UUID."),
  humanNotes: z.string().describe("Required reason for rejection."),
});

const rejectDecision: AssistantTool = {
  schema: rejectDecisionSchema,
  declaration: {
    name: "reject_decision",
    description: "Reject a proposed decision, flagging the line for re-review.",
    parameters: zodToGeminiSchema(rejectDecisionSchema),
  },
  access: { permission: "decisions.reject" },
  execute: async (_ctx, rawArgs) => {
    const parsed = rejectDecisionSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { decisionId, humanNotes } = parsed.data;

    const decisionsPOST = (await getDecisionsRoute()).POST;
    const res = await decisionsPOST(
      new Request("http://internal.local/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json", "x-qubere-source": "CHAT" },
        body: JSON.stringify({ decisionId, action: "REJECT", humanNotes, source: "CHAT" }),
      })
    );
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error ?? "Failed to reject decision" };
    return { success: true, decision: data.decision };
  },
};

// ---- tool: resolve_exception ----

const resolveExceptionSchema = z.object({
  exceptionId: z.string().describe("ExceptionItem UUID."),
  reasonCode: z.string().describe("Resolution reason code."),
  note: z.string().describe("Explanation note."),
});

const resolveException: AssistantTool = {
  schema: resolveExceptionSchema,
  declaration: {
    name: "resolve_exception",
    description: "Resolve an open exception with a reason code and note.",
    parameters: zodToGeminiSchema(resolveExceptionSchema),
  },
  access: { permission: "exceptions.resolve" },
  execute: async (_ctx, rawArgs) => {
    const parsed = resolveExceptionSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { exceptionId, reasonCode, note } = parsed.data;

    const exceptionDetailGET = (await getExceptionsRoute()).GET;
    const exceptionPATCH = (await getExceptionsRoute()).PATCH;

    const current = await exceptionDetailGET(
      new Request(`http://internal.local/api/exceptions/${exceptionId}`),
      { params: Promise.resolve({ id: exceptionId }) }
    );
    if (!current.ok) return { success: false, error: "Exception not found" };
    const currentData = (await current.json()) as { exception: { version: number } };

    const res = await exceptionPATCH(
      new Request(`http://internal.local/api/exceptions/${exceptionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-qubere-source": "CHAT" },
        body: JSON.stringify({
          status: "RESOLVED",
          resolutionReasonCode: reasonCode,
          resolutionReason: note,
          expectedVersion: currentData.exception.version,
          source: "CHAT",
        }),
      }),
      { params: Promise.resolve({ id: exceptionId }) }
    );
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error ?? "Failed to resolve exception" };
    return { success: true, exception: data.exception };
  },
};

// ---- tool: classify_product ----

const classifyProductSchema = z.object({
  productId: z.string().describe("Product UUID."),
  htsCode: z.string().describe("HTS classification code."),
  overrideReason: z.string().optional().describe("Reason for classification."),
});

const classifyProduct: AssistantTool = {
  schema: classifyProductSchema,
  declaration: {
    name: "classify_product",
    description: "Propose and approve an HTS classification for a product in one step.",
    parameters: zodToGeminiSchema(classifyProductSchema),
  },
  access: { permission: "products.classification.approve" },
  execute: async (_ctx, rawArgs) => {
    const parsed = classifyProductSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { productId, htsCode, overrideReason } = parsed.data;

    const classificationsPOST = (await getClassificationsRoute()).POST;
    const classificationReviewPOST = (await getClassificationReviewRoute()).POST;

    const proposeRes = await classificationsPOST(
      new Request(`http://internal.local/api/products/${productId}/classifications`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-qubere-source": "CHAT" },
        body: JSON.stringify({
          jurisdiction: "US",
          nomenclature: "HTS",
          classificationCode: htsCode,
          decisionMethod: "MANUAL",
          source: "CHAT",
        }),
      }),
      { params: Promise.resolve({ id: productId }) }
    );
    const proposeData = await proposeRes.json();
    if (!proposeRes.ok) {
      return { success: false, step: "propose", error: proposeData.error ?? "Failed to propose classification" };
    }
    const classificationId = proposeData.classification.id as string;

    const startReviewRes = await classificationReviewPOST(
      new Request(`http://internal.local/api/products/${productId}/classifications/${classificationId}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-qubere-source": "CHAT" },
        body: JSON.stringify({ action: "START_REVIEW", source: "CHAT" }),
      }),
      { params: Promise.resolve({ id: productId, classificationId }) }
    );
    const startReviewData = await startReviewRes.json();
    if (!startReviewRes.ok) {
      return { success: false, step: "start_review", error: startReviewData.error ?? "Failed to start review" };
    }

    const approveRes = await classificationReviewPOST(
      new Request(`http://internal.local/api/products/${productId}/classifications/${classificationId}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-qubere-source": "CHAT" },
        body: JSON.stringify({ action: "APPROVE", reviewNote: overrideReason, source: "CHAT" }),
      }),
      { params: Promise.resolve({ id: productId, classificationId }) }
    );
    const approveData = await approveRes.json();
    if (!approveRes.ok) {
      return { success: false, step: "approve", error: approveData.error ?? "Failed to approve classification" };
    }
    return { success: true, classification: approveData.classification };
  },
};

// ---- tool: get_classification_rationale (Task D-2) ----

const getClassificationRationaleSchema = z.object({
  productId: z.string().describe("Product UUID."),
});

const getClassificationRationale: AssistantTool = {
  schema: getClassificationRationaleSchema,
  declaration: {
    name: "get_classification_rationale",
    description: "Get full GRI classification rationale, evidence items, and ruling citations for a product.",
    parameters: zodToGeminiSchema(getClassificationRationaleSchema),
  },
  access: { permission: "products.read" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getClassificationRationaleSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { productId } = parsed.data;

    const rationaleRoute = await import("@/app/api/products/[id]/classification-rationale/route");
    const res = await rationaleRoute.GET(
      new Request(`http://internal.local/api/products/${productId}/classification-rationale`),
      { params: Promise.resolve({ id: productId }) }
    );
    if (!res.ok) return { error: "Classification rationale not found for product" };
    return res.json();
  },
};

// ---- tool: get_duty_exposure_risks (Task D-3) ----

const getDutyExposureRisksSchema = z.object({
  limit: z.number().optional().default(3).describe("Number of top duty risk items to return."),
});

const getDutyExposureRisks: AssistantTool = {
  schema: getDutyExposureRisksSchema,
  declaration: {
    name: "get_duty_exposure_risks",
    description: "Retrieve top duty exposure risks aggregated across portfolio line items by dollar value.",
    parameters: zodToGeminiSchema(getDutyExposureRisksSchema),
  },
  access: { permission: "analytics.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = getDutyExposureRisksSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const limit = parsed.data.limit ?? 3;

    const lineItems = await db.shipmentLineItem.findMany({
      where: { accountId: ctx.accountId, shipment: { status: { notIn: ["FILED", "ARCHIVED", "CANCELLED"] } } },
      include: { shipment: { select: { shipmentNumber: true, importerName: true } } },
      take: 200,
    });

    const htsMap = await loadHtsCodesMap(lineItems);
    const risks = lineItems.map((li) => {
      const value = Number(li.totalValue ?? 0);
      const hts = li.htsCode ? htsMap[li.htsCode] : null;
      const parsedRate = hts?.generalDutyRate ? parsePublishedDutyRate(hts.generalDutyRate) : null;
      const rate = parsedRate !== null ? parsedRate : 0.05;
      const estimatedDuty = value * rate;
      return {
        lineItemId: li.id,
        shipmentNumber: li.shipment?.shipmentNumber ?? "Unknown",
        importerName: li.shipment?.importerName ?? "Unknown",
        description: li.description || "Unclassified line item",
        htsCode: li.htsCode ?? "UNCLASSIFIED",
        enteredValue: value,
        dutyRate: rate,
        estimatedDuty,
        riskFactor: !li.htsCode ? "MISSING_CLASSIFICATION" : value > 50000 ? "HIGH_VALUE" : "STANDARD_DUTY",
      };
    });

    risks.sort((a, b) => b.estimatedDuty - a.estimatedDuty);
    const topRisks = risks.slice(0, limit);
    const totalExposure = risks.reduce((sum, r) => sum + r.estimatedDuty, 0);

    return {
      topRisks,
      totalExposure,
      itemCount: risks.length,
    };
  },
};

// ---- tool: validate_shipment_filing (Task D-4) ----

const validateShipmentFilingSchema = z.object({
  shipmentId: z.string().optional().describe("Shipment UUID."),
  filingId: z.string().optional().describe("CustomsFiling UUID."),
});

const validateShipmentFiling: AssistantTool = {
  schema: validateShipmentFilingSchema,
  declaration: {
    name: "validate_shipment_filing",
    description: "Run pre-filing validation on a shipment and return plain-English readiness score and blocker explanations.",
    parameters: zodToGeminiSchema(validateShipmentFilingSchema),
  },
  access: { permission: "filing.validate" },
  execute: async (ctx, rawArgs) => {
    const parsed = validateShipmentFilingSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { shipmentId, filingId } = parsed.data;

    let targetFilingId = filingId;
    if (!targetFilingId && shipmentId) {
      const filing = await db.customsFiling.findFirst({
        where: { shipmentId, accountId: ctx.accountId },
        select: { id: true },
      });
      if (filing) targetFilingId = filing.id;
    }

    if (!targetFilingId) {
      return { error: "No customs filing record found for the specified shipment." };
    }

    const validateRoute = await import("@/app/api/filing/[id]/validate/route");
    const res = await validateRoute.POST(
      new Request(`http://internal.local/api/filing/${targetFilingId}/validate`, { method: "POST" }),
      { params: Promise.resolve({ id: targetFilingId }) }
    );
    if (!res.ok) return { error: "Failed to validate filing readiness" };
    return res.json();
  },
};

// ---- tool: get_product_history ----

const getProductHistorySchema = z.object({
  productId: z.string().describe("Product UUID."),
  limit: z.number().int().min(1).max(50).optional().describe("Maximum change events to return, newest first."),
});

const getProductHistoryTool: AssistantTool = {
  schema: getProductHistorySchema,
  declaration: {
    name: "get_product_history",
    description: "Recorded change history for one product: what changed, when, and how customs-significant it was.",
    parameters: zodToGeminiSchema(getProductHistorySchema),
  },
  access: { navHref: "/app/products" },
  execute: async (ctx, rawArgs) => {
    const parsed = getProductHistorySchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { productId, limit } = parsed.data;

    const actor = productActor(ctx, `assistant-${ctx.userId}`);
    let events;
    try {
      events = await getProductHistoryService(actor, productId);
    } catch {
      return { error: "Product not found" };
    }

    const page = events.slice(0, limit ?? 20);
    return {
      productId,
      totalEvents: events.length,
      returned: page.length,
      truncated: events.length > page.length,
      events: page.map((event) => ({
        changedAt: event.createdAt,
        version: event.versionNumber,
        entity: event.entity,
        field: event.field,
        significance: event.significance,
        impactFlags: event.impactFlags,
        previousValue: event.oldValue,
        newValue: event.newValue,
        reason: event.changeReason,
      })),
    };
  },
};

// ---- tool: get_product_evidence ----

const getProductEvidenceSchema = z.object({
  productId: z.string().describe("Product UUID."),
});

const getProductEvidence: AssistantTool = {
  schema: getProductEvidenceSchema,
  declaration: {
    name: "get_product_evidence",
    description: "The provenance behind a product's facts: which document, page and extraction each fact came from.",
    parameters: zodToGeminiSchema(getProductEvidenceSchema),
  },
  access: { navHref: "/app/products" },
  execute: async (ctx, rawArgs) => {
    const parsed = getProductEvidenceSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { productId } = parsed.data;

    const product = await db.product.findFirst({
      where: { id: productId, accountId: ctx.accountId, deletedAt: null },
      select: { id: true },
    });
    if (!product) return { error: "Product not found" };

    const [rows, total] = await Promise.all([
      db.productEvidence.findMany({
        where: { productId: product.id, accountId: ctx.accountId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          sourceDocument: { select: { id: true, fileName: true, docType: true } },
          _count: {
            select: { attributes: true, compositions: true, parties: true, countryFacts: true, classifications: true },
          },
        },
      }),
      db.productEvidence.count({ where: { productId: product.id, accountId: ctx.accountId } }),
    ]);

    return {
      productId,
      totalEvidence: total,
      returned: rows.length,
      truncated: total > rows.length,
      evidence: rows.map((item) => ({
        evidenceId: item.id,
        sourceType: item.sourceType,
        documentId: item.sourceDocument?.id ?? null,
        documentName: item.sourceDocument?.fileName ?? null,
        documentType: item.sourceDocument?.docType ?? null,
        page: item.page,
        reference: item.sourceReference,
        description: item.description,
        supports: item._count,
        recordedAt: item.createdAt,
      })),
    };
  },
};

// ---- tool: get_party ----

const getPartySchema = z.object({
  partyId: z.string().describe("Party UUID."),
});

const getPartyTool: AssistantTool = {
  schema: getPartySchema,
  declaration: {
    name: "get_party",
    description:
      "Full detail for one party: names, identifiers, registrations, addresses, roles, sites and relationships. " +
      "Registration/address countries describe where a party is registered or located -- never the country of " +
      "origin of any product it supplies.",
    parameters: zodToGeminiSchema(getPartySchema),
  },
  access: { navHref: "/app/parties" },
  execute: async (ctx, rawArgs) => {
    const parsed = getPartySchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { partyId } = parsed.data;

    const actor = partyActor(ctx, `assistant-${ctx.userId}`);
    const party = await getParty(actor, partyId);
    if (!party) return { error: "Party not found" };

    const active = <T extends { status: string }>(rows: readonly T[]) => rows.filter((r) => r.status === "ACTIVE");

    return {
      partyId: party.id,
      name: partyDisplayName(party),
      internalCode: party.internalPartyCode,
      partyKind: party.partyKind,
      status: party.status,
      reviewStatus: party.reviewStatus,
      names: active(party.names).map((row) => ({ name: row.rawName, type: row.nameType, isPrimary: row.isPrimary })),
      identifiers: active(party.identifiers).map((row) => ({
        type: row.identifierType,
        value: row.value,
        issuingCountry: row.issuingCountry,
        isPrimary: row.isPrimary,
      })),
      registrations: party.registrations.map((row) => ({
        registrationNumber: row.registrationNumber,
        authority: row.registeringAuthority,
        countryOfRegistration: row.country,
        legalForm: row.legalForm,
        status: row.status,
      })),
      addresses: active(party.addresses).map((row) => ({
        type: row.addressType,
        city: row.city,
        stateProvince: row.stateProvince,
        country: row.country,
        isPrimary: row.isPrimary,
      })),
      roles: active(party.roles).map((row) => ({ roleType: row.roleType, since: row.effectiveFrom })),
      relationships: [
        ...party.relationshipsFrom.map((row) => ({
          direction: "FROM_THIS_PARTY" as const,
          relationshipType: row.relationshipType,
          counterpartyId: row.toPartyId,
        })),
        ...party.relationshipsTo.map((row) => ({
          direction: "TO_THIS_PARTY" as const,
          relationshipType: row.relationshipType,
          counterpartyId: row.fromPartyId,
        })),
      ],
      countryNote:
        "Registration and address countries describe this party. They are not the country of origin of any product it supplies.",
    };
  },
};

// ---- tool: get_party_history ----

const getPartyHistorySchema = z.object({
  partyId: z.string().describe("Party UUID."),
  limit: z.number().int().min(1).max(50).optional().describe("Maximum change events to return, newest first."),
});

const getPartyHistory: AssistantTool = {
  schema: getPartyHistorySchema,
  declaration: {
    name: "get_party_history",
    description: "Recorded change history for one party: what changed, when, and how significant it was for customs.",
    parameters: zodToGeminiSchema(getPartyHistorySchema),
  },
  access: { navHref: "/app/parties" },
  execute: async (ctx, rawArgs) => {
    const parsed = getPartyHistorySchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { partyId, limit } = parsed.data;

    const actor = partyActor(ctx, `assistant-${ctx.userId}`);
    let events;
    try {
      events = await getPartyHistoryService(actor, partyId);
    } catch {
      return { error: "Party not found" };
    }

    const page = events.slice(0, limit ?? 20);
    return {
      partyId,
      totalEvents: events.length,
      returned: page.length,
      truncated: events.length > page.length,
      events: page.map((event) => ({
        changedAt: event.createdAt,
        version: event.versionNumber,
        entity: event.entity,
        field: event.field,
        significance: event.significance,
        impactFlags: event.impactFlags,
        previousValue: event.oldValue,
        newValue: event.newValue,
        reason: event.changeReason,
      })),
    };
  },
};

// ---- tool: get_party_evidence ----

const getPartyEvidenceSchema = z.object({
  partyId: z.string().describe("Party UUID."),
});

const getPartyEvidence: AssistantTool = {
  schema: getPartyEvidenceSchema,
  declaration: {
    name: "get_party_evidence",
    description: "The provenance behind a party's facts: which document, page and extraction each fact came from.",
    parameters: zodToGeminiSchema(getPartyEvidenceSchema),
  },
  access: { navHref: "/app/parties" },
  execute: async (ctx, rawArgs) => {
    const parsed = getPartyEvidenceSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { partyId } = parsed.data;

    const party = await db.party.findFirst({
      where: { id: partyId, accountId: ctx.accountId, deletedAt: null },
      select: { id: true },
    });
    if (!party) return { error: "Party not found" };

    const [rows, total] = await Promise.all([
      db.partyEvidence.findMany({
        where: { partyId: party.id, accountId: ctx.accountId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          sourceDocument: { select: { id: true, fileName: true, docType: true } },
          _count: { select: { names: true, identifiers: true, registrations: true, addresses: true, roles: true, relationships: true } },
        },
      }),
      db.partyEvidence.count({ where: { partyId: party.id, accountId: ctx.accountId } }),
    ]);

    return {
      partyId,
      totalEvidence: total,
      returned: rows.length,
      truncated: total > rows.length,
      evidence: rows.map((item) => ({
        evidenceId: item.id,
        sourceType: item.sourceType,
        documentId: item.sourceDocument?.id ?? null,
        documentName: item.sourceDocument?.fileName ?? null,
        documentType: item.sourceDocument?.docType ?? null,
        page: item.page,
        reference: item.sourceReference,
        description: item.description,
        supports: item._count,
        recordedAt: item.createdAt,
      })),
    };
  },
};

// ---- tool: get_shipment_filing_readiness ----

const getShipmentFilingReadinessSchema = z.object({
  shipmentId: z.string().describe("Shipment UUID or shipment number."),
});

const getShipmentFilingReadiness: AssistantTool = {
  schema: getShipmentFilingReadinessSchema,
  declaration: {
    name: "get_shipment_filing_readiness",
    description:
      "Whether one shipment can be filed right now, computed from stored shipment columns only (line items, " +
      "documents, importer of record, entry type, open exceptions, open reconciliation issues). Returns the " +
      "blockers found together with how many checks were actually run -- bond sufficiency, PGA requirements " +
      "and licence conditions are never among them. Distinct from validate_shipment_filing, which validates an " +
      "existing CustomsFiling record for the CBP 7501 form.",
    parameters: zodToGeminiSchema(getShipmentFilingReadinessSchema),
  },
  access: { navHref: "/app/shipments" },
  execute: async (ctx, rawArgs) => {
    const parsed = getShipmentFilingReadinessSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    let { shipmentId } = parsed.data;

    if (!shipmentId.includes("-")) {
      const match = await db.shipment.findFirst({
        where: { accountId: ctx.accountId, shipmentNumber: shipmentId },
        select: { id: true },
      });
      if (match) shipmentId = match.id;
    }

    const shipment = await db.shipment.findFirst({
      where: { id: shipmentId, accountId: ctx.accountId, deletedAt: null },
      select: {
        id: true,
        shipmentNumber: true,
        importerOfRecordId: true,
        entryType: true,
        status: true,
        lineItems: { orderBy: { lineNumber: "asc" }, select: { lineNumber: true, htsCode: true, countryOfOrigin: true } },
        documents: { select: { docType: true, status: true } },
        exceptionItems: { where: { status: { in: openStatusVariants() } }, select: { severity: true } },
        reconciliationIssues: { where: { status: "Open" }, select: { severity: true } },
      },
    });
    if (!shipment) return { error: "Shipment not found" };

    const readiness = evaluateFilingReadiness({
      importerOfRecordId: shipment.importerOfRecordId,
      entryType: shipment.entryType,
      lineItems: shipment.lineItems,
      documents: shipment.documents,
      openExceptions: shipment.exceptionItems,
      openReconciliationIssues: shipment.reconciliationIssues,
    });

    return {
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      shipmentStatus: shipment.status,
      ready: readiness.ready,
      checksPerformed: readiness.checksPerformed,
      checksPassed: readiness.checksPassed,
      maxChecks: FILING_READINESS_MAX_CHECKS,
      blockers: readiness.blockers.map((b) => ({ code: b.code, requirement: b.label, detail: b.detail })),
      scopeNote:
        "These are the only checks performed from stored shipment data. Bond sufficiency, PGA requirements and licence conditions are not among them and have not been verified.",
    };
  },
};

// ---- tool: list_tasks ----

const listTasksSchema = z.object({
  assignedToMe: z.boolean().optional().describe("Only work assigned to the signed-in user."),
  kind: z.enum(["decision", "finding", "filing", "document", "exception"]).optional().describe("Restrict to one kind of work item."),
  limit: z.number().int().min(1).max(50).optional().describe("Maximum items to return."),
});

const QUEUE_SOURCE_LIMIT = 50;

const listTasks: AssistantTool = {
  schema: listTasksSchema,
  declaration: {
    name: "list_tasks",
    description:
      "The prioritised work queue for the signed-in account: decisions awaiting review, open compliance findings, " +
      "filings needing attention, documents needing review and open exceptions. Use for 'what should I work on' questions.",
    parameters: zodToGeminiSchema(listTasksSchema),
  },
  access: { navHref: "/app/actions" },
  execute: async (ctx, rawArgs) => {
    const parsed = listTasksSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { assignedToMe, kind, limit } = parsed.data;

    const [decisions, findings, filings, documents, exceptions] = await Promise.all([
      db.agentDecision.findMany({
        where: { accountId: ctx.accountId, ...getActionableDecisionWhereFilter() },
        orderBy: { createdAt: "desc" },
        take: QUEUE_SOURCE_LIMIT,
        select: {
          id: true, agentName: true, decisionSummary: true, status: true, createdAt: true,
          shipmentId: true, shipment: { select: { shipmentNumber: true } },
        },
      }),
      db.complianceFinding.findMany({
        where: { accountId: ctx.accountId, status: { in: FINDING_ACTIONABLE_STATUSES } },
        orderBy: { createdAt: "desc" },
        take: QUEUE_SOURCE_LIMIT,
        select: { id: true, rule: true, severity: true, status: true, createdAt: true, filingId: true, assignedToUserId: true },
      }),
      db.customsFiling.findMany({
        where: { accountId: ctx.accountId, filingStatus: { in: FILING_ACTIONABLE_STATUSES } },
        orderBy: { createdAt: "desc" },
        take: QUEUE_SOURCE_LIMIT,
        select: { id: true, entryNumber: true, filingStatus: true, createdAt: true, shipment: { select: { shipmentNumber: true } } },
      }),
      db.shipmentDocument.findMany({
        where: { accountId: ctx.accountId, status: { in: DOCUMENT_ACTIONABLE_STATUSES } },
        orderBy: { createdAt: "desc" },
        take: QUEUE_SOURCE_LIMIT,
        select: { id: true, fileName: true, status: true, createdAt: true, shipmentId: true, shipment: { select: { shipmentNumber: true } } },
      }),
      db.exceptionItem.findMany({
        where: { accountId: ctx.accountId, status: { in: openStatusVariants() } },
        orderBy: { createdAt: "desc" },
        take: QUEUE_SOURCE_LIMIT,
        select: {
          id: true, type: true, description: true, severity: true, status: true, createdAt: true,
          shipmentId: true, assignedToUserId: true, shipment: { select: { shipmentNumber: true } },
        },
      }),
    ]);

    const queue = buildWorkQueue({
      userId: ctx.userId,
      decisions: decisions.map((row) => ({
        id: row.id, agentName: row.agentName, decisionSummary: row.decisionSummary, status: row.status,
        createdAt: row.createdAt, shipmentId: row.shipmentId, shipmentNumber: row.shipment?.shipmentNumber ?? null,
      })),
      findings: findings.map((row) => ({
        id: row.id, rule: row.rule, severity: row.severity, status: row.status,
        createdAt: row.createdAt, filingId: row.filingId, assignedToUserId: row.assignedToUserId,
      })),
      filings: filings.map((row) => ({
        id: row.id, entryNumber: row.entryNumber, filingStatus: row.filingStatus,
        createdAt: row.createdAt, shipmentNumber: row.shipment?.shipmentNumber ?? null,
      })),
      documents: documents.map((row) => ({
        id: row.id, fileName: row.fileName, status: row.status, createdAt: row.createdAt,
        shipmentId: row.shipmentId, shipmentNumber: row.shipment?.shipmentNumber ?? null,
      })),
      exceptions: exceptions.map((row) => ({
        id: row.id, type: row.type, description: row.description, severity: row.severity, status: row.status,
        createdAt: row.createdAt, shipmentId: row.shipmentId, shipmentNumber: row.shipment?.shipmentNumber ?? null,
        assignedToUserId: row.assignedToUserId,
      })),
    });

    const filtered = queue.filter((item) => {
      if (kind && item.kind !== kind) return false;
      if (assignedToMe && !item.assignedToMe) return false;
      return true;
    });

    const page = filtered.slice(0, limit ?? 20);
    return {
      totalMatching: filtered.length,
      returned: page.length,
      truncated: filtered.length > page.length,
      byPriority: countByPriority(filtered),
      byKind: countByKind(filtered),
      items: page.map((item) => {
        const [, recordId] = item.id.split(":");
        return {
          kind: item.kind,
          recordId: recordId ?? null,
          title: item.title,
          reason: item.reason,
          priority: item.priority,
          shipmentNumber: item.shipmentNumber,
          assignedToMe: item.assignedToMe,
          waitingSince: item.createdAt,
        };
      }),
      sourceLimitNote: `Each source was read up to ${QUEUE_SOURCE_LIMIT} rows, so counts describe the most recent work rather than the account's entire history.`,
    };
  },
};

// ---- tool: get_country_embargo_screening ----

const getCountryEmbargoScreeningSchema = z.object({
  shipFromCountry: z.string().describe("Ship-from or compliance country name/code, for example US."),
  shipToCountry: z.string().describe("Ship-to or destination country name/code, for example Iran."),
});

const getCountryEmbargoScreening: AssistantTool = {
  schema: getCountryEmbargoScreeningSchema,
  declaration: {
    name: "get_country_embargo_screening",
    description:
      "Screen a hypothetical export country pair directly against deterministic embargo reference data, with no " +
      "shipment involved. Use when the user names a ship-from and ship-to country but no shipment. This checks " +
      "only the named country pair -- it does not screen transaction parties, goods, HTS classifications, " +
      "ECCNs, end use, or licences. For an existing shipment, use screen_shipment_embargo instead.",
    parameters: zodToGeminiSchema(getCountryEmbargoScreeningSchema),
  },
  access: { navHref: "/app/compliance" },
  execute: async (ctx, rawArgs) => {
    const parsed = getCountryEmbargoScreeningSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { shipFromCountry, shipToCountry } = parsed.data;

    const accountConfig = await getAccountEmbargoConfig(ctx.accountId);
    if (!accountConfig.embargoScreeningEnabled) {
      return {
        status: "SKIPPED",
        screeningPerformed: false,
        isEmbargoed: null,
        shipFromCountry,
        shipToCountry,
        reason: "EMBARGO_SCREENING_DISABLED",
        scope: "COUNTRY_PAIR_ONLY",
        scopeNote: "Account-level embargo screening is disabled. No country-pair verdict was produced.",
      };
    }

    const checkedAt = new Date();
    const check = await doEmbargoCheck({
      accountId: ctx.accountId,
      shipmentId: "assistant-country-pair",
      screeningLevel: "TRANSACTION",
      complianceCountry: shipFromCountry,
      targetCountry: shipToCountry,
      type: "D",
      screeningDate: checkedAt,
      accountConfig,
    });

    const evidence = check.evidence ?? {};
    const isPrivate = check.matcher === "PRIVATE";
    return {
      status: check.result,
      screeningPerformed: check.result !== "SKIPPED",
      isEmbargoed: check.result === "HIT" ? true : check.result === "CLEAR" ? false : null,
      shipFromCountry: check.complianceCountry,
      shipToCountry: check.screenedCountry,
      direction: "DESTINATION",
      matcher: check.matcher,
      // A HIT from the PRIVATE matcher is this account's own configured watch-list
      // rule, not a government sanction -- never phrase it to the user as one.
      classification: check.result === "HIT" ? (isPrivate ? "PRIVATE_EMBARGO" : "PUBLIC_EMBARGO") : null,
      classificationNote: isPrivate
        ? "This hit is a private, account-configured embargo/watch-list rule -- not a government sanction. It reflects this account's own compliance policy."
        : null,
      reason: check.reason ?? null,
      referenceRuleId: check.ruleId ?? null,
      sanctionIndicators: {
        national: evidence.nationalSanction ?? null,
        eu: evidence.euSanction ?? null,
        un: evidence.unSanction ?? null,
      },
      checkedAt: checkedAt.toISOString(),
      scope: "COUNTRY_PAIR_ONLY",
      scopeNote:
        "This checks only the named country pair. It does not screen transaction parties, goods, HTS classifications, ECCNs, end use, licences, or shipment-specific facts.",
    };
  },
};

// ---- tool: screen_restricted_party ----

const screenRestrictedPartySchema = z.object({
  partyId: z.string().optional().describe("An existing party id to rescreen using its current Party Master identity. Omit to screen ad-hoc fields instead."),
  name: z.string().optional().describe("Party name to screen. Required when partyId is omitted."),
  address: z.string().optional().describe("Street address, if known."),
  city: z.string().optional().describe("City, if known."),
  country: z.string().optional().describe("Country, if known."),
  contactName: z.string().optional().describe("A named contact for this party, if known. Screened as an independent pass."),
});

const screenRestrictedParty: AssistantTool = {
  schema: screenRestrictedPartySchema,
  declaration: {
    name: "screen_restricted_party",
    description:
      "Screen a party against restricted/denied-party denial-order lists (OFAC SDN, BIS DPL, and related lists) " +
      "plus Know-Your-Customer red-flag words. Pass an existing partyId to rescreen a Party Master record's " +
      "current identity, or pass ad-hoc name/address/country/contactName fields to screen a hypothetical identity " +
      "not in Party Master. This persists a new screening result. Never fabricate a match, citation, or " +
      "clearance -- only report what this tool returns.",
    parameters: zodToGeminiSchema(screenRestrictedPartySchema),
  },
  access: { permission: "compliance.restrictedParty.screen" },
  execute: async (ctx, rawArgs) => {
    const parsed = screenRestrictedPartySchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { partyId, name, address, city, country, contactName } = parsed.data;

    if (partyId) {
      const party = await db.party.findFirst({
        where: { id: partyId, accountId: ctx.accountId },
        select: { id: true, internalPartyCode: true, names: { select: { rawName: true, isPrimary: true, nameType: true } } },
      });
      if (!party) return { error: "Party not found" };

      try {
        const { overallStatus, results } = await rescreenParty(ctx.accountId, party.id);
        return {
          partyId: party.id,
          overallStatus,
          results: results.map((r) => ({
            passType: r.passType,
            status: r.status,
            hitCount: r.hitCount,
            redFlagCount: r.redFlagCount,
            matches: r.matches
              .filter((m) => !m.suppressedByApprovedParty)
              .map((m) => ({ matchedName: m.matchedName, nameScore: m.nameScore, matchMethod: m.matchMethod, sourceList: m.sourceList, programCodes: m.programCodes })),
            redFlagHits: r.redFlagHits.map((h) => ({ matchedWord: h.matchedWord })),
          })),
        };
      } catch (error) {
        if (error instanceof PartyHasNoActiveNameError) {
          return { error: error.message };
        }
        throw error;
      }
    }

    if (!name) return { error: "Either partyId or name must be provided." };

    const screeningInput = {
      accountId: ctx.accountId,
      source: "COPILOT" as const,
      identity: { name, address: address ?? null, city: city ?? null, country: country ?? null, contactName: contactName ?? null },
    };

    const runResult = await runRestrictedPartyScreening(screeningInput);
    const persisted = await persistScreeningRun(screeningInput, runResult);

    return {
      correlationId: runResult.correlationId,
      results: persisted.map((r) => ({
        screeningId: r.id,
        passType: r.passType,
        status: r.status,
        hitCount: r.hitCount,
        redFlagCount: r.redFlagCount,
        matches: r.matches
          .filter((m) => !m.suppressedByApprovedParty)
          .map((m) => ({ matchedName: m.matchedName, nameScore: m.nameScore, matchMethod: m.matchMethod, sourceList: m.sourceList, programCodes: m.programCodes })),
        redFlagHits: r.redFlagHits.map((h) => ({ matchedWord: h.matchedWord })),
      })),
    };
  },
};

// ---- tool: get_restricted_party_screening_details ----

const getRestrictedPartyScreeningDetailsSchema = z.object({
  screeningId: z.string().describe("The restricted-party screening result id, from screen_restricted_party or a party's screening history."),
});

const getRestrictedPartyScreeningDetails: AssistantTool = {
  schema: getRestrictedPartyScreeningDetailsSchema,
  declaration: {
    name: "get_restricted_party_screening_details",
    description:
      "Full detail for one persisted restricted/denied-party screening result: the screened identity, thresholds " +
      "used, matched denial-order entries, and red-flag hits.",
    parameters: zodToGeminiSchema(getRestrictedPartyScreeningDetailsSchema),
  },
  access: { permission: "compliance.restrictedParty.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = getRestrictedPartyScreeningDetailsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { screeningId } = parsed.data;

    const result = await db.restrictedPartyScreeningResult.findFirst({
      where: { id: screeningId, accountId: ctx.accountId },
      include: { matches: true, redFlagHits: true, disposition: true },
    });
    if (!result) return { error: "Screening result not found" };

    return {
      screeningId: result.id,
      source: result.source,
      passType: result.passType,
      screenedName: result.screenedName,
      screenedAddress: result.screenedAddress,
      screenedCity: result.screenedCity,
      screenedCountry: result.screenedCountry,
      nameThreshold: result.nameThreshold,
      countryMatchRequired: result.countryMatchRequired,
      status: result.status,
      screeningDate: result.screeningDate.toISOString(),
      matches: result.matches.map((m) => ({
        matchedName: m.matchedName, nameScore: m.nameScore, matchMethod: m.matchMethod,
        sourceList: m.sourceList, programCodes: m.programCodes, suppressedByApprovedParty: m.suppressedByApprovedParty,
      })),
      redFlagHits: result.redFlagHits.map((h) => ({ matchedWord: h.matchedWord })),
      disposition: result.disposition
        ? { status: result.disposition.status, reviewedAt: result.disposition.reviewedAt?.toISOString() ?? null, notes: result.disposition.notes }
        : null,
    };
  },
};

// ---- tool: get_party_restricted_party_screening_history ----

const getPartyScreeningHistorySchema = z.object({
  partyId: z.string().describe("Party UUID."),
});

const getPartyRestrictedPartyScreeningHistory: AssistantTool = {
  schema: getPartyScreeningHistorySchema,
  declaration: {
    name: "get_party_restricted_party_screening_history",
    description:
      "The current restricted/denied-party screening status and screening history for one Party Master record. " +
      "Use for 'when was this party last screened' or 'has this party ever hit a denial list' questions.",
    parameters: zodToGeminiSchema(getPartyScreeningHistorySchema),
  },
  access: { navHref: "/app/parties", permission: "compliance.restrictedParty.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = getPartyScreeningHistorySchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { partyId } = parsed.data;

    const party = await db.party.findFirst({
      where: { id: partyId, accountId: ctx.accountId },
      select: { id: true },
    });
    if (!party) return { error: "Party not found" };

    const [summary, results] = await Promise.all([
      db.partyScreeningSummary.findUnique({ where: { partyId: party.id } }),
      db.restrictedPartyScreeningResult.findMany({
        where: { partyId: party.id, accountId: ctx.accountId },
        orderBy: { screeningDate: "desc" },
        take: 20,
      }),
    ]);

    return {
      partyId: party.id,
      currentStatus: summary?.screeningStatus ?? null,
      lastScreenedAt: summary?.lastScreenedAt?.toISOString() ?? null,
      history: results.map((r) => ({
        screeningId: r.id, passType: r.passType, status: r.status,
        hitCount: r.hitCount, redFlagCount: r.redFlagCount, screeningDate: r.screeningDate.toISOString(),
      })),
    };
  },
};

// ---- tool: get_party_pre_approval_status ----
//
// Deterministic, evidence-grounded: reads persisted PartyScreeningApproval
// rows only and reports validity by re-running the exact same checks
// checkPreApprovalGate uses (revoked / expired / version / identity-hash /
// reference-data freshness). The assistant must never infer, approve, or
// bypass a pre-approval on its own -- this tool only reports what is
// already recorded and whether it is currently valid for reuse.

const getPartyPreApprovalStatusSchema = z.object({
  partyId: z.string().describe("Party UUID."),
});

const getPartyPreApprovalStatus: AssistantTool = {
  schema: getPartyPreApprovalStatusSchema,
  declaration: {
    name: "get_party_pre_approval_status",
    description:
      "Whether a Party has an active Restricted Party Screening pre-approval (reuse permission), and why it is or " +
      "isn't currently valid. Distinct from a candidate's FALSE_POSITIVE disposition -- this is a party-level grant, " +
      "not a judgment on one match. Use for 'is this party pre-approved' or 'can screening be reused for this party' questions.",
    parameters: zodToGeminiSchema(getPartyPreApprovalStatusSchema),
  },
  access: { navHref: "/app/parties", permission: "compliance.restrictedParty.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = getPartyPreApprovalStatusSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { partyId } = parsed.data;

    const party = await db.party.findFirst({ where: { id: partyId, accountId: ctx.accountId }, select: { id: true } });
    if (!party) return { error: "Party not found" };

    const gate = await checkPreApprovalGate({
      accountId: ctx.accountId,
      partyId: party.id,
      source: "SHIPMENT",
      audit: false,
    });

    const approvals = await db.partyScreeningApproval.findMany({
      where: { partyId: party.id, accountId: ctx.accountId },
      orderBy: { approvedAt: "desc" },
      take: 10,
    });

    return {
      partyId: party.id,
      currentlyValidForReuse: gate.applied,
      validityReason: gate.reason,
      approvals: approvals.map((a) => ({
        approvalId: a.id,
        status: a.status,
        approvedAt: a.approvedAt.toISOString(),
        expiresAt: a.expiresAt?.toISOString() ?? null,
        revokedAt: a.revokedAt?.toISOString() ?? null,
        reason: a.reason,
      })),
    };
  },
};

// ---- tool: get_restricted_party_notification_status ----
//
// Read-only: reports whether an RPS notification email was queued/sent for a
// screening result, its delivery status, and why (if not sent) -- never the
// recipient addresses themselves. Tenant-scoped via notificationQueries.ts.

const getRestrictedPartyNotificationStatusSchema = z.object({
  screeningId: z.string().describe("The restricted-party screening result id, from screen_restricted_party or a party's screening history."),
});

const getRestrictedPartyNotificationStatus: AssistantTool = {
  schema: getRestrictedPartyNotificationStatusSchema,
  declaration: {
    name: "get_restricted_party_notification_status",
    description:
      "Whether an email alert was queued/sent for a restricted/denied-party screening result, its delivery status " +
      "(queued, sent, retrying, failed, suppressed), notification type, and provider. Never returns recipient " +
      "addresses. Use for 'was an email sent for this hit' or 'why didn't compliance get notified' questions.",
    parameters: zodToGeminiSchema(getRestrictedPartyNotificationStatusSchema),
  },
  access: { permission: "compliance.restrictedParty.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = getRestrictedPartyNotificationStatusSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { screeningId } = parsed.data;

    const result = await db.restrictedPartyScreeningResult.findFirst({
      where: { id: screeningId, accountId: ctx.accountId },
      select: { id: true },
    });
    if (!result) return { error: "Screening result not found" };

    return getNotificationStatusForScreeningResult(ctx.accountId, result.id);
  },
};

export // ---- tool: get_shipment_compliance_execution_history ----
//
// Deterministic, evidence-grounded: reads only persisted ComplianceExecution
// rows (the unified audit envelope across RPS, embargo, classification, and
// the five thin-finding screening domains). The assistant must never invent
// or infer an execution that isn't recorded here.

const getShipmentComplianceExecutionHistorySchema = z.object({
  shipmentId: z.string().describe("Shipment UUID."),
  executionType: z.string().optional().describe("Optional filter, e.g. EMBARGO_SCREENING, RESTRICTED_PARTY_SCREENING, CLASSIFICATION."),
});

const getShipmentComplianceExecutionHistory: AssistantTool = {
  schema: getShipmentComplianceExecutionHistorySchema,
  declaration: {
    name: "get_shipment_compliance_execution_history",
    description:
      "The full compliance-check execution history for one shipment -- every recorded RPS/embargo/classification/" +
      "forced-labor/end-use/end-user/military-end-use/anti-boycott invocation, with status, source, and timing. " +
      "Use for 'what compliance checks ran on this shipment' or 'when was this shipment last screened' questions.",
    parameters: zodToGeminiSchema(getShipmentComplianceExecutionHistorySchema),
  },
  access: { navHref: "/app/compliance", permission: "compliance.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = getShipmentComplianceExecutionHistorySchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { shipmentId, executionType } = parsed.data;

    const shipment = await db.shipment.findFirst({ where: { id: shipmentId, accountId: ctx.accountId }, select: { id: true } });
    if (!shipment) return { error: "Shipment not found" };

    const executions = await db.complianceExecution.findMany({
      where: { accountId: ctx.accountId, shipmentId: shipment.id, ...(executionType ? { executionType: executionType as never } : {}) },
      orderBy: { startedAt: "desc" },
      take: 50,
      select: {
        id: true, executionType: true, status: true, source: true, finalStatus: true,
        correlationId: true, startedAt: true, completedAt: true, durationMs: true,
      },
    });

    return {
      shipmentId: shipment.id,
      executions: executions.map((e) => ({
        ...e,
        startedAt: e.startedAt.toISOString(),
        completedAt: e.completedAt?.toISOString() ?? null,
      })),
    };
  },
};

// ---- tool: get_service_usage_summary ----
//
// Deterministic aggregate-only tool -- counts recorded ComplianceExecution
// rows via groupBy, never a client-side scan and never an LLM estimate.

const getServiceUsageSummarySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const getServiceUsageSummary: AssistantTool = {
  schema: getServiceUsageSummarySchema,
  declaration: {
    name: "get_service_usage_summary",
    description:
      "Aggregate counts of compliance-check executions for this account (total, by type, by status, by source, " +
      "review-required, overridden), optionally within a date range. Use for 'how many screenings ran this month' " +
      "or 'how many compliance checks needed review' questions.",
    parameters: zodToGeminiSchema(getServiceUsageSummarySchema),
  },
  access: { navHref: "/app/compliance", permission: "compliance.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = getServiceUsageSummarySchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { dateFrom, dateTo } = parsed.data;

    const where = {
      accountId: ctx.accountId,
      ...(dateFrom || dateTo
        ? { startedAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
        : {}),
    };

    const [total, byType, byStatus, overriddenCount] = await Promise.all([
      db.complianceExecution.count({ where }),
      db.complianceExecution.groupBy({ by: ["executionType"], where, _count: { _all: true } }),
      db.complianceExecution.groupBy({ by: ["status"], where, _count: { _all: true } }),
      db.complianceExecution.count({ where: { ...where, overrides: { some: {} } } }),
    ]);

    return {
      total,
      byType: byType.map((r) => ({ executionType: r.executionType, count: r._count._all })),
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      overriddenCount,
    };
  },
};

// ---- tool: get_formal_overrides_for_result ----
//
// Deterministic: reads only persisted ComplianceFormalOverride rows. Never
// creates, infers, or suggests an override -- that path is human-only
// (formalOverride.ts) and unreachable from this tool.

const getFormalOverridesForResultSchema = z.object({
  resultRefType: z.string().describe("The domain result type the override applies to, e.g. RESTRICTED_PARTY, EMBARGO, CLASSIFICATION."),
  resultRefId: z.string().describe("The id of the domain result row the override applies to."),
});

const getFormalOverridesForResult: AssistantTool = {
  schema: getFormalOverridesForResultSchema,
  declaration: {
    name: "get_formal_overrides_for_result",
    description:
      "Every formal compliance override recorded against one domain result (e.g. one RestrictedPartyScreeningResult " +
      "or ClassificationRun), including revocation status. Use for 'has this result been overridden' questions.",
    parameters: zodToGeminiSchema(getFormalOverridesForResultSchema),
  },
  access: { navHref: "/app/compliance", permission: "compliance.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = getFormalOverridesForResultSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { resultRefType, resultRefId } = parsed.data;

    const overrides = await db.complianceFormalOverride.findMany({
      where: { accountId: ctx.accountId, resultRefType, resultRefId },
      orderBy: { overriddenAt: "desc" },
      take: 20,
    });

    return {
      resultRefType,
      resultRefId,
      overrides: overrides.map((o) => ({
        id: o.id,
        originalDecision: o.originalDecision,
        overrideDecision: o.overrideDecision,
        reason: o.reason,
        overriddenByUserId: o.overriddenByUserId,
        overriddenAt: o.overriddenAt.toISOString(),
        revoked: Boolean(o.revokedAt),
        revokedAt: o.revokedAt?.toISOString() ?? null,
        revokedReason: o.revokedReason ?? null,
      })),
    };
  },
};

// ---- Continuous Party Monitoring (RDPS) tools ----
//
// RdpsRun and ReferenceDataChangeSet are platform-level rows (no accountId --
// a single DELTA_IMPACT/FULL_POPULATION run can span Parties across many
// accounts), so tools that surface run/reference-change data return
// aggregate metadata only, never Party-identifying detail from other
// tenants. Everything at outcome/alert/Party level is filtered through
// RdpsPartyOutcome, which IS tenant-scoped, exactly as rdpsQueryService.ts
// itself is scoped.

function serializeRunSummary(run: { id: string; status: string; completedAt: Date | null } | null) {
  if (!run) return null;
  return { runId: run.id, status: run.status, completedAt: run.completedAt?.toISOString() ?? null };
}

// ---- tool: get_rdps_overview ----

const getRdpsOverviewSchema = z.object({});

const getRdpsOverview: AssistantTool = {
  schema: getRdpsOverviewSchema,
  declaration: {
    name: "get_rdps_overview",
    description:
      "High-level Continuous Party Monitoring (RDPS) status for this account: total monitored parties, open " +
      "worsening alerts, how many parties worsened/were screened in the last 30 days, and the most recent " +
      "DELTA_IMPACT/FULL_POPULATION/scheduled recall-validation run. Use as a first step for 'what's the state of " +
      "party monitoring' questions.",
    parameters: zodToGeminiSchema(getRdpsOverviewSchema),
  },
  access: { permission: "compliance.rdps.read" },
  execute: async (ctx) => {
    const summary = await getReportsSummary(ctx.accountId);
    return {
      totalMonitoredParties: summary.totalMonitoredParties,
      openAlerts: summary.openAlerts,
      worseningLast30Days: summary.worseningLast30Days,
      screenedLast30Days: summary.screenedLast30Days,
      lastDeltaImpactRun: serializeRunSummary(summary.lastDeltaImpactRun),
      lastFullPopulationRun: serializeRunSummary(summary.lastFullPopulationRun),
      lastRecallValidation: serializeRunSummary(summary.lastRecallValidation),
    };
  },
};

// ---- tool: list_open_rdps_alerts ----

const listOpenRdpsAlertsSchema = z.object({
  page: z.number().int().min(1).optional().describe("Page number, defaults to 1."),
  pageSize: z.number().int().min(1).max(200).optional().describe("Results per page, defaults to 50."),
});

const listOpenRdpsAlerts: AssistantTool = {
  schema: listOpenRdpsAlertsSchema,
  declaration: {
    name: "list_open_rdps_alerts",
    description:
      "List open Continuous Party Monitoring (RDPS) alerts for this account -- parties whose restricted-party " +
      "screening status worsened on a rescreen and have not yet been dispositioned. Each alert shows the party " +
      "name, previous/new status, which run detected it, and when.",
    parameters: zodToGeminiSchema(listOpenRdpsAlertsSchema),
  },
  access: { permission: "compliance.rdps.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = listOpenRdpsAlertsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { page, pageSize } = parsed.data;

    const { alerts, total } = await listAlerts(ctx.accountId, { dispositioned: false, page, pageSize });
    return {
      total,
      alerts: alerts.map((a) => ({
        outcomeId: a.id,
        partyId: a.partyId,
        partyName: a.partyDisplayName,
        previousStatus: a.previousStatus,
        newStatus: a.newStatus,
        runId: a.runId,
        runType: a.run?.runType ?? null,
        detectedAt: a.createdAt.toISOString(),
        exceptionStatus: a.exceptionItem?.status ?? null,
      })),
    };
  },
};

// ---- tool: get_reference_data_changes ----

const getReferenceDataChangesSchema = z.object({
  datasetId: z.string().optional().describe("Restrict to one dataset, e.g. OFAC_SDN, BIS_DPL."),
  changeType: z.string().optional().describe("Restrict to one change type, e.g. ADDED, REMOVED, MODIFIED."),
  page: z.number().int().min(1).optional().describe("Page number, defaults to 1."),
  pageSize: z.number().int().min(1).max(200).optional().describe("Results per page, defaults to 50."),
});

const getReferenceDataChanges: AssistantTool = {
  schema: getReferenceDataChangesSchema,
  declaration: {
    name: "get_reference_data_changes",
    description:
      "Platform-level feed of restricted-party reference data changes (denial-order list additions/removals/" +
      "modifications) that Continuous Party Monitoring (RDPS) reacts to. This is aggregate reference-data " +
      "metadata only -- it never contains Party-identifying screening detail for any account.",
    parameters: zodToGeminiSchema(getReferenceDataChangesSchema),
  },
  access: { permission: "compliance.rdps.read" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getReferenceDataChangesSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { datasetId, changeType, page, pageSize } = parsed.data;

    const { changes, total } = await listReferenceChanges({ datasetId, changeType, page, pageSize });
    return {
      total,
      changes: changes.map((c) => ({
        id: c.id,
        datasetId: c.datasetId,
        provider: c.provider,
        sourceList: c.sourceList,
        changeType: c.changeType,
        occurredAt: c.occurredAt.toISOString(),
        entityName: c.screeningEntity?.name ?? null,
        entitySourceList: c.screeningEntity?.sourceList ?? null,
      })),
    };
  },
};

// ---- tool: explain_party_rdps_status_change ----
//
// Plain-language explanation layer over getPartyMonitoringHistory -- reads
// persisted RdpsPartyOutcome rows only, never re-derives a status itself.

const explainPartyRdpsStatusChangeSchema = z.object({
  partyId: z.string().describe("Party UUID."),
});

const explainPartyRdpsStatusChange: AssistantTool = {
  schema: explainPartyRdpsStatusChangeSchema,
  declaration: {
    name: "explain_party_rdps_status_change",
    description:
      "Plain-language explanation of a party's Continuous Party Monitoring (RDPS) history: what its screening " +
      "status changed to, when, and why (which run detected it and what triggered the candidate selection). " +
      "Use for 'why did this party's status change' or 'what happened to this party's screening' questions.",
    parameters: zodToGeminiSchema(explainPartyRdpsStatusChangeSchema),
  },
  access: { permission: "compliance.rdps.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = explainPartyRdpsStatusChangeSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { partyId } = parsed.data;

    const history = await getPartyMonitoringHistory(ctx.accountId, partyId);
    if (history === null) return { error: "Party not found in this account." };
    if (history.length === 0) {
      return { partyId, explanation: "This party has no Continuous Party Monitoring history recorded yet." };
    }

    const latest = history[0];
    const latestExplanation = latest.isWorsening
      ? `On ${latest.createdAt.toISOString()}, a ${latest.run?.runType ?? "monitoring"} run found this party's ` +
        `restricted-party screening status worsened from ${latest.previousStatus ?? "never screened"} to ` +
        `${latest.newStatus}${latest.candidateReasons.length ? ` (candidate reasons: ${latest.candidateReasons.join(", ")})` : ""}.`
      : latest.newStatus === "ERROR"
        ? `On ${latest.createdAt.toISOString()}, a ${latest.run?.runType ?? "monitoring"} run errored while rescreening this party: ${latest.errorMessage ?? "no error detail recorded"}.`
        : `On ${latest.createdAt.toISOString()}, a ${latest.run?.runType ?? "monitoring"} run rescreened this party and its status remained ${latest.newStatus} (not a worsening transition).`;

    return {
      partyId,
      mostRecentStatus: latest.newStatus,
      mostRecentChangeAt: latest.createdAt.toISOString(),
      explanation: latestExplanation,
      totalHistoryEvents: history.length,
    };
  },
};

// ---- tool: get_rdps_run_detail ----
//
// RdpsRun is platform-level (no accountId), so this returns aggregate run
// metadata only. It reports how many of THIS account's outcomes came out of
// the run as a count, never individual outcomes -- use list_open_rdps_alerts
// or get_party_rdps_monitoring_history for tenant-scoped per-Party detail.

const getRdpsRunDetailSchema = z.object({
  runId: z.string().describe("RdpsRun id."),
});

const getRdpsRunDetail: AssistantTool = {
  schema: getRdpsRunDetailSchema,
  declaration: {
    name: "get_rdps_run_detail",
    description:
      "Aggregate metadata for one Continuous Party Monitoring (RDPS) run: type, status, timing, and counts " +
      "(candidates, screened, worsened, errored). Platform-level only -- does not include individual Party " +
      "names or outcomes, only how many of this account's outcomes came out of the run.",
    parameters: zodToGeminiSchema(getRdpsRunDetailSchema),
  },
  access: { permission: "compliance.rdps.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = getRdpsRunDetailSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { runId } = parsed.data;

    const run = await getRun(runId);
    if (!run) return { error: "RDPS run not found." };

    const tenantOutcomes = await listOutcomesForRun(ctx.accountId, runId, { pageSize: 1 });

    return {
      runId: run.id,
      runType: run.runType,
      status: run.status,
      triggeredBy: run.triggeredBy,
      candidatePartyCount: run.candidatePartyCount,
      screenedCount: run.screenedCount,
      worsenedCount: run.worsenedCount,
      erroredCount: run.erroredCount,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      thisAccountOutcomeCount: tenantOutcomes.total,
    };
  },
};

// ---- tool: get_rdps_reports_summary ----
//
// Same underlying data as get_rdps_overview, described from the Reports tab
// framing -- kept as a separate tool per the RDPS plan's tool list.

const getRdpsReportsSummarySchema = z.object({});

const getRdpsReportsSummary: AssistantTool = {
  schema: getRdpsReportsSummarySchema,
  declaration: {
    name: "get_rdps_reports_summary",
    description:
      "The Continuous Party Monitoring (RDPS) Reports summary for this account: monitored party count, open " +
      "alert count, 30-day worsening/screened counts, and last-run timestamps per run type. Use for 'give me the " +
      "RDPS report' or 'summarize party monitoring for the reports page' questions.",
    parameters: zodToGeminiSchema(getRdpsReportsSummarySchema),
  },
  access: { permission: "compliance.rdps.read" },
  execute: async (ctx) => {
    const summary = await getReportsSummary(ctx.accountId);
    return {
      totalMonitoredParties: summary.totalMonitoredParties,
      openAlerts: summary.openAlerts,
      worseningLast30Days: summary.worseningLast30Days,
      screenedLast30Days: summary.screenedLast30Days,
      lastDeltaImpactRun: serializeRunSummary(summary.lastDeltaImpactRun),
      lastFullPopulationRun: serializeRunSummary(summary.lastFullPopulationRun),
      lastRecallValidation: serializeRunSummary(summary.lastRecallValidation),
    };
  },
};

// ---- tool: get_party_rdps_monitoring_history ----
//
// Raw structured history over the same source as
// explain_party_rdps_status_change, for callers that want the data rather
// than a plain-language narrative.

const getPartyRdpsMonitoringHistorySchema = z.object({
  partyId: z.string().describe("Party UUID."),
});

const getPartyRdpsMonitoringHistory: AssistantTool = {
  schema: getPartyRdpsMonitoringHistorySchema,
  declaration: {
    name: "get_party_rdps_monitoring_history",
    description:
      "Raw Continuous Party Monitoring (RDPS) outcome history for one party: every recorded rescreen with " +
      "previous/new status, worsening flag, candidate reasons, and which run produced it. Use when the caller " +
      "wants structured history data rather than a narrative explanation (see explain_party_rdps_status_change).",
    parameters: zodToGeminiSchema(getPartyRdpsMonitoringHistorySchema),
  },
  access: { permission: "compliance.rdps.read" },
  execute: async (ctx, rawArgs) => {
    const parsed = getPartyRdpsMonitoringHistorySchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { partyId } = parsed.data;

    const history = await getPartyMonitoringHistory(ctx.accountId, partyId);
    if (history === null) return { error: "Party not found in this account." };

    return {
      partyId,
      count: history.length,
      history: history.map((h) => ({
        outcomeId: h.id,
        runId: h.runId,
        runType: h.run?.runType ?? null,
        runStartedAt: h.run?.startedAt?.toISOString() ?? null,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        isWorsening: h.isWorsening,
        hadActivePreApproval: h.hadActivePreApproval,
        candidateReasons: h.candidateReasons,
        errorMessage: h.errorMessage,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  },
};

// ---- tool: trigger_manual_rdps_scan ----
//
// Write tool -- requires explicit confirmation, same convention as
// rescreen_failed_community_screening_parties. DELTA_IMPACT/FULL_POPULATION
// delegate to triggerManualScan(); TARGETED replicates the synchronous
// per-party recordRdpsOutcome loop from POST /api/compliance/rdps/runs
// (small, caller-bounded partyIds set, tenant-validated via db.party).

const triggerManualRdpsScanSchema = z.object({
  jobType: z.enum(["DELTA_IMPACT", "FULL_POPULATION", "TARGETED"]).describe(
    "DELTA_IMPACT nudges the pending reference-data-change dispatcher; FULL_POPULATION queues a full sweep " +
      "(fails if one is already running); TARGETED synchronously rescreens the given partyIds now."
  ),
  partyIds: z.array(z.string()).optional().describe("Required for TARGETED. Party UUIDs, must belong to this account."),
});

const triggerManualRdpsScan: AssistantTool = {
  schema: triggerManualRdpsScanSchema,
  declaration: {
    name: "trigger_manual_rdps_scan",
    description:
      "Trigger a manual Continuous Party Monitoring (RDPS) scan: DELTA_IMPACT, FULL_POPULATION, or a TARGETED " +
      "rescreen of specific parties. Only call after explicit confirmation -- FULL_POPULATION and TARGETED scans " +
      "screen real parties and can raise new worsening alerts.",
    parameters: zodToGeminiSchema(triggerManualRdpsScanSchema),
  },
  access: { permission: "compliance.rdps.manage" },
  execute: async (ctx, rawArgs) => {
    const parsed = triggerManualRdpsScanSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { jobType, partyIds } = parsed.data;

    if (jobType === "TARGETED") {
      if (!partyIds || partyIds.length === 0) {
        return { error: "partyIds is required for a TARGETED scan." };
      }

      const parties = await db.party.findMany({
        where: { id: { in: partyIds }, accountId: ctx.accountId },
        select: { id: true },
      });
      if (parties.length === 0) {
        return { error: "No matching parties found in this account." };
      }

      const run = await db.rdpsRun.create({
        data: { runType: "TARGETED", status: "RUNNING", triggeredBy: `MANUAL:${ctx.userId}` },
      });

      let worsenedCount = 0;
      let erroredCount = 0;
      for (const party of parties) {
        const outcome = await recordRdpsOutcome({
          runId: run.id,
          accountId: ctx.accountId,
          partyId: party.id,
          candidateReasons: [],
        });
        if (outcome.isWorsening) worsenedCount++;
        if (outcome.errored) erroredCount++;
      }

      const completedRun = await db.rdpsRun.update({
        where: { id: run.id },
        data: {
          status: erroredCount > 0 ? "PARTIAL" : "COMPLETED",
          candidatePartyCount: parties.length,
          screenedCount: parties.length,
          worsenedCount,
          erroredCount,
          completedAt: new Date(),
        },
      });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: AuditAction.RDPS_MANUAL_SCAN_TRIGGERED,
        entity: "RdpsRun",
        entityId: run.id,
        source: "CHAT",
        metadata: { jobType, partyIds },
      });

      return {
        success: true,
        run: {
          runId: completedRun.id,
          status: completedRun.status,
          candidatePartyCount: completedRun.candidatePartyCount,
          screenedCount: completedRun.screenedCount,
          worsenedCount: completedRun.worsenedCount,
          erroredCount: completedRun.erroredCount,
          completedAt: completedRun.completedAt?.toISOString() ?? null,
        },
      };
    }

    try {
      const run = await triggerManualScan(ctx.userId, { jobType });

      await createAuditLog({
        accountId: ctx.accountId,
        userId: ctx.userId,
        action: AuditAction.RDPS_MANUAL_SCAN_TRIGGERED,
        entity: "RdpsRun",
        entityId: run?.id ?? "none",
        source: "CHAT",
        metadata: { jobType },
      });

      return {
        success: true,
        run: run
          ? { runId: run.id, status: run.status, runType: run.runType }
          : null,
        note:
          jobType === "DELTA_IMPACT" && !run
            ? "No pending reference-data-change backlog for DELTA_IMPACT to act on right now."
            : undefined,
      };
    } catch (error) {
      if (error instanceof RdpsFullPopulationAlreadyRunningError) {
        return { success: false, error: error.message };
      }
      throw error;
    }
  },
};

// ---- tool: get_hts_code ----

const getHtsCodeSchema = z.object({
  code: z.string().describe("HTS code (8 or 10 digits)."),
  asOfDate: z.string().optional().describe("Effective as-of date (ISO format YYYY-MM-DD)."),
});

const getHtsCode: AssistantTool = {
  schema: getHtsCodeSchema,
  declaration: {
    name: "get_hts_code",
    description: "Get full HTS code details including chapter notes, duty rates, units, and hierarchy.",
    parameters: zodToGeminiSchema(getHtsCodeSchema),
  },
  access: { navHref: "/app/hts" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getHtsCodeSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { code, asOfDate } = parsed.data;

    const node = await HtsSearchService.getCodeDetail(code, asOfDate);
    if (!node) return { error: `HTS code '${code}' not found.` };
    const hierarchy = await HtsSearchService.getHierarchy(code, asOfDate);
    return { node, hierarchy };
  },
};

// ---- tool: get_ruling ----

const getRulingSchema = z.object({
  rulingNumber: z.string().describe("CBP CROSS Ruling number (e.g. HQ H301234 or NY N123456)."),
});

const getRuling: AssistantTool = {
  schema: getRulingSchema,
  declaration: {
    name: "get_ruling",
    description: "Retrieve a specific CBP CROSS ruling by ruling number with full text fragments.",
    parameters: zodToGeminiSchema(getRulingSchema),
  },
  access: { navHref: "/app/rulings" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getRulingSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { rulingNumber } = parsed.data;

    const ruling = await db.ruling.findUnique({
      where: { rulingNumber: rulingNumber.trim() },
      include: {
        fragments: { orderBy: { id: "asc" } },
        htsReferences: true,
        fromRelations: {
          include: { toRuling: { select: { rulingNumber: true, title: true } } },
        },
      },
    });
    if (!ruling) return { error: `Ruling '${rulingNumber}' not found in CBP CROSS database.` };
    return { ruling };
  },
};

// ---- tool: lookup_restricted_party_lists ----

const lookupRestrictedPartyListsSchema = z.object({
  name: z.string().describe("Entity or company name to search across restricted party lists."),
  listType: z.string().optional().describe("Filter list type (e.g., SDN, BIS_CSL, UFLPA, DOW_JONES)."),
});

const lookupRestrictedPartyLists: AssistantTool = {
  schema: lookupRestrictedPartyListsSchema,
  declaration: {
    name: "lookup_restricted_party_lists",
    description: "Read-only lookup across global restricted party lists (SDN, BIS, UFLPA, CSL) without creating a screening record.",
    parameters: zodToGeminiSchema(lookupRestrictedPartyListsSchema),
  },
  access: { navHref: "/app/party-screening" },
  execute: async (_ctx, rawArgs) => {
    const parsed = lookupRestrictedPartyListsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { name, listType } = parsed.data;

    const where: any = {
      name: { contains: name.trim(), mode: "insensitive" },
    };
    if (listType) where.listType = listType;

    const entities = await db.screeningEntity.findMany({
      where,
      take: 20,
      include: { aliases: true, addresses: true, identifiers: true },
    });
    return { count: entities.length, entities };
  },
};

// ---- tool: get_adcvd_orders ----

const getAdcvdOrdersSchema = z.object({
  caseNumber: z.string().optional().describe("AD/CVD case number (e.g. A-570-893)."),
  htsCode: z.string().optional().describe("HTS code or 4-6 digit prefix."),
  country: z.string().optional().describe("Country code (e.g. CN, VN)."),
});

const getAdcvdOrders: AssistantTool = {
  schema: getAdcvdOrdersSchema,
  declaration: {
    name: "get_adcvd_orders",
    description: "Lookup Anti-Dumping / Countervailing Duty (AD/CVD) orders and company deposit rates.",
    parameters: zodToGeminiSchema(getAdcvdOrdersSchema),
  },
  access: { navHref: "/app/adcvd" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getAdcvdOrdersSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { caseNumber, htsCode, country } = parsed.data;

    const where: any = {};
    if (caseNumber) where.caseNumber = { contains: caseNumber.trim(), mode: "insensitive" };
    if (country) where.country = country;
    if (htsCode) where.htsNumber = { contains: htsCode.replace(/[^0-9]/g, "") };

    const orders = await db.adcvdOrder.findMany({
      where,
      take: 20,
      include: { companyRates: true },
    });
    return { count: orders.length, orders };
  },
};

// ---- tool: get_section_301 ----

const getSection301Schema = z.object({
  htsCode: z.string().describe("HTS 8 or 10 digit code."),
});

const getSection301: AssistantTool = {
  schema: getSection301Schema,
  declaration: {
    name: "get_section_301",
    description: "Lookup Section 301 China tariff tranche, rate, and active exclusion status for an HTS code.",
    parameters: zodToGeminiSchema(getSection301Schema),
  },
  access: { navHref: "/app/duty-calculator" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getSection301Schema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { htsCode } = parsed.data;
    const cleanHts = htsCode.replace(/[^0-9]/g, "");

    const rates = await db.section301Rate.findMany({
      where: { htsNumber: { contains: cleanHts.slice(0, 8) } },
    });
    const exclusions = await db.section301Exclusion.findMany({
      where: { htsNumber: { contains: cleanHts.slice(0, 8) } },
    });
    return { htsCode, rates, exclusions };
  },
};

// ---- tool: get_pga_requirements ----

const getPgaRequirementsSchema = z.object({
  htsCode: z.string().describe("HTS 8 or 10 digit code."),
});

const getPgaRequirements: AssistantTool = {
  schema: getPgaRequirementsSchema,
  declaration: {
    name: "get_pga_requirements",
    description: "Lookup Partner Government Agency (FDA, EPA, DOT, USDA, TTB, FCC) filing requirements for an HTS code.",
    parameters: zodToGeminiSchema(getPgaRequirementsSchema),
  },
  access: { navHref: "/app/pga" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getPgaRequirementsSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { htsCode } = parsed.data;
    const cleanHts = htsCode.replace(/[^0-9]/g, "");

    const requirements = await db.htsPgaRequirement.findMany({
      where: { htsNumber: { contains: cleanHts.slice(0, 8) } },
    });
    return { htsCode, requirements };
  },
};

// ---- tool: get_exchange_rate ----

const getExchangeRateSchema = z.object({
  currency: z.string().describe("3-letter ISO currency code (e.g. EUR, CAD, RMB, JPY)."),
  asOfDate: z.string().optional().describe("Date YYYY-MM-DD for historical rate lookup."),
});

const getExchangeRate: AssistantTool = {
  schema: getExchangeRateSchema,
  declaration: {
    name: "get_exchange_rate",
    description: "Lookup official CBP / Treasury foreign exchange rates to USD.",
    parameters: zodToGeminiSchema(getExchangeRateSchema),
  },
  access: { navHref: "/app/fx" },
  execute: async (_ctx, rawArgs) => {
    const parsed = getExchangeRateSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { currency, asOfDate } = parsed.data;

    const rate = await db.exchangeRate.findFirst({
      where: {
        currency: currency.toUpperCase(),
        ...(asOfDate ? { effectiveDate: { lte: new Date(asOfDate) } } : {}),
      },
      orderBy: { effectiveDate: "desc" },
    });
    if (!rate) return { error: `No exchange rate found for currency ${currency}.` };
    return { rate };
  },
};

// ---- tool: search_regulatory_notices ----

const searchRegulatoryNoticesSchema = z.object({
  query: z.string().optional().describe("Keyword search term."),
  jurisdiction: z.string().optional().describe("Jurisdiction filter (e.g., US, EU)."),
});

const searchRegulatoryNotices: AssistantTool = {
  schema: searchRegulatoryNoticesSchema,
  declaration: {
    name: "search_regulatory_notices",
    description: "Search Federal Register and CBP regulatory updates with full published text.",
    parameters: zodToGeminiSchema(searchRegulatoryNoticesSchema),
  },
  access: { navHref: "/app/regulatory" },
  execute: async (_ctx, rawArgs) => {
    const parsed = searchRegulatoryNoticesSchema.safeParse(rawArgs);
    if (!parsed.success) return { error: parsed.error.message };
    const { query, jurisdiction } = parsed.data;

    const where: any = {};
    if (jurisdiction) where.jurisdiction = jurisdiction;
    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { publishedText: { contains: query, mode: "insensitive" } },
      ];
    }

    const updates = await db.regulatoryUpdate.findMany({
      where,
      take: 10,
      orderBy: { effectiveDate: "desc" },
    });
    return { count: updates.length, updates };
  },
};

// ---- tool: list_drawback_claims ----

const listDrawbackClaimsSchema = z.object({});

const listDrawbackClaims: AssistantTool = {
  schema: listDrawbackClaimsSchema,
  declaration: {
    name: "list_drawback_claims",
    description: "List duty drawback claims, lot status, and estimated refund amounts.",
    parameters: zodToGeminiSchema(listDrawbackClaimsSchema),
  },
  access: { navHref: "/app/drawback" },
  execute: async (ctx) => {
    const claims = await db.drawbackClaim.findMany({
      where: { accountId: ctx.accountId },
      take: 20,
      orderBy: { createdAt: "desc" },
    });
    return { count: claims.length, claims };
  },
};

// ---- tool: list_protests ----

const listProtestsSchema = z.object({});

const listProtests: AssistantTool = {
  schema: listProtestsSchema,
  declaration: {
    name: "list_protests",
    description: "List CBP 19 U.S.C. 1514 Customs Protests and refund claims.",
    parameters: zodToGeminiSchema(listProtestsSchema),
  },
  access: { navHref: "/app/protests" },
  execute: async (ctx) => {
    const protests = await db.protest.findMany({
      where: { accountId: ctx.accountId },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { entries: true },
    });
    return { count: protests.length, protests };
  },
};

// ---- tool: list_refund_opportunities ----

const listRefundOpportunitiesSchema = z.object({});

const listRefundOpportunities: AssistantTool = {
  schema: listRefundOpportunitiesSchema,
  declaration: {
    name: "list_refund_opportunities",
    description: "List Post-Summary Correction (PSC) and Section 301 duty refund opportunities.",
    parameters: zodToGeminiSchema(listRefundOpportunitiesSchema),
  },
  access: { navHref: "/app/refunds" },
  execute: async (ctx) => {
    const opportunities = await db.refundOpportunity.findMany({
      where: { accountId: ctx.accountId },
      take: 20,
      orderBy: { potentialRefundUsd: "desc" },
    });
    return { count: opportunities.length, opportunities };
  },
};

// ---- tool: get_dashboard_metrics ----

const getDashboardMetricsSchema = z.object({});

const getDashboardMetrics: AssistantTool = {
  schema: getDashboardMetricsSchema,
  declaration: {
    name: "get_dashboard_metrics",
    description: "Fetch live Command Center operational metrics (open exceptions, median cycle time, first pass rate, PSC count).",
    parameters: zodToGeminiSchema(getDashboardMetricsSchema),
  },
  access: { navHref: "/app/dashboard" },
  execute: async (ctx) => {
    const computeAnalyticsMetrics = (await import("@/lib/analytics/metricComputer")).computeAnalyticsMetrics;
    const metrics = await computeAnalyticsMetrics(ctx.accountId);
    return { metrics };
  },
};

export const ASSISTANT_TOOLS: AssistantTool[] = [
  listShipments,
  getValueAtRisk,
  getTeamMembers,
  createShipment,
  searchProducts,
  searchParties,
  searchDocuments,
  generateReasonableCareRecord,
  exportComplianceRecord,
  getShipment,
  screenShipmentEmbargo,
  getEmbargoScreeningDetails,
  getLatestCommunityScreeningRun,
  listFailedCommunityScreeningParties,
  explainCommunityScreeningPartyFailure,
  rescreenFailedCommunityScreeningParties,
  exportLatestCommunityScreeningRun,
  listExceptions,
  getDocument,
  listDecisions,
  getProduct,
  getProductOriginPosition,
  searchHts,
  searchRulings,
  getDutyStack,
  getRegulatoryUpdates,
  getFilingStatus,
  runImpactAnalysis,
  approveDecision,
  rejectDecision,
  resolveException,
  classifyProduct,
  getClassificationRationale,
  getDutyExposureRisks,
  validateShipmentFiling,
  getProductHistoryTool,
  getProductEvidence,
  getPartyTool,
  getPartyHistory,
  getPartyEvidence,
  getShipmentFilingReadiness,
  listTasks,
  getCountryEmbargoScreening,
  screenRestrictedParty,
  getRestrictedPartyScreeningDetails,
  getPartyRestrictedPartyScreeningHistory,
  getPartyPreApprovalStatus,
  getRestrictedPartyNotificationStatus,
  getShipmentComplianceExecutionHistory,
  getServiceUsageSummary,
  getFormalOverridesForResult,
  getRdpsOverview,
  listOpenRdpsAlerts,
  getReferenceDataChanges,
  explainPartyRdpsStatusChange,
  getRdpsRunDetail,
  getRdpsReportsSummary,
  getPartyRdpsMonitoringHistory,
  triggerManualRdpsScan,
  getHtsCode,
  getRuling,
  lookupRestrictedPartyLists,
  getAdcvdOrders,
  getSection301,
  getPgaRequirements,
  getExchangeRate,
  searchRegulatoryNotices,
  listDrawbackClaims,
  listProtests,
  listRefundOpportunities,
  getDashboardMetrics,
];

const TOOLS_BY_NAME = new Map(ASSISTANT_TOOLS.map((t) => [t.declaration.name, t]));

export function getToolByName(name: string): AssistantTool | undefined {
  return TOOLS_BY_NAME.get(name);
}

export function availableAssistantTools(ctx: AccountContext): AssistantTool[] {
  return ASSISTANT_TOOLS.filter((tool) => canUseTool(ctx, tool.access));
}
