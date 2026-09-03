"use client";

import { useState, useEffect } from "react";
import { ClientInboundAddresses } from "./ClientInboundAddresses";
import { Mail, Copy, Check, Trash2, Plus, Building2 } from "lucide-react";
import { PanelHeading } from "@/components/PanelHeading";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export interface TeamMemberOption {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface InboundSenderRouteRow {
  id: string;
  displaySenderEmail: string;
  status: string;
  createdAt: string;
  assignedWorkspaceName?: string | null;
  defaultAssignedToUser?: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
}

interface DocumentEmailPanelProps {
  publicDocumentAddress: string;
  accountName: string;
  initialRoutes: InboundSenderRouteRow[];
  teamMembers?: TeamMemberOption[];
  compact?: boolean;
}

function statusVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "warning";
  if (status === "REVOKED") return "danger";
  return "neutral";
}

function LegacyDocumentEmailPanel({
  publicDocumentAddress,
  accountName,
  initialRoutes,
  compact,
}: DocumentEmailPanelProps) {
  const [routes, setRoutes] = useState(initialRoutes);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
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
      const res = await fetch("/api/settings/inbound-senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? "Failed to add authorized sender.");
        return;
      }

      setRoutes((prev) => {
        const activeRoute = {
          id: body.route.id,
          displaySenderEmail: body.route.displaySenderEmail,
          status: body.route.status,
          createdAt: body.route.createdAt,
          assignedWorkspaceName: accountName,
        };
        return [activeRoute, ...prev.filter((route) => route.id !== activeRoute.id)];
      });
      setEmail("");
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

  return (
    <div className={compact ? "space-y-5" : "space-y-8 max-w-5xl mx-auto"}>
      <PanelHeading
        icon={Mail}
        badge="Document Ingestion"
        title="Document Email"
        subtitle="Authorize exact sender addresses that may deliver documents to this account."
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
          Documents emailed to this address are accepted only from active sender addresses authorized for {accountName}. Unknown senders go to quarantine.
        </p>
      </div>

      <div className="apple-card rounded-3xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Authorized senders</h2>
            <p className="text-xs text-ink-muted mt-0.5">Authorization is an exact, case-insensitive email match for this account.</p>
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
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-sm font-bold disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Add Authorized Sender
            </button>
          </div>
        </form>

        {error && <div className="px-4 pt-3 text-xs text-red-600 font-medium">{error}</div>}

        {routes.length === 0 ? (
          <div className="p-8 text-center text-ink-muted text-sm">No authorized senders configured yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {routes.map((route) => {
              return (
                <div key={route.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink font-mono">{route.displaySenderEmail}</span>
                      <Badge variant={statusVariant(route.status)}>{route.status}</Badge>
                    </div>
                    <p className="text-xs text-ink-muted flex items-center space-x-1.5">
                      <Building2 className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span>Account:</span>
                      <span className="font-bold text-ink">{route.assignedWorkspaceName || accountName}</span>
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

export function DocumentEmailPanel(props: DocumentEmailPanelProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { fetch('/api/settings/inbound-addresses').then(async r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => setEnabled(d.enabled)).catch(() => setFailed(true)); }, []);
  if (failed) return <p role="alert" className="text-sm text-red-700">Document email settings could not load. Refresh to try again.</p>;
  if (enabled === null) return <p className="text-sm text-ink-muted">Loading document email settings…</p>;
  return enabled ? <ClientInboundAddresses /> : <LegacyDocumentEmailPanel {...props} />;
}
