"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Compass,
  ExternalLink,
  FileCheck2,
  Files,
  FolderSearch2,
  Landmark,
  LifeBuoy,
  PackageSearch,
  ReceiptText,
  Search,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SUPPORT_ARTICLES,
  SUPPORT_MODULES,
  getSupportModule,
  searchSupportArticleList,
  type SupportArticle,
  type SupportModuleId,
} from "./supportContent";
import { SupportAgent } from "./SupportAgent";

const MODULE_ICONS: Record<(typeof SUPPORT_MODULES)[number]["icon"], LucideIcon> = {
  compass: Compass,
  shipments: PackageSearch,
  documents: Files,
  filing: FileCheck2,
  classification: BookOpen,
  compliance: ShieldCheck,
  "post-entry": ReceiptText,
  "trade-data": Landmark,
  billing: CircleDollarSign,
};

const POPULAR_SEARCHES = [
  "Attach a document",
  "Filing not ready",
  "Review HTS classification",
  "Restricted party hit",
  "Create a 7501",
];

const QUICK_TASKS = [
  {
    title: "Clear today’s blockers",
    description: "Review the items stopping work from moving.",
    articleId: "work-today",
    icon: CheckCircle2,
    tone: "bg-blue-50 text-blue-700 border-blue-100",
  },
  {
    title: "Attach a trade document",
    description: "Route an invoice, packing list, or BOL correctly.",
    articleId: "upload-document",
    icon: Files,
    tone: "bg-violet-50 text-violet-700 border-violet-100",
  },
  {
    title: "Prepare an entry",
    description: "Move a shipment through filing readiness.",
    articleId: "create-filing",
    icon: FileCheck2,
    tone: "bg-indigo-50 text-indigo-700 border-indigo-100",
  },
  {
    title: "Investigate a party hit",
    description: "Review restricted-party match evidence safely.",
    articleId: "screen-party",
    icon: ShieldCheck,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
] as const;

interface SupportSuggestion {
  id: string;
  moduleId: SupportModuleId;
  question: string;
  href?: string;
}

export function SupportCenterClient({ initialArticles = SUPPORT_ARTICLES }: { initialArticles?: SupportArticle[] }) {
  const [query, setQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<SupportModuleId | "all">("all");
  const [openArticleId, setOpenArticleId] = useState<string | null>("work-today");
  const [remoteArticles, setRemoteArticles] = useState<SupportArticle[] | null>(null);
  const [suggestions, setSuggestions] = useState<SupportSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const guidesRef = useRef<HTMLDivElement>(null);

  const filteredArticles = useMemo(
    () => searchSupportArticleList(initialArticles, query, selectedModule),
    [initialArticles, query, selectedModule]
  );
  const isDiscovering = query.trim().length === 0 && selectedModule === "all";
  const visibleArticles = remoteArticles ?? (isDiscovering
    ? initialArticles.filter((article) => article.popular).slice(0, 8)
    : filteredArticles);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/support/suggestions?q=${encodeURIComponent(clean)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { suggestions?: SupportSuggestion[] };
        setSuggestions(payload.suggestions ?? []);
        setSuggestionsOpen((payload.suggestions?.length ?? 0) > 0);
        setActiveSuggestion(-1);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSuggestions([]);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function runSearch(nextQuery: string) {
    const clean = nextQuery.trim();
    setQuery(nextQuery);
    setSelectedModule("all");
    setOpenArticleId(null);
    setSuggestionsOpen(false);
    setSearching(Boolean(clean));
    setRemoteArticles(null);
    if (clean.length >= 2) {
      try {
        const response = await fetch(`/api/support/search?q=${encodeURIComponent(clean)}`);
        if (response.ok) {
          const payload = (await response.json()) as { articles?: SupportArticle[] };
          setRemoteArticles(payload.articles ?? []);
        }
      } catch {
        // The local, code-owned index remains visible when semantic search is unavailable.
        setRemoteArticles(null);
      } finally {
        setSearching(false);
      }
    } else {
      setSearching(false);
    }
    requestAnimationFrame(() => guidesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function selectModule(moduleId: SupportModuleId | "all") {
    setSelectedModule(moduleId);
    setQuery("");
    setRemoteArticles(null);
    setOpenArticleId(null);
    requestAnimationFrame(() => guidesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function openQuickTask(articleId: string) {
    const article = initialArticles.find((item) => item.id === articleId);
    if (!article) return;
    setSelectedModule(article.moduleId);
    setQuery("");
    setRemoteArticles(null);
    setOpenArticleId(article.id);
    requestAnimationFrame(() => guidesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="-m-8 min-h-[calc(100vh-4rem)] bg-[#F5F5F7]">
      <section className="relative overflow-hidden border-b border-border bg-white">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_-20%,rgba(0,113,227,0.18),transparent_62%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
              <LifeBuoy className="h-3.5 w-3.5" />
              Qubere Help Center
            </div>
            <h1 className="text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
              Get an answer. Keep the entry moving.
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
              Search practical guidance for the exact task in front of you — from document intake to
              post-entry recovery.
            </p>

            <div className="relative mx-auto mt-7 max-w-2xl text-left">
              <Search
                className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="search"
                role="combobox"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedModule("all");
                  setOpenArticleId(null);
                  setRemoteArticles(null);
                }}
                onFocus={() => setSuggestionsOpen(suggestions.length > 0)}
                onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" && suggestionsOpen) {
                    event.preventDefault();
                    setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
                  } else if (event.key === "ArrowUp" && suggestionsOpen) {
                    event.preventDefault();
                    setActiveSuggestion((current) => Math.max(current - 1, 0));
                  } else if (event.key === "Escape") {
                    setSuggestionsOpen(false);
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    const selected = suggestions[activeSuggestion];
                    void runSearch(selected?.question ?? query);
                  }
                }}
                placeholder="Search: How do I attach an invoice to a shipment?"
                aria-label="Search Qubere help"
                aria-autocomplete="list"
                aria-expanded={suggestionsOpen}
                aria-controls="support-search-suggestions"
                aria-activedescendant={activeSuggestion >= 0 ? `support-suggestion-${suggestions[activeSuggestion]?.id}` : undefined}
                className="h-15 w-full rounded-2xl border border-[#D2D2D7] bg-white pl-13 pr-20 text-sm text-ink shadow-[0_14px_40px_-20px_rgba(0,70,140,0.45)] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setRemoteArticles(null);
                    setSuggestions([]);
                  }}
                  aria-label="Clear search"
                  className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <kbd className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-border bg-surface-muted px-2 py-1 text-[10px] font-semibold text-ink-muted sm:inline-flex">
                  ⌘ K
                </kbd>
              )}
              {suggestionsOpen && (
                <div
                  id="support-search-suggestions"
                  role="listbox"
                  className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-border bg-white p-1.5 shadow-xl"
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.id}
                      id={`support-suggestion-${suggestion.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeSuggestion}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveSuggestion(index)}
                      onClick={() => void runSearch(suggestion.question)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left",
                        index === activeSuggestion ? "bg-blue-50 text-brand" : "text-ink hover:bg-surface-muted"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{suggestion.question}</span>
                        <span className="mt-0.5 block text-[10px] text-ink-muted">
                          {getSupportModule(suggestion.moduleId).shortName}
                        </span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-medium text-ink-muted">Popular:</span>
              {POPULAR_SEARCHES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => void runSearch(item)}
                  className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:border-brand/30 hover:bg-blue-50 hover:text-brand"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_370px]">
          <div className="min-w-0 space-y-10">
            <section aria-labelledby="quick-tasks-title">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Fast paths</p>
                  <h2 id="quick-tasks-title" className="mt-1 text-xl font-bold tracking-tight text-ink">
                    Common broker tasks
                  </h2>
                </div>
                <span className="hidden text-xs text-ink-muted sm:block">Guidance based on the current Qubere product</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {QUICK_TASKS.map((task) => {
                  const Icon = task.icon;
                  return (
                    <button
                      key={task.articleId}
                      type="button"
                      onClick={() => openQuickTask(task.articleId)}
                      className="group rounded-2xl border border-border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-md"
                    >
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl border", task.tone)}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-ink group-hover:text-brand">{task.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-ink-muted">{task.description}</p>
                      <ArrowRight className="mt-3 h-3.5 w-3.5 text-ink-muted transition group-hover:translate-x-1 group-hover:text-brand" />
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="modules-title">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Browse</p>
                <h2 id="modules-title" className="mt-1 text-xl font-bold tracking-tight text-ink">
                  Help by module
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SUPPORT_MODULES.map((supportModule) => {
                  const Icon = MODULE_ICONS[supportModule.icon];
                  const count = initialArticles.filter((article) => article.moduleId === supportModule.id).length;
                  return (
                    <button
                      key={supportModule.id}
                      type="button"
                      onClick={() => selectModule(supportModule.id)}
                      className={cn(
                        "group flex min-h-36 flex-col rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                        selectedModule === supportModule.id ? "border-brand ring-3 ring-brand/10" : "border-border hover:border-brand/25"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", supportModule.accent)}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-semibold text-ink-muted">
                          {count} guides
                        </span>
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-ink group-hover:text-brand">{supportModule.name}</h3>
                      <p className="mt-1 text-xs leading-5 text-ink-muted">{supportModule.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section ref={guidesRef} aria-labelledby="guides-title" className="scroll-mt-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                    {query ? "Search results" : selectedModule === "all" ? "Most used" : "Module guide"}
                  </p>
                  <h2 id="guides-title" className="mt-1 text-xl font-bold tracking-tight text-ink">
                    {query
                      ? `Answers for “${query}”`
                      : selectedModule === "all"
                        ? "Popular questions"
                        : getSupportModule(selectedModule).name}
                  </h2>
                  <p className="mt-1 text-xs text-ink-muted" role="status">
                    {searching ? "Searching product help…" : `${visibleArticles.length} ${visibleArticles.length === 1 ? "guide" : "guides"}`}
                    {selectedModule !== "all" ? ` in ${getSupportModule(selectedModule).shortName}` : ""}
                  </p>
                </div>
                {(query || selectedModule !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setSelectedModule("all");
                      setOpenArticleId("work-today");
                      setRemoteArticles(null);
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-brand hover:bg-blue-50"
                  >
                    Show all help
                  </button>
                )}
              </div>

              {visibleArticles.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                  {visibleArticles.map((article) => (
                    <ArticleRow
                      key={article.id}
                      article={article}
                      isOpen={openArticleId === article.id}
                      onToggle={() => setOpenArticleId((current) => (current === article.id ? null : article.id))}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#C7C7CC] bg-white px-6 py-12 text-center">
                  <FolderSearch2 className="mx-auto h-9 w-9 text-ink-muted" />
                  <h3 className="mt-3 text-sm font-semibold text-ink">No exact guide found</h3>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-ink-muted">
                    Try fewer words, search by the object you are working on, or ask AI Support for a starting point.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setSelectedModule("all");
                      setRemoteArticles(null);
                    }}
                    className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-hover"
                  >
                    Browse all modules
                  </button>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-muted">
                  <ExternalLink className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink">Looking for company information?</h2>
                  <p className="mt-1 text-xs leading-5 text-ink-muted">
                    Product help stays here. Visit Qubere’s website for company, platform, and contact information.
                  </p>
                </div>
              </div>
              <Link
                href="https://qubere.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-semibold text-ink hover:bg-surface-muted"
              >
                About Qubere <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </section>
          </div>

          <SupportAgent />
        </div>
      </div>
    </div>
  );
}

function ArticleRow({
  article,
  isOpen,
  onToggle,
}: {
  article: SupportArticle;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const supportModule = getSupportModule(article.moduleId);
  const panelId = `support-answer-${article.id}`;

  return (
    <article className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-surface-muted/70 sm:px-6"
      >
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">{supportModule.shortName}</span>
          <h3 className="mt-1 text-sm font-semibold leading-5 text-ink">{article.question}</h3>
        </div>
        <ChevronDown
          className={cn("mt-2 h-4 w-4 shrink-0 text-ink-muted transition-transform", isOpen && "rotate-180 text-brand")}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div id={panelId} className="border-t border-border/70 bg-[#FBFBFD] px-5 py-5 sm:px-6">
          <p className="text-sm leading-6 text-ink">{article.answer}</p>
          <ol className="mt-4 space-y-3">
            {article.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-xs leading-5 text-ink-muted">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-brand">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {article.href && article.actionLabel && (
            <Link
              href={article.href}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-hover"
            >
              {article.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <p className="mt-4 text-[10px] leading-4 text-ink-muted">
            Available actions can vary by account configuration, country, data mode, role, and permission.
          </p>
        </div>
      )}
    </article>
  );
}
