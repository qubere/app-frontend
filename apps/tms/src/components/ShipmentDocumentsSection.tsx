"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, Plus, Unlink, Loader2, X, Files, GripVertical, FileText } from "lucide-react";
import { DocumentUploadModal } from "@/components/DocumentUploadModal";
import { useRouter } from "next/navigation";
import { checkRequiredDocumentTypes } from "@/lib/requiredDocumentTypes";

export interface DocumentItem {
  id: string;
  docType: string;
  fileName: string;
  pageCount: number | null;
  confidence: number | null;
  status: string;
  fileUrl?: string | null;
  extractedJson?: string | null;
}

interface ShipmentDocumentsSectionProps {
  shipmentId: string;
  documents: DocumentItem[];
  originStatus?: string;
  activeDocId: string | undefined;
  onSelectDoc: (docId: string) => void;
}

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
  documents: initialDocs,
  originStatus = "Not Applicable",
  activeDocId,
  onSelectDoc,
}: ShipmentDocumentsSectionProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);
  const [docPendingDetach, setDocPendingDetach] = useState<{ id: string; fileName: string } | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const uniqueDocs = Array.from(
    new Map(initialDocs.map((d) => [d.id, d])).values()
  );

  const [documents, setDocuments] = useState<DocumentItem[]>(uniqueDocs);

  useEffect(() => {
    setDocuments(Array.from(new Map(initialDocs.map((d) => [d.id, d])).values()));
  }, [initialDocs]);

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
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        router.refresh();
      } else {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
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
  };

  const isDocReceived = (d: DocumentItem) =>
    d.status !== "Missing" &&
    Boolean(d.fileUrl || d.status === "Received" || d.status === "Processed" || d.status === "Review Required" || d.status === "Completed" || d.status === "PARSED");

  const { receivedCount, totalRequired, requiredTypes, missingTypes } = checkRequiredDocumentTypes(
    documents,
    originStatus !== "Not Applicable"
  );

  return (
    <>
      <div className="bg-white p-5 rounded-2xl border border-border shadow-2xs space-y-4">
        {/* Header */}
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
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover flex items-center space-x-1 shrink-0 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <a
              href={`#audit-pdf`}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-border bg-white hover:bg-surface-muted text-ink text-[11px] font-medium transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-brand" />
              <span>Audit PDF</span>
            </a>
            <a
              href={`#audit-zip`}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-border bg-white hover:bg-surface-muted text-ink text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Files className="w-3.5 h-3.5 text-brand" />
              <span>Audit ZIP</span>
            </a>
          </div>
        </div>

        {/* Document Cards List */}
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {documents.map((doc, idx) => {
            const received = isDocReceived(doc);
            const isSelected = activeDocId === doc.id;

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
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                  isSelected
                    ? "bg-blue-50/60 border-brand shadow-2xs ring-1 ring-brand/20"
                    : "bg-surface-muted/60 hover:bg-surface-muted border-border hover:border-border-strong"
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                  <GripVertical className="w-3.5 h-3.5 text-ink-muted/40 shrink-0 cursor-grab hover:text-ink-muted transition-colors" />
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
                  {received ? (
                    doc.confidence !== null && doc.confidence !== undefined ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                        {doc.confidence}% Parsed
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80">
                        Uploaded
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200/80">
                      Missing
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

        {/* Required documents checklist */}
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

      <DocumentUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        shipmentId={shipmentId}
      />

      {/* Unlink Confirmation Modal */}
      {docPendingDetach && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-border">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-extrabold text-ink">Unlink Document</h3>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Are you sure you want to unlink <span className="font-bold text-ink">{docPendingDetach.fileName}</span> from this shipment? The document will remain saved in your account library.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDocPendingDetach(null)}
                className="px-4 py-2 rounded-xl border border-border text-ink text-xs font-bold hover:bg-surface-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(detachingId)}
                onClick={() => void confirmDetach()}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                {detachingId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Unlinking…</span>
                  </>
                ) : (
                  <span>Unlink Document</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
