"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Plus, Unlink, Loader2, X, Files, GripVertical, FileText } from "lucide-react";
import { DocumentUploadModal } from "@/components/DocumentUploadModal";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { checkRequiredDocumentTypes } from "@/lib/requiredDocumentTypes";
import { caughtMessage } from "@/lib/utils";

interface DocumentItem {
  id: string;
  docType: string;
  fileName: string;
  pageCount: number | null;
  confidence: number | null;
  status: string;
  fileUrl?: string | null;
  /** "passed" | "failed" | "pending" — whether parsing produced a usable result. */
  parseState?: "passed" | "failed" | "pending";
}

interface ShipmentDocumentsSectionProps {
  shipmentId: string;
  shipmentNumber?: string;
  documents: DocumentItem[];
  originStatus?: string;
  activeDocId: string | undefined;
  onSelectDoc: (docId: string) => void;
}

const DETACH_TITLE_ID = "detach-document-title";

function formatDocTypeName(docType: string): string {
  if (!docType || docType === "AUTO_DETECT") return "Trade Document";
  if (docType.includes("_") || docType === docType.toUpperCase()) {
    return docType
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return docType;
}

export function ShipmentDocumentsSection({
  shipmentId,
  shipmentNumber,
  documents: initialDocs,
  originStatus = "Not Applicable",
  activeDocId,
  onSelectDoc,
}: ShipmentDocumentsSectionProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);
  const [docPendingDetach, setDocPendingDetach] = useState<{ id: string; fileName: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDetachPending, setBulkDetachPending] = useState(false);
  const [bulkDetaching, setBulkDetaching] = useState(false);
  const dragIndexRef = useRef<number | null>(null);

  const toggleSelected = (docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  useEffect(() => {
    const handleOpen = () => setIsModalOpen(true);
    window.addEventListener("qubere:open-upload-modal", handleOpen);
    return () => window.removeEventListener("qubere:open-upload-modal", handleOpen);
  }, []);

  // Map unique documents by ID to prevent key duplication while retaining all uploaded files
  const uniqueDocs = Array.from(
    new Map(initialDocs.map((d) => [d.id, d])).values()
  );

  const [documents, setDocuments] = useState<DocumentItem[]>(uniqueDocs);

  // Sync state when initialDocs props change (e.g. after dynamic file upload refresh)
  useEffect(() => {
    // Resyncs the list after an upload refreshes the server props.
    const next = Array.from(new Map(initialDocs.map((d) => [d.id, d])).values());
    setDocuments(next);
    // Drop any selections for documents that are no longer in the list.
    setSelectedIds((prev) => {
      const live = new Set(next.map((d) => d.id));
      const filtered = new Set([...prev].filter((id) => live.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [initialDocs]);

  const runBulkDetach = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDetaching(true);
    try {
      const res = await fetch("/api/documents/detach/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? data.message ?? "Failed to detach documents");
      const detached: string[] = data.detached ?? [];
      setDocuments((prev) => prev.filter((d) => !detached.includes(d.id)));
      setSelectedIds(new Set());
      if (Array.isArray(data.skipped) && data.skipped.length > 0) {
        alert(
          `${detached.length} detached. ${data.skipped.length} skipped:\n` +
            data.skipped.map((s: { reason: string }) => `• ${s.reason}`).join("\n")
        );
      }
      router.refresh();
    } catch (err) {
      alert(caughtMessage(err, "Failed to detach documents"));
    } finally {
      setBulkDetaching(false);
      setBulkDetachPending(false);
    }
  };

  const requestDetach = (docId: string, fileName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDocPendingDetach({ id: docId, fileName });
  };

  const confirmDetach = async () => {
    if (!docPendingDetach) return;
    const { id: docId } = docPendingDetach;

    setDetachingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}/detach`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to detach document");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      router.refresh();
    } catch (err) {
      alert(caughtMessage(err, "Failed to detach document"));
    } finally {
      setDetachingId(null);
      setDocPendingDetach(null);
    }
  };

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDrop = async (dropIndex: number) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === dropIndex) return;
    dragIndexRef.current = null;

    const reordered = [...documents];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setDocuments(reordered);

    try {
      await fetch(`/api/shipments/${shipmentId}/documents/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: reordered.map((d) => d.id) }),
      });
    } catch {
      setDocuments(documents);
    }
  };

  const isDocReceived = (d: DocumentItem) =>
    d.status !== "Missing" &&
    Boolean(d.fileUrl || d.status === "Received" || d.status === "Processed" || d.status === "Review Required" || d.status === "Completed");

  const { receivedCount, totalRequired, requiredTypes, missingTypes } = checkRequiredDocumentTypes(
    documents,
    originStatus !== "Not Applicable"
  );

  return (
    <>
      <div className="bg-white p-5 rounded-2xl border border-border shadow-2xs space-y-4">
        {/* Header with clear title and badges */}
        <div className="space-y-2 pb-2 border-b border-border/50">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                Documents
              </h3>
              <span className="text-[11px] font-semibold text-brand bg-brand/10 border border-brand/20 px-2.5 py-0.5 rounded-full">
                {documents.length} uploaded
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="px-2.5 py-1 h-auto text-xs flex items-center space-x-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </Button>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <a
              href={`/api/audit/package/${shipmentId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-border bg-white hover:bg-surface-muted text-ink text-[11px] font-medium transition-colors"
              title="Download compiled reasonable care audit PDF package"
            >
              <FileText className="w-3.5 h-3.5 text-brand" />
              <span>Audit PDF</span>
            </a>
            <a
              href={`/api/audit/package/${shipmentId}/zip`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-border bg-white hover:bg-surface-muted text-ink text-[11px] font-medium transition-colors"
              title="Download compiled reasonable care audit ZIP archive"
            >
              <Files className="w-3.5 h-3.5 text-brand" />
              <span>Audit ZIP</span>
            </a>
          </div>
        </div>

        {/* Bulk selection bar */}
        {documents.length > 1 && (
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <label className="flex items-center gap-1.5 text-ink-muted font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 rounded border-border text-brand focus:ring-brand/30"
                checked={selectedIds.size === documents.length && documents.length > 0}
                ref={(el) => {
                  if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < documents.length;
                }}
                onChange={(e) =>
                  setSelectedIds(e.target.checked ? new Set(documents.map((d) => d.id)) : new Set())
                }
              />
              <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}</span>
            </label>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-ink-muted hover:text-ink font-semibold cursor-pointer"
                >
                  Clear
                </button>
                <button
                  onClick={() => setBulkDetachPending(true)}
                  disabled={bulkDetaching}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Unlink className="w-3 h-3" />
                  Detach {selectedIds.size}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Document Cards List */}
        <div className="space-y-2">
          {documents.map((doc, idx) => {
            const received = isDocReceived(doc);
            // Fall back to extraction confidence for documents that predate the
            // parse-run history being surfaced here.
            const parseState =
              doc.parseState ??
              (doc.confidence !== null && doc.confidence !== undefined ? "passed" : "pending");
            const parseFailed = parseState === "failed";
            const parsePending = parseState === "pending";
            const isSelected = activeDocId === doc.id;
            const isChecked = selectedIds.has(doc.id);

            return (
              <div
                key={doc.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDoc(doc.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDoc(doc.id);
                  }
                }}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                  isChecked
                    ? "bg-amber-50/50 border-amber-300"
                    : isSelected
                      ? "bg-blue-50/60 border-brand shadow-2xs ring-1 ring-brand/20"
                      : "bg-surface-muted/60 hover:bg-surface-muted border-border hover:border-border-strong"
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelected(doc.id)}
                    aria-label={`Select ${doc.fileName}`}
                    className="w-3.5 h-3.5 rounded border-border text-brand focus:ring-brand/30 shrink-0"
                  />
                  <GripVertical className="w-3.5 h-3.5 text-ink-muted/40 shrink-0 cursor-grab active:cursor-grabbing hover:text-ink-muted transition-colors" />
                  {received ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-ink break-words leading-tight">
                      {formatDocTypeName(doc.docType)}
                    </p>
                    <p className="text-[10px] text-ink-muted break-words leading-tight mt-0.5">
                      {doc.fileName} ({doc.pageCount || 1} {doc.pageCount === 1 ? "page" : "pages"})
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  {!received ? (
                    <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200/80">
                      Missing
                    </span>
                  ) : parseFailed ? (
                    <span
                      title="Parsing failed"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Parse failed
                    </span>
                  ) : parsePending ? (
                    <span
                      title="Parsing in progress"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-muted bg-surface-muted px-2 py-0.5 rounded-full border border-border"
                    >
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Parsing
                    </span>
                  ) : (
                    <span
                      title="Parsed successfully"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Parsed
                    </span>
                  )}
                  <button
                    onClick={(e) => requestDetach(doc.id, doc.fileName, e)}
                    disabled={detachingId === doc.id}
                    title="Detach from this shipment"
                    className="p-1 rounded-lg hover:bg-red-50 text-ink-muted hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {detachingId === doc.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                    ) : (
                      <Unlink className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Required documents checklist (A-2) */}
        <div className="pt-2 border-t border-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase text-ink-muted tracking-wider">
              Required Documents
            </p>
            <span className="text-[10px] font-semibold text-ink-muted">
              {receivedCount} of {totalRequired} on file
            </span>
          </div>
          <div className="space-y-1.5">
            {requiredTypes.map((type) => {
              const present = !missingTypes.includes(type);
              return (
                <div key={type} className="flex items-center space-x-2 text-[11px]">
                  {present ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  )}
                  <span className={present ? "text-ink font-medium" : "text-red-600 font-semibold"}>
                    {type}
                    {!present && " ✗"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {docPendingDetach && (
        <Modal
          isOpen={Boolean(docPendingDetach)}
          onClose={() => setDocPendingDetach(null)}
          titleId={DETACH_TITLE_ID}
          closeDisabled={detachingId === docPendingDetach.id}
          className="max-w-md"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Unlink className="w-4 h-4" />
              </div>
              <h3 id={DETACH_TITLE_ID} className="text-base font-extrabold text-ink">Detach Document</h3>
            </div>
            <button
              onClick={() => setDocPendingDetach(null)}
              className="p-1.5 rounded-full hover:bg-surface-muted text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm text-ink truncate font-semibold">{docPendingDetach.fileName}</p>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900 flex items-start space-x-2">
            <Files className="w-4 h-4 text-brand shrink-0 mt-0.5" />
            <span>
              This will remove the document from this shipment. If you detach, you&apos;ll still find the document under{" "}
              <strong>Trade Documents</strong> as unattached, and can reattach it to any shipment later — nothing is deleted.
            </span>
          </div>

          <p className="text-xs text-ink-muted">Do you wish to continue?</p>

          <div className="flex items-center justify-end space-x-3 pt-1">
            <Button
              variant="secondary"
              onClick={() => setDocPendingDetach(null)}
              disabled={detachingId === docPendingDetach.id}
              className="shadow-none"
            >
              Cancel
            </Button>
            <button
              onClick={confirmDetach}
              disabled={detachingId === docPendingDetach.id}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center space-x-2 transition-all"
            >
              {detachingId === docPendingDetach.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Detaching...</span>
                </>
              ) : (
                <>
                  <Unlink className="w-4 h-4" />
                  <span>Detach Document</span>
                </>
              )}
            </button>
          </div>
        </Modal>
      )}

      {bulkDetachPending && (
        <Modal
          isOpen={bulkDetachPending}
          onClose={() => setBulkDetachPending(false)}
          titleId={DETACH_TITLE_ID}
          closeDisabled={bulkDetaching}
          className="max-w-md"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Unlink className="w-4 h-4" />
              </div>
              <h3 id={DETACH_TITLE_ID} className="text-base font-extrabold text-ink">
                Detach {selectedIds.size} document{selectedIds.size === 1 ? "" : "s"}
              </h3>
            </div>
            <button
              onClick={() => setBulkDetachPending(false)}
              className="p-1.5 rounded-full hover:bg-surface-muted text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900 flex items-start space-x-2">
            <Files className="w-4 h-4 text-brand shrink-0 mt-0.5" />
            <span>
              These documents will be removed from this shipment. They stay under{" "}
              <strong>Trade Documents</strong> as unattached and can be reattached later — nothing is deleted.
            </span>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-1">
            <Button variant="secondary" onClick={() => setBulkDetachPending(false)} disabled={bulkDetaching} className="shadow-none">
              Cancel
            </Button>
            <button
              onClick={runBulkDetach}
              disabled={bulkDetaching}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center space-x-2 transition-all"
            >
              {bulkDetaching ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Detaching...</span></>
              ) : (
                <><Unlink className="w-4 h-4" /><span>Detach {selectedIds.size}</span></>
              )}
            </button>
          </div>
        </Modal>
      )}

      <DocumentUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        shipmentId={shipmentId}
        shipmentNumber={shipmentNumber}
        onUploadSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}
