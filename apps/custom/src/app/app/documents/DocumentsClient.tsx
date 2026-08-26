"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  CheckCircle2,
  RefreshCw,
  Plus,
  Eye,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ChevronDown,
  Paperclip,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { PAGE_SIZE_DEFAULT, pageWindow } from "@/modules/tables/tableQuery";
import { DocumentUploadModal } from "@/components/DocumentUploadModal";
import { documentViewUrl } from "@/lib/documentUrl";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { RawExtractionModal } from "@/components/RawExtractionModal";
import { QuarantineInboxTable } from "./QuarantineInboxTable";

interface ShipmentDocumentItem {
  id: string;
  name: string;
  type: string;
  docType?: string;
  /** Structured enum value set by the classifier. Null until classification runs. */
  documentType?: string | null;
  /** Model confidence 0–1. Null until classification runs. */
  documentTypeConfidence?: number | null;
  status: string;
  uploadedAt: string;
  uploadedAtRaw: string;
  url: string;
  shipmentId: string;
  shipmentRef?: string;
  fileSize?: string;
  confidenceScore?: number | null;
  assignedBrokerId?: string | null;
  assignedBrokerName: string;
  clientId?: string | null;
  clientName: string;
  unattached?: boolean;
  source?: string;
  shipmentCandidates?: Array<{
    id: string;
    confidenceScore: number;
    matchReasons?: string[];
    shipment: { id: string; shipmentNumber: string; portOfEntry?: string | null };
  }>;
}

/**
 * The subset of `/api/documents/unattached` and `/api/shipments` payloads this
 * screen actually reads.
 *
 * Every field is optional because these describe a JSON response rather than a
 * database row, and the rendering below already falls back for each one. Naming
 * the shape here is what lets the fallbacks be checked instead of assumed.
 */
interface ApiDocument {
  id: string;
  fileName?: string | null;
  name?: string | null;
  docType?: string | null;
  type?: string | null;
  documentType?: string | null;
  documentTypeConfidence?: number | null;
  status?: string | null;
  createdAt?: string | null;
  fileUrl?: string | null;
  url?: string | null;
  /** Extraction confidence, absent until an extraction has actually run. */
  confidence?: number | null;
  /** UPLOAD or EMAIL -- how this document row was created. */
  source?: string | null;
  shipmentCandidates?: Array<{
    id: string;
    confidenceScore: number;
    matchReasons?: string[];
    shipment: { id: string; shipmentNumber: string; portOfEntry?: string | null };
  }>;
}

interface ApiShipment {
  id: string;
  shipmentNumber?: string | null;
  assignedBrokerId?: string | null;
  assignedBroker?: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  documents?: ApiDocument[];
}

