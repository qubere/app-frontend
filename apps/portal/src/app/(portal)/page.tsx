"use client";

import { PortalOverview } from "@/components/PortalOverview";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  Clock,
  CheckCircle2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  UploadCloud,
  Eye,
  Loader2,
  X,
  ExternalLink,
  ShieldAlert,
  FolderCheck,
  FolderOpen,
  Plus,
  Search,
  Archive,
  UserCheck,
} from "lucide-react";

interface MessageItem {
  id: string;
  authorType: string;
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
    status?: string | null;
    docType?: string | null;
  } | null;
  fileName?: string;
  createdAt: string;
}

interface ActionItem {
  id: string;
  actionId?: string;
  type: string;
  title: string;
  description?: string;
  status: string;
  dueAt?: string;
  createdAt?: string;
  assignedUserId?: string | null;
  assignedUser?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  shipmentId?: string;
  shipmentNumber?: string;
  poReference?: string;
  estimatedArrival?: string;
  domain: string;
  targetUrl?: string;
  messages?: MessageItem[];
  documents?: DocumentItem[];
}

interface PortalDocument {
  id: string;
  fileName: string;
  docType?: string | null;
  byteSize?: number;
  shipmentId?: string | null;
  shipmentNumber?: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<"ALL" | "ME">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");

  // Quick reply & file upload state per action item
  const [replyText, setReplyText] = useState<{ [requestId: string]: string }>({});
  const [selectedFiles, setSelectedFiles] = useState<{ [requestId: string]: File | null }>({});
  const [submitting, setSubmitting] = useState<{ [requestId: string]: boolean }>({});

  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState<{ docId: string; fileName: string } | null>(null);

