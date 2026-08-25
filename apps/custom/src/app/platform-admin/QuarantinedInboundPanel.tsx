"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Inbox, Paperclip, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface QuarantinedAttachment {
  id: string;
  originalFilename: string;
  actualSize: number | null;
  declaredMimeType: string | null;
}

interface QuarantinedEmailItem {
  id: string;
  originalFromAddress: string;
  subject: string | null;
  receivedAt: string;
  attachments: QuarantinedAttachment[];
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function QuarantinedInboundPanel({ accounts }: { accounts: AccountOption[] }) {
  const [items, setItems] = useState<QuarantinedEmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<Record<string, string>>({});
  const [createSenderRoute, setCreateSenderRoute] = useState<Record<string, boolean>>({});

  const fetchItems = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/platform-admin/quarantined-inbound");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load quarantined emails");
      setItems(data.items ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load quarantined emails");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleRelease = async (item: QuarantinedEmailItem) => {
    const accountId = selectedAccountId[item.id] || accounts[0]?.id;
    if (!accountId) {
      setMessage({ type: "error", text: "No account available to release into." });
      return;
    }
    setResolvingId(item.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/platform-admin/quarantined-inbound/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RELEASE",
          accountId,
          createSenderRoute: createSenderRoute[item.id] ?? true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to release this email");

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      const accountName = accounts.find((a) => a.id === accountId)?.name ?? accountId;
      setMessage({
        type: "success",
        text: `Released ${item.attachments.length} document${item.attachments.length === 1 ? "" : "s"} from ${item.originalFromAddress} to ${accountName}`,
      });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Network error occurred." });
    } finally {
      setResolvingId(null);
    }
  };

  const handleDiscard = async (item: QuarantinedEmailItem) => {
    setResolvingId(item.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/platform-admin/quarantined-inbound/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DISCARD" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to discard this email");

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setMessage({ type: "success", text: `Discarded email from ${item.originalFromAddress}` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Network error occurred." });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`p-4 rounded-2xl text-sm border flex items-center space-x-3 ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="apple-card rounded-3xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold text-ink flex items-center space-x-2">
            <Inbox className="w-5 h-5 text-amber-600" />
            <span>Quarantined Inbound Emails ({items.length})</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Sent to the shared docs@inbound.qubere.ai mailbox from a sender nobody has registered. Attachments are
            already downloaded, scanned, and stored — release one to an account to turn it into a real document, or
            discard it.
          </p>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center text-ink-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span>Loading quarantined emails…</span>
          </div>
        ) : loadError ? (
          <div className="p-10 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
            <p className="text-sm text-red-700">{loadError}</p>
            <Button size="sm" variant="secondary" onClick={fetchItems}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => {
              const isResolving = resolvingId === item.id;
              const accountId = selectedAccountId[item.id] || accounts[0]?.id || "";
              const routeChecked = createSenderRoute[item.id] ?? true;
              return (
                <div key={item.id} className="p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{item.originalFromAddress}</p>
                      <p className="text-sm text-ink-muted">{item.subject || "(no subject)"}</p>
                      <p className="text-xs text-ink-muted mt-1">{formatDateTime(item.receivedAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={`/api/platform-admin/quarantined-inbound/proxy?attachmentId=${att.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-muted border border-border text-xs font-semibold text-ink hover:bg-slate-100 transition-colors"
                        >
                          <Paperclip className="w-3 h-3" />
                          <span>{att.originalFilename}</span>
                          <span className="text-ink-muted">{formatBytes(att.actualSize)}</span>
                          <Download className="w-3 h-3 text-ink-muted" />
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-border">
                    <select
                      value={accountId}
                      onChange={(e) => setSelectedAccountId((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      className="bg-surface-muted border border-border rounded-xl px-3 py-2 text-xs font-semibold text-ink focus:outline-none"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type})
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <input
                        type="checkbox"
                        checked={routeChecked}
                        onChange={(e) => setCreateSenderRoute((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                      />
                      <span>Remember this sender for future emails</span>
                    </label>

                    <div className="flex items-center gap-2 sm:ml-auto">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={isResolving || !accountId}
                        onClick={() => handleRelease(item)}
                        className="rounded-full py-1.5 shadow-2xs gap-1.5"
                      >
                        {isResolving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Release</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={isResolving}
                        onClick={() => handleDiscard(item)}
                        className="rounded-full py-1.5 shadow-2xs gap-1.5"
                      >
                        <span>Discard</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="px-6 py-8 text-center text-ink-muted text-sm">Nothing quarantined.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
