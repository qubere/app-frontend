"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Scale, RotateCw, Loader2, FileText, ArrowUpRight, Clock } from "lucide-react";
import { FILTERS, bucketCounts, filterCases, type FilterKey } from "./classificationInboxFilters";

export interface InboxCase {
  id: string;
  status: string;
  priority: string;
  createdAt: string;
  dueAt: string | null;
  description: string;
  countryOfOrigin: string | null;
  canonicalProductId: string | null;
  documentCount: number;
  latestRun: {
    status: string;
    startedAt: string;
    topProposal: {
      hts: string;
      description: string | null;
      confidence: number;
      band: string;
    } | null;
  } | null;
}

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PROPOSED: "bg-amber-50 text-amber-700 border-amber-200",
  HUMAN_REVIEW_REQUIRED: "bg-amber-50 text-amber-700 border-amber-200",
  NEEDS_INFORMATION: "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  QUEUED: "bg-blue-50 text-blue-700 border-blue-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

const BAND_STYLE: Record<string, string> = {
  HIGH: "text-emerald-700",
  MEDIUM: "text-amber-700",
  LOW: "text-red-700",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function ClassificationInboxClient({ cases, canRun }: { cases: InboxCase[]; canRun: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("review");
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const counts = useMemo(() => bucketCounts(cases), [cases]);
  const visible = useMemo(() => filterCases(cases, filter, query), [cases, filter, query]);

  async function rerun(caseId: string) {
    setRunning((r) => ({ ...r, [caseId]: true }));
    setErrors((e) => ({ ...e, [caseId]: null }));
    try {
      const res = await fetch(`/api/v1/classification/cases/${encodeURIComponent(caseId)}/runs`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setErrors((e) => ({ ...e, [caseId]: err instanceof Error ? err.message : "Something went wrong" }));
    } finally {
      setRunning((r) => ({ ...r, [caseId]: false }));
    }
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-border shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center">
            <Scale className="w-4 h-4 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-ink tracking-tight">Classification Inbox</h1>
            <p className="text-xs text-ink-muted">{cases.length} case{cases.length === 1 ? "" : "s"} · every HTS classification case for the account</p>
          </div>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search description or case id…"
          className="px-3 py-2 bg-surface-muted border border-border focus:border-brand focus:bg-white rounded-xl text-xs text-ink w-56 outline-none font-medium"
        />
      </div>

      <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-border shadow-2xs overflow-x-auto">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active ? "bg-brand text-white shadow-2xs" : "text-ink-muted hover:text-ink hover:bg-surface-muted"
              }`}
            >
              {f.label}
              <span
                className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center ${
                  active ? "bg-white/25 text-white" : "bg-surface-muted text-ink-muted"
                }`}
              >
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-2xs p-12 text-center">
          <Scale className="w-8 h-8 text-ink-muted mx-auto mb-3" />
          <p className="text-sm font-bold text-ink">No cases in this view</p>
          <p className="text-xs text-ink-muted mt-1">Cases are created when you classify a product or a shipment line item.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((c) => {
            const detailHref = `/app/classification/${c.id}`;
            const busy = !!running[c.id];
            return (
              <li key={c.id} className="bg-white rounded-2xl border border-border shadow-2xs p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          STATUS_STYLE[c.status] ?? "bg-surface-muted text-ink-muted border-border"
                        }`}
                      >
                        {statusLabel(c.status)}
                      </span>
                      {c.priority !== "MEDIUM" && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface-muted text-ink-muted border border-border">
                          {c.priority}
                        </span>
                      )}
                      {c.countryOfOrigin && <span className="text-[11px] text-ink-muted">{c.countryOfOrigin}</span>}
                      {c.documentCount > 0 && (
                        <span className="text-[11px] text-ink-muted inline-flex items-center gap-0.5">
                          <FileText className="w-3 h-3" />
                          {c.documentCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-ink mt-1 truncate">{c.description}</p>

                    {c.latestRun?.topProposal ? (
                      <p className="text-xs text-ink-muted mt-1">
                        Proposed <span className="font-mono font-semibold text-ink">{c.latestRun.topProposal.hts}</span>
                        {" · "}
                        <span className={`font-bold ${BAND_STYLE[c.latestRun.topProposal.band] ?? ""}`}>
                          {Math.round(c.latestRun.topProposal.confidence * 100)}% {c.latestRun.topProposal.band}
                        </span>
                        {c.latestRun.topProposal.description ? ` · ${c.latestRun.topProposal.description}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-ink-muted mt-1 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {c.latestRun ? `Run ${statusLabel(c.latestRun.status)} — no proposal yet` : "No run yet"}
                      </p>
                    )}
                    {errors[c.id] && <p className="text-[11px] text-red-600 mt-1">{errors[c.id]}</p>}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {canRun && (
                      <button
                        onClick={() => rerun(c.id)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-muted border border-border text-xs font-bold text-ink hover:bg-white hover:border-brand disabled:opacity-40 transition-colors"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                        {c.latestRun ? "Re-run" : "Run"}
                      </button>
                    )}
                    <Link
                      href={detailHref}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-brand hover:bg-brand/10 transition-colors"
                    >
                      Open
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
