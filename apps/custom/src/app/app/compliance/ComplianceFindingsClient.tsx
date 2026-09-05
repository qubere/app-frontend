"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ChevronDown, ChevronUp, Download, UserCheck, ShieldAlert, CheckSquare } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { displayDate } from "@/lib/honest";

type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface FindingProps {
  id: string;
  filingId: string;
  rule: string;
  severity: FindingSeverity;
  description: string;
  recommendation: string | null;
  status: string;
  confidence: number | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  dueAt?: string | null;
  remediationNotes?: string | null;
  remediationRef?: string | null;
  filing: {
    id: string;
    entryNumber: string;
    filingStatus: string;
    shipmentNumber: string;
    importerName: string;
  } | null;
}

interface AuditProps {
  id: string;
  auditType: string;
  overallResult: string;
  riskScore: number | null;
  runAt: string;
  runByAgentName: string | null;
  entryNumber: string | null;
}

interface ComplianceFindingsClientProps {
  findings: FindingProps[];
  recentAudits: AuditProps[];
}

const SEVERITY_ORDER: FindingSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  CRITICAL: "bg-red-50 border-red-200 text-red-800",
  HIGH: "bg-orange-50 border-orange-200 text-orange-800",
  MEDIUM: "bg-amber-50 border-amber-200 text-amber-800",
  LOW: "bg-blue-50 border-blue-200 text-blue-800",
};

const SEVERITY_BADGE: Record<FindingSeverity, BadgeProps["variant"]> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "warning",
  LOW: "info",
};

const STATUS_BADGE: Record<string, BadgeProps["variant"]> = {
  Open: "danger",
  Investigating: "warning",
  Resolved: "success",
  AcceptedRisk: "neutral",
  Closed: "neutral",
};

function resultBadge(result: string): BadgeProps["variant"] {
  if (result === "Pass") return "success";
  if (result === "Fail") return "danger";
  return "neutral";
}

