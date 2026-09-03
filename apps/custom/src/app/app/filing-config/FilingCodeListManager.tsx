/**
 * Filing Code List Manager
 *
 * A single combined UI (per product requirement -- these three tables are
 * one tab, not split across separate ones) for the Header -> Item ->
 * Translation hierarchy:
 *   - Header list (Country/Procedure/ListType/Version/validity), with the
 *     only true FK-driven dropdown in this hierarchy: List Type, sourced
 *     from FilingCodeListType via /api/filing-config/list-types.
 *   - Drilling into a header manages its Items inline, each Item carrying
 *     its Translations as a nested repeatable group.
 *   - A CSV upload path that can create/update Header + Item + Translation
 *     rows together in one file (see codeListCsv.ts for the column format),
 *     plus a template download.
 *
 * countryIso2/procedureCode/version are free-text on this table's DDL (no
 * FK to another master), so they render as plain inputs, not dropdowns --
 * only List Type has a real relationship to show as one.
 */

"use client";

import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, ChevronLeft, Upload, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/Modal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeaderRow {
  codeListId: string;
  countryIso2: string;
  procedureCode: string;
  listType: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  codeListType?: { listTypeName: string } | null;
  _count?: { items: number };
}

interface TranslationRow {
  translationId?: string;
  languageCode: string;
  displayName: string;
  description: string | null;
}

interface ItemRow {
  itemId: string;
  codeListId: string;
  code: string;
  attributes: Record<string, unknown>;
  isDeprecated: boolean;
  translations: TranslationRow[];
}

interface UploadSummary {
  headersCreated: number;
  headersUpdated: number;
  itemsCreated: number;
  itemsUpdated: number;
  translationsUpserted: number;
  rowsFailed: number;
  rowResults: { rowNumber: number; status: string; message?: string }[];
  fileErrors: { column: string | null; message: string }[];
}

function errorFromResponse(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: { message?: string } }).error;
    if (err && typeof err.message === "string") return err.message;
  }
  return fallback;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Attributes key/value <-> JSON object conversion
//
// FilingCodeListItem.attributes is stored as an arbitrary JSON object, but
// asking an operator to hand-type valid JSON is unnecessary friction for
// what's almost always a flat set of scalar properties (a tax rate, a flag,
// a short code). This renders/edits it as a plain key/value list instead;
// each value is opportunistically JSON-parsed on save so "0.21" becomes a
// number and "true" a boolean, exactly as if the user had written {"taxRate":
// 0.21} by hand -- anything that doesn't parse as JSON is kept as text.
// ---------------------------------------------------------------------------

function attributesToEntries(attributes: Record<string, unknown>): { key: string; value: string }[] {
  return Object.entries(attributes ?? {}).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}

function parseAttributeValue(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return text;
  }
}

function entriesToAttributes(entries: { key: string; value: string }[]): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const { key, value } of entries) {
    const trimmedKey = key.trim();
    if (trimmedKey === "") continue;
    attributes[trimmedKey] = parseAttributeValue(value);
  }
  return attributes;
}

