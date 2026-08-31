"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Bot,
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
  MessageCircle,
  PackageSearch,
  ReceiptText,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SUPPORT_ARTICLES,
  SUPPORT_MODULES,
  getSupportModule,
  searchSupportArticles,
  type SupportArticle,
  type SupportModuleId,
} from "./supportContent";

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

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    text: "Hi — I’m the support chat preview. Ask how to complete a task and I’ll point you to the right Qubere workflow.",
  },
];

function mockSupportReply(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("document") || text.includes("invoice") || text.includes("attach")) {
    return "Start in Documents. Open the file, confirm processing is complete, and select the correct shipment if it is unattached. Review extracted fields before using them in a filing.";
  }
  if (text.includes("7501") || text.includes("filing") || text.includes("transmit") || text.includes("entry")) {
    return "Open the shipment’s Pre-filing Readiness first. Resolve every blocker, then open its filing to review the declaration, totals, filing snapshot, and available Form 7501 or transmission actions.";
  }
  if (text.includes("screen") || text.includes("party") || text.includes("compliance") || text.includes("hit")) {
    return "Open Compliance and inspect the match evidence before dispositioning the result. Compare the name, country, address, identifiers, list source, and score — a similar name alone is not proof of identity.";
  }
  if (text.includes("billing") || text.includes("invoice") || text.includes("rate")) {
    return "Open Billing Exceptions for a missing or zero-rated charge. Check the operational event, client scope, rate-card version, and rule mapping before resolving or waiving the exception.";
  }
  return "This preview uses scripted guidance, so it cannot inspect your account yet. Search the help center for the task, or browse the module that owns the record. The live support assistant will be connected separately.";
}

export function SupportCenterClient() {
  const [query, setQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<SupportModuleId | "all">("all");
  const [openArticleId, setOpenArticleId] = useState<string | null>("work-today");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const guidesRef = useRef<HTMLDivElement>(null);

  const filteredArticles = useMemo(
    () => searchSupportArticles(query, selectedModule),
    [query, selectedModule]
  );
  const isDiscovering = query.trim().length === 0 && selectedModule === "all";
  const visibleArticles = isDiscovering
    ? SUPPORT_ARTICLES.filter((article) => article.popular).slice(0, 8)
    : filteredArticles;

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

  function runSearch(nextQuery: string) {
    setQuery(nextQuery);
    setSelectedModule("all");
    setOpenArticleId(null);
    requestAnimationFrame(() => guidesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function selectModule(moduleId: SupportModuleId | "all") {
    setSelectedModule(moduleId);
    setQuery("");
    setOpenArticleId(null);
    requestAnimationFrame(() => guidesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function openQuickTask(articleId: string) {
    const article = SUPPORT_ARTICLES.find((item) => item.id === articleId);
    if (!article) return;
    setSelectedModule(article.moduleId);
    setQuery("");
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
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedModule("all");
                  setOpenArticleId(null);
                }}
                placeholder="Search: How do I attach an invoice to a shipment?"
                aria-label="Search Qubere help"
                className="h-15 w-full rounded-2xl border border-[#D2D2D7] bg-white pl-13 pr-20 text-sm text-ink shadow-[0_14px_40px_-20px_rgba(0,70,140,0.45)] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
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
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-medium text-ink-muted">Popular:</span>
              {POPULAR_SEARCHES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => runSearch(item)}
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
                  const count = SUPPORT_ARTICLES.filter((article) => article.moduleId === supportModule.id).length;
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
                    {visibleArticles.length} {visibleArticles.length === 1 ? "guide" : "guides"}
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
                    Try fewer words, search by the object you are working on, or ask the support chat preview for a starting point.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setSelectedModule("all");
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

          <SupportChatMock />
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

function SupportChatMock() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [input, setInput] = useState("");
  const nextIdRef = useRef(2);
  const conversationRef = useRef<HTMLDivElement>(null);

  function sendMessage(text: string) {
    const cleanText = text.trim();
    if (!cleanText) return;
    const userId = nextIdRef.current++;
    const assistantId = nextIdRef.current++;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", text: cleanText },
      { id: assistantId, role: "assistant", text: mockSupportReply(cleanText) },
    ]);
    setInput("");
    requestAnimationFrame(() => {
      conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <aside className="xl:sticky xl:top-6" aria-label="Support chat preview">
      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_50px_-25px_rgba(0,45,90,0.35)]">
        <div className="relative overflow-hidden border-b border-blue-100 bg-gradient-to-br from-[#F0F7FF] via-white to-[#F7F5FF] p-5">
          <div className="absolute -right-8 -top-12 h-32 w-32 rounded-full bg-brand/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shadow-sm shadow-brand/20">
                <Bot className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-ink">Support chat</h2>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                    Mock
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">Workflow guidance preview</p>
              </div>
            </div>
            <Sparkles className="h-4 w-4 text-brand" />
          </div>
        </div>

        <div className="border-b border-amber-100 bg-amber-50/80 px-5 py-3">
          <p className="text-[10px] leading-4 text-amber-800">
            Design preview only. Messages are not sent to Qubere Support and replies are scripted.
          </p>
        </div>

        <div ref={conversationRef} className="h-86 space-y-4 overflow-y-auto px-4 py-5" aria-live="polite">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-3.5 py-3 text-xs leading-5",
                  message.role === "user"
                    ? "rounded-br-md bg-brand text-white"
                    : "rounded-bl-md border border-border bg-surface-muted text-ink"
                )}
              >
                {message.text}
              </div>
            </div>
          ))}

          {messages.length === 1 && (
            <div className="space-y-2 pt-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Try asking</p>
              {["Why is my filing blocked?", "How do I attach an invoice?", "How do I review a party hit?"].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-2.5 text-left text-xs font-medium text-ink transition hover:border-brand/30 hover:bg-blue-50 hover:text-brand"
                >
                  {prompt}
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="border-t border-border p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-muted p-2 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/10">
            <label htmlFor="support-chat-input" className="sr-only">Ask the support chat preview</label>
            <textarea
              id="support-chat-input"
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask how to do something…"
              className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-xs leading-5 text-ink outline-none placeholder:text-ink-muted"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send mock support message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-2 text-center text-[9px] text-ink-muted">Mock response • No account data is accessed</p>
        </form>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand">
            <Scale className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-ink">Regulated decisions still need review</h3>
            <p className="mt-1 text-[10px] leading-4 text-ink-muted">
              Help content explains the workflow. It does not replace a licensed broker’s classification, valuation, origin, admissibility, or filing judgment.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
