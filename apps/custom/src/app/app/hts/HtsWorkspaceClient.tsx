"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Search, Loader2, ChevronRight, ScrollText, Layers } from "lucide-react";
import {
  codeLevelLabel,
  headlineRate,
  isClassifiable,
  normalizeHtsQuery,
  type DutyRateLike,
  type HtsNodeLike,
} from "./htsFormat";

interface SearchItem extends HtsNodeLike {
  id: string;
  fullDescription?: string;
}

interface HierarchyNode {
  htsNumberDisplay: string;
  description: string;
  codeLevel: number;
}

interface NoteFragment {
  id: string;
  citation: string;
  text: string;
  pageOrLocation?: string | null;
}

export function HtsWorkspaceClient({ initialCode }: { initialCode: string | null }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialCode ?? "");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SearchItem | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  const [notes, setNotes] = useState<NoteFragment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/v1/hts/search?q=${encodeURIComponent(term)}&limit=25`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      setResults(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const loadDetail = useCallback(async (node: SearchItem) => {
    setSelected(node);
    setDetailLoading(true);
    setHierarchy([]);
    setNotes([]);
    const code = normalizeHtsQuery(node.htsNumberDisplay);
    router.replace(`/app/hts?code=${encodeURIComponent(code)}`);
    try {
      const [hRes, nRes] = await Promise.all([
        fetch(`/api/v1/hts/codes/${encodeURIComponent(code)}/hierarchy`, { cache: "no-store" }),
        fetch(`/api/v1/hts/codes/${encodeURIComponent(code)}/notes`, { cache: "no-store" }),
      ]);
      if (hRes.ok) {
        const h = await hRes.json();
        setHierarchy(Array.isArray(h.hierarchy) ? h.hierarchy : []);
      }
      if (nRes.ok) {
        const n = await nRes.json();
        setNotes(Array.isArray(n.notes) ? n.notes.filter(Boolean) : []);
      }
    } finally {
      setDetailLoading(false);
    }
  }, [router]);

  // Deep-link: resolve ?code= to a selected node on first load.
  const didInitial = useRef(false);
  useEffect(() => {
    if (didInitial.current || !initialCode) return;
    didInitial.current = true;
    (async () => {
      await runSearch(initialCode);
      try {
        const res = await fetch(`/api/v1/hts/codes/${encodeURIComponent(normalizeHtsQuery(initialCode))}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.node) await loadDetail({ ...data.node, id: data.node.id });
        }
      } catch {
        // deep link just fails soft -- the search results still show
      }
    })();
  }, [initialCode, runSearch, loadDetail]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      <div className="flex items-center gap-2.5 bg-white p-5 rounded-2xl border border-border shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-ink tracking-tight">HTS Lookup</h1>
          <p className="text-xs text-ink-muted">Codes, duty rates, hierarchy and legal chapter notes from the current schedule.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="relative">
        <Search className="w-4 h-4 text-ink-muted absolute left-4 top-3.5" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="HTS number or keywords — e.g. 8471.30 or “laptop computer”"
          className="w-full pl-11 pr-4 py-3 bg-white border border-border focus:border-brand rounded-2xl text-sm text-ink outline-none shadow-2xs"
          autoFocus
        />
        {searching && <Loader2 className="w-4 h-4 text-ink-muted absolute right-4 top-3.5 animate-spin" />}
      </form>
      {searchError && <p className="text-xs text-red-600 px-1">{searchError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Results */}
        <div className="lg:col-span-5 space-y-2">
          {results.length === 0 && !searching ? (
            <div className="bg-white rounded-2xl border border-border shadow-2xs p-8 text-center text-xs text-ink-muted">
              {query.trim().length >= 2 ? "No matching HTS codes." : "Search by code or product description."}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {results.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => loadDetail(item)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${
                        active ? "bg-brand/5 border-brand" : "bg-white border-border hover:border-brand/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-ink">{item.htsNumberDisplay}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface-muted text-ink-muted border border-border">
                          {codeLevelLabel(item.codeLevel)}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted mt-1 line-clamp-2">{item.description}</p>
                      <p className="text-[11px] text-ink-muted/80 mt-1">
                        Duty: <span className="font-semibold text-ink">{headlineRate(item.dutyRates as DutyRateLike[])}</span>
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-7 space-y-4">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-border shadow-2xs p-10 text-center text-xs text-ink-muted">
              Select a code to see its hierarchy, duty rates and legal notes.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-border shadow-2xs p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-extrabold text-ink">{selected.htsNumberDisplay}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isClassifiable(selected.codeLevel)
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-surface-muted text-ink-muted border-border"
                    }`}
                  >
                    {isClassifiable(selected.codeLevel) ? "Declarable" : "Not declarable at this level"}
                  </span>
                </div>
                <p className="text-sm text-ink mt-1">{selected.fullDescription || selected.description}</p>
              </div>

              {/* Hierarchy */}
              <div className="bg-white rounded-2xl border border-border shadow-2xs p-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-3 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Hierarchy
                </h2>
                {detailLoading && hierarchy.length === 0 ? (
                  <p className="text-xs text-ink-muted">Loading…</p>
                ) : hierarchy.length === 0 ? (
                  <p className="text-xs text-ink-muted">No hierarchy available.</p>
                ) : (
                  <ol className="space-y-1">
                    {hierarchy.map((h, i) => (
                      <li
                        key={`${h.htsNumberDisplay}-${i}`}
                        className="flex items-start gap-2 text-xs"
                        style={{ paddingLeft: `${i * 14}px` }}
                      >
                        {i > 0 && <ChevronRight className="w-3 h-3 text-ink-muted/50 mt-0.5 shrink-0" />}
                        <span className="font-mono font-semibold text-ink shrink-0">{h.htsNumberDisplay}</span>
                        <span className="text-ink-muted">{h.description}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Duty rates */}
              {selected.dutyRates && selected.dutyRates.length > 0 && (
                <div className="bg-white rounded-2xl border border-border shadow-2xs p-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-3">Duty rates</h2>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-border">
                      {selected.dutyRates.map((r, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-3 font-semibold text-ink whitespace-nowrap">{r.rateColumn}</td>
                          <td className="py-1.5 text-ink-muted">{r.isFree ? "Free" : r.rawRateText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Legal notes */}
              <div className="bg-white rounded-2xl border border-border shadow-2xs p-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-3 flex items-center gap-1.5">
                  <ScrollText className="w-3.5 h-3.5" /> Legal &amp; chapter notes
                </h2>
                {detailLoading && notes.length === 0 ? (
                  <p className="text-xs text-ink-muted">Loading…</p>
                ) : notes.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    No legal notes are linked to this code. Check the chapter and section notes for the broader heading.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {notes.map((n) => (
                      <li key={n.id} className="text-xs">
                        <p className="font-semibold text-brand">{n.citation}</p>
                        <p className="text-ink-muted mt-0.5 whitespace-pre-wrap">{n.text}</p>
                        {n.pageOrLocation && <p className="text-[10px] text-ink-muted/70 mt-0.5">{n.pageOrLocation}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
