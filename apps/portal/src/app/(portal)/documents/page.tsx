"use client";

import { InboundAddressCard } from "@/components/InboundAddressCard";
import React, { useEffect, useState } from "react";
import { DocumentIcon } from "../icons";
import { Card } from "@/components/ui/Card";
import {
  Mail,
  Check,
  UploadCloud,
  Loader2,
  FileText,
  X,
  Eye,
  Download,
  Trash2,
} from "lucide-react";

interface DocItem {
  id: string;
  key: string;
  uploadedBy: string | null;
  downloadUrl: string;
  canDelete: boolean;
  fileName: string;
  docType: string;
  byteSize?: number;
  status: string;
  source?: string;
  fileUrl?: string | null;
  shipmentId?: string | null;
  shipmentNumber?: string;
  createdAt: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocuments = async (showLoading = false, cursor: string | null = null) => {
    if (showLoading) setLoading(true);
    if (cursor) setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(`/api/documents${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load documents. Please try again.');
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error('Could not load documents. Please try again.');
      setDocuments(previous => cursor ? [...previous, ...data.items] : data.items);
      setNextCursor(data.nextCursor ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load documents.'); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  useEffect(() => {
    fetchDocuments(true);
  }, []);

  const handleDeleteDocument = async (doc: DocItem) => {
    if (doc.shipmentId || doc.shipmentNumber) {
      alert(`Cannot delete document "${doc.fileName}" because it is attached to Shipment ${doc.shipmentNumber || doc.shipmentId}.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete "${doc.fileName}" from your vault?`)) {
      return;
    }

    setDeletingId(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        // Optimistically remove only the deleted line instantly without unmounting or repainting table
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      } else {
        alert(data.message || "Failed to delete document.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting the document.");
    } finally {
      setDeletingId(null);
    }
  };

  const groupedDocuments = [...documents].sort((a, b) => (a.shipmentNumber || "~").localeCompare(b.shipmentNumber || "~") || b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1D1D1F] tracking-tight">Documents Vault</h1>
          <p className="text-[#86868B] text-xs mt-1">
            All customer documents, email-ingested attachments, commercial invoices, and broker-published records.
          </p>
        </div>

      </div>
      <InboundAddressCard />

      {error && <div role="alert" className="rounded-xl border border-red-200 p-4 text-sm text-red-700">{error}<button className="ml-3 underline" onClick={() => fetchDocuments(true)}>Try again</button></div>}
      <div className="flex justify-between items-center text-sm"><p className="text-[#86868B]">Shared shipment files and setup documents across your client workspace.</p><button disabled={loading || loadingMore} onClick={() => fetchDocuments(true)} className="text-[#0071E3] disabled:opacity-40">Refresh documents</button></div>
      {/* Main Documents Table View */}
      {loading ? (
        <Card className="p-8 text-center text-[#86868B] text-sm animate-pulse">Loading documents vault...</Card>
      ) : documents.length === 0 ? (
        <Card className="p-12 text-center rounded-3xl">
          <DocumentIcon className="w-12 h-12 text-[#86868B] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#1D1D1F]">No documents in vault yet</h3>
          <p className="text-[#86868B] text-xs mt-1 max-w-sm mx-auto">
            Documents shared with your broker will appear here, including files received by email.
          </p>
        </Card>
      ) : (
        <div className="bg-white rounded-3xl border border-[#E5E5EA] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF9F6] border-b border-[#E5E5EA] text-[#86868B] uppercase tracking-wider text-[10px] font-extrabold">
                  <th className="py-3.5 px-6">Document Name</th>
                  <th className="py-3.5 px-4">Shipment ID</th>
                  <th className="py-3.5 px-4">Uploaded Date</th>
                  <th className="py-3.5 px-4">Uploaded by</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5EA]">
                {groupedDocuments.map((doc, index) => {
                  const isEmail = doc.source === "INBOUND_EMAIL";

                  return (
                    <React.Fragment key={doc.key}>{(index === 0 || groupedDocuments[index - 1].shipmentNumber !== doc.shipmentNumber) && <tr className="bg-blue-50/50"><td colSpan={6} className="px-6 py-2 text-xs font-semibold text-[#1D1D1F]">{doc.shipmentNumber || "With your broker / unassigned"}</td></tr>}<tr className="hover:bg-[#FAF9F6] transition group">
                      {/* Document Name (Clickable to open Reader Modal) */}
                      <td className="py-4 px-6 font-bold">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="flex items-center space-x-3 text-[#0071E3] hover:underline group-hover:text-[#005bb5] transition cursor-pointer text-left"
                        >
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="truncate max-w-xs sm:max-w-md">{doc.fileName}<span className="mt-1 block text-[11px] font-normal text-[#86868B]">{doc.status}</span></span>
                        </button>
                      </td>

                      {/* Shipment ID */}
                      <td className="py-4 px-4 font-mono font-extrabold text-[#1D1D1F]">
                        {doc.shipmentNumber ? (
                          <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#0071E3] border border-blue-100 shadow-2xs">
                            {doc.shipmentNumber}
                          </span>
                        ) : (
                          <span className="text-[#86868B] font-normal">-</span>
                        )}
                      </td>

                      {/* Uploaded Date */}
                      <td className="py-4 px-4 text-[#86868B] font-medium whitespace-nowrap">
                        {new Date(doc.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      <td className="py-4 px-4 text-[#86868B]">{doc.uploadedBy || "Not recorded"}</td>
                      {/* Source {upload / email} */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {doc.source === "CLIENT_SETUP" ? <span className="text-xs text-[#86868B]">Client setup</span> : isEmail ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-[#0071E3] border border-blue-200 uppercase tracking-wider flex items-center space-x-1.5 w-fit">
                            <Mail className="w-3 h-3" />
                            <span>Emailed</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 uppercase tracking-wider flex items-center space-x-1.5 w-fit">
                            <UploadCloud className="w-3 h-3" />
                            <span>Direct Upload</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        {!doc.canDelete ? (
                          <button
                            disabled
                            title="This document is managed by your service provider or linked to a shipment."
                            className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 text-xs font-bold inline-flex items-center space-x-1.5 cursor-not-allowed opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>Delete</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteDocument(doc)}
                            disabled={deletingId === doc.id}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-700" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            )}
                            <span>Delete</span>
                          </button>
                        )}
                      </td>
                    </tr></React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {nextCursor && <div className="text-center"><button disabled={loadingMore} onClick={() => fetchDocuments(false, nextCursor)} className="rounded-xl border px-5 py-2 text-sm text-[#0071E3] disabled:opacity-40">{loadingMore ? "Loading…" : "Load more documents"}</button></div>}

      {/* Document Reader / Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-[#E5E5EA] shadow-2xl overflow-hidden flex flex-col h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E5E5EA] bg-[#FAF9F6] flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0071E3] flex items-center justify-center border border-blue-100 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#1D1D1F] truncate">{previewDoc.fileName}</h3>
                  <div className="flex items-center space-x-2 text-[10px] text-[#86868B] mt-0.5">
                    {previewDoc.shipmentNumber && (
                      <span className="font-mono font-bold text-[#0071E3]">{previewDoc.shipmentNumber}</span>
                    )}
                    <span>&bull;</span>
                    <span>Uploaded {new Date(previewDoc.createdAt).toLocaleDateString()}</span>
                    <span>&bull;</span>
                    <span className="font-bold text-[#1D1D1F] uppercase">{previewDoc.source === "INBOUND_EMAIL" ? "Email Ingest" : "Direct Upload"}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <a
                  href={previewDoc.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#0071E3] text-white text-xs font-bold hover:bg-[#0071E3]/90 transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="w-9 h-9 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Document Viewer Body */}
            <div className="flex-1 bg-[#F5F5F7] p-4 overflow-auto flex items-center justify-center">
              <iframe
                src={previewDoc.downloadUrl}
                className="w-full h-full rounded-2xl bg-white border border-[#E5E5EA] shadow-inner"
                title={previewDoc.fileName}
              />
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
