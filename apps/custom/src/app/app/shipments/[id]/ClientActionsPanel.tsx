"use client";

import React, { useState, useEffect } from "react";
import {
  UserCheck,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Eye,
  Sparkles,
  ShieldAlert,
  FolderCheck,
  X,
  RotateCcw,
} from "lucide-react";

export interface CustomerRequestMessageData {
  id: string;
  authorType: string;
  body: string;
  createdAt: string | Date;
  authorUser?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
}

export interface CustomerRequestDocumentData {
  id: string;
  documentId?: string;
  document?: {
    id: string;
    fileName: string;
    fileUrl?: string | null;
    status?: string | null;
    docType?: string | null;
  } | null;
  fileName?: string;
  createdAt: string | Date;
}

export interface CustomerRequestItemData {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  status: string;
  dueAt?: string | Date | null;
  createdAt: string | Date;
  assignedUserId?: string | null;
  assignedUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  messages: CustomerRequestMessageData[];
  documents?: CustomerRequestDocumentData[];
}

interface ClientActionsPanelProps {
  shipmentId: string;
  initialRequests: CustomerRequestItemData[];
}

export function ClientActionsPanel({ shipmentId, initialRequests }: ClientActionsPanelProps) {
  const [requests, setRequests] = useState<CustomerRequestItemData[]>(initialRequests);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [requestId: string]: string }>({});
  const [sendingReply, setSendingReply] = useState<{ [requestId: string]: boolean }>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [customerUserCandidates, setCustomerUserCandidates] = useState<Array<{ id: string; name: string; email: string }>>([]);

  useEffect(() => {
    fetch("/api/broker/customer-users")
      .then((res) => res.json())
      .then((data) => {
        if (data.customerUsers && Array.isArray(data.customerUsers)) {
          setCustomerUserCandidates(data.customerUsers);
        }
      })
      .catch(() => {});
  }, []);

  const handleReassignUser = async (requestId: string, targetUserId: string) => {
    try {
      const res = await fetch("/api/broker/customer-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, assignedUserId: targetUserId || null }),
      });
      if (res.ok) {
        refreshRequests();
      }
    } catch (err) {
      console.error("Failed to reassign user", err);
    }
  };

  // Review Modal state for viewing & approving quarantine documents
  const [reviewModalDoc, setReviewModalDoc] = useState<{
    id: string;
    reqDocId?: string;
    fileName: string;
    docType?: string | null;
    status?: string | null;
    fileUrl?: string | null;
  } | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvedDocs, setApprovedDocs] = useState<{ [docId: string]: boolean }>({});

  const refreshRequests = () => {
    fetch(`/api/broker/customer-requests?shipmentId=${shipmentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.requests) {
          setRequests(data.requests);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    const interval = setInterval(refreshRequests, 4000);
    return () => clearInterval(interval);
  }, [shipmentId]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleSendReply = async (requestId: string) => {
    const text = replyText[requestId]?.trim();
    if (!text) return;

    setSendingReply((prev) => ({ ...prev, [requestId]: true }));
    try {
      const res = await fetch(`/api/broker/customer-requests/${requestId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        setReplyText((prev) => ({ ...prev, [requestId]: "" }));
        refreshRequests();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(`Failed to send reply: ${errJson.message || errJson.error || res.statusText}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error sending message.");
    } finally {
      setSendingReply((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    setResolvingId(requestId);
    try {
      const res = await fetch(`/api/broker/customer-requests/${requestId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        refreshRequests();
      } else {
        alert("Failed to update action status.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setResolvingId(null);
    }
  };

  const handleApproveDocument = (shipDocId: string, reqDocId?: string) => {
    // Instantly close modal overlay for zero-latency UI response
    setApprovedDocs((prev) => ({
      ...prev,
      [shipDocId]: true,
      ...(reqDocId ? { [reqDocId]: true } : {}),
    }));
    setReviewModalDoc(null);

    // Notify top PipelineProgressTracker banner ribbon to wake up and poll active job
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qubere:document-uploaded", { detail: { shipmentId } }));
    }

    // Dispatch non-blocking background job to promote file and start agent pipeline
    fetch(`/api/broker/documents/${shipDocId}/attach-to-shipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipmentId }),
    })
      .then((res) => res.json())
      .then(() => {
        refreshRequests();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("qubere:document-uploaded", { detail: { shipmentId } }));
        }
      })
      .catch((err) => console.error("Background document approval error:", err));
  };

  if (requests.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-border rounded-2xl space-y-3">
        <UserCheck className="w-10 h-10 text-ink-muted/40 mx-auto" />
        <h3 className="text-base font-bold text-ink">No Client Actions Pending</h3>
        <p className="text-xs text-ink-muted max-w-md mx-auto">
          When you request a document or information from the counterparty, the request thread and client responses will appear here in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-border">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-ink">Client Action Items & Counterparty Thread</h2>
            <p className="text-xs text-ink-muted">
              Active document requests, customer responses, and counterparty communications
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          {requests.filter((r) => r.status !== "RESOLVED").length} Action(s) Pending
        </span>
      </div>

      {/* Action Requests Cards List */}
      {(() => {
        const sortedAsc = [...requests].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const actionIdMap = new Map<string, string>();
        sortedAsc.forEach((r, idx) => {
          actionIdMap.set(r.id, `ACT-${(101 + idx).toString()}`);
        });

        // Active items first (OPEN, CUSTOMER_RESPONDED, PROCESSING), then RESOLVED items; sorted by createdAt asc within groups
        const displaySortedRequests = [...requests].sort((a, b) => {
          const isResA = a.status === "RESOLVED" || a.status === "CLOSED";
          const isResB = b.status === "RESOLVED" || b.status === "CLOSED";
          if (isResA !== isResB) {
            return isResA ? 1 : -1;
          }
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        return (
          <div className="space-y-3">
            {displaySortedRequests.map((item, idx) => {
              const isExpanded = expandedId === item.id;
              const isResponded = item.status === "CUSTOMER_RESPONDED";
              const isResolved = item.status === "RESOLVED" || item.status === "CLOSED";
              const displayActionId = actionIdMap.get(item.id) || `ACT-${(101 + idx).toString()}`;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                isResponded
                  ? "border-emerald-300 ring-2 ring-emerald-500/10 shadow-sm"
                  : isResolved
                  ? "border-border opacity-85"
                  : "border-border"
              }`}
            >
              {/* Card Header Bar */}
              <div
                onClick={() => toggleExpand(item.id)}
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-surface-muted/50 transition-colors"
              >
                <div className="flex items-start space-x-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isResolved
                        ? "bg-slate-100 text-slate-500 border border-slate-200"
                        : item.status === "PROCESSING"
                        ? "bg-purple-100 text-purple-700 border border-purple-300 animate-pulse"
                        : isResponded
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                        : "bg-amber-100 text-amber-700 border border-amber-300"
                    }`}
                  >
                    {isResolved ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : item.status === "PROCESSING" ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isResponded ? (
                      <MessageSquare className="w-5 h-5 animate-bounce" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="text-xs font-mono font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs">
                        {displayActionId}
                      </span>
                      <h3 className="text-sm font-bold text-ink truncate">{item.title}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isResolved
                            ? "bg-slate-100 text-slate-600 border border-slate-300"
                            : item.status === "PROCESSING"
                            ? "bg-purple-100 text-purple-800 border border-purple-300"
                            : isResponded
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-amber-100 text-amber-800 border border-amber-300"
                        }`}
                      >
                        {isResolved
                          ? "Resolved / Closed"
                          : item.status === "PROCESSING"
                          ? "Agent Processing"
                          : isResponded
                          ? "Counterparty Responded"
                          : "Awaiting Client Response"}
                      </span>

                      {/* Assignee Selector Dropdown */}
                      <div className="flex items-center space-x-1 ml-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-ink-muted font-semibold">Assignee:</span>
                        <select
                          value={item.assignedUserId || ""}
                          onChange={(e) => handleReassignUser(item.id, e.target.value)}
                          className="px-2 py-0.5 text-[11px] bg-surface-muted border border-border rounded-lg text-ink font-semibold focus:outline-none focus:border-brand cursor-pointer"
                        >
                          <option value="">Unassigned (All Team)</option>
                          {customerUserCandidates.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {item.description && (
                      <p className="text-xs text-ink-muted mt-1 truncate">{item.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0 pl-4">
                  {/* Status Action Buttons */}
                  {isResolved ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateStatus(item.id, "OPEN");
                      }}
                      disabled={resolvingId === item.id}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs font-extrabold transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 shadow-2xs"
                      title="Re-open Action Item"
                    >
                      {resolvingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      <span>Re-Open Action</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateStatus(item.id, "RESOLVED");
                      }}
                      disabled={resolvingId === item.id}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50 flex items-center space-x-1 shadow-2xs"
                    >
                      {resolvingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Close & Resolve</span>
                    </button>
                  )}

                  <button className="text-ink-muted hover:text-ink">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Expandable Conversation Thread & Attachments Panel */}
              {isExpanded && (
                <div className="border-t border-border p-6 bg-[#F9F9FB] space-y-6">
                  {/* Attached Documents Section */}
                  {item.documents && item.documents.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center space-x-1.5">
                        <FileText className="w-4 h-4 text-brand" />
                        <span>Counterparty Uploaded Documents ({item.documents.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {item.documents.map((docItem, idx) => {
                          const docName = docItem.document?.fileName || docItem.fileName || "Uploaded Document";
                          const shipDocId = docItem.document?.id || docItem.documentId || docItem.id;
                          const reqDocId = docItem.id;
                          const docStatus = docItem.document?.status || "QUARANTINED";
                          const isApproved =
                            (shipDocId && approvedDocs[shipDocId]) ||
                            approvedDocs[reqDocId] ||
                            (docStatus !== "QUARANTINED" && docStatus !== "Pending");
                          const formattedDate = docItem.createdAt
                            ? new Date(docItem.createdAt).toLocaleTimeString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "";

                          return (
                            <div
                              key={docItem.id}
                              className={`p-3 bg-white border rounded-xl flex items-center justify-between space-x-3 transition ${
                                isApproved
                                  ? "border-emerald-200 bg-emerald-50/10"
                                  : "border-amber-300 bg-amber-50/20"
                              }`}
                            >
                              {/* Left Side: Sequence Badge + File Name + Upload Timestamp + Status */}
                              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-slate-200">
                                  #{idx + 1}
                                </span>
                                <FileText className="w-4 h-4 text-brand shrink-0" />
                                <span className="text-xs font-bold text-ink truncate">{docName}</span>

                                {formattedDate && (
                                  <span className="text-[10px] text-ink-muted shrink-0 font-medium bg-slate-50 px-2 py-0.5 rounded border border-border/50">
                                    {formattedDate}
                                  </span>
                                )}

                                {!isApproved && (
                                  <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border border-amber-300 bg-amber-100 text-amber-900 shrink-0 flex items-center space-x-1">
                                    <ShieldAlert className="w-3 h-3 text-amber-700" />
                                    <span>Quarantine Blob</span>
                                  </span>
                                )}
                              </div>

                              {/* Right Side: View Button / Approved Icon */}
                              <div className="flex items-center space-x-2 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReviewModalDoc({
                                      id: shipDocId,
                                      reqDocId: reqDocId,
                                      fileName: docName,
                                      docType: docItem.document?.docType || item.title,
                                      status: docStatus,
                                      fileUrl: docItem.document?.fileUrl,
                                    });
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand/90 transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View & Review Document</span>
                                </button>

                                {isApproved && (
                                  <span className="text-xs font-bold text-emerald-700 flex items-center space-x-1 pl-1">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Messages Timeline */}
                  {item.messages && item.messages.length > 0 && (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2 bg-[#F9F9FB] p-4 rounded-3xl border border-[#E5E5EA]">
                      {item.messages.map((msg) => {
                        const isBroker = msg.authorType === "BROKER";
                        const brokerName = msg.authorUser
                          ? `${msg.authorUser.firstName || "Customs"} ${msg.authorUser.lastName || "Broker"}`.trim()
                          : "Customs Broker";
                        const customerName = msg.authorUser
                          ? `${msg.authorUser.firstName || "Porter"} ${msg.authorUser.lastName || "TargetUser"}`.trim()
                          : "Porter TargetUser";

                        const displayAuthor = isBroker
                          ? `${brokerName} (You)`
                          : customerName;

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isBroker ? "items-end" : "items-start"}`}
                          >
                            <div className="flex items-center space-x-1.5 text-[10px] font-semibold text-[#8E8E93] mb-1 px-2">
                              <span>{displayAuthor}</span>
                              <span>&bull;</span>
                              <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div
                              className={`px-4 py-2.5 rounded-[20px] text-[13px] max-w-lg leading-snug ${
                                isBroker
                                  ? "bg-[#007AFF] text-white rounded-br-[4px] font-normal shadow-2xs"
                                  : "bg-[#E9E9EB] text-[#000000] rounded-bl-[4px] font-normal"
                              }`}
                            >
                              {msg.body}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reply Input Form */}
                  {!isResolved && (
                    <div className="pt-2 flex items-center space-x-2">
                      <input
                        type="text"
                        value={replyText[item.id] || ""}
                        onChange={(e) =>
                          setReplyText((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSendReply(item.id);
                        }}
                        placeholder="iMessage..."
                        className="flex-1 bg-white border border-[#C6C6C8] text-[#000000] rounded-full px-4 py-2 text-xs focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] focus:outline-none transition shadow-2xs"
                      />
                      <button
                        onClick={() => handleSendReply(item.id)}
                        disabled={!replyText[item.id]?.trim() || sendingReply[item.id]}
                        className="w-9 h-9 rounded-full bg-[#007AFF] text-white hover:bg-[#0062CC] transition cursor-pointer disabled:opacity-40 flex items-center justify-center shrink-0 shadow-2xs"
                        title="Send Message"
                      >
                        {sendingReply[item.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 translate-x-0.5 -translate-y-0.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  })()}

      {/* Document Review & Agent Pipeline Approval Modal Overlay */}
      {reviewModalDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-border space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-border pb-4 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-extrabold text-ink">{reviewModalDoc.fileName}</h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                      Quarantine Storage
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Review uploaded document before accepting into regular storage & triggering agent pipeline
                  </p>
                </div>
              </div>

              <button
                onClick={() => setReviewModalDoc(null)}
                className="text-ink-muted hover:text-ink p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Viewer Frame */}
            <div className="flex-1 min-h-[380px] bg-slate-900 rounded-2xl overflow-hidden border border-border relative">
              <iframe
                src={`/api/documents/proxy?documentId=${reviewModalDoc.id}`}
                className="w-full h-full min-h-[380px] border-0"
                title="Quarantine Document Preview"
              />
            </div>

            {/* Modal Actions Footer */}
            <div className="flex flex-col sm:flex-row justify-between items-center pt-2 border-t border-border gap-3 shrink-0">
              <div className="text-xs text-ink-muted flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Blob Location: <code className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono">quarantine/requests/{reviewModalDoc.fileName}</code></span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setReviewModalDoc(null)}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-ink hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApproveDocument(reviewModalDoc.id, reviewModalDoc.reqDocId)}
                  disabled={approving}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-extrabold hover:bg-emerald-700 transition cursor-pointer flex items-center space-x-2 shadow-sm disabled:opacity-50"
                >
                  {approving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Approve & Start Agent Pipeline</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
