"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Download, Loader2, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";

type AccountOption = { id: string; name: string; type: string };
type QuarantinedEmail = {
  id: string;
  originalFromAddress: string;
  subject: string | null;
  receivedAt: string;
  accountId: string | null;
  account: { id: string; name: string } | null;
  attachments: Array<{
    id: string;
    originalFilename: string;
    actualSize: number | null;
    declaredMimeType: string | null;
    processingStatus: string;
  }>;
};

export function QuarantineInboxTable({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [items, setItems] = useState<QuarantinedEmail[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [canRouteAcrossAccounts, setCanRouteAcrossAccounts] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [accountByEmail, setAccountByEmail] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"RELEASE" | "DISCARD" | "BLOCK" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async (preserveMessage = false) => {
    setLoading(true);
    if (!preserveMessage) setMessage(null);
    try {
      const response = await fetch("/api/documents/quarantine", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Unable to load quarantined email.");
      const nextItems = (body.items ?? []) as QuarantinedEmail[];
      const nextAccounts = (body.accounts ?? []) as AccountOption[];
      const nextCanRouteAcrossAccounts = Boolean(body.canRouteAcrossAccounts);
      setItems(nextItems);
      setAccounts(nextAccounts);
      setCanRouteAcrossAccounts(nextCanRouteAcrossAccounts);
      setSelected(new Set());
      setAccountByEmail((current) => {
        const next = { ...current };
        for (const item of nextItems) {
          next[item.id] = item.accountId ?? next[item.id] ?? (nextCanRouteAcrossAccounts ? "" : nextAccounts[0]?.id ?? "");
        }
        return next;
      });
      onCountChange?.(nextItems.length);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to load quarantined email." });
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const selectedItems = useMemo(() => items.filter((item) => selected.has(item.id)), [items, selected]);

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)));
  const toggleOne = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulkAction = async (action: "RELEASE" | "DISCARD" | "BLOCK") => {
    if (selectedItems.length === 0) return;
    if (action !== "DISCARD" && selectedItems.some((item) => !accountByEmail[item.id])) {
      setMessage({ tone: "error", text: "Choose an account for every selected email before releasing or blocking." });
      return;
    }
    if ((action === "DISCARD" || action === "BLOCK") && !window.confirm(`${action === "BLOCK" ? "Block the senders and reject" : "Discard"} ${selectedItems.length} selected email${selectedItems.length === 1 ? "" : "s"}?`)) return;

    setWorking(action);
    setMessage(null);
    try {
      const response = await fetch("/api/documents/quarantine/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          items: selectedItems.map((item) => ({
            inboundEmailId: item.id,
            accountId: accountByEmail[item.id] || undefined,
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Bulk action failed.");
      const failedCount = body.failed?.length ?? 0;
      const completedVerb = action === "RELEASE" ? "released" : action === "DISCARD" ? "discarded" : "blocked";
      setMessage({
        tone: failedCount ? "error" : "success",
        text: failedCount
          ? `${body.succeeded.length} completed; ${failedCount} failed. ${body.failed[0]?.message ?? ""}`
          : `${body.succeeded.length} email${body.succeeded.length === 1 ? "" : "s"} ${completedVerb}.`,
      });
      await load(true);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Bulk action failed." });
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-white shadow-xs overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-ink">Quarantined email</p>
            <p className="text-[11px] text-ink-muted">Review the attachment, choose its account, then release, discard, or block.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">{selected.size} selected</span>
          <ActionButton label="Release" icon={CheckCircle2} disabled={!selected.size || !!working} working={working === "RELEASE"} onClick={() => runBulkAction("RELEASE")} />
          <ActionButton label="Discard" icon={Trash2} disabled={!selected.size || !!working} working={working === "DISCARD"} onClick={() => runBulkAction("DISCARD")} />
          <ActionButton label="Block" icon={Ban} danger disabled={!selected.size || !!working} working={working === "BLOCK"} onClick={() => runBulkAction("BLOCK")} />
          <button type="button" onClick={() => void load()} disabled={loading || !!working} className="rounded-lg border border-border bg-white p-2 text-ink-muted hover:text-ink disabled:opacity-50" aria-label="Refresh quarantine queue">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {message && <div className={`border-b px-4 py-2 text-xs font-semibold ${message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{message.text}</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead className="border-b border-border bg-white text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Select all quarantined emails" checked={allSelected} onChange={toggleAll} /></th>
              <th className="px-3 py-3">Timestamp</th>
              <th className="px-3 py-3">From</th>
              <th className="px-3 py-3">Subject</th>
              <th className="px-3 py-3">Account</th>
              <th className="px-3 py-3">Attachment name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-muted"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading quarantine queue…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-muted">No quarantined email needs review.</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className={selected.has(item.id) ? "bg-amber-50/50" : "hover:bg-surface-muted/40"}>
                <td className="px-4 py-3 align-top"><input type="checkbox" aria-label={`Select email from ${item.originalFromAddress}`} checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} /></td>
                <td className="whitespace-nowrap px-3 py-3 align-top text-ink-muted">{new Date(item.receivedAt).toLocaleString()}</td>
                <td className="max-w-52 truncate px-3 py-3 align-top font-semibold text-ink" title={item.originalFromAddress}>{item.originalFromAddress}</td>
                <td className="max-w-64 truncate px-3 py-3 align-top text-ink" title={item.subject ?? ""}>{item.subject || "(no subject)"}</td>
                <td className="px-3 py-3 align-top">
                  {canRouteAcrossAccounts ? (
                    <select value={accountByEmail[item.id] ?? ""} onChange={(event) => setAccountByEmail((current) => ({ ...current, [item.id]: event.target.value }))} className="w-52 rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-semibold text-ink">
                      <option value="">Choose account…</option>
                      {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  ) : <span className="font-semibold text-ink">{item.account?.name ?? accounts[0]?.name ?? "Unassigned"}</span>}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-1">
                    {item.attachments.filter((attachment) => attachment.processingStatus === "QUARANTINED").map((attachment) => (
                      <a key={attachment.id} href={`/api/documents/quarantine/proxy?attachmentId=${attachment.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                        <Download className="h-3 w-3" />{attachment.originalFilename}
                      </a>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionButton({ label, icon: Icon, disabled, working, danger, onClick }: { label: string; icon: typeof CheckCircle2; disabled: boolean; working: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-40 ${danger ? "border-red-200 bg-red-50 text-red-700" : "border-border bg-white text-ink hover:bg-surface-muted"}`}>
      {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}{label}
    </button>
  );
}
