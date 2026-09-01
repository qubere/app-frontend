"use client";

import { useCallback, useEffect, useState } from "react";
import { documentViewUrl } from "@/lib/documentUrl";
import { caughtMessage } from "@/lib/utils";

interface DocumentRow {
  id: string;
  fileName: string;
  docType: string;
  documentType: string | null;
  status: string;
  confidence: number | null;
  createdAt: string;
  shipmentId: string | null;
  shipmentNumber: string | null;
  clientName: string | null;
  linkedEntityCount: number;
}

interface DocumentsResponse {
  documents: DocumentRow[];
  page: number;
  pageSize: number;
  total: number;
}

const ENTITY_TYPES = ["SHIPMENT", "PARTY", "PRODUCT", "LICENSE", "FILING"] as const;
const PAGE_SIZE = 25;

function displayDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function TradeRepositoryClient({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState("");
  const [status, setStatus] = useState("");
  const [linkedEntityType, setLinkedEntityType] = useState<(typeof ENTITY_TYPES)[number] | "">("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set("search", search.trim());
      if (docType) params.set("docType", docType);
      if (status) params.set("status", status);
      if (linkedEntityType) params.set("linkedEntityType", linkedEntityType);
      const res = await fetch(`/api/documents?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load documents (${res.status})`);
      const data: DocumentsResponse = await res.json();
      setRows(data.documents);
      setTotal(data.total);
    } catch (err) {
      setError(caughtMessage(err, "Failed to load documents."));
    } finally {
      setLoading(false);
    }
  }, [page, search, docType, status, linkedEntityType]);

  useEffect(() => {
    load();
  }, [load]);

  // Filter changes always reset to page 1 -- a stale page number past the new total is confusing, not helpful.
  useEffect(() => {
    setPage(1);
  }, [search, docType, status, linkedEntityType]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-extrabold text-ink">Trade Repository</h1>
        <p className="text-sm text-ink-muted">
          Every document in this account, searchable across shipments, parties, products, licenses, and filings.
          {canManage ? " Open a file to link or unlink it from its entities." : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search file name, doc type, shipment, client..."
          className="flex-1 min-w-[240px] px-3.5 py-2 bg-surface-muted border border-border rounded-xl text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <input
          type="text"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          placeholder="Doc type"
          className="w-32 px-3.5 py-2 bg-surface-muted border border-border rounded-xl text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <input
          type="text"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="Status"
          className="w-32 px-3.5 py-2 bg-surface-muted border border-border rounded-xl text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <select
          value={linkedEntityType}
          onChange={(e) => setLinkedEntityType(e.target.value as (typeof ENTITY_TYPES)[number] | "")}
          className="px-3.5 py-2 bg-surface-muted border border-border rounded-xl text-xs text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Linked to: any entity</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              Linked to: {t}
            </option>
          ))}
        </select>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="rounded-2xl bg-white border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">File</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Type</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Status</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Shipment</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Linked to</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-ink-muted">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-ink-muted">
                  No documents match these filters.
                </td>
              </tr>
            ) : (
              rows.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-2.5">
                    <a
                      href={documentViewUrl(doc.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      {doc.fileName}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink">{doc.documentType ?? doc.docType}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-muted">{doc.status}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-muted">{doc.shipmentNumber ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-muted">
                    {doc.linkedEntityCount > 0 ? `${doc.linkedEntityCount} entities` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-muted whitespace-nowrap">{displayDate(doc.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>
          {total === 0 ? "0 documents" : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, total)} of ${total} documents`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-xl border border-border bg-white font-semibold text-ink disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-muted"
          >
            Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="px-3 py-1.5 rounded-xl border border-border bg-white font-semibold text-ink disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-muted"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
