"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Package, Users, ArrowRight, X } from "lucide-react";
import { Badge } from "@/components/ui";

export interface SearchResultItem {
  id: string;
  kind: "party" | "product";
  title: string;
  subtitle: string;
  status: string;
  reviewStatus?: string | null;
  href: string;
}

export function OmniboxSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut (⌘K / Ctrl+K) handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search fetcher
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setSelectedIndex(0);
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        // Silent error fallback
      }
      if (!controller.signal.aborted) setLoading(false);
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Modal keyboard navigation (Up, Down, Enter, Escape)
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false);
    router.push(item.href);
  };

  return (
    <>
      {/* Trigger Button in App Top Bar */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white border border-border hover:border-border-hover text-ink-muted hover:text-ink text-xs font-medium transition-all shadow-2xs cursor-pointer group min-w-[200px] max-w-[320px] w-full justify-between"
      >
        <div className="flex items-center space-x-2 truncate">
          <Search className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand transition-colors shrink-0" />
          <span className="truncate">Search parties & products...</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted bg-surface-muted border border-border rounded-md shrink-0">
          ⌘K
        </kbd>
      </button>

      {/* Omnibox Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150">
          {/* Backdrop click to close */}
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />

          <div
            onKeyDown={handleModalKeyDown}
            className="relative w-full max-w-2xl bg-white rounded-2xl border border-border shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150"
          >
            {/* Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-border gap-3">
              <Search className="w-5 h-5 text-brand shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search across Party & Product master records..."
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted outline-none font-medium"
              />
              {loading && <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-muted text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results List Area */}
            <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
              {!query.trim() ? (
                <div className="p-8 text-center text-xs text-ink-muted space-y-1">
                  <p className="font-semibold text-ink">Universal Search Omnibox</p>
                  <p>Type a party name, internal code, product name, SKU, or tariff code.</p>
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="p-8 text-center text-xs text-ink-muted">
                  No parties or products matched &quot;{query}&quot;.
                </div>
              ) : (
                results.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={`${item.kind}-${item.id}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? "bg-brand/10 border border-brand/20 shadow-2xs"
                          : "hover:bg-surface-muted border border-transparent"
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            item.kind === "party"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-purple-50 text-purple-600"
                          }`}
                        >
                          {item.kind === "party" ? (
                            <Users className="w-4 h-4" />
                          ) : (
                            <Package className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                              {item.kind}
                            </span>
                            <Badge variant={item.status === "ACTIVE" ? "success" : "neutral"}>
                              {item.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-bold text-ink truncate">{item.title}</p>
                          <p className="text-xs text-ink-muted truncate">{item.subtitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 pl-3">
                        <span className="text-xs font-semibold text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                          View
                        </span>
                        <ArrowRight className="w-4 h-4 text-brand" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2 bg-surface-muted/60 border-t border-border flex items-center justify-between text-[11px] text-ink-muted">
              <span>Use ↑ ↓ to navigate, Enter to select, Esc to close</span>
              <span>{results.length} result(s)</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
