"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Users, Factory, Loader2 } from "lucide-react";
import {
  accuracyTone,
  compactUsd,
  overrideTone,
  pct,
  riskTone,
  type RiskTone,
} from "./intelligenceFormat";

type TabKey = "benchmarks" | "brokers" | "suppliers";

const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "benchmarks", label: "HTS Benchmarks", icon: BarChart3 },
  { key: "brokers", label: "Broker Scorecard", icon: Users },
  { key: "suppliers", label: "Supplier Risk", icon: Factory },
];

const TONE_BADGE: Record<RiskTone, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
};

interface Benchmark {
  htsCode10: string;
  industryAvgDuty: string | number;
  avgDeclaredPrice: string | number;
  topOriginCountry: string;
  totalUSVolumeVal: string | number;
}
interface BrokerMetric {
  brokerName: string;
  entriesProcessed: number;
  accuracyPct: string | number;
  overrideRatePct: string | number;
  correctionRatePct: string | number;
  avgReviewTimeMin: number;
  rejectedCount: number;
}
interface SupplierRisk {
  supplierName: string;
  score: number;
  riskLevel: string;
  violationHistoryCount: number;
  missingDocsCount: number;
  pgaIssuesCount: number;
  classificationIssuesCount: number;
}

function EmptyState({ what }: { what: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-2xs p-10 text-center">
      <p className="text-sm font-bold text-ink">No {what} yet</p>
      <p className="text-xs text-ink-muted mt-1">
        This data populates as entries are processed and reference data is ingested.
      </p>
    </div>
  );
}

export function IntelligenceClient() {
  const [tab, setTab] = useState<TabKey>("benchmarks");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [benchmarks, setBenchmarks] = useState<Benchmark[] | null>(null);
  const [brokers, setBrokers] = useState<BrokerMetric[] | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierRisk[] | null>(null);

  const load = useCallback(async (which: TabKey) => {
    const already =
      (which === "benchmarks" && benchmarks) ||
      (which === "brokers" && brokers) ||
      (which === "suppliers" && suppliers);
    if (already) return;
    setLoading(true);
    setError(null);
    try {
      if (which === "benchmarks") {
        const r = await fetch("/api/trade-intel/benchmarks", { cache: "no-store" });
        const d = await r.json();
        setBenchmarks(Array.isArray(d.benchmarks) ? d.benchmarks : []);
      } else if (which === "brokers") {
        const r = await fetch("/api/risk/brokers", { cache: "no-store" });
        const d = await r.json();
        setBrokers(Array.isArray(d.brokerMetrics) ? d.brokerMetrics : []);
      } else {
        const r = await fetch("/api/risk/suppliers", { cache: "no-store" });
        const d = await r.json();
        setSuppliers(Array.isArray(d.supplierRisks) ? d.supplierRisks : []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [benchmarks, brokers, suppliers]);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-2.5 bg-white p-5 rounded-2xl border border-border shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-ink tracking-tight">Trade Intelligence</h1>
          <p className="text-xs text-ink-muted">Nationwide HTS benchmarks, broker QA metrics and supplier risk scores.</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-border shadow-2xs">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              tab === key ? "bg-brand text-white shadow-2xs" : "text-ink-muted hover:text-ink hover:bg-surface-muted"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-600 px-1">{error}</p>}

      {loading ? (
        <div className="bg-white rounded-2xl border border-border shadow-2xs p-10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-ink-muted animate-spin" />
        </div>
      ) : tab === "benchmarks" ? (
        !benchmarks || benchmarks.length === 0 ? (
          <EmptyState what="HTS benchmarks" />
        ) : (
          <div className="bg-white rounded-2xl border border-border shadow-2xs overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-muted text-ink-muted uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left">HTS 10</th>
                  <th className="px-4 py-2.5 text-right">Industry avg duty</th>
                  <th className="px-4 py-2.5 text-right">Avg declared price</th>
                  <th className="px-4 py-2.5 text-left">Top origin</th>
                  <th className="px-4 py-2.5 text-right">US import volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {benchmarks.map((b) => (
                  <tr key={b.htsCode10}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-ink">{b.htsCode10}</td>
                    <td className="px-4 py-2.5 text-right">{pct(Number(b.industryAvgDuty))}</td>
                    <td className="px-4 py-2.5 text-right">{compactUsd(Number(b.avgDeclaredPrice))}</td>
                    <td className="px-4 py-2.5">{b.topOriginCountry}</td>
                    <td className="px-4 py-2.5 text-right">{compactUsd(Number(b.totalUSVolumeVal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : tab === "brokers" ? (
        !brokers || brokers.length === 0 ? (
          <EmptyState what="broker metrics" />
        ) : (
          <ul className="space-y-2">
            {brokers.map((br) => (
              <li key={br.brokerName} className="bg-white rounded-2xl border border-border shadow-2xs p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">{br.brokerName}</span>
                  <span className="text-[11px] text-ink-muted">{br.entriesProcessed} entries</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <p className="text-ink-muted text-[10px] uppercase tracking-wider">Accuracy</p>
                    <p className={`font-bold px-1.5 py-0.5 rounded-full border inline-block mt-0.5 ${TONE_BADGE[accuracyTone(Number(br.accuracyPct))]}`}>
                      {pct(Number(br.accuracyPct))}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-muted text-[10px] uppercase tracking-wider">Override rate</p>
                    <p className={`font-bold px-1.5 py-0.5 rounded-full border inline-block mt-0.5 ${TONE_BADGE[overrideTone(Number(br.overrideRatePct))]}`}>
                      {pct(Number(br.overrideRatePct))}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-muted text-[10px] uppercase tracking-wider">Correction rate</p>
                    <p className="font-semibold text-ink mt-1">{pct(Number(br.correctionRatePct))}</p>
                  </div>
                  <div>
                    <p className="text-ink-muted text-[10px] uppercase tracking-wider">Avg review</p>
                    <p className="font-semibold text-ink mt-1">{br.avgReviewTimeMin} min</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : !suppliers || suppliers.length === 0 ? (
        <EmptyState what="supplier risk scores" />
      ) : (
        <ul className="space-y-2">
          {suppliers.map((s) => (
            <li key={s.supplierName} className="bg-white rounded-2xl border border-border shadow-2xs p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink">{s.supplierName}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TONE_BADGE[riskTone(s.riskLevel)]}`}>
                  {s.riskLevel} · {s.score}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[11px] text-ink-muted">
                <span>{s.violationHistoryCount} violations</span>
                <span>{s.missingDocsCount} missing docs</span>
                <span>{s.pgaIssuesCount} PGA issues</span>
                <span>{s.classificationIssuesCount} classification issues</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
