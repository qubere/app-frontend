"use client";

import React, { useEffect, useState, useRef } from "react";
import { DocumentIcon } from "../icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Mail,
  Copy,
  Check,
  UploadCloud,
  Send,
  Loader2,
  FileText,
  ShieldCheck,
  X,
  Inbox,
  ArrowRight,
  Eye,
  Download,
  Trash2,
} from "lucide-react";

interface DocItem {
  id: string;
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
  const [copied, setCopied] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Email ingestion simulation state
  const [emailSender, setEmailSender] = useState("porter@target.com");
  const [emailSubject, setEmailSubject] = useState("Commercial Invoice & Packing List for Shipment SHP-TGT-2026-001");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const inboundEmailEndpoint = "target-docs@inbound.qubere.ai";

  const fetchDocuments = (showLoading = false) => {
    if (showLoading) setLoading(true);
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setDocuments(data.items);
      })
      .catch(() => {})
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  };

  useEffect(() => {
    fetchDocuments(true);
  }, []);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(inboundEmailEndpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

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

  const handleSimulateEmailIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIngesting(true);
    setIngestSuccess(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("senderEmail", emailSender);
    formData.append("recipientEmail", inboundEmailEndpoint);
    formData.append("docType", "COMMERCIAL_INVOICE");

    try {
      const res = await fetch("/api/documents/inbound-email", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIngestSuccess(`Attachment "${selectedFile.name}" ingested successfully into your Documents Vault!`);
        setSelectedFile(null);
        fetchDocuments();
        setTimeout(() => {
          setEmailModalOpen(false);
          setIngestSuccess(null);
        }, 2000);
      } else {
        alert(`Ingestion failed: ${data.message || "Could not process attachment"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error ingesting email attachment.");
    } finally {
      setIngesting(false);
    }
  };

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

        <button
          onClick={() => setEmailModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-[#0071E3] text-white text-xs font-bold hover:bg-[#0071E3]/90 transition shadow-xs flex items-center space-x-2 cursor-pointer shrink-0"
        >
          <Mail className="w-4 h-4" />
          <span>Email Document Ingest</span>
        </button>
      </div>

      {/* Inbound Email Ingestion Feature Banner */}
      <div className="p-6 rounded-3xl bg-white border border-[#E5E5EA] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start space-x-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0071E3] flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
            <Inbox className="w-6 h-6 text-[#0071E3]" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center space-x-2 flex-wrap">
              <h3 className="text-sm font-bold text-[#1D1D1F]">Direct Email Ingestion Endpoint</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                Active & Authorized
              </span>
            </div>
            <p className="text-xs text-[#86868B] leading-relaxed max-w-2xl">
              Send invoices, bills of lading, or packing lists from your registered email address (<span className="font-mono font-semibold text-[#1D1D1F]">porter@target.com</span>). Attachments are automatically scanned, classified, and routed straight into your Documents folder!
            </p>
          </div>
        </div>

        {/* Email Address Display Box & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full md:w-auto">
          <div className="bg-[#FAF9F6] border border-[#E5E5EA] rounded-2xl px-3.5 py-2 flex items-center justify-between space-x-3">
            <Mail className="w-4 h-4 text-[#0071E3] shrink-0" />
            <span className="text-xs font-mono font-bold text-[#1D1D1F] select-all truncate">{inboundEmailEndpoint}</span>
            <button
              onClick={handleCopyEmail}
              className="p-1 rounded-lg hover:bg-white text-[#86868B] hover:text-[#0071E3] transition cursor-pointer shrink-0"
              title="Copy Email Address"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={() => setEmailModalOpen(true)}
            className="px-4 py-2 rounded-2xl bg-[#FAF9F6] hover:bg-white text-[#0071E3] border border-[#E5E5EA] text-xs font-extrabold transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-2xs"
          >
            <span>Simulate Ingest</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Documents Table View */}
      {loading ? (
        <Card className="p-8 text-center text-[#86868B] text-sm animate-pulse">Loading documents vault...</Card>
      ) : documents.length === 0 ? (
        <Card className="p-12 text-center rounded-3xl">
          <DocumentIcon className="w-12 h-12 text-[#86868B] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#1D1D1F]">No documents in vault yet</h3>
          <p className="text-[#86868B] text-xs mt-1 max-w-sm mx-auto">
            Email attachments sent to <span className="font-mono font-semibold">{inboundEmailEndpoint}</span> or uploaded directly will automatically appear here.
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
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5EA]">
                {documents.map((doc) => {
                  const isEmail = doc.source === "INBOUND_EMAIL";

                  return (
                    <tr key={doc.id} className="hover:bg-[#FAF9F6] transition group">
                      {/* Document Name (Clickable to open Reader Modal) */}
                      <td className="py-4 px-6 font-bold">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="flex items-center space-x-3 text-[#0071E3] hover:underline group-hover:text-[#005bb5] transition cursor-pointer text-left"
                        >
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="truncate max-w-xs sm:max-w-md">{doc.fileName}</span>
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

                      {/* Source {upload / email} */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {isEmail ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-[#0071E3] border border-blue-200 uppercase tracking-wider flex items-center space-x-1.5 w-fit">
                            <Mail className="w-3 h-3" />
                            <span>Email Ingest</span>
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
                        {doc.shipmentId || doc.shipmentNumber ? (
                          <button
                            disabled
                            title={`Cannot delete: Attached to Shipment ${doc.shipmentNumber || doc.shipmentId}`}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  href={`/api/documents/${previewDoc.id}/download`}
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
                src={`/api/documents/${previewDoc.id}/download`}
                className="w-full h-full rounded-2xl bg-white border border-[#E5E5EA] shadow-inner"
                title={previewDoc.fileName}
              />
            </div>
          </div>
        </div>
      )}

      {/* Email Ingestion Simulation Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 border border-[#E5E5EA] shadow-xl animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-[#E5E5EA] pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0071E3] flex items-center justify-center border border-blue-100">
                  <Mail className="w-5 h-5 text-[#0071E3]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1D1D1F]">Simulate Email Document Ingest</h3>
                  <p className="text-xs text-[#86868B]">Simulate sending an email attachment directly to your vault</p>
                </div>
              </div>

              <button
                onClick={() => setEmailModalOpen(false)}
                className="p-1 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {ingestSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center space-x-2">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{ingestSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleSimulateEmailIngest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#86868B] uppercase tracking-wider mb-1">
                    From (Authorized Sender Email)
                  </label>
                  <input
                    type="email"
                    value={emailSender}
                    onChange={(e) => setEmailSender(e.target.value)}
                    required
                    className="w-full bg-[#FAF9F6] border border-[#E5E5EA] rounded-xl px-3.5 py-2.5 text-xs text-[#1D1D1F] focus:ring-2 focus:ring-[#0071E3] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#86868B] uppercase tracking-wider mb-1">
                    To (Inbound Email Endpoint)
                  </label>
                  <input
                    type="text"
                    value={inboundEmailEndpoint}
                    disabled
                    className="w-full bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#86868B] select-all cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#86868B] uppercase tracking-wider mb-1">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-[#E5E5EA] rounded-xl px-3.5 py-2.5 text-xs text-[#1D1D1F] focus:ring-2 focus:ring-[#0071E3] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#86868B] uppercase tracking-wider mb-1">
                    Attach Document File
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx,.csv"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-[#E5E5EA] hover:border-[#0071E3]/50 rounded-2xl p-4 text-center hover:bg-[#FAF9F6] transition cursor-pointer"
                  >
                    <UploadCloud className="w-6 h-6 text-[#0071E3] mx-auto mb-1" />
                    <p className="text-xs font-bold text-[#1D1D1F]">
                      {selectedFile ? selectedFile.name : "Click to select email attachment"}
                    </p>
                    <p className="text-[10px] text-[#86868B] mt-0.5">Supports PDF, PNG, JPG, DOCX, XLSX</p>
                  </button>
                </div>

                <div className="pt-2 flex justify-end space-x-3 border-t border-[#E5E5EA]">
                  <button
                    type="button"
                    onClick={() => setEmailModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={!selectedFile || ingesting}
                    className="px-5 py-2.5 rounded-xl bg-[#0071E3] text-white text-xs font-bold hover:bg-[#0071E3]/90 transition cursor-pointer disabled:opacity-50 flex items-center space-x-2 shadow-xs"
                  >
                    {ingesting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Ingest Attachment</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
