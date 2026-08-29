/**
 * Account-scoped data loader for the work queue.
 *
 * Fetches decisions, findings, filings, documents, exceptions, and open
 * ComplianceDeadlines for one account and shapes them into WorkQueueInput.
 * The caller is responsible for account auth; this module does not re-check.
 */

import { db } from "@/lib/db";
import { DeadlineStatus } from "@prisma/client";
import {
  FILING_ACTIONABLE_STATUSES,
  DOCUMENT_ACTIONABLE_STATUSES,
  EXCEPTION_ACTIONABLE_STATUSES,
  type WorkQueueInput,
  type DecisionRow,
  type FilingRow,
  type DocumentRow,
  type ExceptionRow,
  type DeadlineRow,
} from "./workQueue";
import { getActionableDecisionWhereFilter, isDecisionActionable } from "@/modules/decisions/decisionState";

const ROW_CAP = 500; // per source — prevents loading the whole account

export interface WorkQueueLoaderResult {
  input: WorkQueueInput;
  loads: Partial<Record<keyof WorkQueueInput, { loaded: number; matching: number }>>;
}

interface RawDecisionRow {
  id: string;
  agentName: string;
  decisionSummary: string;
  status: string;
  triageState: string | null;
  proposedDescription: string | null;
  confidence: number | null;
  createdAt: Date;
  shipmentId: string | null;
  assignedToUserId?: string | null;
  assignedToUser?: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  reviewSlaDueAt?: Date | null;
  slaBreachedAt?: Date | null;
  escalationLevel?: number | null;
  shipment: { shipmentNumber: string | null; filingDeadline: Date | null } | null;
}

interface RawDocumentRow {
  id: string;
  fileName: string;
  status: string;
  createdAt: Date;
  shipmentId: string | null;
  shipment: { shipmentNumber: string | null } | null;
}

interface RawExceptionRow {
  id: string;
  type: string;
  description: string;
  severity: string;
  status: string;
  blocking: boolean | null;
  createdAt: Date;
  shipmentId: string | null;
  assignedToUserId?: string | null;
  assignedToUser?: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  slaDueAt?: Date | null;
  slaBreachedAt?: Date | null;
  escalationLevel?: number | null;
  shipment: { shipmentNumber: string | null; filingDeadline: Date | null } | null;
}

function toDecisionRow(d: RawDecisionRow): DecisionRow {
  return {
    id: d.id,
    agentName: d.agentName,
    decisionSummary: d.decisionSummary,
    status: d.status,
    triageState: d.triageState,
    proposedDescription: d.proposedDescription,
    confidence: d.confidence,
    createdAt: d.createdAt,
    shipmentId: d.shipmentId,
    shipmentNumber: d.shipment?.shipmentNumber ?? null,
    assignedToUserId: d.assignedToUserId ?? null,
    assignedToUser: d.assignedToUser ?? null,
    reviewSlaDueAt: d.reviewSlaDueAt ?? null,
    slaBreachedAt: d.slaBreachedAt ?? null,
    escalationLevel: d.escalationLevel ?? 0,
    filingDeadline: d.shipment?.filingDeadline ?? null,
  };
}

function toDocumentRow(d: RawDocumentRow): DocumentRow {
  return {
    id: d.id,
    fileName: d.fileName,
    status: d.status,
    createdAt: d.createdAt,
    shipmentId: d.shipmentId,
    shipmentNumber: d.shipment?.shipmentNumber ?? null,
  };
}

function toExceptionRow(e: RawExceptionRow): ExceptionRow {
  return {
    id: e.id,
    type: e.type,
    description: e.description,
    severity: e.severity,
    status: e.status,
    blocking: e.blocking,
    createdAt: e.createdAt,
    shipmentId: e.shipmentId,
    shipmentNumber: e.shipment?.shipmentNumber ?? null,
    assignedToUserId: e.assignedToUserId ?? null,
    assignedToUser: e.assignedToUser ?? null,
    slaDueAt: e.slaDueAt ?? null,
    slaBreachedAt: e.slaBreachedAt ?? null,
    escalationLevel: e.escalationLevel ?? 0,
    filingDeadline: e.shipment?.filingDeadline ?? null,
  };
}

export interface WorkQueueOptions {
  shipmentId?: string;
  scope?: "mine" | "team" | "unassigned" | "all";
  stage?: string;
}

