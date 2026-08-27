"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { LayoutDashboard, Search, ListChecks, Clock, ShieldCheck, Mail, Users, Radar } from "lucide-react";
import type { ScreeningFindingProps, PartyScreeningResultProps } from "./ScreeningPanel";
import type { AuditRecordProps } from "./AuditHistoryPanel";

// OverviewPanel is the default tab (no ?tab= param) -- keep it SSR'd so the
// most common landing view has real server-rendered content on first paint.
// Only the non-default tabs defer to ssr:false for bundle-splitting.
const OverviewPanel = dynamic(() => import("./OverviewPanel").then((m) => m.OverviewPanel));
const ScreeningPanel = dynamic(() => import("./ScreeningPanel").then((m) => m.ScreeningPanel), { ssr: false });
const ComplianceFindingsClient = dynamic(() => import("./ComplianceFindingsClient").then((m) => m.ComplianceFindingsClient), { ssr: false });
const AuditHistoryPanel = dynamic(() => import("./AuditHistoryPanel").then((m) => m.AuditHistoryPanel), { ssr: false });
const ExecutionHistoryPanel = dynamic(() => import("./ExecutionHistoryPanel").then((m) => m.ExecutionHistoryPanel), { ssr: false });
const NotificationSettingsPanel = dynamic(() => import("./NotificationSettingsPanel").then((m) => m.NotificationSettingsPanel), { ssr: false });
const CommunityScreeningPanel = dynamic(() => import("./CommunityScreeningPanel").then((m) => m.CommunityScreeningPanel), { ssr: false });
const RdpsPanel = dynamic(() => import("./RdpsPanel").then((m) => m.RdpsPanel), { ssr: false });

export type ScreeningBucketData = {
  items: ScreeningFindingProps[];
  openCount: number;
};

interface FindingProps {
  id: string;
  filingId: string;
  rule: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  recommendation: string | null;
  status: string;
  confidence: number | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  filing: {
    id: string;
    entryNumber: string;
    filingStatus: string;
    shipmentNumber: string;
    importerName: string;
  } | null;
}

interface NotificationSettingsProps {
  rpsEmailAlertsEnabled: boolean;
  rpsGeneralRecipients: string[];
  rpsHitRecipients: string[];
  rpsPalRescreenRecipients: string[];
  rpsEmailFormat: "HTML" | "TEXT";
  rpsSecureEmailEnabled: boolean;
  rpsSuppressEmailAlerts: boolean;
}

interface ComplianceWorkspaceClientProps {
  initialTab?: string;
  findings: FindingProps[];
  recentAudits: AuditRecordProps[];
  screeningBuckets: Record<string, ScreeningBucketData>;
  mayReadPartyScreening: boolean;
  mayReadAuditHistory: boolean;
  partyScreeningResults: PartyScreeningResultProps[];
  partySummaryCounts: Record<string, number>;
  /** Gates the "Service Usage & History" tab -- true when the session holds `audit.read` or `compliance.read`. */
  mayReadExecutionHistory: boolean;
  /** Gates the "Notifications" tab -- true when the session holds `compliance.restrictedParty.settings.manage`. */
  mayManageNotificationSettings: boolean;
  notificationSettings: NotificationSettingsProps;
  /** Gates the "Community Screening" tab -- true when the session holds `compliance.community_screening.read`. */
  mayReadCommunityScreening: boolean;
  /** Gates the override fields (name/address threshold, country-match, red-flag) in Community Screening -- true when the session holds `compliance.community_screening.override`. */
  mayOverrideThresholds: boolean;
  /** Gates the "Continuous Monitoring" (RDPS) tab -- true when the session holds `compliance.rdps.read`. */
  mayReadRdps: boolean;
  /** Gates scan-trigger/disposition actions within the RDPS tab -- true when the session holds `compliance.rdps.manage`. */
  mayManageRdps: boolean;
}

type WorkspaceTab =
  | "overview"
  | "screening"
  | "review"
  | "audit"
  | "history"
  | "notifications"
  | "community-screening"
  | "rdps";

