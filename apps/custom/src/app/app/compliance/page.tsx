import { getAccountContext } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { Scale } from "lucide-react";
import { holdsPermission } from "@/modules/party/partyActor";
import { ComplianceWorkspaceClient, type ScreeningBucketData } from "./ComplianceWorkspaceClient";

export const dynamic = "force-dynamic";

const SCREENING_BUCKETS = [
  "COUNTRY_EMBARGO",
  "PRIVATE_EMBARGO",
  "UFLPA",
  "END_USE_RESTRICTION",
  "END_USER_RESTRICTION",
  "ANTI_BOYCOTT",
  "MILITARY_END_USE",
  "MILITARY_END_USER",
] as const;

export default async function CompliancePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const context = await getAccountContext();
  if (!context) return null;

  const rawTab = typeof searchParams.tab === "string" ? searchParams.tab : "overview";
  const activeTab =
    rawTab === "screening" || rawTab === "review" || rawTab === "audit" || rawTab === "history" ? rawTab : "overview";
  const mayReadPartyScreening = holdsPermission(context, "compliance.restrictedParty.read");
  const mayReadAuditHistory = holdsPermission(context, "compliance.read");
  const mayReadExecutionHistory =
    holdsPermission(context, "audit.read") || holdsPermission(context, "compliance.read");
  const resolvedTab =
    (activeTab === "audit" && !mayReadAuditHistory) || (activeTab === "history" && !mayReadExecutionHistory)
      ? "overview"
      : activeTab;

  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () => {
    let findingsQuery: Promise<any[]> = Promise.resolve([]);
    let auditQuery: Promise<any[]> = Promise.resolve([]);
    let screeningFindingQuery: Promise<any[]> = Promise.resolve([]);
    let partyResultQuery: Promise<any[]> = Promise.resolve([]);
    let partySummaryQuery: Promise<any> = Promise.resolve([]);

    if (resolvedTab === "overview") {
      findingsQuery = db.complianceFinding.findMany({
        where: { accountId: context.accountId },
        include: {
          filing: {
            select: {
              id: true,
              entryNumber: true,
              filingStatus: true,
              shipment: { select: { shipmentNumber: true, importerName: true } },
            },
          },
          assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 10,
      });

      if (mayReadAuditHistory) {
        auditQuery = db.complianceAuditRecord.findMany({
          where: { accountId: context.accountId },
          orderBy: { runAt: "desc" },
          take: 5,
          include: { filing: { select: { entryNumber: true } } },
        });
      }

      screeningFindingQuery = db.complianceScreeningFinding.findMany({
        where: { accountId: context.accountId },
        include: { shipment: { select: { id: true, shipmentNumber: true, importerName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      if (mayReadPartyScreening) {
        partyResultQuery = db.restrictedPartyScreeningResult.findMany({
          where: { accountId: context.accountId, status: { in: ["HIT", "REVIEW_REQUIRED", "PARTIAL"] } },
          select: {
            id: true,
            passType: true,
            status: true,
            screenedName: true,
            screeningDate: true,
            hitCount: true,
            redFlagCount: true,
            party: {
              select: {
                id: true,
                internalPartyCode: true,
                names: {
                  where: { status: "ACTIVE" },
                  orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
                  take: 1,
                  select: { rawName: true },
                },
              },
            },
            matches: { select: { id: true, matchedName: true, sourceList: true, nameScore: true } },
            redFlagHits: { select: { id: true, matchedWord: true } },
            disposition: { select: { status: true } },
          },
          orderBy: { screeningDate: "desc" },
          take: 10,
        });

        partySummaryQuery = db.partyScreeningSummary.groupBy({
          by: ["screeningStatus"],
          where: { accountId: context.accountId },
          _count: true,
        });
      }
    } else if (resolvedTab === "screening") {
      screeningFindingQuery = db.complianceScreeningFinding.findMany({
        where: { accountId: context.accountId },
        include: { shipment: { select: { id: true, shipmentNumber: true, importerName: true } } },
        orderBy: { createdAt: "desc" },
        take: 300,
      });

      if (mayReadPartyScreening) {
        partyResultQuery = db.restrictedPartyScreeningResult.findMany({
          where: { accountId: context.accountId, status: { in: ["HIT", "REVIEW_REQUIRED", "PARTIAL"] } },
          select: {
            id: true,
            passType: true,
            status: true,
            screenedName: true,
            screeningDate: true,
            hitCount: true,
            redFlagCount: true,
            party: {
              select: {
                id: true,
                internalPartyCode: true,
                names: {
                  where: { status: "ACTIVE" },
                  orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
                  take: 1,
                  select: { rawName: true },
                },
              },
            },
            matches: { select: { id: true, matchedName: true, sourceList: true, nameScore: true } },
            redFlagHits: { select: { id: true, matchedWord: true } },
            disposition: { select: { status: true } },
          },
          orderBy: { screeningDate: "desc" },
          take: 50,
        });

        partySummaryQuery = db.partyScreeningSummary.groupBy({
          by: ["screeningStatus"],
          where: { accountId: context.accountId },
          _count: true,
        });
      }
    } else if (resolvedTab === "review") {
      findingsQuery = db.complianceFinding.findMany({
        where: { accountId: context.accountId },
        include: {
          filing: {
            select: {
              id: true,
              entryNumber: true,
              filingStatus: true,
              shipment: { select: { shipmentNumber: true, importerName: true } },
            },
          },
          assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 50,
      });
    } else if (resolvedTab === "audit") {
      auditQuery = db.complianceAuditRecord.findMany({
        where: { accountId: context.accountId },
        orderBy: { runAt: "desc" },
        take: 50,
        include: { filing: { select: { entryNumber: true } } },
      });
    }
    // "history" tab needs no server query -- ExecutionHistoryPanel is fully
    // self-fetching against /api/v1/compliance/executions*.

    const [findings, recentAudits, screeningFindings, partyScreeningResults, partySummaryGroups] = await Promise.all([
      findingsQuery,
      auditQuery,
      screeningFindingQuery,
      partyResultQuery,
      partySummaryQuery,
    ]);

  const findingProps = findings.map((f) => ({
    id: f.id,
    filingId: f.filingId,
    rule: f.rule,
    severity: f.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    description: f.description,
    recommendation: f.recommendation,
    status: f.status,
    confidence: f.confidence,
    assignedToUserId: f.assignedToUserId,
    assignedToName: f.assignedToUser ? [f.assignedToUser.firstName, f.assignedToUser.lastName].filter(Boolean).join(" ") || f.assignedToUser.email : null,
    createdAt: f.createdAt.toISOString(),
    resolvedAt: f.resolvedAt ? f.resolvedAt.toISOString() : null,
    filing: f.filing
      ? {
          id: f.filing.id,
          entryNumber: f.filing.entryNumber,
          filingStatus: f.filing.filingStatus,
          shipmentNumber: f.filing.shipment?.shipmentNumber ?? "N/A",
          importerName: f.filing.shipment?.importerName ?? "Unknown Importer",
        }
      : null,
  }));

  const auditProps = recentAudits.map((a) => ({
    id: a.id,
    auditType: a.auditType,
    overallResult: a.overallResult,
    riskScore: a.riskScore,
    runAt: a.runAt.toISOString(),
    runByAgentName: a.runByAgentName,
    entryNumber: a.filing?.entryNumber ?? null,
  }));

  const screeningFindingProps = screeningFindings.map((f) => ({
    id: f.id,
    category: f.category,
    ruleId: f.ruleId,
    ruleName: f.ruleName,
    severity: f.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    details: f.details,
    lineNumber: f.lineNumber,
    status: f.status as "OPEN" | "RESOLVED",
    createdAt: f.createdAt.toISOString(),
    resolvedAt: f.resolvedAt ? f.resolvedAt.toISOString() : null,
    shipment: { id: f.shipment.id, shipmentNumber: f.shipment.shipmentNumber, importerName: f.shipment.importerName },
  }));

  const screeningBuckets: Record<string, ScreeningBucketData> = {};
  for (const bucket of SCREENING_BUCKETS) {
    const items = screeningFindingProps.filter((f) => f.category === bucket);
    screeningBuckets[bucket] = {
      items,
      openCount: items.filter((f) => f.status === "OPEN").length,
    };
  }

  const partyScreeningProps = partyScreeningResults.map((r) => ({
    id: r.id,
    passType: r.passType,
    status: r.status,
    screenedName: r.screenedName,
    screeningDate: r.screeningDate.toISOString(),
    hitCount: r.hitCount,
    redFlagCount: r.redFlagCount,
    party: r.party
      ? { id: r.party.id, internalPartyCode: r.party.internalPartyCode, displayName: r.party.names[0]?.rawName ?? r.party.internalPartyCode ?? "Unnamed party" }
      : null,
    matches: r.matches.map((m: any) => ({ id: m.id, matchedName: m.matchedName, sourceList: m.sourceList, nameScore: m.nameScore })),
    redFlagHits: r.redFlagHits.map((h: any) => ({ id: h.id, matchedWord: h.matchedWord })),
    disposition: r.disposition ? { status: r.disposition.status } : null,
  }));

  const partySummaryCounts: Record<string, number> = {};
  for (const group of partySummaryGroups) {
    partySummaryCounts[group.screeningStatus] = group._count;
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
          <Scale className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Compliance Workspace</h1>
          <p className="text-xs text-ink-muted">Screening, review, and audit history across every shipment</p>
        </div>
      </div>

      <ComplianceWorkspaceClient
        findings={findingProps}
        recentAudits={auditProps}
        screeningBuckets={screeningBuckets}
        mayReadPartyScreening={mayReadPartyScreening}
        mayReadAuditHistory={mayReadAuditHistory}
        partyScreeningResults={partyScreeningProps}
        partySummaryCounts={partySummaryCounts}
        mayReadExecutionHistory={mayReadExecutionHistory}
      />
    </div>
  );
  });
}
