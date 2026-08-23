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
  category: "FIELD_APPROVAL" | "DOCUMENT_INGESTION" | "AGENT_EXECUTION" | "SHIPMENT_MUTATION" | "EXCEPTION_RESOLVED" | "SYSTEM_AUDIT" | "FILING_SUBMISSION";
  title: string;
  description: string;
  source: "UI" | "CHAT" | "SYSTEM" | "API";
  user: {
    name: string | null;
    email?: string | null;
  };
  timestamp: string;
  beforeValue?: string | null;
  afterValue?: string | null;
  metadata?: Record<string, unknown> | null;
}

const SOURCE_BADGES: Record<ShipmentAuditEntry["source"], { label: string; badge: string }> = {
  UI: { label: "User Action", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  CHAT: { label: "Copilot AI", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  SYSTEM: { label: "System Auto", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  API: { label: "External API", badge: "bg-amber-50 text-amber-700 border-amber-200" },
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
    <div className="apple-card rounded-3xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-6 hover:bg-surface-muted transition-colors text-left group cursor-pointer"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <History className="w-5 h-5 text-brand shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ink group-hover:text-brand transition-colors">
              Shipment Audit Log & Event Table
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Append-only audit table tracking every action, field edit, document upload, and filing submission on this shipment.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0 ml-3">
          <span className="px-3 py-1 bg-brand/10 text-brand text-xs font-bold rounded-full font-mono">
            {entries.length} Event{entries.length !== 1 ? "s" : ""} Logged
          </span>
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold text-ink-muted bg-slate-100 group-hover:bg-slate-200 transition-colors">
            <span>{isCollapsed ? "Expand" : "Collapse"}</span>
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </span>
        </div>
      </button>

      {/* Expanded Content */}
      {!isCollapsed && (
        <div className="px-6 pb-6 pt-2 space-y-4 border-t border-border bg-[#FAFAFC]">
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-ink-muted font-bold flex items-center space-x-1 mr-1">
                <Filter className="w-3.5 h-3.5 text-ink-muted" />
                <span>Category:</span>
              </span>
              <button
                type="button"
                onClick={() => setFilter("ALL")}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filter === "ALL" ? "bg-brand text-white" : "bg-white text-ink-muted hover:text-ink border border-border"
                }`}
              >
                All Categories ({entries.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("FIELD_APPROVAL")}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filter === "FIELD_APPROVAL" ? "bg-brand text-white" : "bg-white text-ink-muted hover:text-ink border border-border"
                }`}
              >
                Field Edits & Approvals ({entries.filter((e) => e.category === "FIELD_APPROVAL").length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("DOCUMENT_INGESTION")}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filter === "DOCUMENT_INGESTION" ? "bg-brand text-white" : "bg-white text-ink-muted hover:text-ink border border-border"
                }`}
              >
                Document Uploads ({entries.filter((e) => e.category === "DOCUMENT_INGESTION").length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("FILING_SUBMISSION")}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filter === "FILING_SUBMISSION" ? "bg-brand text-white" : "bg-white text-ink-muted hover:text-ink border border-border"
                }`}
              >
                Filing Submissions ({entries.filter((e) => e.category === "FILING_SUBMISSION").length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1 sm:pt-0 border-t sm:border-t-0 border-border">
              <span className="text-ink-muted font-bold mr-1">Origin:</span>
              <button
                type="button"
                onClick={() => setSourceFilter("ALL")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                  sourceFilter === "ALL" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("UI")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                  sourceFilter === "UI" ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                }`}
              >
                User
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("CHAT")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                  sourceFilter === "CHAT" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                }`}
              >
                Copilot
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("API")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                  sourceFilter === "API" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                API
              </button>
            </div>
          </div>

      {/* Audit Log Table */}
      {filteredEntries.length === 0 ? (
        <div className="py-12 text-center text-xs text-ink-muted bg-slate-50 rounded-2xl border border-border">
          No audit events match the selected filter criteria.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-2xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] font-extrabold text-ink-muted uppercase tracking-wider">
                <th className="py-3 px-4 w-[240px]">Action & Source</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 w-[180px]">User / System</th>
                <th className="py-3 px-4 w-[190px]">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEntries.map((entry) => {
                const isExpanded = expandedEntryId === entry.id;
                const sourceInfo = SOURCE_BADGES[entry.source] || SOURCE_BADGES.UI;

                return (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Column 1: Action */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          {getCategoryIcon(entry.category)}
                          <span className="font-bold text-ink text-xs">{entry.title}</span>
                        </div>
                        {entry.source !== "UI" && (
                          <div>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${sourceInfo.badge}`}>
                              {sourceInfo.label}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Column 2: Details */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="space-y-1.5">
                        <p className="text-slate-700 leading-snug">{entry.description}</p>

                        {/* Expandable diff / JSON details toggle */}
                        {(entry.beforeValue || entry.afterValue || entry.metadata) && (
                          <div>
                            <button
                              type="button"
                              onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                              className="text-[11px] font-bold text-brand hover:underline inline-flex items-center space-x-1 cursor-pointer"
                            >
                              <span>{isExpanded ? "Hide payload" : "View change details"}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {isExpanded && (
                              <div className="mt-2 p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] space-y-2 border border-slate-800">
                                {entry.beforeValue && (
                                  <div>
                                    <span className="text-rose-400 font-bold uppercase text-[9px] block font-sans">Previous Value</span>
                                    <span className="text-rose-300">{entry.beforeValue}</span>
                                  </div>
                                )}
                                {entry.afterValue && (
                                  <div>
                                    <span className="text-emerald-400 font-bold uppercase text-[9px] block font-sans">Updated Value</span>
                                    <span className="text-emerald-300">{entry.afterValue}</span>
                                  </div>
                                )}
                                {entry.metadata && (
                                  <div>
                                    <span className="text-slate-400 font-bold uppercase text-[9px] block font-sans mb-1">Metadata</span>
                                    <pre className="text-[10px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                                      {JSON.stringify(entry.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Column 3: User */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-center space-x-1.5 font-semibold text-ink text-xs pt-0.5">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[160px]" title={entry.user.name || "User"}>
                          {entry.user.name || "User"}
                        </span>
                      </div>
                    </td>

                    {/* Column 4: Timestamp */}
                    <td className="py-3.5 px-4 align-top text-ink-muted font-mono text-xs whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatTimestamp(entry.timestamp)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )}
</div>
  );
}
