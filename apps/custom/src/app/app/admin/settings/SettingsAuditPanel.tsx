"use client";

import React, { useState, useMemo } from "react";
import { Settings, ShieldCheck, History, Key, CheckCircle2, ChevronLeft, ChevronRight, Search, ChevronDown, Code2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { PanelHeading } from "@/components/PanelHeading";
import { Badge } from "@/components/ui/Badge";
import type { FormattedAuditLog } from "@/lib/admin/auditData";

interface SettingsAuditPanelProps {
  accountName: string;
  auditLogs: FormattedAuditLog[];
  compact?: boolean;
}

export function SettingsAuditPanel({ accountName, auditLogs, compact }: SettingsAuditPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Filter logs by search term across User, Action, Entity, and Metadata JSON
  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return auditLogs;
    const term = searchTerm.toLowerCase();
    return auditLogs.filter((log) => {
      const userText = (log.userEmail || log.formattedActorText || "").toLowerCase();
      const actionText = (log.action || "").toLowerCase();
      const entityText = (log.entity || "").toLowerCase();
      const metaText = log.metadata ? JSON.stringify(log.metadata).toLowerCase() : "";
      return (
        userText.includes(term) ||
        actionText.includes(term) ||
        entityText.includes(term) ||
        metaText.includes(term)
      );
    });
  }, [auditLogs, searchTerm]);

  const total = filteredLogs.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pages);

  const pagedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const firstRow = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRow = Math.min(total, currentPage * pageSize);

  const toggleExpand = (logId: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [logId]: !prev[logId] }));
  };

  return (
    <div className={compact ? "space-y-5" : "space-y-8 max-w-6xl mx-auto"}>
      <PanelHeading
        icon={Settings}
        badge="Security & Governance"
        title="Account Audit Logs & Settings"
        subtitle={`Security settings and administrative audit history for ${accountName}.`}
        compact={compact}
      />

      {!compact && (
        <div className="apple-card p-6 rounded-3xl border border-border bg-white shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-ink flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-brand" />
            <span>Active Security Configuration</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-surface-muted border border-border rounded-2xl space-y-1">
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Authentication Provider</span>
              <p className="text-sm font-bold text-ink flex items-center space-x-2">
                <Key className="w-4 h-4 text-emerald-600" />
                <span>Clerk Identity Verification</span>
              </p>
            </div>

            <div className="p-4 bg-surface-muted border border-border rounded-2xl space-y-1">
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Multi-Tenant Account Scope</span>
              <p className="text-sm font-bold text-ink flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-brand" />
                <span>PostgreSQL Account Isolation (`accountId`)</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Card */}
      <div className="apple-card rounded-3xl border border-border bg-white shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-ink">Administrative Audit Log Trail</h2>
            <Badge variant="neutral" className="font-mono text-xs normal-case ml-2">
              {total} Events
            </Badge>
          </div>

          {/* Search Input Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search user, action, JSON details..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-muted border border-border rounded-xl text-ink focus:outline-none focus:border-brand"
            />
          </div>
        </div>

        {total === 0 ? (
          <div className="p-8 text-center text-ink-muted text-sm">
            {searchTerm.trim() ? "No audit events match your search term." : "No administrative actions recorded yet for this account."}
          </div>
        ) : (
          <>
            {/* Audit Logs Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-muted/60 border-b border-border text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    <th className="py-2.5 px-3 w-8"></th>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">JSON Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedLogs.map((log) => {
                    const isExpanded = Boolean(expandedLogIds[log.id]);
                    const jsonSummaryString = log.metadata != null
                      ? JSON.stringify(log.metadata)
                      : JSON.stringify({ entity: log.entity, entityId: log.entityId });

                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          onClick={() => toggleExpand(log.id)}
                          className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                            isExpanded ? "bg-blue-50/40" : ""
                          }`}
                        >
                          <td className="py-3 px-3 text-ink-muted">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-brand" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-ink-muted" />
                            )}
                          </td>
                          <td className="py-3 px-3 font-semibold text-ink whitespace-nowrap">
                            {log.userEmail || log.formattedActorText || "System/Admin"}
                          </td>
                          <td className="py-3 px-3 text-ink-muted whitespace-nowrap">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-brand border border-blue-100 font-mono">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-3 max-w-xs md:max-w-md lg:max-w-lg">
                            <div className="font-mono text-[11px] text-ink-muted truncate" title={jsonSummaryString}>
                              {jsonSummaryString}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Details Sub-Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-t-0">
                            <td></td>
                            <td colSpan={4} className="py-3 px-3 pb-4">
                              <div className="p-3.5 rounded-2xl bg-white border border-border space-y-2.5 shadow-2xs">
                                <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                                  <div className="flex items-center space-x-2">
                                    <Code2 className="w-4 h-4 text-brand" />
                                    <span className="font-bold text-ink">Event Details & JSON Metadata</span>
                                  </div>
                                  <div className="text-[11px] text-ink-muted font-mono">
                                    Entity: <span className="font-bold text-ink">{log.entity}</span> (id: {log.entityId})
                                  </div>
                                </div>

                                {log.formattedActorText && (
                                  <div className="text-xs text-ink-muted">
                                    Actor Context: <span className="font-semibold text-ink">{log.formattedActorText}</span>
                                  </div>
                                )}

                                <pre className="text-[11px] font-mono text-ink bg-surface-muted p-3 rounded-xl border border-border overflow-x-auto max-h-60">
                                  {JSON.stringify(log.metadata || { entity: log.entity, entityId: log.entityId }, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Audit Logs Pagination Controls */}
            <div className="p-4 border-t border-border bg-surface-muted/30 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <p className="text-xs text-ink-muted">
                  Showing {firstRow}–{lastRow} of {total} events
                </p>
                <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span>Rows</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    aria-label="Rows per page"
                    className="rounded-lg border border-border bg-white px-2 py-1 text-xs font-semibold text-ink focus:outline-none focus:border-brand cursor-pointer"
                  >
                    {[10, 25, 50, 100].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">
                  Page {currentPage} of {pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-white text-xs font-semibold text-ink hover:bg-surface-muted disabled:bg-surface-muted disabled:text-ink-muted disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= pages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-white text-xs font-semibold text-ink hover:bg-surface-muted disabled:bg-surface-muted disabled:text-ink-muted disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
