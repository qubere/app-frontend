"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  FileText,
  Filter,
  Edit3,
  ShieldCheck,
  User as UserIcon,
  Clock,
  ChevronDown,
  ChevronUp,
  Send,
  History,
} from "lucide-react";

export interface ShipmentAuditEntry {
  id: string;
  action: string;
  category: string;
  title: string;
  description: string;
  source: string;
  user: {
    name: string | null;
    email?: string | null;
  };
  timestamp: string;
  beforeValue?: string | null;
  afterValue?: string | null;
  metadata?: Record<string, unknown> | null;
}

const SOURCE_BADGES: Record<string, { label: string; badge: string }> = {
  UI: { label: "User Action", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  CHAT: { label: "Copilot AI", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  SYSTEM: { label: "System Auto", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  API: { label: "External API", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  AGENT: { label: "Agent Run", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  EMAIL: { label: "Email Ingestion", badge: "bg-teal-50 text-teal-700 border-teal-200" },
};

function getCategoryIcon(category: ShipmentAuditEntry["category"]) {
  switch (category) {
    case "FIELD_APPROVAL":
      return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
    case "DOCUMENT_INGESTION":
      return <FileText className="w-4 h-4 text-blue-600 shrink-0" />;
    case "SHIPMENT_MUTATION":
      return <Edit3 className="w-4 h-4 text-purple-600 shrink-0" />;
    case "EXCEPTION_RESOLVED":
      return <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />;
    case "FILING_SUBMISSION":
      return <Send className="w-4 h-4 text-brand shrink-0" />;
    default:
      return <Activity className="w-4 h-4 text-indigo-600 shrink-0" />;
  }
}

function formatTimestamp(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ShipmentAuditTrail({ entries }: { entries: ShipmentAuditEntry[] }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const filteredEntries = entries.filter((e) => {
    if (sourceFilter !== "ALL" && e.source !== sourceFilter) return false;
    if (filter === "ALL") return true;
    if (filter === "FIELD_APPROVAL") return e.category === "FIELD_APPROVAL";
    if (filter === "DOCUMENT_INGESTION") return e.category === "DOCUMENT_INGESTION";
    if (filter === "FILING_SUBMISSION") return e.category === "FILING_SUBMISSION";
    if (filter === "SHIPMENT_MUTATION") return e.category === "SHIPMENT_MUTATION";
    return true;
  });

  return (
    <div className="rounded-3xl border border-border bg-white shadow-2xs overflow-hidden">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-6 hover:bg-surface-muted transition-colors text-left group cursor-pointer"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <History className="w-5 h-5 text-brand shrink-0" />
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-ink flex items-center space-x-2">
              <span>System & Operator Audit Log</span>
              <span className="text-xs font-semibold text-ink-muted bg-surface-muted px-2.5 py-0.5 rounded-full border border-border">
                {entries.length} total events
              </span>
            </h3>
            <p className="text-xs text-ink-muted mt-0.5 truncate">
              Every data mutation, AI agent run, document upload, and user edit recorded for this shipment.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-xs font-bold text-brand group-hover:underline">
            {isCollapsed ? "Expand Audit Log" : "Collapse"}
          </span>
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-ink-muted group-hover:text-brand" />
          ) : (
            <ChevronUp className="w-5 h-5 text-ink-muted group-hover:text-brand" />
          )}
        </div>
      </button>

      {/* Expanded Log Content */}
      {!isCollapsed && (
        <div className="border-t border-border p-6 space-y-4 bg-surface-muted/30">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border text-xs">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-ink-muted" />
              <span className="font-bold text-ink">Filter Category:</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-white border border-border rounded-xl px-3 py-1.5 font-medium text-xs focus:ring-1 focus:ring-brand focus:outline-none"
              >
                <option value="ALL">All Categories ({entries.length})</option>
                <option value="DOCUMENT_INGESTION">Document Ingestion</option>
                <option value="SHIPMENT_MUTATION">Shipment Mutations</option>
                <option value="FIELD_APPROVAL">Field Approvals</option>
                <option value="FILING_SUBMISSION">Filings / Submissions</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="font-bold text-ink">Source:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-white border border-border rounded-xl px-3 py-1.5 font-medium text-xs focus:ring-1 focus:ring-brand focus:outline-none"
              >
                <option value="ALL">All Sources</option>
                <option value="UI">User (UI)</option>
                <option value="CHAT">Copilot AI</option>
                <option value="SYSTEM">System Auto</option>
                <option value="API">API Integration</option>
              </select>
            </div>
          </div>

          {/* Event Entries List */}
          {filteredEntries.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted">
              No audit entries match the selected filters.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredEntries.map((entry) => {
                const sourceInfo = SOURCE_BADGES[entry.source] || SOURCE_BADGES.SYSTEM;
                const isDetailExpanded = expandedEntryId === entry.id;
                const hasDetails = Boolean(entry.beforeValue || entry.afterValue || entry.metadata);

                return (
                  <div
                    key={entry.id}
                    className="p-3.5 bg-white rounded-2xl border border-border shadow-2xs hover:border-brand/40 transition-all space-y-2"
                  >
                    <div
                      className="flex items-start justify-between gap-3 cursor-pointer"
                      onClick={() => hasDetails && setExpandedEntryId(isDetailExpanded ? null : entry.id)}
                    >
                      <div className="flex items-start space-x-3 min-w-0">
                        <div className="p-2 rounded-xl bg-surface-muted border border-border mt-0.5">
                          {getCategoryIcon(entry.category)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="text-xs font-extrabold text-ink">{entry.title}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${sourceInfo.badge}`}
                            >
                              {sourceInfo.label}
                            </span>
                          </div>

                          <p className="text-xs text-ink-muted font-medium mt-0.5">{entry.description}</p>

                          <div className="flex items-center space-x-3 text-[10px] text-ink-muted font-medium mt-1">
                            <span className="flex items-center space-x-1">
                              <UserIcon className="w-3 h-3" />
                              <span>{entry.user.name || entry.user.email || "System"}</span>
                            </span>
                            <span>&middot;</span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatTimestamp(entry.timestamp)}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {hasDetails && (
                        <button
                          type="button"
                          className="text-ink-muted hover:text-brand p-1 shrink-0"
                          title="Toggle detailed metadata"
                        >
                          {isDetailExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>

                    {/* Metadata & Diff Details */}
                    {isDetailExpanded && hasDetails && (
                      <div className="pt-2 border-t border-border/60 text-xs space-y-2 mt-2">
                        {(entry.beforeValue || entry.afterValue) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                            {entry.beforeValue && (
                              <div className="p-2 bg-red-50 text-red-800 rounded-xl border border-red-200">
                                <span className="font-bold text-[10px] uppercase block text-red-600 mb-0.5">Before</span>
                                {entry.beforeValue}
                              </div>
                            )}
                            {entry.afterValue && (
                              <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
                                <span className="font-bold text-[10px] uppercase block text-emerald-600 mb-0.5">After</span>
                                {entry.afterValue}
                              </div>
                            )}
                          </div>
                        )}

                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-ink-muted uppercase block mb-1">
                              Event Context Metadata
                            </span>
                            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[10px] font-mono overflow-x-auto max-h-40">
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
