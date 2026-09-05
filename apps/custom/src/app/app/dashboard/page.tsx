import { getAccountContext } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { computeReadinessBreakdown, deriveReadinessDimensions } from "@/lib/shipmentReadiness";
import { checkRequiredDocumentTypes } from "@/lib/requiredDocumentTypes";
import { triageDecision } from "@/modules/decisions/decisionState";
import { computeAttentionPriority } from "@/lib/dashboard/attentionPriority";
import { computeAgentOperationsFromGroups, type AgentOverrideGroup } from "@/lib/dashboard/agentOperationsSummary";
import { CommandCenterClient } from "./CommandCenterClient";
import type { TeamMember } from "@/lib/team";

const SHIPMENT_ROW_CAP = 2000;

const AUTO_CERTIFIED_STATUSES = new Set(["AUTO_VERIFIED", "Auto-Approved", "Verified"]);
const HUMAN_REVIEWED_STATUSES = new Set(["Approved", "APPROVED", "Rejected", "REJECTED"]);

const BLOCKED_SENTINELS = ["BLOCKED_DEPENDENCY", "WAITING_FOR_EXTRACTION", "BLOCKED_MISSING_DESCRIPTION"] as const;

interface DedupedAgentDecisionGroup {
  agentName: string;
  status: string;
  triageState: string | null;
  blockedSentinel: string | null;
  count: number;
}

