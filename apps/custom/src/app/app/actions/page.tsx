import { redirect } from "next/navigation";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { canWrite } from "@/lib/api/write-access";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { groupDecisions } from "@/modules/decisions/groupDecisions";
import { getAllReviewableDecisionWhereFilter } from "@/modules/decisions/decisionState";
import { buildShipmentActionGroups } from "@/modules/actions/shipmentActions";
import { buildWorkQueue, filterWorkQueue, parseWorkFilter, explainRank } from "@/modules/work/workQueue";
import { loadWorkQueueForAccountFromPrefetched } from "@/modules/work/workQueueLoader";
import { RISK_ACCEPTANCE_PERMISSION, openStatusVariants } from "@/modules/exceptions/exceptionState";
import { loadComplianceLane, loadBillingLane } from "@/modules/today/loadTodayLanes";
import { ActionsClient } from "./ActionsClient";

export const dynamic = "force-dynamic";

const exceptionSelect = {
  id: true,
  type: true,
  severity: true,
  description: true,
  status: true,
  version: true,
  createdAt: true,
  resolvedAt: true,
  shipmentId: true,
  filingId: true,
  assignedToUserId: true,
  shipment: {
    select: {
      id: true,
      shipmentNumber: true,
      filingDeadline: true,
      assignedBrokerId: true,
      assignedBroker: { select: { id: true, firstName: true, lastName: true, email: true } },
      client: { select: { id: true, name: true } },
    },
  },
  assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
  blocking: true,
} as const;

