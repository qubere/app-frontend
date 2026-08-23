/**
 * UI Configuration Dashboard
 *
 * Dedicated dashboard for the FilingUIConfig table — purpose-built with:
 *   - Invitational empty state explaining the default renderer fallback
 *   - Stat line: "X configured · Y using default rendering"
 *   - Filters: Country, Message Type, Status (Active/Draft/All)
 *   - Status chips per row (Active / Draft / Inactive)
 *   - Inline Active toggle (off = instant, tooltip explains default renderer)
 *   - Separate Delete action requiring confirmation (destructive)
 *   - Duplicate row action (clones config as new draft)
 *   - Version history in a row-level drawer (not separate rows)
 *   - "Configure Fields Visually" CTA
 */

"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Settings2, Plus, Pencil, Trash2, Search, Copy, History,
  ChevronLeft, ChevronRight, X, AlertCircle, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/Modal";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UIConfigRow {
  id: string;
  country: string;
  procedureCode: string;
  messageName: string;
  messageType: string;
  release?: string | null;
  version: number;
  description?: string;
  totalFields: number;
  totalTabs: number;
  totalSections: number;
  layoutMode: string;
  configVersion: string;
  isActive: boolean;
  isDraft: boolean;
  status: "active" | "draft" | "inactive";
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

interface UIConfigDashboardProps {
  onEdit: (configId: string | null) => void;
}

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Status chip
// ─────────────────────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: UIConfigRow["status"] }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 border border-green-200">
        ● Active
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700 border border-orange-200">
        ✎ Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600 border border-gray-200">
      — Inactive
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline Active toggle
// ─────────────────────────────────────────────────────────────────────────────

