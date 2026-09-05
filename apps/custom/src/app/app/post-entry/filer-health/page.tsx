import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ChevronRight, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { getAccountContext, hasPermission } from "@/lib/auth";
import { isDataMode, withDataModeContext } from "@/lib/db";
import { getFilerAdminHealth } from "@/modules/filing/filerAdminService";

export const metadata = {
  title: "Filer Admin Health | Qubere",
  description: "19 CFR 143 Subpart A monitoring for your filer code.",
};

const STATUS_ICON = {
  HEALTHY: { icon: CheckCircle2, cls: "text-emerald-600" },
  WARNING: { icon: AlertTriangle, cls: "text-amber-600" },
  NON_COMPLIANT: { icon: XCircle, cls: "text-red-600" },
} as const;

export default async function FilerHealthPage() {
  const ctx = await getAccountContext();
  if (!ctx) return null;
  if (!(await hasPermission("filing.read"))) redirect("/app/dashboard");

  const health = await withDataModeContext(
    isDataMode(ctx.dataMode) ? ctx.dataMode : null,
    () => getFilerAdminHealth(ctx.accountId)
  );

  return (
    <div className="min-h-screen bg-surface-muted">
      <div className="border-b border-border bg-white/70 px-6 py-5">
        <div className="flex items-center gap-2 text-ink-muted text-sm mb-1">
          <Link href="/app/post-entry" className="hover:text-ink">
            Post-Entry
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-ink font-medium">Filer Admin Health</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-500 flex items-center justify-center">
            <Activity className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">Filer Administration Health</h1>
            <p className="text-sm text-ink-muted">
              19 CFR 143 Subpart A — a broker&apos;s ABI fatal-error rate must stay under 5%.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-3xl">
        {!health ? (
          <p className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-ink-muted">
            No filer code is configured for this account. Add a filer profile or ABI credential first.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-muted">Filer code</p>
                  <p className="font-mono text-lg font-bold text-ink">{health.filerCode}</p>
                  <p className="text-xs text-ink-muted">{health.filerName}</p>
                </div>
                {(() => {
                  const s = STATUS_ICON[health.status];
                  const Icon = s.icon;
                  return (
                    <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${s.cls}`}>
                      <Icon className="w-4 h-4" /> {health.status.replace("_", " ")}
                    </span>
                  );
                })()}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat
                label={`Fatal error rate (${health.windowDays}d)`}
                value={`${health.fatalErrorRatePct}%`}
                tone={health.isCompliantWith19Cfr143 ? "ok" : "bad"}
                sub={health.isCompliantWith19Cfr143 ? "within 19 CFR 143.5" : "exceeds 5% limit"}
              />
              <Stat
                label="Filer exports in window"
                value={String(health.exportsInWindow)}
                sub={`${health.failedExportsInWindow} failed`}
              />
              <Stat
                label="Connection"
                value={health.connectionStatus}
                tone={
                  health.connectionStatus === "HEALTHY"
                    ? "ok"
                    : health.connectionStatus === "DISCONNECTED"
                      ? "bad"
                      : "warn"
                }
              />
              <Stat label="ABI environment" value={health.environment ?? "—"} />
              <Stat label="Credential status" value={health.credentialStatus ?? "—"} />
              <Stat label="Transport" value={String(health.transportProtocol)} />
            </div>

            {health.lastError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
                Last export error: {health.lastError}
              </p>
            )}
            {health.lastExportAt && (
              <p className="text-xs text-ink-muted">
                Last filer export {new Date(health.lastExportAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "bad"
          ? "text-red-700"
          : "text-ink";
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${toneCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-muted">{sub}</p>}
    </div>
  );
}
