"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  FileText,
  Send,
  UploadCloud,
  CheckCircle2,
  Clock,
  Building2,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface Message {
  id: string;
  authorType: "BROKER" | "CUSTOMER" | "SYSTEM";
  body: string;
  createdAt: string;
  authorUser?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
}

interface DocumentItem {
  id: string;
  document?: {
    id: string;
    fileName: string;
    fileUrl?: string | null;
  } | null;
  fileName?: string;
  createdAt: string;
}

interface RequestDetail {
  id: string;
  actionId?: string;
  type: string;
  title: string;
  description?: string | null;
  status: string;
  dueAt?: string | null;
  shipment?: {
    id: string;
    shipmentNumber: string;
    poReference?: string | null;
  } | null;
  messages: Message[];
  documents: DocumentItem[];
}

export default function RequestThreadPage() {
  const params = useParams();
  const id = params.id as string;

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string } | null>(null);

  const fetchRequest = () => {
    fetch(`/api/requests/${id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.request) {
          setRequest(data.request);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequest();

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchRequest();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!replyText.trim() && !selectedFile) || submitting) return;

    setSubmitting(true);
    try {
      // 1. If file attached, upload first
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        await fetch(`/api/requests/${id}/documents`, {
          method: "POST",
          body: formData,
        });
      }

      // 2. If message text provided, post message
      if (replyText.trim()) {
        await fetch(`/api/requests/${id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: replyText }),
        });
      }

      setReplyText("");
      setSelectedFile(null);
      fetchRequest();
    } catch (err) {
      console.error("Failed to submit response:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-[#86868B] text-sm animate-pulse">
        Loading request thread...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center rounded-2xl bg-white border border-[#E5E5EA]">
        <h2 className="text-lg font-bold text-[#1D1D1F]">Request Not Found</h2>
        <p className="text-xs text-[#86868B] mt-1">The request action item does not exist or has been archived.</p>
        <Link href="/" className="inline-block mt-4 text-xs font-semibold text-[#0071E3] hover:underline">
          &larr; Back to Actions
        </Link>
      </div>
    );
  }

  const isResolved = request.status === "RESOLVED";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div>
        <Link href="/" className="text-[#86868B] hover:text-[#1D1D1F] text-xs font-semibold">
          &larr; Back to Actions
        </Link>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-3 border-b border-[#E5E5EA] pb-5">
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              {/* <ShipmentID> */}
              {request.shipment?.shipmentNumber ? (
                <Link
                  href={`/shipments/${request.shipment.id}`}
                  className="font-mono text-xs font-extrabold text-[#0071E3] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 hover:underline"
                >
                  {request.shipment.shipmentNumber}
                </Link>
              ) : request.shipment?.id ? (
                <span className="font-mono text-xs font-extrabold text-[#0071E3] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                  SHP-{request.shipment.id.slice(-6).toUpperCase()}
                </span>
              ) : null}

              {/* <ActionID> */}
              <span className="font-mono text-xs font-extrabold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                {request.actionId || `ACT-${request.id.slice(-4).toUpperCase()}`}
              </span>

              <Badge variant={isResolved ? "success" : "warning"}>
                {isResolved ? "Action Resolved" : "Action Required"}
              </Badge>
            </div>
            {/* <ActionNeeded> */}
            <h1 className="text-2xl font-extrabold text-[#1D1D1F] tracking-tight mt-2">
              {request.title}
            </h1>
            {request.description && (
              <p className="text-xs text-[#86868B] mt-1">{request.description}</p>
            )}
          </div>

          {/* <ETA> */}
          <div className="text-xs text-[#86868B] flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-[#E5E5EA] shrink-0">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>ETA / Due Date: <strong className="text-[#1D1D1F]">{request.dueAt ? new Date(request.dueAt).toLocaleDateString() : "ASAP"}</strong></span>
          </div>
        </div>
      </div>

      {/* Uploaded Documents */}
      {request.documents.length > 0 && (
        <Card className="p-5 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#0071E3]" />
            <span>Attached / Uploaded Documents ({request.documents.length})</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {request.documents.map((doc) => {
              const name = doc.document?.fileName || doc.fileName || "Uploaded Document";
              return (
                <div
                  key={doc.id}
                  className="p-3 bg-[#F5F5F7]/60 border border-[#E5E5EA] rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-[#1D1D1F] truncate">{name}</span>
                  </div>
                  <button
                    onClick={() => {
                      const docId = doc.document?.id || doc.id;
                      if (docId) {
                        window.open(`/api/documents/${docId}/download`, "_blank");
                      } else {
                        setPreviewDoc({ fileName: name });
                      }
                    }}
                    className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer shrink-0"
                  >
                    View File
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Message Thread */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-[#86868B] uppercase tracking-wider">
          Conversation Thread with Customs Broker
        </h3>
        <div className="space-y-3">
          {request.messages.map((m) => {
            const isCustomer = m.authorType === "CUSTOMER";
            return (
              <Card
                key={m.id}
                className={`p-5 rounded-2xl ${
                  isCustomer
                    ? "border-[#0071E3]/30 bg-blue-50/40 ml-8"
                    : "border-[#E5E5EA] bg-white mr-8"
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
                    {isCustomer
                      ? m.authorUser
                        ? `${m.authorUser.firstName || "You"} (${m.authorUser.email})`
                        : "You (Customer)"
                      : "Customs Broker Team"}
                  </span>
                  <span className="text-xs text-[#86868B]">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">{m.body}</p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Reply & Attachment Form */}
      {!isResolved && (
        <form onSubmit={handleSendReply}>
          <Card className="p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-[#1D1D1F]">Respond or Upload Requested Document</h3>

            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your response to the customs broker..."
              className="w-full bg-white border border-[#E5E5EA] text-[#1D1D1F] rounded-xl p-3.5 text-xs focus:ring-2 focus:ring-[#0071E3] focus:outline-none"
            />

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-1">
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-2 text-xs text-[#0071E3] font-semibold bg-blue-50 border border-blue-100 px-3.5 py-2 rounded-xl cursor-pointer hover:bg-blue-100 transition">
                  <UploadCloud className="w-4 h-4" />
                  <span>{selectedFile ? selectedFile.name : "Attach Document"}</span>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-red-600 font-semibold hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>

              <Button
                type="submit"
                loading={submitting}
                disabled={!replyText.trim() && !selectedFile}
                size="md"
              >
                <span>Submit Response</span>
              </Button>
            </div>
          </Card>
        </form>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-[#E5E5EA] space-y-4">
            <div className="flex justify-between items-center border-b border-[#E5E5EA] pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1D1D1F]">{previewDoc.fileName}</h3>
                  <p className="text-xs text-[#86868B]">Document Preview & Verification</p>
                </div>
              </div>

              <button
                onClick={() => setPreviewDoc(null)}
                className="text-[#86868B] hover:text-[#1D1D1F] text-sm font-bold px-3 py-1.5 rounded-xl bg-[#F5F5F7] transition cursor-pointer"
              >
                Close &times;
              </button>
            </div>

            <div className="p-8 bg-[#F5F5F7] rounded-2xl border border-[#E5E5EA] text-center space-y-3 font-mono text-xs text-[#1D1D1F]">
              <div className="w-12 h-12 bg-white rounded-2xl border border-[#E5E5EA] mx-auto flex items-center justify-center shadow-xs">
                <FileText className="w-6 h-6 text-[#0071E3]" />
              </div>
              <p className="font-bold text-sm text-[#1D1D1F]">{previewDoc.fileName}</p>
              <p className="text-[#86868B] text-xs">
                Status: <strong className="text-emerald-700 font-semibold">Uploaded & Transmitted</strong>
              </p>
              <div className="p-4 bg-white rounded-xl border border-[#E5E5EA] text-left font-sans text-xs space-y-1">
                <p className="font-bold text-[#1D1D1F] mb-1">Upload Details:</p>
                <p>&bull; Target Shipment: {request?.shipment?.shipmentNumber || "Clearance File"}</p>
                <p>&bull; Status: Sent to Customs Broker Workspace</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setPreviewDoc(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