interface DocumentsClientProps {
  context: {
    userId: string;
    roleNames: string[];
    accountType: string;
    accountName: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    isPlatformAdmin: boolean;
  };
  teamMembers: Array<{
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
  initialShipments?: ApiShipment[];
  initialUnattachedDocs?: ApiDocument[];
  initialQuarantineCount?: number;
}

function buildDocumentItems(
  apiShipments: ApiShipment[],
  unattachedDocs: ApiDocument[]
): ShipmentDocumentItem[] {
  const docs: ShipmentDocumentItem[] = [];

  apiShipments.forEach((shp) => {
    if (shp.documents && Array.isArray(shp.documents)) {
      shp.documents.forEach((d) => {
        docs.push({
          id: d.id,
          name: d.fileName || d.name || "Trade_Document.pdf",
          type: d.docType || d.type || "Commercial Invoice",
          docType: d.docType || d.type || "COMMERCIAL_INVOICE",
          documentType: d.documentType ?? null,
          documentTypeConfidence: d.documentTypeConfidence ?? null,
          status: d.status || "Received",
          uploadedAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "Just now",
          uploadedAtRaw: d.createdAt || "",
          url: d.fileUrl || d.url || "#",
          shipmentId: shp.id,
          shipmentRef: shp.shipmentNumber || shp.id,
          confidenceScore: d.confidence ?? null,
          assignedBrokerId: shp.assignedBrokerId,
          assignedBrokerName: shp.assignedBroker
            ? `${shp.assignedBroker.firstName ?? ""} ${shp.assignedBroker.lastName ?? ""}`.trim() || shp.assignedBroker.email
            : "Unassigned",
          clientId: shp.clientId ?? null,
          clientName: shp.client?.name || "No Client",
          source: d.source ?? "UPLOAD",
        });
      });
    }
  });

  unattachedDocs.forEach((d) => {
    docs.push({
      id: d.id,
      name: d.fileName || "Trade_Document.pdf",
      type: d.docType || "Commercial Invoice",
      docType: d.docType || "COMMERCIAL_INVOICE",
      documentType: d.documentType ?? null,
      documentTypeConfidence: d.documentTypeConfidence ?? null,
      status: d.status || "Received",
      uploadedAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "Just now",
      uploadedAtRaw: d.createdAt || "",
      url: d.fileUrl || "#",
      shipmentId: "",
      shipmentRef: "Unattached",
      confidenceScore: d.confidence ?? null,
      assignedBrokerId: null,
      assignedBrokerName: "Unassigned",
      clientId: null,
      clientName: "No Client",
      unattached: true,
      source: d.source ?? "UPLOAD",
      shipmentCandidates: d.shipmentCandidates,
    });
  });

  return docs;
}

export function DocumentsClient({
  context,
  teamMembers,
  initialShipments,
  initialUnattachedDocs,
  initialQuarantineCount,
}: DocumentsClientProps) {
  const isEnterpriseAdmin =
    context.accountType === "ENTERPRISE" &&
    (context.roleNames.includes("ADMIN") || context.roleNames.includes("OWNER"));

  // Construct full team list containing the logged-in admin themselves
  const fullTeamList = useMemo(() => {
    const list = [...teamMembers];
    const hasMe = list.some((m) => m.userId === context.userId);
    if (!hasMe) {
      list.unshift({
        userId: context.userId,
        email: context.email || "me@qubere.ai",
        firstName: context.firstName || "Me",
        lastName: context.lastName || "",
      });
    }
    return list;
  }, [teamMembers, context]);

  const hasInitialData = Boolean(initialShipments && initialUnattachedDocs);
  const [documents, setDocuments] = useState<ShipmentDocumentItem[]>(() =>
    initialShipments && initialUnattachedDocs
      ? buildDocumentItems(initialShipments, initialUnattachedDocs)
      : []
  );
  const [shipments, setShipments] = useState<ApiShipment[]>(() => initialShipments || []);
  const [queueView, setQueueView] = useState<"NEEDS_ACTION" | "ALL" | "QUARANTINE">("NEEDS_ACTION");
  const [quarantineCount, setQuarantineCount] = useState<number>(() => initialQuarantineCount ?? 0);

  // Paginated over the filtered list, matching the shipments workbench: the six
  // filters and the search all read every document, so limiting the rows on screen
  // must not limit what they search.
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [page, setPage] = useState(1);

  type SortField = "name" | "shipment" | "client" | "owner" | "date";
  const [sortField, setSortFieldValue] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const toggleSort = (field: SortField) => {
    setPage(1);
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortFieldValue(field);
      setSortDir("asc");
    }
  };

  const [searchQuery, setSearchQueryValue] = useState("");
  const [selectedType, setSelectedTypeValue] = useState("ALL");
  const [selectedClientId, setSelectedClientIdValue] = useState("ALL");
  const [selectedShipmentId, setSelectedShipmentIdValue] = useState("ALL");
  const [selectedStatus, setSelectedStatusValue] = useState("ALL");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ShipmentDocumentItem | null>(null);
  const [targetShipmentId] = useState("");
  const [isLoading, setIsLoading] = useState(!hasInitialData);
  /** Tracks which doc's classification dropdown is open. */
  const [classifyingDocId, setClassifyingDocId] = useState<string | null>(null);
  /** In-flight classification overrides so the UI optimistically updates. */
  const [typeOverrides, setTypeOverrides] = useState<Record<string, string>>({});
  const [reprocessingDocId, setReprocessingDocId] = useState<string | null>(null);
  const [attachingDocId, setAttachingDocId] = useState<string | null>(null);