export function ComplianceWorkspaceClient({
  initialTab = "overview",
  findings,
  recentAudits,
  screeningBuckets,
  mayReadPartyScreening,
  mayReadAuditHistory,
  partyScreeningResults,
  partySummaryCounts,
  mayReadExecutionHistory,
  mayManageNotificationSettings,
  notificationSettings,
  mayReadCommunityScreening,
  mayOverrideThresholds,
  mayReadRdps,
  mayManageRdps,
}: ComplianceWorkspaceClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    (initialTab as WorkspaceTab) || "overview"
  );

  const topTabs: { id: WorkspaceTab; label: string; icon: typeof LayoutDashboard; hidden?: boolean }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "screening", label: "Screening", icon: Search },
    { id: "review", label: "Review Queue", icon: ListChecks },
    { id: "audit", label: "Audit History", icon: Clock, hidden: !mayReadAuditHistory },
    { id: "history", label: "Service Usage & History", icon: ShieldCheck, hidden: !mayReadExecutionHistory },
    { id: "notifications", label: "Notifications", icon: Mail, hidden: !mayManageNotificationSettings },
    { id: "community-screening", label: "Community Screening", icon: Users, hidden: !mayReadCommunityScreening },
    { id: "rdps", label: "Continuous Monitoring", icon: Radar, hidden: !mayReadRdps },
  ];

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "audit") {
      setActiveTab(mayReadAuditHistory ? "audit" : "overview");
    } else if (tabParam === "history") {
      setActiveTab(mayReadExecutionHistory ? "history" : "overview");
    } else if (tabParam === "notifications") {
      setActiveTab(mayManageNotificationSettings ? "notifications" : "overview");
    } else if (tabParam === "community-screening") {
      setActiveTab(mayReadCommunityScreening ? "community-screening" : "overview");
    } else if (tabParam === "rdps") {
      setActiveTab(mayReadRdps ? "rdps" : "overview");
    } else if (tabParam === "screening" || tabParam === "review") {
      setActiveTab(tabParam);
    } else if (!tabParam) {
      setActiveTab("overview");
    }
  }, [
    searchParams,
    mayReadAuditHistory,
    mayReadExecutionHistory,
    mayManageNotificationSettings,
    mayReadCommunityScreening,
    mayReadRdps,
  ]);

  const selectTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.push(`?${params.toString()}`);
  };

  const openFindingsCount = findings.filter((f) => f.status !== "Resolved").length;
  const partyReviewCount = partyScreeningResults.filter((r) => !r.disposition || r.disposition.status === "PENDING").length;
  const screeningOpenTotal = Object.values(screeningBuckets).reduce((sum, b) => sum + b.openCount, 0) + (mayReadPartyScreening ? partyReviewCount : 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 pt-2 border-t border-border">
        {topTabs.filter((t) => !t.hidden).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === id ? "bg-brand text-white" : "bg-slate-100 text-ink-muted hover:text-ink"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            {id === "screening" && screeningOpenTotal > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] ${activeTab === id ? "bg-white/20" : "bg-slate-200"}`}>
                {screeningOpenTotal}
              </span>
            )}
            {id === "review" && openFindingsCount > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] ${activeTab === id ? "bg-white/20" : "bg-slate-200"}`}>
                {openFindingsCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div key={activeTab} className="space-y-6">
        {activeTab === "overview" && (
          <OverviewPanel
            findings={findings}
            screeningBuckets={screeningBuckets}
            mayReadPartyScreening={mayReadPartyScreening}
            partySummaryCounts={partySummaryCounts}
            onNavigate={selectTab}
          />
        )}
        {activeTab === "screening" && (
          <ScreeningPanel
            screeningBuckets={screeningBuckets}
            mayReadPartyScreening={mayReadPartyScreening}
            partyScreeningResults={partyScreeningResults}
          />
        )}
        {activeTab === "review" && <ComplianceFindingsClient findings={findings} recentAudits={[]} />}
        {activeTab === "audit" && mayReadAuditHistory && <AuditHistoryPanel recentAudits={recentAudits} />}
        {activeTab === "history" && mayReadExecutionHistory && <ExecutionHistoryPanel />}
        {activeTab === "notifications" && mayManageNotificationSettings && (
          <NotificationSettingsPanel initialSettings={notificationSettings} mayManage={mayManageNotificationSettings} />
        )}
        {activeTab === "community-screening" && mayReadCommunityScreening && (
          <CommunityScreeningPanel mayOverrideThresholds={mayOverrideThresholds} />
        )}
        {activeTab === "rdps" && mayReadRdps && <RdpsPanel mayManageRdps={mayManageRdps} />}
      </div>
    </div>
  );
}

export type { FindingProps };
