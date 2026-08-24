"use client";

import { useState } from "react";
import { Mail, Copy, Check, Trash2, Plus, CheckSquare, Building2 } from "lucide-react";
import { PanelHeading } from "@/components/PanelHeading";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export interface TeamMemberOption {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface WorkspaceOption {
  id: string;
  name: string;
  category?: string;
}

export interface InboundSenderRouteRow {
  id: string;
  displaySenderEmail: string;
  status: string;
  createdAt: string;
  assignedWorkspaceName?: string | null;
  defaultAssignedToUser?: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  autoAttachAndProcess?: boolean;
}

interface DocumentEmailPanelProps {
  publicDocumentAddress: string;
  initialRoutes: InboundSenderRouteRow[];
  teamMembers?: TeamMemberOption[];
  workspaces?: WorkspaceOption[];
  compact?: boolean;
}

function statusVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "warning";
  if (status === "REVOKED") return "danger";
  return "neutral";
}

export function DocumentEmailPanel({
  publicDocumentAddress,
  initialRoutes,
  workspaces = [],
  compact,
}: DocumentEmailPanelProps) {
  const [routes, setRoutes] = useState(initialRoutes);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [autoAttachAndProcess, setAutoAttachAndProcess] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicDocumentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by browser
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const selectedWs = workspaces.find((w) => w.id === selectedWorkspaceId);

      const res = await fetch("/api/settings/inbound-senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          workspaceId: selectedWorkspaceId || undefined,
          autoAttachAndProcess,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? "Failed to add authorized sender.");
        return;
      }

      setRoutes((prev) => [
        {
          id: body.route.id,
          displaySenderEmail: body.route.displaySenderEmail,
          status: body.route.status,
          createdAt: body.route.createdAt,
          assignedWorkspaceName: selectedWs ? selectedWs.name : "Default Account Workspace",
          autoAttachAndProcess,
        },
        ...prev,
      ]);
      setEmail("");
      setSelectedWorkspaceId("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: string) {
    const res = await fetch(`/api/settings/inbound-senders/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, status: "REVOKED" } : r)));
    }
  }

  const enterpriseWorkspaces = workspaces.filter((w) => w.category === "Enterprise Workspace");
  const clientWorkspaces = workspaces.filter((w) => w.category === "Client Workspace");

  return (
    <div className={compact ? "space-y-5" : "space-y-8 max-w-5xl mx-auto"}>
      <PanelHeading
        icon={Mail}
        badge="Document Ingestion"
        title="Document Email"
        subtitle="Route emailed trade documents to their assigned workspace (e.g. Amazon, Target, Acme)."
        compact={compact}
      />

      <div className="apple-card p-6 rounded-3xl border border-border bg-white shadow-sm space-y-3">
        <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Inbound Address</span>
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono font-bold text-ink bg-surface-muted px-3 py-2 rounded-xl border border-border">
            {publicDocumentAddress}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-bold text-ink hover:bg-surface-muted transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-ink-muted">
          Documents emailed to this address are accepted only from authorized senders mapped to a workspace below.
        </p>
      </div>

      <div className="apple-card rounded-3xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Authorized Senders & Assigned Workspaces</h2>
            <p className="text-xs text-ink-muted mt-0.5">Assign authorized client email senders to their workspace (Amazon, Target, etc.).</p>
          </div>
        </div>

        <form onSubmit={handleAdd} className="p-4 border-b border-border bg-surface-muted/30 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs font-bold text-ink-muted uppercase tracking-wider">Sender Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="logistics@amazon.com"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-border text-sm bg-white font-medium"
              />
            </div>
            <div className="min-w-[280px]">
              <label className="text-xs font-bold text-ink-muted uppercase tracking-wider">Assigned Workspace (Client / Enterprise)</label>
              <select
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-border text-sm bg-white font-semibold text-ink"
              >
                <option value="">Default Account Workspace</option>

                {enterpriseWorkspaces.length > 0 && (
                  <optgroup label="Enterprise Workspaces">
                    {enterpriseWorkspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        🏢 {w.name}
                      </option>
                    ))}
                  </optgroup>
                )}

                {clientWorkspaces.length > 0 && (
                  <optgroup label="Client Workspaces">
                    {clientWorkspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        💼 {w.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-sm font-bold disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Add Authorized Sender
            </button>
          </div>

          {/* Checkmark: Attach and process */}
          <div className="pt-1">
            <label className="inline-flex items-center space-x-2 text-xs font-semibold text-ink cursor-pointer bg-white px-3 py-2 rounded-xl border border-border shadow-2xs">
              <input
                type="checkbox"
                checked={autoAttachAndProcess}
                onChange={(e) => setAutoAttachAndProcess(e.target.checked)}
                className="rounded border-border text-brand focus:ring-brand shrink-0 cursor-pointer"
              />
              <CheckSquare className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>Attach and process automatically to assigned workspace (Amazon, Target, etc.)</span>
            </label>
          </div>
        </form>

        {error && <div className="px-4 pt-3 text-xs text-red-600 font-medium">{error}</div>}

        {routes.length === 0 ? (
          <div className="p-8 text-center text-ink-muted text-sm">No authorized senders configured yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {routes.map((route) => {
              const wsDisplay =
                route.assignedWorkspaceName ||
                (route.defaultAssignedToUser
                  ? [route.defaultAssignedToUser.firstName, route.defaultAssignedToUser.lastName].filter(Boolean).join(" ") || route.defaultAssignedToUser.email
                  : "Target Account Workspace");

              return (
                <div key={route.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink font-mono">{route.displaySenderEmail}</span>
                      <Badge variant={statusVariant(route.status)}>{route.status}</Badge>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        <CheckSquare className="w-3 h-3" />
                        <span>Attach & Process Enabled</span>
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted flex items-center space-x-1.5">
                      <Building2 className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>Assigned Workspace:</span>
                      <span className="font-bold text-ink">{wsDisplay}</span>
                      <span>· Added {formatDate(route.createdAt)}</span>
                    </p>
                  </div>
                  {route.status === "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(route.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