  const attachDocumentToShipment = async (docId: string, shipmentId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId }),
      });
      if (res.ok) {
        setAttachingDocId(null);
        await fetchDocuments();
      } else {
        alert("Failed to attach document.");
      }
    } catch (err) {
      console.error("Error attaching document", err);
    }
  };

  const handleReprocess = async (docId: string, fromStep: string = "full") => {
    setReprocessingDocId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}/reprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromStep }),
      });
      if (res.ok) {
        await fetchDocuments();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error?.message || "Failed to reprocess document");
      }
    } catch (err) {
      console.error("Error reprocessing document", err);
    } finally {
      setReprocessingDocId(null);
    }
  };

  const { t } = useLanguage();

  // Selected team member IDs. Default is [] (All Documents)
  const [selectedUserIds, setSelectedUserIdsValue] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Narrowing any filter returns to the first page. Wrapped at the setters so the
  // six existing filters, and any added later, cannot leave the operator looking at
  // a page the new result no longer reaches.
  const setSearchQuery: typeof setSearchQueryValue = (value) => {
    setPage(1);
    setSearchQueryValue(value);
  };
  const setSelectedType: typeof setSelectedTypeValue = (value) => {
    setPage(1);
    setSelectedTypeValue(value);
  };
  const setSelectedClientId: typeof setSelectedClientIdValue = (value) => {
    setPage(1);
    setSelectedClientIdValue(value);
  };
  const setSelectedShipmentId: typeof setSelectedShipmentIdValue = (value) => {
    setPage(1);
    setSelectedShipmentIdValue(value);
  };
  const setSelectedStatus: typeof setSelectedStatusValue = (value) => {
    setPage(1);
    setSelectedStatusValue(value);
  };
  const setSelectedUserIds: typeof setSelectedUserIdsValue = (value) => {
    setPage(1);
    setSelectedUserIdsValue(value);
  };

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const [shipmentsRes, unattachedRes] = await Promise.all([
        fetch("/api/shipments"),
        fetch("/api/documents/unattached"),
      ]);

      const docs: ShipmentDocumentItem[] = [];

      if (shipmentsRes.ok) {
        const data = await shipmentsRes.json();
        if (data.shipments && Array.isArray(data.shipments)) {
          const apiShipments = data.shipments as ApiShipment[];
          setShipments(apiShipments);
          apiShipments.forEach((shp) => {
            if (shp.documents && Array.isArray(shp.documents)) {
              shp.documents.forEach((d) => {
                docs.push({
                  id: d.id,
                  name: d.fileName || d.name || "Trade_Document.pdf",
                  type: d.docType || d.type || "Commercial Invoice",
                  docType: d.docType || d.type || "COMMERCIAL_INVOICE",
                  documentType: d.documentType ?? null,
                  documentTypeConfidence: d.documentTypeConfidence ?? null,
                  status: d.status || "Received",
                  uploadedAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "Just now",
                  uploadedAtRaw: d.createdAt || "",
                  url: d.fileUrl || d.url || "#",
                  shipmentId: shp.id,
                  shipmentRef: shp.shipmentNumber || shp.id,
                  confidenceScore: d.confidence ?? null,
                  assignedBrokerId: shp.assignedBrokerId,
                  assignedBrokerName: shp.assignedBroker
                    ? `${shp.assignedBroker.firstName ?? ""} ${shp.assignedBroker.lastName ?? ""}`.trim() || shp.assignedBroker.email
                    : "Unassigned",
                  clientId: shp.clientId ?? null,
                  clientName: shp.client?.name || "No Client",
                  source: d.source ?? "UPLOAD",
                });
              });
            }
          });
        }
      }

      // Detached documents -- no shipmentId, but still real rows with their
      // extractedJson intact, kept visible here so they're findable and
      // reattachable rather than disappearing after being detached.
      if (unattachedRes.ok) {
        const data = await unattachedRes.json();
        if (data.documents && Array.isArray(data.documents)) {
          (data.documents as ApiDocument[]).forEach((d) => {
            docs.push({
              id: d.id,
              name: d.fileName || "Trade_Document.pdf",
              type: d.docType || "Commercial Invoice",
              docType: d.docType || "COMMERCIAL_INVOICE",
              documentType: d.documentType ?? null,
              documentTypeConfidence: d.documentTypeConfidence ?? null,
              status: d.status || "Received",
              uploadedAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "Just now",
              uploadedAtRaw: d.createdAt || "",
              url: d.fileUrl || "#",
              shipmentId: "",
              shipmentRef: "Unattached",
              confidenceScore: d.confidence ?? null,
              assignedBrokerId: null,
              assignedBrokerName: "Unassigned",
              clientId: null,
              clientName: "No Client",
              unattached: true,
              source: d.source ?? "UPLOAD",
              shipmentCandidates: d.shipmentCandidates,
            });
          });
        }
      }

      setDocuments(docs);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Declared after fetchDocuments so the effect does not reference the const
  // before its initialiser runs. Still a mount-only load, as before.
  useEffect(() => {
    if (!hasInitialData) {
      // Sets the loading flag synchronously so the spinner shows on the same paint.
      fetchDocuments();
      if (context.isPlatformAdmin) {
        fetch("/api/documents/quarantine", { cache: "no-store" })
          .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load quarantine count")))
          .then((body) => setQuarantineCount(Array.isArray(body.items) ? body.items.length : 0))
          .catch((error) => console.error("Failed to fetch quarantine count:", error));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const classifyDocument = async (docId: string, documentType: string) => {
    setTypeOverrides((prev) => ({ ...prev, [docId]: documentType }));
    setClassifyingDocId(null);
    try {
      await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType }),
      });
      // Refresh list to pick up the cleared NEEDS_CLASSIFICATION status.
      fetchDocuments();
    } catch {
      // Revert optimistic update on failure.
      setTypeOverrides((prev) => { const next = { ...prev }; delete next[docId]; return next; });
    }
  };

  const DOCUMENT_TYPE_LABELS: Record<string, string> = {
    COMMERCIAL_INVOICE: "Commercial Invoice",
    PACKING_LIST: "Packing List",
    BILL_OF_LADING: "Bill of Lading",
    AIR_WAYBILL: "Air Waybill",
    CERTIFICATE_OF_ORIGIN: "Certificate of Origin",
    PHYTOSANITARY_CERTIFICATE: "Phytosanitary Certificate",
    FUMIGATION_CERTIFICATE: "Fumigation Certificate",
    CUSTOMS_BOND: "Customs Bond",
    POWER_OF_ATTORNEY: "Power of Attorney",
    ENTRY_SUMMARY: "Entry Summary",
    ISF: "ISF (10+2)",
    OTHER: "Other",
  };

  // Derived from the shipments loaded via /api/shipments (already includes client)
  const availableClients = useMemo(() => {
    const map = new Map<string, string>();
    shipments.forEach((shp) => {
      if (shp.client) map.set(shp.client.id, shp.client.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [shipments]);

  const availableShipments = useMemo(() => {
    return shipments
      .map((shp) => ({ id: shp.id, ref: shp.shipmentNumber || shp.id }))
      .sort((a, b) => a.ref.localeCompare(b.ref));
  }, [shipments]);

  const availableStatuses = useMemo(() => {
    return Array.from(new Set(documents.map((d) => d.status).filter(Boolean))).sort();
  }, [documents]);

  const filteredDocs = documents.filter((doc) => {
    if (
      queueView === "NEEDS_ACTION" &&
      !doc.unattached &&
      doc.status !== "NEEDS_CLASSIFICATION" &&
      doc.status !== "Review Required"
    ) {
      return false;
    }

    // 1. Assignee/Owner filter
    if (isEnterpriseAdmin) {
      if (selectedUserIds.length > 0) {
        if (!doc.assignedBrokerId || !selectedUserIds.includes(doc.assignedBrokerId)) {
          return false;
        }
      }
    }

    // 2. Search query filter
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.shipmentRef && doc.shipmentRef.toLowerCase().includes(searchQuery.toLowerCase()));

    // 3. Document type dropdown filter
    const matchesType = selectedType === "ALL" || doc.docType === selectedType;

    // 4. Client dropdown filter
    const matchesClient =
      selectedClientId === "ALL" ||
      (selectedClientId === "UNASSIGNED" ? !doc.clientId : doc.clientId === selectedClientId);

    // 5. Shipment dropdown filter
    const matchesShipment =
      selectedShipmentId === "ALL" ||
      (selectedShipmentId === "UNATTACHED" ? doc.unattached : doc.shipmentId === selectedShipmentId);

    // 6. Status dropdown filter
    const matchesStatus = selectedStatus === "ALL" || doc.status === selectedStatus;

    return matchesSearch && matchesType && matchesClient && matchesShipment && matchesStatus;
  });

  const totalDocs = filteredDocs.length;
  const unattachedCount = documents.filter((doc) => doc.unattached).length;
  const classificationCount = documents.filter((doc) => doc.status === "NEEDS_CLASSIFICATION").length;
  const reviewCount = documents.filter((doc) => doc.status === "Review Required").length;
  const actionCount = new Set(
    documents
      .filter((doc) => doc.unattached || doc.status === "NEEDS_CLASSIFICATION" || doc.status === "Review Required")
      .map((doc) => doc.id)
  ).size;
  // filteredDocs is already recomputed fresh every render (it's a plain
  // .filter(), not memoized), so sorting it gains nothing from useMemo --
  // just derive it the same way as the counts above.
  const sortValueFor = (doc: ShipmentDocumentItem, field: SortField): string | number => {
    switch (field) {
      case "name":
        return doc.name.toLowerCase();
      case "shipment":
        return (doc.unattached ? "" : doc.shipmentRef || "").toLowerCase();
      case "client":
        return doc.clientName.toLowerCase();
      case "owner":
        return doc.assignedBrokerName.toLowerCase();
      case "date":
        return doc.uploadedAtRaw ? new Date(doc.uploadedAtRaw).getTime() : 0;
    }
  };
  const sortedDocs = sortField
    ? [...filteredDocs].sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        const av = sortValueFor(a, sortField);
        const bv = sortValueFor(b, sortField);
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      })
    : filteredDocs;

  const { pages, page: currentPage, firstRow, lastRow, start, end } = pageWindow(
    totalDocs,
    pageSize,
    page
  );
  const pagedDocs = sortedDocs.slice(start, end);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="rounded-2xl border border-border bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Document operations</p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-ink">Action inbox</h1>
            <p className="mt-1 text-xs text-ink-muted">Clear quarantined, unattached, and low-confidence documents before browsing the full repository.</p>
          </div>
          <button onClick={() => setIsUploadModalOpen(true)} className="inline-flex items-center justify-center space-x-2 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-hover hover:shadow-sm">
            <Plus className="h-3.5 w-3.5" /><span>{t.documents.uploadButton}</span>
          </button>
        </div>

        <div className={`mt-5 grid grid-cols-2 gap-2 ${context.isPlatformAdmin ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <QueueMetric label="Needs action" value={actionCount + quarantineCount} tone="amber" onClick={() => { setQueueView("NEEDS_ACTION"); setPage(1); }} />
          {context.isPlatformAdmin && (
            <QueueMetric label="Quarantined" value={quarantineCount} tone="red" onClick={() => setQueueView("QUARANTINE")} />
          )}
          <QueueMetric label="Unattached" value={unattachedCount} onClick={() => { setQueueView("ALL"); setSelectedShipmentId("UNATTACHED"); }} />
          <QueueMetric label="Classification / review" value={classificationCount + reviewCount} onClick={() => { setQueueView("NEEDS_ACTION"); setPage(1); }} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <QueueTab active={queueView === "NEEDS_ACTION"} label="Needs action" count={actionCount} onClick={() => { setQueueView("NEEDS_ACTION"); setPage(1); }} />
            {context.isPlatformAdmin && (
              <QueueTab active={queueView === "QUARANTINE"} label="Quarantine" count={quarantineCount} onClick={() => setQueueView("QUARANTINE")} />
            )}
            <QueueTab active={queueView === "ALL"} label="All documents" count={documents.length} onClick={() => { setQueueView("ALL"); setPage(1); }} />
          </div>

          {/* Assignee filter, merged in next to the tabs rather than living in its own bar. */}
          {isEnterpriseAdmin && queueView !== "QUARANTINE" && (
            <div className="flex flex-wrap items-center gap-2">
              <Users className="w-3.5 h-3.5 text-ink-muted" />
              <div className="flex bg-surface-muted p-1 rounded-xl border border-border text-xs">
                <button
                  onClick={() => setSelectedUserIds([])}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedUserIds.length === 0 ? "bg-white text-ink shadow-3xs" : "text-ink-muted"
                  }`}
                >
                  All Documents
                </button>
                <button
                  onClick={() => setSelectedUserIds([context.userId])}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedUserIds.length === 1 && selectedUserIds[0] === context.userId
                      ? "bg-white text-ink shadow-3xs"
                      : "text-ink-muted"
                  }`}
                >
                  My Documents
                </button>
              </div>

              <div className="flex items-center text-xs relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="px-3 py-1.5 rounded-xl border border-border bg-white text-xs text-ink focus:outline-none focus:border-brand font-semibold cursor-pointer flex items-center space-x-1.5 shadow-3xs"
                >
                  <span>
                    {selectedUserIds.length === 0
                      ? "All Team Members"
                      : selectedUserIds.length === 1
                      ? selectedUserIds[0] === context.userId
                        ? `My Documents (${context.firstName || "Me"})`
                        : (() => {
                            const user = fullTeamList.find((u) => u.userId === selectedUserIds[0]);
                            return user
                              ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
                              : "1 Selected";
                          })()
                      : `${selectedUserIds.length} Selected`}
                  </span>
                  <span className="text-ink-muted text-[9px]">▼</span>
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-border rounded-2xl shadow-lg p-3 z-20 space-y-2 max-h-60 overflow-y-auto">
                      <div className="flex items-center justify-between border-b border-border pb-2 mb-1 text-[10px] font-bold text-ink-muted uppercase">
                        <span>Select Members</span>
                        <div className="space-x-2">
                          <button
                            onClick={() => setSelectedUserIds(fullTeamList.map((t) => t.userId))}
                            className="text-brand hover:underline cursor-pointer"
                          >
                            All
                          </button>
                          <button
                            onClick={() => setSelectedUserIds([])}
                            className="text-brand hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {fullTeamList.map((member) => {
                          const isChecked = selectedUserIds.includes(member.userId);
                          const memberName =
                            member.firstName || member.lastName
                              ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
                              : member.email;

                          return (
                            <label
                              key={member.userId}
                              className="flex items-center space-x-2.5 p-2 hover:bg-surface-muted rounded-xl cursor-pointer text-left transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleUser(member.userId)}
                                className="rounded border-border text-brand focus:ring-brand cursor-pointer"
                              />
                              <div className="truncate">
                                <p className="font-bold text-ink text-xs truncate">
                                  {memberName}
                                  {member.userId === context.userId && " (Me)"}
                                </p>
                                <p className="text-[10px] text-ink-muted truncate">
                                  {member.email}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {queueView === "QUARANTINE" && context.isPlatformAdmin && <QuarantineInboxTable onCountChange={setQuarantineCount} />}

      {queueView !== "QUARANTINE" && <>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder={t.documents.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-white text-xs text-ink focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        {/* Filter & Refresh */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-white text-xs text-ink focus:outline-none focus:border-brand cursor-pointer font-medium"
          >
            <option value="ALL">{t.documents.allTypes}</option>
            <option value="COMMERCIAL_INVOICE">Commercial Invoice</option>
            <option value="OCEAN_BILL_OF_LADING">Ocean Bill of Lading (B/L)</option>
            <option value="GENERAL_CERTIFICATE_OF_ORIGIN">Certificate of Origin</option>
            <option value="CBP_FORM_7501_ENTRY_SUMMARY">CBP Form 7501</option>
            <option value="PACKING_LIST">Packing List</option>
          </select>

          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-white text-xs text-ink focus:outline-none focus:border-brand cursor-pointer font-medium"
          >
            <option value="ALL">All Clients</option>
            <option value="UNASSIGNED">No Client</option>
            {availableClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedShipmentId}
            onChange={(e) => setSelectedShipmentId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-white text-xs text-ink focus:outline-none focus:border-brand cursor-pointer font-medium"
          >
            <option value="ALL">All Shipments</option>
            <option value="UNATTACHED">Unattached</option>
            {availableShipments.map((shp) => (
              <option key={shp.id} value={shp.id}>
                {shp.ref}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-white text-xs text-ink focus:outline-none focus:border-brand cursor-pointer font-medium"
          >
            <option value="ALL">All Statuses</option>
            {availableStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            onClick={fetchDocuments}
            disabled={isLoading}
            className="p-2 rounded-xl border border-border bg-white hover:bg-surface-muted text-ink transition-colors cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-brand" : ""}`} />
          </button>
        </div>
      </div>

      {/* Document Roster Table */}
      <div className="bg-white rounded-3xl border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-ink">
            <thead className="bg-surface-muted border-b border-border text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              <tr>
                <SortHeader label={t.documents.colName} field="name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label={t.documents.colShipment} field="shipment" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <th className="py-3 px-5">Next action</th>
                <SortHeader label="Client" field="client" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                {isEnterpriseAdmin && <SortHeader label="Owner" field="owner" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />}
                <SortHeader label={t.documents.colDate} field="date" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={isEnterpriseAdmin ? 7 : 6} className="py-12 text-center text-ink-muted">
                    <FileText className="w-8 h-8 mx-auto text-ink-muted/40 mb-2" />
                    <p className="font-semibold text-xs text-ink">{queueView === "NEEDS_ACTION" ? "Action queue clear" : "No trade documents uploaded yet"}</p>
                    <p className="text-[11px] text-ink-muted mt-1">
                      {queueView === "NEEDS_ACTION" ? "No unattached, unclassified, or review-required documents match these filters." : <>Click <strong className="text-brand">Upload Document</strong> above to ingest a file.</>}
                    </p>
                  </td>
                </tr>
              ) : (
                pagedDocs.map((doc) => {
                  const effectiveType = typeOverrides[doc.id] ?? doc.documentType ?? doc.docType;
                  const needsClassification = doc.status === "NEEDS_CLASSIFICATION" && !typeOverrides[doc.id];
                  return (
                  <tr key={doc.id} className="hover:bg-surface-muted/50 transition-colors">
                    {/* Document Name Click triggers Modal. Type/classification now
                        lives under the name instead of its own column -- one
                        fewer thing to scan per row. */}
                    <td className="py-3.5 px-5 font-semibold text-ink">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="flex items-start space-x-2.5 hover:text-brand transition-colors text-left group cursor-pointer"
                        title="Click to view document in modal"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-brand shrink-0 group-hover:scale-105 transition-transform">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-xs group-hover:underline">{doc.name}</span>
                            {doc.source === "EMAIL" && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                                Emailed
                              </span>
                            )}
                            <Eye className="w-3.5 h-3.5 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {!needsClassification && effectiveType && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {DOCUMENT_TYPE_LABELS[effectiveType] ?? doc.type ?? effectiveType}
                              </span>
                              {doc.documentTypeConfidence != null && (
                                <span className="text-[9px] font-mono text-ink-muted">
                                  {Math.round(doc.documentTypeConfidence * 100)}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    </td>

                    <td className="py-3.5 px-5 font-mono text-[11px]">
                      {doc.unattached ? (
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={() => setAttachingDocId(attachingDocId === doc.id ? null : doc.id)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                            title="Unattached — click to attach to a shipment"
                            aria-label="Attach to a shipment"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                          </button>
                          {attachingDocId === doc.id && (
                            <div className="absolute left-0 top-full mt-1.5 w-72 bg-white rounded-2xl border border-border shadow-xl z-20 p-2 text-xs">
                              <p className="font-bold text-ink mb-1 text-[11px] px-2 pt-1">Attach to shipment</p>
                              {shipments.length === 0 ? (
                                <p className="text-ink-muted text-[11px] px-2 py-2">No active shipments found</p>
                              ) : (
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                  {shipments.map((s) => (
                                    <button
                                      key={s.id}
                                      onClick={() => attachDocumentToShipment(doc.id, s.id)}
                                      className="w-full text-left px-2 py-1.5 hover:bg-surface-muted rounded-xl transition-colors text-ink text-[11px] font-medium cursor-pointer"
                                    >
                                      {s.shipmentNumber || s.id}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Link href={`/app/shipments/${doc.shipmentId}`} className="text-brand hover:underline">
                          {doc.shipmentRef}
                        </Link>
                      )}
                    </td>

                    {/* Next action drives the row: classify, review, or attach --
                        clicking it takes the operator straight to that control
                        instead of just labeling a state they then have to hunt for. */}
                    <td className="py-3.5 px-5">
                      {needsClassification ? (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setClassifyingDocId(classifyingDocId === doc.id ? null : doc.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Classify document</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          {classifyingDocId === doc.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setClassifyingDocId(null)} />
                              <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-border rounded-xl shadow-lg z-20 overflow-hidden">
                                <p className="px-3 py-2 text-[10px] font-bold text-ink-muted uppercase tracking-wide border-b border-border">
                                  Set document type
                                </p>
                                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => classifyDocument(doc.id, value)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-surface-muted transition-colors cursor-pointer"
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ) : doc.status === "Review Required" ? (
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
                          title="Open the document to review its extracted data"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>Review document</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{doc.status || "Received"}{doc.confidenceScore != null ? ` (${doc.confidenceScore}% Conf)` : ""}</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-5">
                      {doc.clientId ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-brand/10 text-brand">
                          {doc.clientName}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-muted">—</span>
                      )}
                    </td>

                    {isEnterpriseAdmin && (
                      <td className="py-3.5 px-5 font-semibold text-ink">
                        {doc.assignedBrokerName}
                      </td>
                    )}

                    <td className="py-3.5 px-5 text-ink-muted">{doc.uploadedAt}</td>

                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        disabled={reprocessingDocId === doc.id}
                        onClick={() => handleReprocess(doc.id)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-border bg-white hover:bg-surface-muted text-ink text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                        title="Reprocess document extraction pipeline"
                      >
                        <RefreshCw className={`w-3 h-3 ${reprocessingDocId === doc.id ? "animate-spin text-brand" : ""}`} />
                        <span>{reprocessingDocId === doc.id ? "Processing..." : "Reprocess"}</span>
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Range read from the filtered total, so a partial last page reports the
            rows it holds rather than repeating the page size. */}
        <nav
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-border"
          aria-label="Trade documents pagination"
        >
          <div className="flex items-center gap-3">
            <p className="text-xs text-ink-muted">
              {totalDocs === 0
                ? "No documents"
                : `${firstRow}–${lastRow} of ${totalDocs} document${totalDocs === 1 ? "" : "s"}`}
            </p>
            <label className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Rows per page"
                className="rounded-lg border border-border bg-white px-2 py-1 text-xs font-semibold text-ink focus:outline-none focus:border-brand"
              >
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">
              Page {currentPage} of {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-white text-xs font-semibold text-ink hover:bg-surface-muted disabled:bg-surface-muted disabled:text-ink-muted disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= pages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-white text-xs font-semibold text-ink hover:bg-surface-muted disabled:bg-surface-muted disabled:text-ink-muted disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </nav>
      </div>
      </>}

      {/* Reusable Document Viewer Modal */}
      {previewDoc && (
        <>
        <RawExtractionModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          documentId={previewDoc.id}
          fileName={previewDoc.name}
          shipmentNumber={previewDoc.shipmentRef}
          fileUrl={previewDoc.url}
          proxyUrl={previewDoc?.id ? documentViewUrl(previewDoc.id) : undefined}
        />
        </>
      )}

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        shipmentId={targetShipmentId}
        shipments={shipments}
        onUploadSuccess={fetchDocuments}
      />
    </div>
  );
}

function QueueMetric({ label, value, tone = "neutral", onClick }: { label: string; value: number; tone?: "neutral" | "amber" | "red"; onClick?: () => void }) {
  const toneClasses =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-border bg-surface-muted/50 text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left transition-shadow cursor-pointer hover:shadow-xs ${toneClasses}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</p>
    </button>
  );
}

function QueueTab({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${active ? "border-brand bg-brand text-white" : "border-border bg-white text-ink hover:bg-surface-muted"}`}>
      <span>{label}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${active ? "bg-white/20 text-white" : "bg-surface-muted text-ink-muted"}`}>{count}</span>
    </button>
  );
}

function SortHeader<F extends string>({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  align,
}: {
  label: string;
  field: F;
  sortField: F | null;
  sortDir: "asc" | "desc";
  onSort: (field: F) => void;
  align?: "right";
}) {
  const active = sortField === field;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`py-3 px-5 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 cursor-pointer hover:text-ink transition-colors ${active ? "text-ink" : ""}`}
      >
        <span>{label}</span>
        <Icon className={`w-3 h-3 ${active ? "text-brand" : "text-ink-muted/50"}`} />
      </button>
    </th>
  );
}