export async function loadWorkQueueForAccount(
  accountId: string,
  userId: string,
  options: WorkQueueOptions = {}
): Promise<WorkQueueLoaderResult> {
  const { shipmentId, scope, stage } = options;
  const shipmentFilter: Record<string, unknown> = shipmentId ? { shipmentId } : {};

  if (stage) {
    shipmentFilter.shipment = { currentStage: stage };
  }

  // Filings and documents carry no assignee, so a person-scoped view
  // (mine / team / unassigned) must exclude them rather than dump every
  // account-wide filing into "My queue".
  const personalScope = scope === "mine" || scope === "team" || scope === "unassigned";

  // Resolve DB scope filter
  let scopeFilter: Record<string, unknown> = {};
  if (scope === "mine") {
    scopeFilter = { assignedToUserId: userId };
  } else if (scope === "unassigned") {
    scopeFilter = { assignedToUserId: null };
  } else if (scope === "team") {
    const userTeams = await db.accountTeamMembership.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = userTeams.map((t) => t.teamId);
    const teamMembers = await db.accountTeamMembership.findMany({
      where: { teamId: { in: teamIds } },
      select: { userId: true },
    });
    const memberUserIds = Array.from(new Set(teamMembers.map((m) => m.userId)));
    scopeFilter = { assignedToUserId: { in: memberUserIds } };
  }

  const userSelect = { select: { id: true, firstName: true, lastName: true, email: true } };

  const [decisions, filings, documents, exceptions, deadlines] = await Promise.all([
    db.agentDecision.findMany({
      where: {
        accountId,
        ...getActionableDecisionWhereFilter(),
        ...shipmentFilter,
        ...scopeFilter,
      },
      select: {
        id: true,
        agentName: true,
        decisionSummary: true,
        status: true,
        triageState: true,
        proposedDescription: true,
        confidence: true,
        createdAt: true,
        shipmentId: true,
        assignedToUserId: true,
        assignedToUser: userSelect,
        reviewSlaDueAt: true,
        slaBreachedAt: true,
        escalationLevel: true,
        shipment: { select: { shipmentNumber: true, filingDeadline: true } },
      },
      orderBy: { createdAt: "desc" },
      take: ROW_CAP,
    }),

    db.customsFiling.findMany({
      where: {
        accountId,
        filingStatus: { in: FILING_ACTIONABLE_STATUSES },
        ...(shipmentId ? { shipmentId } : {}),
      },
      select: {
        id: true,
        entryNumber: true,
        filingStatus: true,
        createdAt: true,
        shipmentId: true,
        shipment: { select: { shipmentNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: personalScope ? 0 : ROW_CAP,
    }),

    db.shipmentDocument.findMany({
      where: {
        shipment: { accountId },
        status: { in: DOCUMENT_ACTIONABLE_STATUSES },
        ...shipmentFilter,
      },
      select: {
        id: true,
        fileName: true,
        status: true,
        createdAt: true,
        shipmentId: true,
        shipment: { select: { shipmentNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: personalScope ? 0 : ROW_CAP,
    }),

    db.exceptionItem.findMany({
      where: {
        accountId,
        status: { in: EXCEPTION_ACTIONABLE_STATUSES },
        ...shipmentFilter,
        ...scopeFilter,
      },
      select: {
        id: true,
        type: true,
        description: true,
        severity: true,
        status: true,
        blocking: true,
        createdAt: true,
        shipmentId: true,
        assignedToUserId: true,
        assignedToUser: userSelect,
        slaDueAt: true,
        slaBreachedAt: true,
        escalationLevel: true,
        shipment: { select: { shipmentNumber: true, filingDeadline: true } },
      },
      orderBy: { createdAt: "desc" },
      take: ROW_CAP,
    }),

    db.complianceDeadline.findMany({
      where: {
        accountId,
        status: DeadlineStatus.OPEN,
        dueAt: { not: null },
        ...(shipmentId ? { shipmentId } : {}),
      },
      select: {
        shipmentId: true,
        type: true,
        dueAt: true,
        estimated: true,
        penaltyEstimate: true,
      },
    }),
  ]);

  const decisionRows: DecisionRow[] = decisions.map(toDecisionRow);
  const filingRows: FilingRow[] = filings.map(toFilingRow);
  const documentRows: DocumentRow[] = documents.map(toDocumentRow);
  const exceptionRows: ExceptionRow[] = exceptions.map(toExceptionRow);
  const deadlineRows: DeadlineRow[] = deadlines.filter(hasDeadline).map(toDeadlineRow);

  const input: WorkQueueInput = {
    userId,
    decisions: decisionRows,
    findings: [], // findings come from CustomsFiling scope — not yet wired here
    filings: filingRows,
    documents: documentRows,
    exceptions: exceptionRows,
    deadlines: deadlineRows,
  };

  return {
    input,
    loads: {
      decisions: { loaded: decisions.length, matching: decisions.length },
      filings: { loaded: filings.length, matching: filings.length },
      documents: { loaded: documents.length, matching: documents.length },
      exceptions: { loaded: exceptions.length, matching: exceptions.length },
    },
  };
}

interface RawFilingRow {
  id: string;
  entryNumber: string;
  filingStatus: string;
  createdAt: Date;
  shipmentId: string | null;
  shipment: { shipmentNumber: string | null } | null;
}

interface RawDeadlineRow {
  shipmentId: string | null;
  type: string;
  dueAt: Date | null;
  estimated: boolean;
  penaltyEstimate: unknown;
}

function toFilingRow(f: RawFilingRow): FilingRow {
  return {
    id: f.id,
    entryNumber: f.entryNumber,
    filingStatus: f.filingStatus,
    createdAt: f.createdAt,
    shipmentId: f.shipmentId,
    shipmentNumber: f.shipment?.shipmentNumber ?? null,
  };
}

function hasDeadline(d: RawDeadlineRow): boolean {
  return d.shipmentId != null && d.dueAt != null;
}

function toDeadlineRow(d: RawDeadlineRow): DeadlineRow {
  return {
    shipmentId: d.shipmentId!,
    type: d.type,
    dueAt: d.dueAt!,
    estimated: d.estimated,
    penaltyEstimate: d.penaltyEstimate != null ? Number(d.penaltyEstimate) : null,
  };
}

/**
 * Same shape as `loadWorkQueueForAccount`, but for callers that already hold
 * account-scoped decisions/documents/exceptions from an earlier query (e.g.
 * the Actions page, which fetches a superset of these for its own display).
 * Filters that superset down to the actionable rows in memory instead of
 * re-querying, and only hits the DB for filings/deadlines, which aren't
 * fetched anywhere else on that page.
 */
export async function loadWorkQueueForAccountFromPrefetched(
  accountId: string,
  userId: string,
  rows: { decisions: RawDecisionRow[]; documents: RawDocumentRow[]; exceptions: RawExceptionRow[] },
  options: { shipmentId?: string } = {}
): Promise<WorkQueueLoaderResult> {
  const { shipmentId } = options;

  const [filings, deadlines] = await Promise.all([
    db.customsFiling.findMany({
      where: {
        accountId,
        filingStatus: { in: FILING_ACTIONABLE_STATUSES },
        ...(shipmentId ? { shipmentId } : {}),
      },
      select: {
        id: true,
        entryNumber: true,
        filingStatus: true,
        createdAt: true,
        shipmentId: true,
        shipment: { select: { shipmentNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: ROW_CAP,
    }),
    db.complianceDeadline.findMany({
      where: {
        accountId,
        status: DeadlineStatus.OPEN,
        dueAt: { not: null },
        ...(shipmentId ? { shipmentId } : {}),
      },
      select: {
        shipmentId: true,
        type: true,
        dueAt: true,
        estimated: true,
        penaltyEstimate: true,
      },
    }),
  ]);

  const actionableDecisions = rows.decisions.filter(isDecisionActionable);
  const actionableDocuments = rows.documents.filter((d) => DOCUMENT_ACTIONABLE_STATUSES.includes(d.status));
  // rows.exceptions is assumed pre-filtered by the caller's query to
  // EXCEPTION_ACTIONABLE_STATUSES (same `openStatusVariants()` set) --
  // no further in-memory filtering needed here.

  const decisionRows: DecisionRow[] = actionableDecisions.map(toDecisionRow);
  const documentRows: DocumentRow[] = actionableDocuments.map(toDocumentRow);
  const exceptionRows: ExceptionRow[] = rows.exceptions.map(toExceptionRow);
  const filingRows: FilingRow[] = filings.map(toFilingRow);
  const deadlineRows: DeadlineRow[] = deadlines.filter(hasDeadline).map(toDeadlineRow);

  const input: WorkQueueInput = {
    userId,
    decisions: decisionRows,
    findings: [],
    filings: filingRows,
    documents: documentRows,
    exceptions: exceptionRows,
    deadlines: deadlineRows,
  };

  return {
    input,
    loads: {
      decisions: { loaded: rows.decisions.length, matching: actionableDecisions.length },
      filings: { loaded: filings.length, matching: filings.length },
      documents: { loaded: rows.documents.length, matching: actionableDocuments.length },
      exceptions: { loaded: rows.exceptions.length, matching: rows.exceptions.length },
    },
  };
}
