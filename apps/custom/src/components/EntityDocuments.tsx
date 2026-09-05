"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Link2, Loader2, Search, Unlink } from "lucide-react";
import { documentViewUrl } from "@/lib/documentUrl";
import { caughtMessage } from "@/lib/utils";

export type DocumentAssociationEntityType = "SHIPMENT" | "PARTY" | "PRODUCT" | "LICENSE" | "FILING";

interface AssociationDocument {
  id: string;
  fileName: string;
  docType: string;
  documentType: string | null;
  status: string;
  confidence: number | null;
  createdAt: string;
  source: string;
}

interface Association {
  id: string;
  documentId: string;
  relationshipType: string;
  source: string;
  linkedAt: string;
  document: AssociationDocument;
}

interface SearchResultDoc {
  id: string;
  fileName: string;
  docType: string;
}

interface EntityDocumentsProps {
  entityType: DocumentAssociationEntityType;
  entityId: string;
  /** Optional: hides the "Link a document" affordance for read-only contexts. */
  canManage?: boolean;
}

function formatRelationshipType(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Reusable "Linked Documents" panel for any DocumentAssociation-backed entity.
 * Fetches and manages its own state so it can be dropped onto Shipment,
 * Party, Product, License, or Filing detail pages unmodified.
 */
export function EntityDocuments({ entityType, entityId, canManage = true }: EntityDocumentsProps) {
  const [associations, setAssociations] = useState<Association[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultDoc[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkingDocId, setLinkingDocId] = useState<string | null>(null);

  const loadAssociations = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/document-associations?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to load linked documents");
      setAssociations(data.associations ?? []);
      setLoadError(null);
    } catch (err) {
      setLoadError(caughtMessage(err, "Failed to load linked documents"));
    }
  }, [entityType, entityId]);

  useEffect(() => {
    loadAssociations();
  }, [loadAssociations]);

  const runSearch = async (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/documents?search=${encodeURIComponent(term)}&pageSize=8`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSearchResults(data.documents ?? []);
    } finally {
      setSearching(false);
    }
  };

  const linkDoc = async (documentId: string) => {
    setLinkingDocId(documentId);
    try {
      const res = await fetch("/api/document-associations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, entityType, entityId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to link document");
      await loadAssociations();
      setSearchTerm("");
      setSearchResults([]);
      setIsLinking(false);
    } catch (err) {
      alert(caughtMessage(err, "Failed to link document"));
    } finally {
      setLinkingDocId(null);
    }
  };

  const unlink = async (associationId: string) => {
    setUnlinkingId(associationId);
    try {
      const res = await fetch(`/api/document-associations/${associationId}/unlink`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to unlink document");
      setAssociations((prev) => prev?.filter((a) => a.id !== associationId) ?? null);
    } catch (err) {
      alert(caughtMessage(err, "Failed to unlink document"));
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-border shadow-2xs space-y-4">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
        <div className="flex items-center space-x-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Linked Documents</h3>
          {associations && (
            <span className="text-[11px] font-semibold text-brand bg-brand/10 border border-brand/20 px-2.5 py-0.5 rounded-full">
              {associations.length}
            </span>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setIsLinking((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-white hover:bg-surface-muted text-ink text-[11px] font-medium transition-colors cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5 text-brand" />
            {isLinking ? "Cancel" : "Link Document"}
          </button>
        )}
      </div>

      {isLinking && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Search documents by file name…"
              className="w-full pl-8 pr-3 py-2 bg-surface-muted border border-border rounded-xl text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          {searching && <p className="text-[11px] text-ink-muted">Searching…</p>}
          {!searching && searchTerm && searchResults.length === 0 && (
            <p className="text-[11px] text-ink-muted">No matching documents.</p>
          )}
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {searchResults.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-surface-muted/60 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span className="truncate font-medium text-ink">{doc.fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => linkDoc(doc.id)}
                  disabled={linkingDocId === doc.id}
                  className="shrink-0 px-2 py-1 rounded-lg bg-brand text-white text-[11px] font-semibold hover:bg-brand/90 disabled:opacity-50 cursor-pointer"
                >
                  {linkingDocId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Link"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadError && <p className="text-[11px] text-red-600">{loadError}</p>}

      {associations === null && !loadError && (
        <p className="text-[11px] text-ink-muted">Loading…</p>
      )}

      {associations && associations.length === 0 && (
        <p className="text-[11px] text-ink-muted">No documents linked yet.</p>
      )}

      {associations && associations.length > 0 && (
        <div className="space-y-2">
          {associations.map((assoc) => (
            <a
              key={assoc.id}
              href={documentViewUrl(assoc.documentId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border bg-surface-muted/60 hover:bg-surface-muted transition-colors text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-ink-muted shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-ink truncate">{assoc.document.fileName}</p>
                  <p className="text-[10px] text-ink-muted mt-0.5">
                    {formatRelationshipType(assoc.relationshipType)} · linked{" "}
                    {new Date(assoc.linkedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    unlink(assoc.id);
                  }}
                  disabled={unlinkingId === assoc.id}
                  title="Unlink this document"
                  className="p-1 rounded-lg hover:bg-red-50 text-ink-muted hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {unlinkingId === assoc.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                  ) : (
                    <Unlink className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