function ActiveToggle({
  row,
  onToggle,
}: {
  row: UIConfigRow;
  onToggle: (id: string, active: boolean) => void;
}) {
  const isActive = row.isActive;
  return (
    <div className="flex items-center gap-1.5 group relative">
      <button
        type="button"
        onClick={() => onToggle(row.id, !isActive)}
        aria-pressed={isActive}
        title={
          isActive
            ? "Toggle off — this combination will use the default renderer"
            : "Toggle on — this configuration becomes live"
        }
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 ${
          isActive ? "bg-green-500" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            isActive ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-20 w-52 text-[10px] bg-gray-900 text-white rounded-lg px-2.5 py-2 shadow-lg pointer-events-none">
        {isActive
          ? "Off = this combination uses the default rendering"
          : "Turn on to make this configuration live"}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Version History Drawer
// ─────────────────────────────────────────────────────────────────────────────

function VersionHistoryModal({
  combo,
  allRows,
  onClose,
  onEdit,
}: {
  combo: { country: string; procedureCode: string; messageName: string; messageType: string };
  allRows: UIConfigRow[];
  onClose: () => void;
  onEdit: (id: string) => void;
}) {
  const versions = allRows
    .filter(
      (r) =>
        r.country === combo.country &&
        r.procedureCode === combo.procedureCode &&
        r.messageName === combo.messageName &&
        r.messageType === combo.messageType
    )
    .sort((a, b) => b.version - a.version);

  return (
    <Modal isOpen onClose={onClose} titleId="version-history">
      <ModalHeader titleId="version-history">
        <div>
          <h2 className="text-sm font-bold text-ink">Version History</h2>
          <p className="text-xs text-ink-muted mt-0.5 font-mono">
            {combo.country} / {combo.procedureCode} / {combo.messageName} / {combo.messageType}
          </p>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-2">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-white hover:bg-surface-muted"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-ink">v{v.version}</span>
                <StatusChip status={v.status} />
                <div className="text-[10px] text-ink-muted">
                  {v.totalFields} fields · {new Date(v.updatedAt).toLocaleDateString()}
                  {v.updatedBy && <span className="ml-1">by {v.updatedBy}</span>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { onEdit(v.id); onClose(); }}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </ModalFooter>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mb-5">
        <Settings2 className="w-8 h-8 text-blue-400" />
      </div>
      <h3 className="text-base font-bold text-ink mb-2">No custom UI configurations yet</h3>
      <p className="text-sm text-ink-muted max-w-md mb-2">
        All Country + Procedure + Message combinations currently use the{" "}
        <strong>default renderer</strong> — forms are generated automatically from the JSON Schema.
      </p>
      <p className="text-sm text-ink-muted max-w-md">
        Use the <strong>+ Configure Fields Visually</strong> button above to create a custom configuration
        and override the layout, add conditional logic, set translations, and control field behaviour
        for any combination.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────────────────────

export default function UIConfigDashboard({ onEdit }: UIConfigDashboardProps) {
  const [allRows, setAllRows] = useState<UIConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterMessageType, setFilterMessageType] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "draft" | "inactive">("all");
  const [page, setPage] = useState(1);

  // Modals
  const [confirmDelete, setConfirmDelete] = useState<UIConfigRow | null>(null);
  const [versionHistory, setVersionHistory] = useState<UIConfigRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/filing-config/ui-configuration");
      if (!res.ok) throw new Error("Failed to load UI configurations");
      const data = await res.json();
      setAllRows(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  // Unique countries and message types for filter dropdowns
  const countries = Array.from(new Set(allRows.map((r) => r.country))).sort();
  const messageTypes = Array.from(new Set(allRows.map((r) => r.messageType))).sort();

  // Latest row per combo (active > draft > inactive)
  const statusPriority = (s: string) => (s === "active" ? 0 : s === "draft" ? 1 : 2);
  const latestByCombo = React.useMemo(() => {
    const map = new Map<string, UIConfigRow>();
    for (const row of allRows) {
      const key = `${row.country}|${row.procedureCode}|${row.messageName}|${row.messageType}`;
      const existing = map.get(key);
      if (!existing || statusPriority(row.status) < statusPriority(existing.status)) {
        map.set(key, row);
      }
    }
    return Array.from(map.values());
  }, [allRows]);

  // How many combos have a config vs. using default
  const configuredCount = latestByCombo.filter((r) => r.isActive).length;

  // Apply filters
  const filtered = latestByCombo.filter((row) => {
    const q = search.trim().toLowerCase();
    if (q && !`${row.country} ${row.procedureCode} ${row.messageName} ${row.messageType} ${row.description ?? ""}`.toLowerCase().includes(q)) return false;
    if (filterCountry && row.country !== filterCountry) return false;
    if (filterMessageType && row.messageType !== filterMessageType) return false;
    if (filterStatus !== "all" && row.status !== filterStatus) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleToggleActive = async (id: string, active: boolean) => {
    // Optimistic update
    setAllRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: active, status: active ? "active" : "inactive" } : r))
    );
    try {
      const response = await fetch(`/api/filing-config/ui-configuration/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: active }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Unable to update configuration status");
      }
    } catch {
      // Revert on error
      load();
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/filing-config/ui-configuration/${confirmDelete.id}?confirmed=true`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicate = async (row: UIConfigRow) => {
    try {
      const res = await fetch(
        `/api/filing-config/ui-configuration/${row.id}/duplicate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Duplicate failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const comboHasVersionHistory = (row: UIConfigRow) => {
    return allRows.filter(
      (r) =>
        r.country === row.country &&
        r.procedureCode === row.procedureCode &&
        r.messageName === row.messageName &&
        r.messageType === row.messageType
    ).length > 1;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Stat line */}
      {!loading && allRows.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-ink-muted px-1">
          <span className="font-semibold text-ink">{configuredCount} configured</span>
          <span>·</span>
          <span className="text-ink-muted">
            remaining combinations use the <strong>default rendering</strong>
          </span>
          {latestByCombo.filter((r) => r.status === "draft").length > 0 && (
            <>
              <span>·</span>
              <span className="text-orange-600 font-semibold">
                {latestByCombo.filter((r) => r.status === "draft").length} unpublished draft{latestByCombo.filter((r) => r.status === "draft").length !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Search + Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by country, message, description…"
              className="pl-9 w-64 text-xs"
            />
          </div>

          <select
            value={filterCountry}
            onChange={(e) => { setFilterCountry(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-md px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">All Countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filterMessageType}
            onChange={(e) => { setFilterMessageType(e.target.value); setPage(1); }}
            className="text-xs border border-border rounded-md px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">All Types</option>
            {messageTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as any); setPage(1); }}
            className="text-xs border border-border rounded-md px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
          </select>

          {(filterCountry || filterMessageType || filterStatus !== "all" || search) && (
            <button
              onClick={() => { setFilterCountry(""); setFilterMessageType(""); setFilterStatus("all"); setSearch(""); setPage(1); }}
              className="text-[10px] text-brand underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <Button onClick={() => onEdit(null)} variant="primary" size="sm">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Configure Fields Visually
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-sm text-ink-muted">Loading configurations…</div>
      ) : allRows.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-ink-muted">
          No configurations match your filters.{" "}
          <button className="text-brand underline" onClick={() => { setFilterCountry(""); setFilterMessageType(""); setFilterStatus("all"); setSearch(""); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-border text-ink-muted">
                <th className="py-2.5 px-3 font-bold">Country</th>
                <th className="py-2.5 px-3 font-bold">Procedure</th>
                <th className="py-2.5 px-3 font-bold">Message</th>
                <th className="py-2.5 px-3 font-bold">Type</th>
                <th className="py-2.5 px-3 font-bold">Release</th>
                <th className="py-2.5 px-3 font-bold">Fields</th>
                <th className="py-2.5 px-3 font-bold">Status</th>
                <th className="py-2.5 px-3 font-bold">Active</th>
                <th className="py-2.5 px-3 font-bold">Updated</th>
                <th className="py-2.5 px-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-muted/50 group">
                  <td className="py-2.5 px-3 font-mono font-semibold text-ink">{row.country}</td>
                  <td className="py-2.5 px-3 font-mono text-ink">{row.procedureCode}</td>
                  <td className="py-2.5 px-3 font-mono text-ink">{row.messageName}</td>
                  <td className="py-2.5 px-3 text-ink-muted">{row.messageType}</td>
                  <td className="py-2.5 px-3">
                    {row.release ? (
                      <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-mono font-semibold">
                        {row.release}
                      </span>
                    ) : (
                      <span className="text-[10px] text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-ink-muted">
                    {row.totalFields}
                    {row.totalSections > 0 && (
                      <span className="text-[10px] text-ink-muted ml-1">({row.totalSections} sec)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusChip status={row.status} />
                  </td>
                  <td className="py-2.5 px-3">
                    <ActiveToggle row={row} onToggle={handleToggleActive} />
                  </td>
                  <td className="py-2.5 px-3 text-ink-muted">
                    {new Date(row.updatedAt).toLocaleDateString()}
                    {row.updatedBy && <div className="text-[10px]">{row.updatedBy}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {/* Edit */}
                      <button
                        onClick={() => onEdit(row.id)}
                        title="Edit in visual designer"
                        className="p-1.5 rounded-lg border border-transparent hover:border-border hover:bg-white text-ink transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* Duplicate */}
                      <button
                        onClick={() => handleDuplicate(row)}
                        title="Duplicate as new draft"
                        className="p-1.5 rounded-lg border border-transparent hover:border-border hover:bg-white text-ink-muted transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {/* Version History (only if multiple versions exist) */}
                      {comboHasVersionHistory(row) && (
                        <button
                          onClick={() => setVersionHistory(row)}
                          title="Version history"
                          className="p-1.5 rounded-lg border border-transparent hover:border-border hover:bg-white text-ink-muted transition-colors"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Delete — separate and destructive */}
                      <button
                        onClick={() => setConfirmDelete(row)}
                        title="Delete configuration permanently"
                        className="p-1.5 rounded-lg border border-transparent hover:border-red-200 hover:bg-red-50 text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-ink-muted px-1">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-surface-muted"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-surface-muted"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <Modal isOpen onClose={() => setConfirmDelete(null)} titleId="confirm-delete">
          <ModalHeader titleId="confirm-delete">
            <div>
              <h2 className="text-sm font-bold text-red-700">Delete Configuration?</h2>
              <p className="text-xs text-ink-muted mt-0.5">This action is permanent and cannot be undone.</p>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-3 text-sm text-ink">
              <p>
                You are about to permanently delete the configuration for:
              </p>
              <div className="font-mono bg-gray-50 border border-border rounded-lg px-4 py-3 text-xs">
                {confirmDelete.country} / {confirmDelete.procedureCode} / {confirmDelete.messageName} / {confirmDelete.messageType}
              </div>
              <p className="text-ink-muted">
                After deletion, this combination will fall back to the <strong>default renderer</strong>.
                All custom layout, field configuration, and translations will be lost.
              </p>
              {confirmDelete.isActive && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800 font-semibold">
                    This configuration is currently <strong>Active</strong> — deleting it will immediately revert to default rendering for all users.
                  </p>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {isDeleting ? "Deleting…" : "Delete Permanently"}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Version History modal */}
      {versionHistory && (
        <VersionHistoryModal
          combo={versionHistory}
          allRows={allRows}
          onClose={() => setVersionHistory(null)}
          onEdit={onEdit}
        />
      )}
    </div>
  );
}