export default async function ActionsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const context = await getAccountContext();
  if (!context) redirect("/sign-in");

  const shipmentId =
    typeof searchParams.shipmentId === "string" ? searchParams.shipmentId : undefined;

  const scope =
    typeof searchParams.scope === "string" &&
    ["mine", "team", "unassigned", "all"].includes(searchParams.scope)
      ? (searchParams.scope as "mine" | "team" | "unassigned" | "all")
      : "all";

  // AgentDecision/ShipmentDocument/ExceptionItem all carry an Account relation
  // (dataMode-scoped, as does everything loadWorkQueueForAccount below queries)
  // -- without this wrapper these queries silently default to PRODUCTION
  // isolation for any DEMO/SANDBOX account.
  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () => {

  // Scope filter for the routed queue: My / Team / Unassigned tabs. Applied to
  // decisions and exceptions (the two work-item kinds that carry an assignee).
  let scopeWhere: Record<string, unknown> = {};
  if (scope === "mine") {
    scopeWhere = { assignedToUserId: context.userId };
  } else if (scope === "unassigned") {
    scopeWhere = { assignedToUserId: null };
  } else if (scope === "team") {
    const myTeams = await db.accountTeamMembership.findMany({
      where: { userId: context.userId },
      select: { teamId: true },
    });
    const teammates = await db.accountTeamMembership.findMany({
      where: { teamId: { in: myTeams.map((t) => t.teamId) } },
      select: { userId: true },
    });
    scopeWhere = { assignedToUserId: { in: Array.from(new Set(teammates.map((m) => m.userId))) } };
  }

  // Today's compliance + billing lanes are account-wide triage (not scoped by
  // the My/Team/Unassigned tabs, which only apply to assignable Operations
  // work). Each lane is gated by the same permission that guards its native
  // surface; a lane the caller may not see is passed as null and its chip
  // never renders.
  const [
    mayViewComplianceLane,
    mayViewBillingLane,
    canResolveCompliance,
    canResolveBilling,
    canWaiveBilling,
    canEscalate,
  ] = await Promise.all([
    hasPermission("compliance.read"),
    hasPermission("billing.exception.view"),
    hasPermission("exceptions.resolve"),
    hasPermission("billing.exception.resolve"),
    hasPermission("billing.exception.waive"),
    hasPermission("specialist.write"),
  ]);

  const [decisions, allDocuments, exceptions, writable, mayWaive, memberships, complianceLane, billingLane] = await Promise.all([
    db.agentDecision.findMany({
      where: {
        accountId: context.accountId,
        ...getAllReviewableDecisionWhereFilter(),
        ...(shipmentId ? { shipmentId } : {}),
        ...scopeWhere,
      },
      select: {
        id: true,
        accountId: true,
        agentName: true,
        status: true,
        triageState: true,
        blockedReason: true,
        autoApprovalPolicy: true,
        autoApproved: true,
        createdAt: true,
        updatedAt: true,
        decisionSummary: true,
        humanNotes: true,
        currentHtsCode: true,
        proposedHtsCode: true,
        proposedDescription: true,
        evidenceItems: true,
        shipmentId: true,
        documentId: true,
        lineNumber: true,
        confidence: true,
        shipment: {
          select: {
            id: true,
            shipmentNumber: true,
            filingDeadline: true,
            assignedBrokerId: true,
            assignedBroker: { select: { id: true, firstName: true, lastName: true, email: true } },
            client: { select: { id: true, name: true } },
          },
        },
        reviewedByUser: { select: { id: true, firstName: true, lastName: true, email: true, brokerLicenseNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.shipmentDocument.findMany({
      where: {
        shipment: { accountId: context.accountId },
        ...(shipmentId ? { shipmentId } : {}),
      },
      select: {
        id: true,
        shipmentId: true,
        fileName: true,
        fileUrl: true,
        status: true,
        createdAt: true,
        shipment: { select: { shipmentNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.exceptionItem.findMany({
      where: {
        accountId: context.accountId,
        status: { in: openStatusVariants() },
        shipmentId: { not: null },
        ...(shipmentId ? { shipmentId } : {}),
        ...scopeWhere,
      },
      select: exceptionSelect,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    Promise.resolve(canWrite(context)),
    hasPermission(RISK_ACCEPTANCE_PERMISSION).then((ok) => canWrite(context) && ok),
    db.accountMembership.findMany({
      where: { accountId: context.accountId, status: "ACTIVE" },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    mayViewComplianceLane ? loadComplianceLane(context.accountId) : Promise.resolve(null),
    mayViewBillingLane ? loadBillingLane(context.accountId) : Promise.resolve(null),
  ]);

  const queueLoaderResult = await loadWorkQueueForAccountFromPrefetched(
    context.accountId,
    context.userId,
    { decisions, documents: allDocuments, exceptions },
    { shipmentId }
  );

  const serializedDecisions = decisions.map((d) => ({
    ...d,
    shipmentId: d.shipmentId ?? "",
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    shipment: d.shipment
      ? {
          ...d.shipment,
          filingDeadline: d.shipment.filingDeadline ? d.shipment.filingDeadline.toISOString() : null,
        }
      : null,
  }));

  const serializedDocuments = allDocuments.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
  }));

  const serializedExceptions = exceptions.map((e) => ({
    ...e,
    createdAt: e.createdAt.toISOString(),
    resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
    shipment: e.shipment
      ? {
          ...e.shipment,
          filingDeadline: e.shipment.filingDeadline ? e.shipment.filingDeadline.toISOString() : null,
        }
      : null,
  }));

  const decisionGroups = groupDecisions(serializedDecisions, serializedDocuments);
  const groups = buildShipmentActionGroups(decisionGroups, serializedExceptions);

  // Build the ordered work queue — first production call to buildWorkQueue.
  // The queue drives ordering and urgency display; groups drive the detailed
  // review UI. Both are passed so ActionsClient can show countdown chips.
  const workQueueParams = new URLSearchParams(
    Object.entries(searchParams)
      .filter(([, v]) => typeof v === "string")
      .map(([k, v]) => [k, v as string])
  );
  const workFilter = parseWorkFilter(workQueueParams);
  const workQueue = buildWorkQueue(queueLoaderResult.input);
  const filteredQueue = filterWorkQueue(workQueue, workFilter);

  // shipmentNumber → best B-1 score + the one-line "why now" a broker can defend.
  // Built from the unfiltered queue so list order is stable across client filters.
  const queueRankByShipment: Record<string, { score: number; reason: string }> = {};
  for (const item of workQueue) {
    if (!item.shipmentNumber) continue;
    const existing = queueRankByShipment[item.shipmentNumber];
    if (existing && existing.score >= item.score) continue;
    queueRankByShipment[item.shipmentNumber] = {
      score: item.score,
      reason: explainRank(item),
    };
  }

  const firstName = context.firstName ?? null;
  const lastName = context.lastName ?? null;
  const userName = [firstName, lastName].filter(Boolean).join(" ") || context.email;

  const documents = serializedDocuments.map((d: { id: string; fileName: string; fileUrl: string | null }) => ({
    id: d.id,
    fileName: d.fileName,
    fileUrl: d.fileUrl ?? null,
  }));

  // Apply deadline urgency as a priority floor on each group.
  // buildShipmentActionGroups derives priority only from decisions/exceptions;
  // a 17h deadline must escalate the group to "critical" regardless.
  const urgencyFloor = (msRemaining: number): "critical" | "high" | "normal" =>
    msRemaining <= 0 || msRemaining <= 24 * 3_600_000 ? "critical"
    : msRemaining <= 3 * 24 * 3_600_000 ? "high"
    : "normal";
  const priorityRank = { critical: 0, high: 1, normal: 2 } as const;
  for (const g of groups) {
    const queueItem = filteredQueue.find((i) => i.shipmentNumber === g.shipmentNumber && i.urgency);
    if (!queueItem?.urgency) continue;
    const floor = urgencyFloor(queueItem.urgency.msRemaining);
    if (priorityRank[floor] < priorityRank[g.priority]) g.priority = floor;
  }

  // Serialize the urgency map (shipmentId → most-urgent deadline) so the
  // client can render countdown chips without its own DB access.
  const urgencyByShipment = Object.fromEntries(
    filteredQueue
      .filter((item) => item.urgency != null && item.shipmentNumber != null)
      .map((item) => [
        item.shipmentNumber!,
        {
          deadlineType: item.urgency!.deadlineType,
          dueAt: item.urgency!.dueAt.toISOString(),
          msRemaining: item.urgency!.msRemaining,
          breached: item.urgency!.breached,
          estimated: item.urgency!.estimated,
          exposureUsd: item.urgency!.exposureUsd,
        },
      ])
  );

  const teamMembers = memberships.map((m) => m.user);

  const operationsCount = groups.reduce((n, g) => n + g.items.length, 0);
  const laneParam = typeof searchParams.lane === "string" ? searchParams.lane : undefined;
  const initialLane =
    laneParam === "compliance" && complianceLane
      ? "compliance"
      : laneParam === "billing" && billingLane
        ? "billing"
        : "operations";

  return (
    <ActionsClient
      groups={groups}
      canReadPga={await hasPermission("pga.read")}
      canReviewPga={await hasPermission("pga.review")}
      canWrite={writable}
      canWaive={mayWaive}
      initialShipmentId={shipmentId}
      userId={context.userId}
      userName={userName}
      documents={documents}
      urgencyByShipment={urgencyByShipment}
      queueRankByShipment={queueRankByShipment}
      teamMembers={teamMembers}
      scope={scope}
      operationsCount={operationsCount}
      complianceLane={complianceLane}
      billingLane={billingLane}
      initialLane={initialLane}
      canResolveCompliance={canResolveCompliance}
      canResolveBilling={canResolveBilling}
      canWaiveBilling={canWaiveBilling}
      canEscalate={canEscalate}
    />
  );
  });
}