function findDuplicateKeys(entries: { key: string; value: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { key } of entries) {
    const trimmedKey = key.trim();
    if (trimmedKey === "") continue;
    if (seen.has(trimmedKey)) duplicates.add(trimmedKey);
    seen.add(trimmedKey);
  }
  return Array.from(duplicates);
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function FilingCodeListManager() {
  const [headers, setHeaders] = useState<HeaderRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingHeader, setCreatingHeader] = useState(false);
  const [editingHeader, setEditingHeader] = useState<HeaderRow | null>(null);
  const [confirmDeleteHeader, setConfirmDeleteHeader] = useState<HeaderRow | null>(null);
  const [activeHeader, setActiveHeader] = useState<HeaderRow | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadHeaders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/filing-config/code-list-headers");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorFromResponse(data, "Failed to load code list headers."));
      setHeaders(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHeaders();
  }, []);

  async function handleDeleteHeader(row: HeaderRow) {
    setError(null);
    try {
      const res = await fetch(`/api/filing-config/code-list-headers/${row.codeListId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorFromResponse(data, "Delete failed."));
      setConfirmDeleteHeader(null);
      await loadHeaders();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (activeHeader) {
    return (
      <ItemManager
        header={activeHeader}
        onBack={() => {
          setActiveHeader(null);
          loadHeaders();
        }}
      />
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border shadow-2xs p-6">
      <div className="flex items-center justify-between mb-5 border-b border-border pb-4">
        <div>
          <p className="text-sm font-bold text-ink">Filing Code List</p>
          <p className="text-xs text-ink-muted mt-0.5 max-w-xl">
            Country/procedure-scoped customs reference codes (headers, items, and per-language translations)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowUpload(true)}>
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload CSV
          </Button>
          <Button onClick={() => setCreatingHeader(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Header
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-ink-muted bg-surface-muted">
              <th className="py-2.5 px-3 font-bold">Country</th>
              <th className="py-2.5 px-3 font-bold">Procedure Code</th>
              <th className="py-2.5 px-3 font-bold">List Type</th>
              <th className="py-2.5 px-3 font-bold">Version</th>
              <th className="py-2.5 px-3 font-bold">Effective From</th>
              <th className="py-2.5 px-3 font-bold">Effective To</th>
              <th className="py-2.5 px-3 font-bold">Active</th>
              <th className="py-2.5 px-3 font-bold">Items</th>
              <th className="py-2.5 px-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={9} className="py-8 text-center text-ink-muted">Loading...</td></tr>
            ) : (headers ?? []).length === 0 ? (
              <tr><td colSpan={9} className="py-8 text-center text-ink-muted">No code list headers yet.</td></tr>
            ) : (
              (headers ?? []).map((row) => (
                <tr key={row.codeListId} className="hover:bg-surface-muted">
                  <td className="py-2.5 px-3 text-ink font-semibold">{row.countryIso2}</td>
                  <td className="py-2.5 px-3 text-ink">{row.procedureCode}</td>
                  <td className="py-2.5 px-3 text-ink">{row.codeListType?.listTypeName ?? row.listType}</td>
                  <td className="py-2.5 px-3 text-ink">{row.version}</td>
                  <td className="py-2.5 px-3 text-ink">{formatDate(row.effectiveFrom)}</td>
                  <td className="py-2.5 px-3 text-ink">{formatDate(row.effectiveTo)}</td>
                  <td className="py-2.5 px-3 text-ink">{row.isActive ? "Yes" : "No"}</td>
                  <td className="py-2.5 px-3 text-ink">
                    <button
                      type="button"
                      onClick={() => setActiveHeader(row)}
                      className="text-brand font-semibold hover:underline"
                    >
                      {row._count?.items ?? 0} item(s)
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveHeader(row)}
                        className="p-1.5 rounded-lg border border-border hover:bg-surface-muted"
                        aria-label="Manage items"
                        title="Manage items"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingHeader(row)}
                        className="p-1.5 rounded-lg border border-border hover:bg-surface-muted"
                        aria-label="Edit header"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteHeader(row)}
                        className="p-1.5 rounded-lg border border-border text-red-600 hover:bg-red-50"
                        aria-label="Delete header"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(creatingHeader || editingHeader) && (
        <HeaderFormModal
          initial={editingHeader}
          onClose={() => {
            setCreatingHeader(false);
            setEditingHeader(null);
          }}
          onSaved={async () => {
            setCreatingHeader(false);
            setEditingHeader(null);
            await loadHeaders();
          }}
        />
      )}

      {confirmDeleteHeader && (
        <Modal isOpen onClose={() => setConfirmDeleteHeader(null)} titleId="delete-header-title">
          <ModalHeader titleId="delete-header-title" title="Delete this code list header?" onClose={() => setConfirmDeleteHeader(null)} />
          <ModalBody>
            <p className="text-sm text-ink-muted">
              This deletes every item and translation under this header too (cascading delete). This cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setConfirmDeleteHeader(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDeleteHeader(confirmDeleteHeader)}>Delete</Button>
          </ModalFooter>
        </Modal>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onImported={async () => {
            await loadHeaders();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header create/edit modal
// ---------------------------------------------------------------------------

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function HeaderFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: HeaderRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = initial !== null;
  const [countryIso2, setCountryIso2] = useState(initial?.countryIso2 ?? "");
  const [procedureCode, setProcedureCode] = useState(initial?.procedureCode ?? "");
  const [listType, setListType] = useState(initial?.listType ?? "");
  const [version, setVersion] = useState(initial?.version ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(toDateInputValue(initial?.effectiveFrom ?? null));
  const [effectiveTo, setEffectiveTo] = useState(toDateInputValue(initial?.effectiveTo ?? null));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [listTypeOptions, setListTypeOptions] = useState<{ code: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/filing-config/list-types", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const codes: string[] = data.codes ?? [];
        const labels: Record<string, string> = data.optionLabels ?? {};
        setListTypeOptions(codes.map((code) => ({ code, label: labels[code] ?? code })));
      })
      .catch((err) => console.error("Failed to load list types:", err));
  }, []);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        countryIso2,
        procedureCode,
        listType,
        version,
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        isActive,
      };
      const url = isEdit ? `/api/filing-config/code-list-headers/${initial!.codeListId}` : "/api/filing-config/code-list-headers";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorFromResponse(data, "Save failed."));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} titleId="header-form-title" size="lg">
      <ModalHeader titleId="header-form-title" title={isEdit ? "Edit Code List Header" : "Add Code List Header"} onClose={onClose} />
      <ModalBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink-muted">Country (ISO2)</label>
            <Input value={countryIso2} onChange={(e) => setCountryIso2(e.target.value.toUpperCase())} maxLength={2} placeholder="NL" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink-muted">Procedure Code</label>
            <Input value={procedureCode} onChange={(e) => setProcedureCode(e.target.value)} placeholder="4000" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-ink-muted">List Type</label>
          <select
            value={listType}
            onChange={(e) => setListType(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm"
          >
            <option value="">Select...</option>
            {listTypeOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>{opt.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-ink-muted">
            Sourced from the Filing Code List Type master. Create the type there first if it&apos;s missing here.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-ink-muted">Version</label>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v2026.1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink-muted">Effective From</label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink-muted">Effective To</label>
            <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-ink-muted">Active</label>
          <select
            value={isActive ? "true" : "false"}
            onChange={(e) => setIsActive(e.target.value === "true")}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm"
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={busy || !countryIso2 || !procedureCode || !listType || !version || !effectiveFrom}>
          {busy ? "Saving..." : isEdit ? "Save Changes" : "Create Header"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Item manager (drill-down for one header)
// ---------------------------------------------------------------------------

function ItemManager({ header, onBack }: { header: HeaderRow; onBack: () => void }) {
  const [items, setItems] = useState<ItemRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ItemRow | null>(null);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/filing-config/code-list-headers/${header.codeListId}/items`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorFromResponse(data, "Failed to load items."));
      setItems(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.codeListId]);

  async function handleDelete(row: ItemRow) {
    setError(null);
    try {
      const res = await fetch(`/api/filing-config/code-list-items/${row.itemId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorFromResponse(data, "Delete failed."));
      setConfirmDelete(null);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-border shadow-2xs p-6">
      <div className="flex items-center justify-between mb-5 border-b border-border pb-4">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink mb-1.5">
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to headers
          </button>
          <p className="text-sm font-bold text-ink">
            {header.countryIso2} / {header.procedureCode} / {header.codeListType?.listTypeName ?? header.listType} / {header.version}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">Items and their per-language translations for this code list version</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Item
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-ink-muted bg-surface-muted">
              <th className="py-2.5 px-3 font-bold">Code</th>
              <th className="py-2.5 px-3 font-bold">Translations</th>
              <th className="py-2.5 px-3 font-bold">Attributes</th>
              <th className="py-2.5 px-3 font-bold">Deprecated</th>
              <th className="py-2.5 px-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-ink-muted">Loading...</td></tr>
            ) : (items ?? []).length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-ink-muted">No items yet.</td></tr>
            ) : (
              (items ?? []).map((row) => (
                <tr key={row.itemId} className="hover:bg-surface-muted">
                  <td className="py-2.5 px-3 text-ink font-semibold">{row.code}</td>
                  <td className="py-2.5 px-3 text-ink">
                    {row.translations.length === 0
                      ? "—"
                      : row.translations.map((t) => `${t.languageCode}: ${t.displayName}`).join(", ")}
                  </td>
                  <td className="py-2.5 px-3 text-ink font-mono text-[11px]">
                    {Object.keys(row.attributes ?? {}).length === 0 ? "{}" : JSON.stringify(row.attributes)}
                  </td>
                  <td className="py-2.5 px-3 text-ink">{row.isDeprecated ? "Yes" : "No"}</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditing(row)}
                        className="p-1.5 rounded-lg border border-border hover:bg-surface-muted"
                        aria-label="Edit item"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(row)}
                        className="p-1.5 rounded-lg border border-border text-red-600 hover:bg-red-50"
                        aria-label="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <ItemFormModal
          codeListId={header.codeListId}
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await loadItems();
          }}
        />
      )}

      {confirmDelete && (
        <Modal isOpen onClose={() => setConfirmDelete(null)} titleId="delete-item-title">
          <ModalHeader titleId="delete-item-title" title="Delete this item?" onClose={() => setConfirmDelete(null)} />
          <ModalBody>
            <p className="text-sm text-ink-muted">This deletes all of its translations too. This cannot be undone.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Delete</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item create/edit modal (translations nested inline)
// ---------------------------------------------------------------------------

function ItemFormModal({
  codeListId,
  initial,
  onClose,
  onSaved,
}: {
  codeListId: string;
  initial: ItemRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = initial !== null;
  const [code, setCode] = useState(initial?.code ?? "");
  const [attributeEntries, setAttributeEntries] = useState<{ key: string; value: string }[]>(
    attributesToEntries(initial?.attributes ?? {})
  );
  const [isDeprecated, setIsDeprecated] = useState(initial?.isDeprecated ?? false);
  const [translations, setTranslations] = useState<TranslationRow[]>(
    initial?.translations ?? [{ languageCode: "", displayName: "", description: "" }]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAttribute(index: number, patch: Partial<{ key: string; value: string }>) {
    setAttributeEntries((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function addAttribute() {
    setAttributeEntries((rows) => [...rows, { key: "", value: "" }]);
  }
  function removeAttribute(index: number) {
    setAttributeEntries((rows) => rows.filter((_, i) => i !== index));
  }

  function updateTranslation(index: number, patch: Partial<TranslationRow>) {
    setTranslations((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function addTranslation() {
    setTranslations((rows) => [...rows, { languageCode: "", displayName: "", description: "" }]);
  }
  function removeTranslation(index: number) {
    setTranslations((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const duplicateKeys = findDuplicateKeys(attributeEntries);
      if (duplicateKeys.length > 0) {
        throw new Error(`Duplicate attribute key(s): ${duplicateKeys.join(", ")}.`);
      }
      const attributes = entriesToAttributes(attributeEntries);

      const cleanedTranslations = translations
        .filter((t) => t.languageCode.trim() && t.displayName.trim())
        .map((t) => ({ languageCode: t.languageCode.trim(), displayName: t.displayName.trim(), description: t.description?.trim() || undefined }));

      const payload = { code, attributes, isDeprecated, translations: cleanedTranslations };
      const url = isEdit ? `/api/filing-config/code-list-items/${initial!.itemId}` : `/api/filing-config/code-list-headers/${codeListId}/items`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorFromResponse(data, "Save failed."));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} titleId="item-form-title" size="lg">
      <ModalHeader titleId="item-form-title" title={isEdit ? "Edit Code List Item" : "Add Code List Item"} onClose={onClose} />
      <ModalBody className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-ink-muted">Code</label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="BX" disabled={isEdit} className={isEdit ? "opacity-60" : undefined} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-ink-muted">Attributes</label>
          <div className="space-y-2 rounded-xl border border-border p-2 bg-surface-muted/40">
            {attributeEntries.length === 0 && (
              <p className="text-xs text-ink-muted px-2 py-1">No attributes yet.</p>
            )}
            {attributeEntries.map((entry, i) => (
              <div key={i} className="flex items-start gap-2">
                <Input
                  value={entry.key}
                  onChange={(e) => updateAttribute(i, { key: e.target.value })}
                  placeholder="Key (e.g. taxRate)"
                  className="flex-1"
                />
                <Input
                  value={entry.value}
                  onChange={(e) => updateAttribute(i, { value: e.target.value })}
                  placeholder="Value (e.g. 0.21, true, text)"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeAttribute(i)}
                  aria-label="Remove attribute"
                  className="p-2 mt-0.5 rounded-lg hover:bg-red-50 text-red-600 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addAttribute}
              className="w-full rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-ink-muted hover:bg-surface-muted"
            >
              + Add Attribute
            </button>
          </div>
          <p className="text-[11px] text-ink-muted">
            Flexible metadata, e.g. taxRate = 0.21. Values that look like a number, true/false, or JSON are stored with
            that type; anything else is stored as plain text.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-ink-muted">Deprecated</label>
          <select
            value={isDeprecated ? "true" : "false"}
            onChange={(e) => setIsDeprecated(e.target.value === "true")}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm"
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-ink-muted">Translations</label>
          <div className="space-y-2 rounded-xl border border-border p-2 bg-surface-muted/40">
            {translations.map((t, i) => (
              <div key={i} className="rounded-lg border border-border bg-white p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-ink-muted">Translation {i + 1}</span>
                  <button type="button" onClick={() => removeTranslation(i)} className="p-1 rounded hover:bg-red-50 text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={t.languageCode}
                    onChange={(e) => updateTranslation(i, { languageCode: e.target.value })}
                    placeholder="Locale (en, nl, de)"
                  />
                  <Input
                    value={t.displayName}
                    onChange={(e) => updateTranslation(i, { displayName: e.target.value })}
                    placeholder="Display name"
                  />
                </div>
                <Input
                  value={t.description ?? ""}
                  onChange={(e) => updateTranslation(i, { description: e.target.value })}
                  placeholder="Description (optional)"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addTranslation}
              className="w-full rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-ink-muted hover:bg-surface-muted"
            >
              + Add Translation
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={busy || !code.trim()}>
          {busy ? "Saving..." : isEdit ? "Save Changes" : "Create Item"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// CSV upload modal
// ---------------------------------------------------------------------------

function UploadModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSummary(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!content) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/filing-config/code-list/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, fileName: fileName ?? undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorFromResponse(data, "Upload failed."));
      setSummary(data.summary);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} titleId="upload-csv-title" size="lg">
      <ModalHeader titleId="upload-csv-title" title="Upload Code List CSV" onClose={onClose} />
      <ModalBody className="space-y-3">
        <p className="text-xs text-ink-muted">
          One row per (header, item, translation-language) combination. Header and item columns repeat across every row
          that shares them. List Type must already exist under Filing Code List Type. If Attributes (JSON) contains a
          comma, wrap the whole field in double quotes and double any inner quotes, e.g.{" "}
          <code className="font-mono">&quot;{"{"}&quot;&quot;weightKg&quot;&quot;:25{"}"}&quot;</code> — see the template.
        </p>
        {/*
          A plain anchor, not next/link: this is a file download served by an
          API route, and client-side navigation to it would be handed a CSV
          body it cannot render. `download` also exempts it from
          @next/next/no-html-link-for-pages, matching the party/product
          import wizards' template-download links.
        */}
        <a
          href="/api/filing-config/code-list/template"
          download
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
        >
          <Download className="w-3.5 h-3.5" />
          Download CSV template
        </a>
        <div className="space-y-1">
          <label className="text-xs font-bold text-ink-muted">CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full text-xs rounded-xl border border-border px-3 py-2"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {summary && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <SummaryStat label="Headers created" value={summary.headersCreated} />
              <SummaryStat label="Headers updated" value={summary.headersUpdated} />
              <SummaryStat label="Items created" value={summary.itemsCreated} />
              <SummaryStat label="Items updated" value={summary.itemsUpdated} />
              <SummaryStat label="Translations" value={summary.translationsUpserted} />
              <SummaryStat label="Rows failed" value={summary.rowsFailed} tone={summary.rowsFailed > 0 ? "error" : "default"} />
            </div>
            {summary.fileErrors.length > 0 && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 space-y-1">
                {summary.fileErrors.map((e, i) => (
                  <p key={i}>{e.column ? `${e.column}: ` : ""}{e.message}</p>
                ))}
              </div>
            )}
            {summary.rowResults.filter((r) => r.status === "FAILED").length > 0 && (
              <div className="max-h-40 overflow-y-auto text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 space-y-1">
                {summary.rowResults
                  .filter((r) => r.status === "FAILED")
                  .map((r) => (
                    <p key={r.rowNumber}>Row {r.rowNumber}: {r.message}</p>
                  ))}
              </div>
            )}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button onClick={handleUpload} disabled={busy || !content}>
          {busy ? (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</span>
          ) : (
            "Upload"
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function SummaryStat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "error" }) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${tone === "error" && value > 0 ? "border-red-200 bg-red-50" : "border-border bg-surface-muted"}`}>
      <p className={`text-lg font-extrabold ${tone === "error" && value > 0 ? "text-red-700" : "text-ink"}`}>{value}</p>
      <p className="text-[10px] text-ink-muted">{label}</p>
    </div>
  );
}
