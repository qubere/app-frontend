"use client";

import { useCallback, useEffect, useState } from "react";

interface SyncLogRow {
  id: string;
  direction: string;
  entityType: string;
  qubereId: string | null;
  providerId: string | null;
  status: string;
  message: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface QboStatus {
  configured: boolean;
  connected: boolean;
  environment: string | null;
  companyName: string | null;
  realmId: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  recentLogs: SyncLogRow[];
}

export function QuickBooksConnectionCard() {
  const [status, setStatus] = useState<QboStatusState>({ loading: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/quickbooks/status", { cache: "no-store" });
      if (!res.ok) {
        setStatus({ loading: false, error: `Status check failed (${res.status})` });
        return;
      }
      setStatus({ loading: false, data: (await res.json()) as QboStatus });
    } catch {
      setStatus({ loading: false, error: "Could not load QuickBooks status" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = async () => {
    if (!confirm("Disconnect QuickBooks? Invoices already synced stay in QuickBooks.")) return;
    setBusy(true);
    try {
      await fetch("/api/integrations/quickbooks/disconnect", { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const data = "data" in status ? status.data : undefined;

  return (
    <div className="p-6 rounded-2xl bg-white border border-[#E5E5EA] shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: data?.connected ? "#2CA01C" : "#C7C7CC" }} />
            QuickBooks Online
          </h3>
          <p className="text-sm text-ink-muted">
            Push approved invoices into QuickBooks as customers and invoices.
          </p>
        </div>
        {data?.environment && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-slate-200 bg-slate-50 text-slate-600">
            {data.environment}
          </span>
        )}
      </div>

      {status.loading && <p className="text-xs text-ink-muted">Checking connection…</p>}
      {"error" in status && status.error && (
        <p className="text-xs text-rose-600">{status.error}</p>
      )}

      {data && !data.configured && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          QuickBooks is not configured on the server. Set <code>QBO_CLIENT_ID</code>,{" "}
          <code>QBO_CLIENT_SECRET</code>, <code>QBO_REDIRECT_URI</code> and{" "}
          <code>INTEGRATION_ENCRYPTION_KEY</code>.
        </div>
      )}

      {data?.configured && !data.connected && (
        <a
          href="/api/integrations/quickbooks/connect"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2CA01C] text-white hover:bg-[#268a18] transition-colors"
        >
          Connect QuickBooks
        </a>
      )}

      {data?.connected && (
        <div className="space-y-3">
          <div className="text-xs text-ink-muted space-y-0.5">
            <div>
              Company: <span className="font-semibold text-ink">{data.companyName ?? data.realmId}</span>
            </div>
            {data.connectedAt && <div>Connected {new Date(data.connectedAt).toLocaleString()}</div>}
            {data.lastSyncAt && <div>Last sync {new Date(data.lastSyncAt).toLocaleString()}</div>}
            {data.lastErrorMessage && (
              <div className="text-rose-600">Last error: {data.lastErrorMessage}</div>
            )}
          </div>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50"
          >
            {busy ? "Disconnecting…" : "Disconnect"}
          </button>

          {data.recentLogs.length > 0 && (
            <div className="pt-2 border-t border-[#F5F5F7]">
              <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                Recent sync activity
              </div>
              <ul className="space-y-1">
                {data.recentLogs.map((log) => (
                  <li key={log.id} className="text-[11px] flex items-center gap-2">
                    <span
                      className={
                        log.status === "SUCCESS" ? "text-emerald-600" : "text-rose-600"
                      }
                    >
                      {log.status === "SUCCESS" ? "✓" : "✕"}
                    </span>
                    <span className="text-ink-muted">
                      {new Date(log.createdAt).toLocaleTimeString()} · {log.direction} {log.entityType}
                      {log.providerId ? ` → #${log.providerId}` : ""}
                      {log.message ? ` · ${log.message}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type QboStatusState =
  | { loading: true }
  | { loading: false; data: QboStatus }
  | { loading: false; error: string };