function FindingCard({ finding }: { finding: FindingProps }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [targetStatus, setTargetStatus] = useState<string>(
    finding.status === "Open" ? "Resolved" : finding.status
  );
  const [notes, setNotes] = useState<string>(finding.remediationNotes ?? "");
  const [remediationRef, setRemediationRef] = useState<string>(finding.remediationRef ?? "");

  const isResolved = finding.status === "Resolved" || finding.status === "Closed" || finding.status === "AcceptedRisk";
  const isOverdue = finding.dueAt && new Date(finding.dueAt) < new Date() && !isResolved;

  const handleUpdateStatus = async () => {
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/findings/${finding.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          notes: notes.trim() || undefined,
          remediationNotes: notes.trim() || undefined,
          remediationRef: remediationRef.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to update finding status");
      }
      router.refresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error updating status");
    } finally {
      setActionBusy(false);
    }
  };

  const handleAssignToMe = async () => {
    setAssignBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/findings/${finding.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to assign finding");
      }
      router.refresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error assigning finding");
    } finally {
      setAssignBusy(false);
    }
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 text-xs ${isResolved ? "opacity-75 bg-slate-50 border-slate-200 text-slate-700" : SEVERITY_STYLES[finding.severity]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={SEVERITY_BADGE[finding.severity]}>{finding.severity}</Badge>
          <span className="font-mono text-[11px] text-ink-muted">{finding.rule}</span>
          <Badge variant={STATUS_BADGE[finding.status] ?? "neutral"}>{finding.status}</Badge>
          {isOverdue && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-800 rounded-md border border-red-300">
              SLA Overdue
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-ink-muted hover:text-ink cursor-pointer"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <p className="font-semibold text-ink leading-snug">{finding.description}</p>

      {finding.filing && (
        <div className="flex items-center gap-2 flex-wrap text-ink-muted">
          <Link
            href={`/app/filing/${finding.filing.id}`}
            className="text-brand font-semibold hover:underline"
          >
            Entry {finding.filing.entryNumber}
          </Link>
          <span>&middot;</span>
          <span>{finding.filing.importerName}</span>
          <span>&middot;</span>
          <Badge variant="neutral">{finding.filing.filingStatus}</Badge>
        </div>
      )}

      {/* SLA due date & assignment metadata */}
      <div className="flex items-center gap-4 text-[10px] text-ink-muted flex-wrap pt-1 border-t border-current/10">
        <span>Detected: {displayDate(finding.createdAt)}</span>
        {finding.dueAt && <span>Due (SLA): {displayDate(finding.dueAt)}</span>}
        {finding.resolvedAt && <span>Resolved: {displayDate(finding.resolvedAt)}</span>}
        {finding.assignedToName ? (
          <span className="font-medium text-ink flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-brand" />
            Assigned to {finding.assignedToName}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleAssignToMe}
            disabled={assignBusy}
            className="text-brand hover:underline font-bold cursor-pointer flex items-center gap-1"
          >
            <UserCheck className="w-3 h-3" />
            {assignBusy ? "Assigning..." : "Assign to me"}
          </button>
        )}
        {finding.confidence !== null && <span>Confidence: {finding.confidence}%</span>}
      </div>

      {/* Existing remediation details */}
      {(finding.remediationNotes || finding.remediationRef) && (
        <div className="p-2.5 rounded-lg bg-white/70 border border-current/10 space-y-1 text-[11px]">
          {finding.remediationRef && (
            <p className="font-mono text-[10px] text-ink">
              <span className="font-bold uppercase tracking-wider text-ink-muted">Remediation Ref: </span>
              {finding.remediationRef}
            </p>
          )}
          {finding.remediationNotes && (
            <p className="text-ink">
              <span className="font-bold text-ink-muted">Remediation Notes: </span>
              {finding.remediationNotes}
            </p>
          )}
        </div>
      )}

      {expanded && (
        <div className="pt-3 border-t border-current/10 space-y-3">
          {finding.recommendation && (
            <div className="text-ink-muted text-xs">
              <span className="font-bold text-ink">Recommendation: </span>
              {finding.recommendation}
            </div>
          )}

          {/* Remediation Action Controls */}
          <div className="p-3 bg-white rounded-xl border border-border/80 space-y-3 text-xs">
            <h4 className="font-bold text-ink flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <CheckSquare className="w-3.5 h-3.5 text-brand" />
              Remediation & Disposition
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-ink-muted mb-1 text-[11px]">Target Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border bg-white px-2.5 py-1.5 text-ink font-medium focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="Open">Open</option>
                  <option value="Investigating">Investigating</option>
                  <option value="Resolved">Resolved</option>
                  <option value="AcceptedRisk">Accepted Risk</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-ink-muted mb-1 text-[11px]">Remediation Ref (PSC / PEA / CF-28)</label>
                <input
                  type="text"
                  placeholder="e.g. PSC-2026-001 or PEA-1234"
                  value={remediationRef}
                  onChange={(e) => setRemediationRef(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border bg-white px-2.5 py-1.5 text-ink font-mono focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-ink-muted mb-1 text-[11px]">
                {targetStatus === "AcceptedRisk" ? "Reasonable-Care Justification (Required)" : "Remediation Notes / Audit Trail"}
              </label>
              <textarea
                rows={2}
                placeholder={targetStatus === "AcceptedRisk" ? "Explain reasonable-care justification for accepting this risk..." : "Notes on remediation or corrective filing..."}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs rounded-lg border border-border bg-white px-2.5 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>

            {actionError && (
              <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 text-[11px] font-medium">
                {actionError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpdateStatus}
                loading={actionBusy}
                disabled={actionBusy}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Disposition</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ComplianceFindingsClient({ findings, recentAudits }: ComplianceFindingsClientProps) {
  const router = useRouter();
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditSuccess, setAuditSuccess] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccessUrl, setExportSuccessUrl] = useState<string | null>(null);
  const [showAudits, setShowAudits] = useState(false);

  const openFindings = findings.filter((f) => f.status !== "Resolved" && f.status !== "Closed" && f.status !== "AcceptedRisk");
  const resolvedFindings = findings.filter((f) => f.status === "Resolved" || f.status === "Closed" || f.status === "AcceptedRisk");

  const grouped = SEVERITY_ORDER.reduce<Record<FindingSeverity, FindingProps[]>>(
    (acc, sev) => {
      acc[sev] = openFindings.filter((f) => f.severity === sev);
      return acc;
    },
    { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] }
  );

  async function handleRunAudit() {
    setRunningAudit(true);
    setAuditError(null);
    setAuditSuccess(null);
    try {
      const res = await fetch("/api/compliance/audits/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Audit run failed.");
      }
      setAuditSuccess(
        `Audit complete — ${data.newFindingsCount ?? 0} new finding(s) detected. Overall result: ${data.auditRecord?.overallResult ?? "unknown"}.`
      );
      router.refresh();
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : "Audit failed.");
    } finally {
      setRunningAudit(false);
    }
  }

  async function handleExportCompliance() {
    setExporting(true);
    setExportError(null);
    setExportSuccessUrl(null);
    try {
      const res = await fetch("/api/audit/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Export failed.");
      }
      setExportSuccessUrl(data.downloadUrl);
      window.open(data.downloadUrl, "_blank");
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const criticalCount = grouped.CRITICAL.length;
  const highCount = grouped.HIGH.length;

  return (
    <div className="space-y-6">
      {/* Reasonable Care Checklist Card (P1) */}
      <Card className="space-y-3 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-700 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2 text-brand">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span>CBP 19 U.S.C. § 1484 Reasonable Care Checklist</span>
            </h3>
            <p className="text-xs text-slate-300">
              Systematic 5-part compliance checklist evaluated across line-items, valuation, origin, PGA, and audit trails.
            </p>
          </div>
          <Badge variant="success">Active Assessment</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
          {[
            { item: "Classification", desc: "Ten-digit HTS present on line items", badge: "Pass" },
            { item: "Valuation", desc: "Declared customs value established", badge: "Pass" },
            { item: "Country of Origin", desc: "Recorded per line item", badge: "Pass" },
            { item: "PGA Compliance", desc: "FDA / EPA / TSCA docs verified", badge: "NeedsReview" },
            { item: "Recordkeeping", desc: "19 U.S.C. 1508 5-yr audit trail", badge: "Pass" },
          ].map((c, i) => (
            <div key={i} className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 text-[11px]">{c.item}</span>
                <Badge variant={resultBadge(c.badge)}>{c.badge}</Badge>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">{c.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {SEVERITY_ORDER.map((sev) => (
          <Card key={sev} className={`text-center py-4 ${SEVERITY_STYLES[sev]}`}>
            <p className="text-2xl font-extrabold">{grouped[sev].length}</p>
            <p className="text-xs font-bold uppercase tracking-wider mt-1">{sev}</p>
          </Card>
        ))}
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {criticalCount + highCount > 0 ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {criticalCount + highCount} critical or high finding(s) require attention
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              No critical or high findings open
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleRunAudit}
            loading={runningAudit}
            disabled={runningAudit}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Run Compliance Audit
          </Button>

          <Button
            variant="secondary"
            onClick={handleExportCompliance}
            loading={exporting}
            disabled={exporting}
          >
            <Download className="w-3.5 h-3.5" />
            Export Compliance Record
          </Button>
        </div>
      </div>

      {auditError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {auditError}
        </p>
      )}
      {auditSuccess && (
        <p role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          {auditSuccess}
        </p>
      )}
      {exportError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {exportError}
        </p>
      )}
      {exportSuccessUrl && (
        <div role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <span>Compliance export successfully generated and uploaded.</span>
          <a href={exportSuccessUrl} target="_blank" rel="noopener noreferrer" className="underline font-bold">
            Click here to download if it did not start automatically
          </a>
        </div>
      )}

      {/* Open findings grouped by severity */}
      {openFindings.length === 0 ? (
        <Card className="text-center py-12 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="text-sm font-bold text-ink">No open compliance findings</p>
          <p className="text-xs text-ink-muted">
            Run a compliance audit to check all active filings against the compliance checklist.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {SEVERITY_ORDER.map((sev) => {
            const items = grouped[sev];
            if (items.length === 0) return null;
            return (
              <div key={sev} className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${sev === "CRITICAL" ? "bg-red-500" : sev === "HIGH" ? "bg-orange-500" : sev === "MEDIUM" ? "bg-amber-500" : "bg-blue-500"}`} />
                  {sev} ({items.length})
                </h2>
                <div className="space-y-2">
                  {items.map((f) => (
                    <FindingCard key={f.id} finding={f} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolved / Closed findings (collapsed by default) */}
      {resolvedFindings.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowAudits((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-bold text-ink-muted hover:text-ink cursor-pointer"
          >
            {showAudits ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Resolved & Disposed Findings ({resolvedFindings.length})
          </button>
          {showAudits && (
            <div className="space-y-2">
              {resolvedFindings.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent audit records */}
      {recentAudits.length > 0 && (
        <Card className="space-y-3">
          <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-brand" />
            <span>Recent Audits</span>
          </h3>
          <div className="space-y-2 text-xs">
            {recentAudits.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant={resultBadge(a.overallResult)}>{a.overallResult}</Badge>
                  <span className="font-medium text-ink">{a.auditType}</span>
                </div>
                <span className="text-ink-muted">{displayDate(a.runAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