export default async function CommandCenterPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const accountId = context.accountId;

  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const isEnterpriseAdmin =
      context.accountType === "ENTERPRISE" &&
      (context.roleNames.includes("ADMIN") || context.roleNames.includes("OWNER"));

    const [
      shipments,
      shipmentTotalCount,
      clients,
      dedupedAgentGroups,
      overrideEligibleDecisions,
      classificationCaseCounts,
      classificationOverrideCount,
      openRevalidationFlags,
      productReviewCount,
      significantProductChanges30d,
      regUpdates,
      openDeadlines,
      teamMemberships,
    ] = await Promise.all([
      db.shipment.findMany({
        where: { accountId, deletedAt: null },
        select: {
          id: true,
          shipmentNumber: true,
          poReference: true,
          importerName: true,
          entryType: true,
          incoterm: true,
          portOfEntry: true,
          countryOfExport: true,
          invoiceCurrency: true,
          status: true,
          healthStatus: true,
          riskScore: true,
          clientId: true,
          client: { select: { id: true, name: true } },
          assignedBrokerId: true,
          assignedBroker: { select: { id: true, firstName: true, lastName: true } },
          estimatedArrival: true,
          documents: { select: { docType: true, fileName: true, status: true, fileUrl: true } },
          lineItems: { select: { htsCode: true, countryOfOrigin: true, quantity: true, unitPrice: true, totalValue: true } },
          exceptionItems: { select: { status: true, severity: true } },
          agentDecisions: { select: { id: true, agentName: true, status: true, triageState: true, proposedDescription: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: SHIPMENT_ROW_CAP,
      }),
      db.shipment.count({ where: { accountId, deletedAt: null } }),
      db.client.findMany({
        where: { accountId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      // $queryRaw bypasses the withDataModeContext Prisma extension (it only
      // intercepts model CRUD, not raw SQL) -- safe here only because
      // AgentDecision has no own dataMode column and is scoped solely via its
      // accountId -> Account.dataMode relation, so filtering by this exact
      // accountId already pins the query to that account's one dataMode.
      // Dedup to the latest decision per (shipment, agent) before aggregating --
      // agents rerun on every shipment edit, so a naive groupBy over all
      // AgentDecision rows double-counts reruns. The outer GROUP BY stays a
      // real aggregate dimension (bounded by agent x status x triageState x
      // sentinel-or-not) by collapsing proposedDescription's free text down to
      // just the three blocked sentinels triageDecision checks for.
      db.$queryRaw<DedupedAgentDecisionGroup[]>`
        SELECT "agentName", "status", "triageState",
          CASE WHEN "proposedDescription" IN (${BLOCKED_SENTINELS[0]}, ${BLOCKED_SENTINELS[1]}, ${BLOCKED_SENTINELS[2]})
            THEN "proposedDescription" ELSE NULL END AS "blockedSentinel",
          COUNT(*)::int AS count
        FROM (
          SELECT DISTINCT ON ("shipmentId", "agentName") "agentName", "status", "triageState", "proposedDescription"
          FROM "AgentDecision"
          WHERE "accountId" = ${accountId}
          ORDER BY "shipmentId", "agentName", "createdAt" DESC
        ) latest
        GROUP BY "agentName", "status", "triageState", "blockedSentinel"
      `,
      // Override rate is a historical rate over every human approval this
      // agent ever received, so it's tallied over the full (non-deduped) set
      // -- a superseded decision's override still happened.
      db.agentDecision.findMany({
        where: {
          accountId,
          status: "Approved",
          autoApproved: false,
          currentHtsCode: { not: null },
          proposedHtsCode: { not: null },
        },
        select: { agentName: true, currentHtsCode: true, proposedHtsCode: true },
      }),
      db.classificationCase.groupBy({
        by: ["status"],
        where: { accountId },
        _count: { _all: true },
      }),
      db.classificationDecision.count({
        where: { decisionStatus: "OVERRIDDEN", case: { accountId } },
      }),
      db.productRevalidationFlag.groupBy({
        by: ["flag"],
        where: { accountId, status: "OPEN" },
        _count: { _all: true },
      }),
      db.product.count({
        where: { accountId, deletedAt: null, reviewStatus: "NEEDS_REVIEW" },
      }),
      db.productChangeEvent.count({
        where: { accountId, significance: "CUSTOMS_SIGNIFICANT", createdAt: { gte: thirtyDaysAgo } },
      }),
      db.regulatoryUpdate.findMany({
        take: 3,
        orderBy: { effectiveDate: "desc" },
        select: { id: true, title: true, description: true, effectiveDate: true },
      }),
      db.complianceDeadline.findMany({
        where: { accountId, status: "OPEN", dueAt: { not: null } },
        select: {
          shipmentId: true,
          type: true,
          dueAt: true,
          estimated: true,
          penaltyEstimate: true,
          shipment: { select: { shipmentNumber: true } },
        },
        orderBy: { dueAt: "asc" },
      }),
      isEnterpriseAdmin
        ? db.accountMembership.findMany({
            where: { accountId, status: "ACTIVE" },
            include: { user: true },
          })
        : Promise.resolve([]),
    ]);

    const agentGroups = dedupedAgentGroups.map((g) => ({
      agentName: g.agentName,
      status: g.status,
      triageState: g.triageState,
      proposedDescription: g.blockedSentinel,
      count: g.count,
    }));

    const overrideTally = new Map<string, { eligible: number; overridden: number }>();
    for (const d of overrideEligibleDecisions) {
      const tally = overrideTally.get(d.agentName) ?? { eligible: 0, overridden: 0 };
      tally.eligible++;
      if (d.currentHtsCode !== d.proposedHtsCode) tally.overridden++;
      overrideTally.set(d.agentName, tally);
    }
    const overrideGroups: AgentOverrideGroup[] = Array.from(overrideTally, ([agentName, tally]) => ({
      agentName,
      eligible: tally.eligible,
      overridden: tally.overridden,
    }));

    const agentOperations = computeAgentOperationsFromGroups(agentGroups, overrideGroups);

    // Throughput tiles use the same "latest decision per shipment per agent"
    // set as the Agent Operations table above -- both are exact counts (the
    // dedup query above is never capped), so there's nothing to truncate.
    const autoCertifiedCount = dedupedAgentGroups
      .filter((g) => AUTO_CERTIFIED_STATUSES.has(g.status))
      .reduce((sum, g) => sum + g.count, 0);
    const humanReviewedCount = dedupedAgentGroups
      .filter((g) => HUMAN_REVIEWED_STATUSES.has(g.status))
      .reduce((sum, g) => sum + g.count, 0);

    const shipmentsTruncated = shipmentTotalCount > shipments.length;

    const caseCountByStatus = new Map(classificationCaseCounts.map((c) => [c.status, c._count._all]));
    const classificationSignals = {
      newOrInProgress:
        (caseCountByStatus.get("DRAFT") ?? 0) +
        (caseCountByStatus.get("AWAITING_DOCUMENTS") ?? 0) +
        (caseCountByStatus.get("QUEUED") ?? 0) +
        (caseCountByStatus.get("PROCESSING") ?? 0),
      proposed: caseCountByStatus.get("PROPOSED") ?? 0,
      needsInformation: caseCountByStatus.get("NEEDS_INFORMATION") ?? 0,
      humanReviewRequired: caseCountByStatus.get("HUMAN_REVIEW_REQUIRED") ?? 0,
      approved: caseCountByStatus.get("APPROVED") ?? 0,
      overridden: classificationOverrideCount,
    };

    const revalidationByFlag = new Map(openRevalidationFlags.map((f) => [f.flag, f._count._all]));
    const productIntelligenceSignals = {
      classificationRevalidationRequired: revalidationByFlag.get("CLASSIFICATION_REVALIDATION_REQUIRED") ?? 0,
      originRevalidationRequired: revalidationByFlag.get("ORIGIN_REVALIDATION_REQUIRED") ?? 0,
      regulatoryRevalidationRequired: revalidationByFlag.get("REGULATORY_REVALIDATION_REQUIRED") ?? 0,
      valuationReviewRequired: revalidationByFlag.get("VALUATION_REVIEW_REQUIRED") ?? 0,
      productsNeedingReview: productReviewCount,
      significantChanges30d: significantProductChanges30d,
    };

    const needsReviewByAgent = new Map(agentOperations.map((a) => [a.agentName, a.needsReview]));
    const reviewQueue = {
      classification: classificationSignals.humanReviewRequired,
      productIntelligence: productIntelligenceSignals.productsNeedingReview,
      documentIntelligence: needsReviewByAgent.get("Document Intelligence Agent") ?? 0,
      origin: needsReviewByAgent.get("Origin Agent") ?? 0,
      valuation: needsReviewByAgent.get("Valuation Agent") ?? 0,
    };

    const teamMembers: TeamMember[] = teamMemberships.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
    }));

    const urgencyByShipment: Record<string, { deadlineType: string; dueAt: string; estimated: boolean; exposureUsd: number | null }> = {};
    for (const d of openDeadlines) {
      const num = d.shipment?.shipmentNumber;
      if (!num || urgencyByShipment[num]) continue;
      urgencyByShipment[num] = {
        deadlineType: d.type,
        dueAt: d.dueAt!.toISOString(),
        estimated: d.estimated,
        exposureUsd: d.penaltyEstimate != null ? Number(d.penaltyEstimate) : null,
      };
    }

    const now = Date.now();

    const formattedShipments = shipments.map((s) => {
      const readinessBreakdown = computeReadinessBreakdown(s);
      const readinessScore = readinessBreakdown.totalScore;
      const { dimensions: readinessDimensions, blockers: readinessBlockers } =
        deriveReadinessDimensions(readinessBreakdown);

      const primaryLineItem = [...s.lineItems].sort(
        (a, b) => Number(b.totalValue) - Number(a.totalValue)
      )[0];
      const totalValue = s.lineItems.reduce((sum, li) => sum + Number(li.totalValue), 0);
      const includeCertificateOfOrigin =
        s.documents.length === 0 || s.lineItems.some((li) => li.htsCode?.startsWith("02"));
      const docCheck = checkRequiredDocumentTypes(s.documents, includeCertificateOfOrigin);

      const activeExceptions = (s.exceptionItems || []).filter(
        (e) => e.status !== "RESOLVED" && e.status !== "WAIVED" && e.status !== "Resolved"
      );
      const blockedExceptions = activeExceptions.filter(
        (e) => e.severity === "Critical" || e.severity === "High"
      );
      const openExceptions = activeExceptions.filter(
        (e) => e.severity !== "Critical" && e.severity !== "High"
      );

      const latestByAgent = new Map<string, typeof s.agentDecisions[number]>();
      for (const d of s.agentDecisions || []) {
        const existing = latestByAgent.get(d.agentName);
        if (!existing || new Date(d.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
          latestByAgent.set(d.agentName, d);
        }
      }

      let blockedDecisions = 0;
      let needsReviewDecisions = 0;
      let verifiedDecisions = 0;

      for (const d of latestByAgent.values()) {
        const triage = triageDecision({ status: d.status, triageState: d.triageState, proposedDescription: d.proposedDescription });
        if (triage === "blocked") blockedDecisions++;
        else if (triage === "review") needsReviewDecisions++;
        else verifiedDecisions++;
      }

      const blockedCount = blockedExceptions.length + blockedDecisions;
      const needsReviewCount = openExceptions.length + needsReviewDecisions;
      const verifiedCount = verifiedDecisions;

      const hasCriticalException = activeExceptions.some((e) => e.severity === "Critical");
      const isOverdue =
        !!s.estimatedArrival &&
        s.estimatedArrival.getTime() < now &&
        s.status !== "Submitted" &&
        s.status !== "Completed";
      const deadlineInfo = urgencyByShipment[s.shipmentNumber];
      const hoursUntilDeadline = deadlineInfo
        ? (new Date(deadlineInfo.dueAt).getTime() - now) / (1000 * 60 * 60)
        : null;

      const { priority, reasons: attentionReasons } = computeAttentionPriority({
        hasCriticalException,
        blockedDecisions,
        needsReviewDecisions,
        isOverdue,
        missingDocCount: docCheck.missingTypes.length,
        hoursUntilDeadline,
      });

      return {
        id: s.id,
        shipmentNumber: s.shipmentNumber,
        referenceNumber: s.poReference,
        exporterName: s.importerName,
        primaryHtsCode: primaryLineItem?.htsCode ?? "Not Yet Classified",
        totalValue,
        currency: s.invoiceCurrency || "USD",
        readinessScore,
        readinessDimensions,
        readinessBlockers,
        priority,
        attentionReasons,
        status: s.status,
        healthStatus: s.healthStatus,
        riskScore: s.riskScore,
        clientId: s.clientId,
        client: s.client ? { id: s.client.id, name: s.client.name } : null,
        assignedBrokerId: s.assignedBrokerId,
        assignedBroker: s.assignedBroker
          ? {
              id: s.assignedBroker.id,
              firstName: s.assignedBroker.firstName,
              lastName: s.assignedBroker.lastName,
            }
          : null,
        estimatedArrival: s.estimatedArrival ? s.estimatedArrival.toISOString() : null,
        requiredDocTypes: docCheck.requiredTypes,
        missingDocTypes: docCheck.missingTypes,
        receivedDocCount: docCheck.receivedCount,
        totalRequiredDocs: docCheck.totalRequired,
        openExceptions: activeExceptions.length,
        aiReview: {
          blocked: blockedCount,
          needsReview: needsReviewCount,
          verified: verifiedCount,
        },
      };
    });

    const formattedRegUpdates = regUpdates.map((ru) => ({
      id: ru.id,
      title: ru.title,
      summary: ru.description,
      effectiveDate: ru.effectiveDate.toISOString(),
    }));

    return (
      <CommandCenterClient
        accountName={context.accountName}
        initialShipments={formattedShipments}
        urgencyByShipment={urgencyByShipment}
        autoCertifiedCount={autoCertifiedCount}
        humanReviewedCount={humanReviewedCount}
        regUpdates={formattedRegUpdates}
        teamMembers={teamMembers}
        clients={clients}
        agentOperations={agentOperations}
        shipmentsTruncated={shipmentsTruncated}
        shipmentTotalCount={shipmentTotalCount}
        classificationSignals={classificationSignals}
        productIntelligenceSignals={productIntelligenceSignals}
        reviewQueue={reviewQueue}
        context={{
          userId: context.userId,
          roleNames: context.roleNames,
          accountType: context.accountType,
          accountName: context.accountName,
          firstName: context.firstName,
          lastName: context.lastName,
          email: context.email,
        }}
      />
    );
  });
}
