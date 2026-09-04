"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  id: string;
  label: string;
  description?: string | null;
  keywords?: string;
}

export interface ComboboxProps {
  id?: string;
  label?: string;
  value: ComboboxOption | null;
  options: ComboboxOption[];
  onChange: (option: ComboboxOption | null) => void;
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  allowClear?: boolean;
}

/**
 * Search and selection in a single field. Supports local options as well as
 * server-filtered results through onQueryChange.
 */
export function Combobox({
  id: providedId,
  label,
  value,
  options,
  onChange,
  onQueryChange,
  placeholder = "Search and select",
  emptyMessage = "No matches found",
  loading = false,
  disabled = false,
  error,
  required = false,
  allowClear = true,
}: ComboboxProps) {
  const generatedId = React.useId();
  const id = providedId ?? generatedId;
  const listboxId = `${id}-listbox`;
  const errorId = `${id}-error`;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);

  const visibleOptions = React.useMemo(() => {
    if (onQueryChange) return options;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""} ${option.keywords ?? ""}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [onQueryChange, options, query]);

  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [query, visibleOptions.length]);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setOpen(true);
    onQueryChange?.(nextQuery);
  }

  function select(option: ComboboxOption) {
    onChange(option);
    setQuery("");
    setOpen(false);
  }

  const inputValue = open ? query : (value?.label ?? "");
  const activeDescendant = open && visibleOptions[highlightedIndex]
    ? `${id}-option-${visibleOptions[highlightedIndex].id}`
    : undefined;

  return (
    <div ref={rootRef} className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-ink">
          {label}{required ? " *" : ""}
        </label>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          aria-required={required}
          autoComplete="off"
          disabled={disabled}
          value={inputValue}
          placeholder={placeholder}
          onFocus={() => {
            setQuery("");
            setOpen(true);
            onQueryChange?.("");
          }}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setHighlightedIndex((index) => Math.min(index + 1, Math.max(visibleOptions.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Home" && open) {
              event.preventDefault();
              setHighlightedIndex(0);
            } else if (event.key === "End" && open) {
              event.preventDefault();
              setHighlightedIndex(Math.max(visibleOptions.length - 1, 0));
            } else if (event.key === "Enter" && open && visibleOptions[highlightedIndex]) {
              event.preventDefault();
              select(visibleOptions[highlightedIndex]);
            } else if (event.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
          className={cn(
            "w-full rounded-xl border bg-surface-muted py-2.5 pl-10 pr-10 text-xs text-ink outline-none transition-all placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-red-400" : "border-border",
          )}
        />
        {value && !open && allowClear && !disabled ? (
          <button
            type="button"
            aria-label={`Clear ${label?.toLowerCase() ?? "selection"}`}
            onClick={() => onChange(null)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-ink-muted transition-colors hover:bg-white hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        )}

        {open && !disabled && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-40 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-white p-1.5 shadow-xl"
          >
            {loading ? (
              <p className="px-3 py-3 text-xs text-ink-muted">Loading…</p>
            ) : visibleOptions.length === 0 ? (
              <p className="px-3 py-3 text-xs text-ink-muted">{emptyMessage}</p>
            ) : (
              visibleOptions.map((option, index) => {
                const selected = option.id === value?.id;
                return (
                  <button
                    key={option.id}
                    id={`${id}-option-${option.id}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => select(option)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      index === highlightedIndex ? "bg-brand/10" : "hover:bg-surface-muted",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{option.label}</span>
                      {option.description && (
                        <span className="mt-0.5 block truncate text-xs text-ink-muted">{option.description}</span>
                      )}
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      {error && <p id={errorId} role="alert" className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