  // Existing documents picker modal state
  const [pickerRequestId, setPickerRequestId] = useState<string | null>(null);
  const [pickerShipmentId, setPickerShipmentId] = useState<string | null>(null);
  const [pickerPage, setPickerPage] = useState<number>(1);
  const [portalDocs, setPortalDocs] = useState<PortalDocument[]>([]);
  const [loadingPortalDocs, setLoadingPortalDocs] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [attachingDocId, setAttachingDocId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUserId(data.user.id);
          setCurrentUserEmail(data.user.email);
        }
      })
      .catch(() => {});
  }, []);

  const fetchDashboardData = () => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.actionItems) {
          setActionItems(data.actionItems);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();

    // Smart Tab-Aware Polling (every 5s only when tab is visible)
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchDashboardData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const allActiveCompanyActionsCount = useMemo(() => {
    return actionItems.filter((i) => i.status !== "RESOLVED" && i.status !== "CLOSED").length;
  }, [actionItems]);

  const assignedToMeCount = useMemo(() => {
    return actionItems.filter(
      (item) =>
        item.status !== "RESOLVED" &&
        item.status !== "CLOSED" &&
        ((currentUserId && item.assignedUserId === currentUserId) ||
          (currentUserEmail && item.assignedUser?.email?.toLowerCase() === currentUserEmail.toLowerCase()))
    ).length;
  }, [actionItems, currentUserId, currentUserEmail]);

  const filteredActionItems = useMemo(() => {
    if (assigneeFilter === "ME") {
      return actionItems.filter(
        (item) =>
          (currentUserId && item.assignedUserId === currentUserId) ||
          (currentUserEmail && item.assignedUser?.email?.toLowerCase() === currentUserEmail.toLowerCase())
      );
    }
    return actionItems;
  }, [actionItems, assigneeFilter, currentUserId, currentUserEmail]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const openDocumentsPicker = (requestId: string, shipmentId?: string) => {
    setPickerRequestId(requestId);
    setPickerShipmentId(shipmentId || null);
    setPickerPage(1);
    setLoadingPortalDocs(true);
    fetch("/api/documents?limit=100")
      .then((res) => res.json())
      .then((data) => {
        if (data.items) {
          setPortalDocs(data.items);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPortalDocs(false));
  };

  const handleAttachExistingDoc = async (docId: string) => {
    if (!pickerRequestId) return;
    setAttachingDocId(docId);

    try {
      await fetch(`/api/requests/${pickerRequestId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });

      setPickerRequestId(null);
      fetchDashboardData();
    } catch (err) {
      console.error("Failed attaching existing document:", err);
    } finally {
      setAttachingDocId(null);
    }
  };

  const handleReplySubmit = async (requestId: string) => {
    const text = replyText[requestId]?.trim() || "";
    const file = selectedFiles[requestId];
    if (!text && !file) return;

    setSubmitting((prev) => ({ ...prev, [requestId]: true }));

    try {
      // 1. Upload new file if selected
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        await fetch(`/api/requests/${requestId}/documents`, {
          method: "POST",
          body: formData,
        });
      }

      // 2. Post reply text if provided
      if (text) {
        await fetch(`/api/requests/${requestId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        });
      }

      setReplyText((prev) => ({ ...prev, [requestId]: "" }));
      setSelectedFiles((prev) => ({ ...prev, [requestId]: null }));
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to submit response:", err);
    } finally {
      setSubmitting((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const activeItems = filteredActionItems.filter((i) => i.status !== "RESOLVED" && i.status !== "CLOSED");
  const archivedItems = filteredActionItems.filter((i) => i.status === "RESOLVED" || i.status === "CLOSED");
  const displayedItems = activeTab === "active" ? activeItems : archivedItems;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PortalOverview />
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-[#E5E5EA] shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20 shadow-2xs">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#1D1D1F] tracking-tight">Actions Workspace</h1>
          </div>
          <p className="text-xs text-[#86868B] mt-1 pl-11">
            Action items, document upload requests, and broker inquiries — sorted by shipment and urgency.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
            {activeItems.length} Active Action(s)
          </span>
          <Link
            href="/documents"
            className="px-4 py-2 rounded-xl bg-[#0071E3] text-white text-xs font-bold hover:bg-[#0071E3]/90 transition shadow-xs flex items-center space-x-1.5"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Document</span>
          </Link>
        </div>
      </div>

      {/* Tab Navigation: Active Actions vs Archive & Assignee Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5EA] pb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 cursor-pointer ${
              activeTab === "active"
                ? "bg-[#0071E3] text-white shadow-xs"
                : "bg-white text-[#86868B] hover:text-[#1D1D1F] border border-[#E5E5EA]"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Active Actions</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === "active" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"}`}>
              {activeItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("archive")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 cursor-pointer ${
              activeTab === "archive"
                ? "bg-[#0071E3] text-white shadow-xs"
                : "bg-white text-[#86868B] hover:text-[#1D1D1F] border border-[#E5E5EA]"
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Archive</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === "archive" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
              {archivedItems.length}
            </span>
          </button>
        </div>

        {/* Assignee Filter Toggle: All vs Assigned to Me */}
        <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-[#E5E5EA]">
          <button
            onClick={() => setAssigneeFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
              assigneeFilter === "ALL"
                ? "bg-[#1D1D1F] text-white shadow-2xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            All Company Actions ({allActiveCompanyActionsCount})
          </button>
          <button
            onClick={() => setAssigneeFilter("ME")}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center space-x-1.5 ${
              assigneeFilter === "ME"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Assigned to Me ({assignedToMeCount})</span>
          </button>
        </div>
      </div>

      {/* Main Actions List View */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-[#E5E5EA] text-[#86868B] text-sm animate-pulse">
          Loading action items...
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-[#E5E5EA] shadow-xs">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-xs">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#1D1D1F]">
            {activeTab === "active" ? "No Active Actions Pending!" : "No Archived Action Items"}
          </h3>
          <p className="text-xs text-[#86868B] mt-1 max-w-md mx-auto">
            {activeTab === "active"
              ? "You have no active action items requiring input. All active shipments and filings are progressing smoothly."
              : "Resolved and completed action items will appear here for historical reference."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedItems.map((item, idx) => {
            const isExpanded = expandedId === item.id;
            const isResponded = item.status === "CUSTOMER_RESPONDED";
            const isResolved = item.status === "RESOLVED" || item.status === "CLOSED";

            const displayActionId = item.actionId || `ACT-${(101 + idx).toString()}`;
            const displayShipmentId = item.shipmentNumber || (item.shipmentId ? `SHP-${item.shipmentId.slice(-6).toUpperCase()}` : "SHP-GENERAL");

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl border transition-all overflow-hidden shadow-xs ${
                  isResponded
                    ? "border-emerald-300 ring-2 ring-emerald-500/10"
                    : isResolved
                    ? "border-[#E5E5EA] opacity-80"
                    : "border-amber-300 ring-2 ring-amber-500/10"
                }`}
              >
                {/* Accordion Header Row */}
                <div
                  onClick={() => toggleExpand(item.id)}
                  className="p-6 flex items-center justify-between cursor-pointer hover:bg-[#FAF9F6] transition-colors"
                >
                  <div className="flex items-start space-x-4 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${
                        isResolved
                          ? "bg-slate-100 text-slate-500 border border-slate-200"
                          : isResponded
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}
                    >
                      {isResolved ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : isResponded ? (
                        <MessageSquare className="w-5 h-5 animate-bounce" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      {/* Header Line: <ShipmentID> <ActionID> <ActionNeeded> <ETA> */}
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        {/* ShipmentID */}
                        <span className="font-mono text-xs font-extrabold text-[#0071E3] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 shadow-2xs">
                          {displayShipmentId}
                        </span>

                        {/* ActionID */}
                        <span className="font-mono text-xs font-extrabold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 shadow-2xs">
                          {displayActionId}
                        </span>

                        {/* Assignee Badge */}
                        {(currentUserId && item.assignedUserId === currentUserId) || (currentUserEmail && item.assignedUser?.email?.toLowerCase() === currentUserEmail.toLowerCase()) ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white shadow-2xs flex items-center space-x-1">
                            <UserCheck className="w-3 h-3" />
                            <span>Assigned to You</span>
                          </span>
                        ) : item.assignedUser ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 flex items-center space-x-1">
                            <span>Assigned to {item.assignedUser.firstName || item.assignedUser.email?.split("@")[0]}</span>
                          </span>
                        ) : null}

                        {/* Status Tag */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            isResolved
                              ? "bg-slate-100 text-slate-700 border border-slate-300"
                              : isResponded
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-amber-100 text-amber-900 border border-amber-300"
                          }`}
                        >
                          {isResolved
                            ? "Action Resolved"
                            : isResponded
                            ? "Response Submitted"
                            : "Awaiting Your Action"}
                        </span>
                      </div>

                      {/* ActionNeeded Title */}
                      <h3 className="text-base font-bold text-[#1D1D1F] tracking-tight">{item.title}</h3>

                      {item.description && (
                        <p className="text-xs text-[#86868B] line-clamp-1">{item.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Header Right: ETA / Due & Chevron */}
                  <div className="flex items-center space-x-4 shrink-0 pl-4">
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#86868B] block">
                        Due Date / ETA
                      </span>
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {item.dueAt ? new Date(item.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "ASAP"}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(item.id);
                      }}
                      className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-[#86868B] flex items-center justify-center transition cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Accordion Body View */}
                {isExpanded && (
                  <div className="border-t border-[#E5E5EA] bg-[#FAF9F6]/60 p-6 space-y-6 animate-in fade-in duration-150">
                    {/* Instructions */}
                    {item.description && (
                      <div className="p-4 rounded-2xl bg-white border border-[#E5E5EA] text-xs text-[#1D1D1F] space-y-1">
                        <span className="font-extrabold uppercase tracking-wider text-[10px] text-[#86868B]">
                          Broker Instructions
                        </span>
                        <p>{item.description}</p>
                      </div>
                    )}

                    {/* Attached / Uploaded Documents */}
                    {item.documents && item.documents.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#86868B]">
                          Uploaded / Associated Documents ({item.documents.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {item.documents.map((doc) => {
                            const fileName = doc.document?.fileName || doc.fileName || "Uploaded Document";
                            const docId = doc.document?.id || doc.id;

                            return (
                              <div
                                key={doc.id}
                                className="p-3.5 rounded-2xl bg-white border border-[#E5E5EA] flex items-center justify-between shadow-2xs hover:border-[#0071E3]/30 transition"
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-[#1D1D1F] truncate">{fileName}</p>
                                    <p className="text-[10px] text-[#86868B]">
                                      {new Date(doc.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  onClick={() => setPreviewDoc({ docId, fileName })}
                                  className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#E5E5EA] text-xs font-semibold text-[#0071E3] flex items-center space-x-1 transition cursor-pointer shrink-0"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* iOS Style Messages Thread Timeline */}
                    {item.messages && item.messages.length > 0 && (
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1 bg-[#F9F9FB] p-4 rounded-3xl border border-[#E5E5EA]">
                        {item.messages.map((msg) => {
                          const isBroker = msg.authorType === "BROKER";
                          const isCustomerMsg = !isBroker;

                          const brokerName = msg.authorUser
                            ? `${msg.authorUser.firstName || "Customs"} ${msg.authorUser.lastName || "Broker"}`.trim()
                            : "Customs Broker";
                          const customerName = msg.authorUser
                            ? `${msg.authorUser.firstName || "Porter"} ${msg.authorUser.lastName || "TargetUser"}`.trim()
                            : "Porter TargetUser";

                          const displayAuthor = isCustomerMsg
                            ? `${customerName} (You)`
                            : brokerName;

                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isCustomerMsg ? "items-end" : "items-start"}`}
                            >
                              <div className="flex items-center space-x-1.5 text-[10px] font-semibold text-[#8E8E93] mb-1 px-2">
                                <span>{displayAuthor}</span>
                                <span>&bull;</span>
                                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              <div
                                className={`px-4 py-2.5 rounded-[20px] text-[13px] max-w-lg leading-snug ${
                                  isCustomerMsg
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

                    {/* Response & Dual-Option Document Attachment Form */}
                    {!isResolved && (
                      <div className="p-4 rounded-2xl bg-white border border-[#E5E5EA] space-y-3">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1D1D1F]">
                          Submit Response or Attach Document
                        </h4>

                        <textarea
                          rows={2}
                          value={replyText[item.id] || ""}
                          onChange={(e) => setReplyText({ ...replyText, [item.id]: e.target.value })}
                          placeholder="Type notes or message for your customs broker..."
                          className="w-full bg-[#FAF9F6] border border-[#E5E5EA] rounded-xl p-3 text-xs text-[#1D1D1F] focus:ring-2 focus:ring-[#0071E3] focus:outline-none transition shadow-2xs"
                        />

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                          {/* Single Attach Document Button (Opens Modal with Select & Upload) */}
                          <div>
                            <button
                              type="button"
                              onClick={() => openDocumentsPicker(item.id, item.shipmentId)}
                              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] text-xs font-semibold text-[#0071E3] hover:bg-[#E5E5EA] transition cursor-pointer"
                            >
                              <FolderOpen className="w-4 h-4 text-[#0071E3]" />
                              <span>Attach Document</span>
                            </button>
                          </div>

                          <button
                            onClick={() => handleReplySubmit(item.id)}
                            disabled={submitting[item.id] || (!replyText[item.id]?.trim() && !selectedFiles[item.id])}
                            className="px-5 py-2.5 rounded-xl bg-[#0071E3] text-white text-xs font-bold hover:bg-[#0071E3]/90 disabled:opacity-50 transition shadow-xs flex items-center justify-center space-x-2 cursor-pointer shrink-0"
                          >
                            {submitting[item.id] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            <span>{submitting[item.id] ? "Submitting..." : "Submit Response"}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Document Selector Modal (Attach from My Documents) */}
      {pickerRequestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-[#E5E5EA] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#E5E5EA] flex items-center justify-between bg-[#FAF9F6]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center font-bold">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1D1D1F]">Select from Documents Folder</h3>
                  <p className="text-xs text-[#86868B]">Choose an existing document from your portal vault to attach.</p>
                </div>
              </div>
              <button
                onClick={() => setPickerRequestId(null)}
                className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Filter & Direct Upload Action Bar */}
            <div className="p-4 border-b border-[#E5E5EA] bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-[#86868B] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Search documents by file name or type..."
                  className="w-full bg-[#FAF9F6] border border-[#E5E5EA] rounded-xl pl-10 pr-4 py-2 text-xs text-[#1D1D1F] focus:ring-2 focus:ring-[#0071E3] focus:outline-none transition"
                />
              </div>

              {/* Upload New Document Button directly inside modal */}
              <label className="px-4 py-2.5 rounded-xl bg-[#0071E3] text-white text-xs font-bold hover:bg-[#0071E3]/90 transition shadow-xs flex items-center space-x-1.5 cursor-pointer shrink-0">
                {attachingDocId === "uploading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>{attachingDocId === "uploading" ? "Uploading..." : "Upload New Doc"}</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !pickerRequestId) return;
                    setAttachingDocId("uploading");
                    try {
                      const formData = new FormData();
                      formData.append("file", file);
                      await fetch(`/api/requests/${pickerRequestId}/documents`, {
                        method: "POST",
                        body: formData,
                      });
                      setPickerRequestId(null);
                      fetchDashboardData();
                    } catch (err) {
                      console.error("Failed uploading new document from modal:", err);
                    } finally {
                      setAttachingDocId(null);
                    }
                  }}
                />
              </label>
            </div>

            {/* Documents List Body & Pagination */}
            {(() => {
              const filteredDocs = portalDocs.filter(
                (d) =>
                  !docSearch ||
                  d.fileName.toLowerCase().includes(docSearch.toLowerCase()) ||
                  d.docType?.toLowerCase().includes(docSearch.toLowerCase())
              );

              const sortedDocs = [...filteredDocs].sort((a, b) => {
                const aMatch = pickerShipmentId && a.shipmentId === pickerShipmentId;
                const bMatch = pickerShipmentId && b.shipmentId === pickerShipmentId;
                if (aMatch && !bMatch) return -1;
                if (!aMatch && bMatch) return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              });

              const pageSize = 10;
              const totalPages = Math.max(1, Math.ceil(sortedDocs.length / pageSize));
              const currentPage = Math.min(pickerPage, totalPages);
              const paginatedDocs = sortedDocs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

              return (
                <>
                  <div className="p-6 space-y-2 overflow-y-auto flex-1 bg-[#FAF9F6]/50 min-h-[320px]">
                    {loadingPortalDocs ? (
                      <div className="p-12 text-center text-xs text-[#86868B] animate-pulse">Loading documents folder...</div>
                    ) : sortedDocs.length === 0 ? (
                      <div className="p-12 text-center text-xs text-[#86868B]">
                        No documents found. You can upload a new file directly using the Upload New Doc button above.
                      </div>
                    ) : (
                      paginatedDocs.map((doc) => {
                        const isShipmentDoc = pickerShipmentId && doc.shipmentId === pickerShipmentId;

                        return (
                          <div
                            key={doc.id}
                            className={`px-3 py-2 rounded-xl bg-white border flex items-center justify-between shadow-2xs hover:border-[#0071E3] hover:bg-[#FAF9F6] transition cursor-pointer ${
                              isShipmentDoc ? "border-emerald-300 ring-1 ring-emerald-500/20 bg-emerald-50/30" : "border-[#E5E5EA]"
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0071E3] flex items-center justify-center shrink-0">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <h4 className="text-xs font-bold text-[#1D1D1F] truncate max-w-[200px]">{doc.fileName}</h4>

                              {isShipmentDoc && (
                                <span className="text-[10px] font-extrabold uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 shrink-0">
                                  This Shipment
                                </span>
                              )}

                              <span className="text-[10px] font-bold text-[#86868B] bg-[#F5F5F7] px-2 py-0.5 rounded border border-[#E5E5EA] truncate max-w-[120px] hidden sm:inline-block">
                                {doc.docType || "Document"}
                              </span>

                              {doc.shipmentNumber && (
                                <span className="font-mono text-[10px] font-extrabold text-[#0071E3] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 hidden sm:inline-block">
                                  {doc.shipmentNumber}
                                </span>
                              )}

                              <span className="text-[10px] text-[#86868B] ml-auto pr-2 hidden md:inline-block">
                                {new Date(doc.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <button
                              onClick={() => handleAttachExistingDoc(doc.id)}
                              disabled={attachingDocId === doc.id}
                              className="w-6 h-6 rounded-lg bg-[#0071E3] hover:bg-[#0071E3]/90 text-white flex items-center justify-center transition shadow-2xs cursor-pointer shrink-0 disabled:opacity-50"
                              title="Attach Document"
                            >
                              {attachingDocId === doc.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Plus className="w-4 h-4 font-bold" />
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Modal Footer with Pagination Controls */}
                  <div className="p-4 border-t border-[#E5E5EA] bg-[#FAF9F6] flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-[#86868B]">
                      Showing <span className="font-bold text-[#1D1D1F]">{sortedDocs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{" "}
                      <span className="font-bold text-[#1D1D1F]">{Math.min(currentPage * pageSize, sortedDocs.length)}</span> of{" "}
                      <span className="font-bold text-[#1D1D1F]">{sortedDocs.length}</span> documents
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setPickerPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E5EA] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
                      >
                        &larr; Previous
                      </button>
                      <span className="text-xs font-bold text-[#1D1D1F] px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPickerPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E5EA] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
                      >
                        Next &rarr;
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Document View & Review Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full h-[85vh] border border-[#E5E5EA] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-[#E5E5EA] flex items-center justify-between bg-[#FAF9F6]">
              <div className="flex items-center space-x-3 min-w-0">
                <FileText className="w-5 h-5 text-[#0071E3] shrink-0" />
                <h3 className="text-sm font-bold text-[#1D1D1F] truncate">{previewDoc.fileName}</h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body iframe */}
            <div className="flex-1 bg-[#F5F5F7] p-2">
              <iframe
                src={`/api/documents/proxy?docId=${previewDoc.docId}`}
                className="w-full h-full rounded-2xl border border-[#E5E5EA]"
                title="Document Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
