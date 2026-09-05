"use client";
import { PgaHoldQueue } from "@/components/pga/PgaHoldQueue";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Scale, TriangleAlert, Search, CheckCircle2, FileText, X, Upload, ChevronRight, Zap, Keyboard } from "lucide-react";
import dynamic from "next/dynamic";
import { useDecisionActions } from "@/lib/decisions/useDecisionActions";
import { ExceptionQuickActions } from "./ExceptionQuickActions";

const ExceptionSlideOver = dynamic(
  () => import("./ExceptionSlideOver").then((mod) => mod.ExceptionSlideOver),
  { ssr: false }
);
const DocumentReviewPanel = dynamic(
  () => import("@/components/DocumentReviewPanel").then((mod) => mod.DocumentReviewPanel),
  { ssr: false }
);
import { Modal, ModalHeader, ModalBody } from "@/components/ui/Modal";
import { documentViewUrl } from "@/lib/documentUrl";
import { decisionGroupLabel, reviewerLabel, editableFieldsFor } from "@/modules/decisions/editableFields";
import { triageDecision, type TriageCategory } from "@/modules/decisions/decisionState";
import { REJECTION_REASONS } from "@/modules/decisions/rejectionReasons";
import type { ShipmentActionGroup, ActionItem } from "@/modules/actions/shipmentActions";
import type { WorkPriority } from "@/modules/work/workQueue";
import type { TodayLane, TodayLaneSummary } from "@/modules/today/todayLanes";
import { TodayLanePanel } from "./TodayLanePanel";
import { CountdownChip } from "@/components/deadlines/CountdownChip";

export interface DocSummary {
  id: string;
  fileName: string;
  fileUrl: string | null;
}

interface SerializedUrgency {
  deadlineType: string;
  dueAt: string; // ISO string — serialized for RSC boundary
  msRemaining: number;
  breached: boolean;
  estimated: boolean;
  exposureUsd: number | null;
}

interface TeamMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface ActionsClientProps {
  canReadPga?: boolean;
  canReviewPga?: boolean;
  groups: ShipmentActionGroup[];
  canWrite: boolean;
  canWaive: boolean;
  initialShipmentId?: string;
  userId: string;
  userName: string;
  documents: DocSummary[];
  /** shipmentNumber → urgency context for countdown chips */
  urgencyByShipment?: Record<string, SerializedUrgency>;
  /**
   * shipmentNumber → B-1 queue rank (deadline × dollars × blocking) and the
   * one-line explanation a broker can justify to their manager.
   */
  queueRankByShipment?: Record<string, { score: number; reason: string }>;
  teamMembers?: TeamMember[];
  /** Server-applied routed-queue scope (from ?scope=). */
  scope?: "mine" | "team" | "unassigned" | "all";
  /** Open Operations item count, for the lane strip. */
  operationsCount?: number;
  /** Cross-domain compliance lane, or null when the caller lacks compliance.read. */
  complianceLane?: TodayLaneSummary | null;
  /** Cross-domain billing lane, or null when the caller lacks billing.exception.view. */
  billingLane?: TodayLaneSummary | null;
  initialLane?: TodayLane;
  /** exceptions.resolve -- resolve/accept-risk compliance findings from Today. */
  canResolveCompliance?: boolean;
  /** billing.exception.resolve. */
  canResolveBilling?: boolean;
  /** billing.exception.waive. */
  canWaiveBilling?: boolean;
  /** specialist.write -- show Escalate on exception rows. */
  canEscalate?: boolean;
}

const PRIORITY_LABEL: Record<WorkPriority, string> = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
};

const PRIORITY_DOT: Record<WorkPriority, string> = {
  critical: "bg-red-500",
  high: "bg-amber-400",
  normal: "bg-gray-300",
};

const PRIORITY_TEXT: Record<WorkPriority, string> = {
  critical: "text-red-600",
  high: "text-amber-600",
  normal: "text-ink-muted",
};

export function ActionsClient({
  canReadPga = false,
  canReviewPga = false,
  groups: initialGroups,
  canWrite,
  canWaive,
  initialShipmentId,
  userId,
  userName,
  documents,
  urgencyByShipment = {},
  queueRankByShipment = {},
  teamMembers = [],
  scope = "all",
  operationsCount,
  complianceLane = null,
  billingLane = null,
  initialLane = "operations",
  canResolveCompliance = false,
  canResolveBilling = false,
  canWaiveBilling = false,
  canEscalate = false,
}: ActionsClientProps) {
  const router = useRouter();
  const [localGroups, setLocalGroups] = useState(initialGroups);
  const [activeLane, setActiveLane] = useState<TodayLane>(initialLane);
  // Items disposed from a lane this session -- subtracted from the strip counts.
  const [laneDisposed, setLaneDisposed] = useState<{ compliance: number; billing: number }>({
    compliance: 0,
    billing: 0,
  });
  const onLaneDisposed = (lane: "compliance" | "billing") =>
    setLaneDisposed((prev) => ({ ...prev, [lane]: prev[lane] + 1 }));

  const goToLane = (next: TodayLane) => {
    setActiveLane(next);
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    if (next === "operations") params.delete("lane");
    else params.set("lane", next);
    // Shallow update: keep the current scroll/work but make the lane linkable.
    router.replace(`/app/actions${params.toString() ? `?${params.toString()}` : ""}`);
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<WorkPriority | "all">("all");
  const [scopeTab, setScopeTab] = useState<"mine" | "team" | "unassigned" | "all">(scope);

  // Scope is applied server-side — switching tabs re-navigates so the page
  // re-queries with the new ?scope=.
  const goToScope = (next: "mine" | "team" | "unassigned" | "all") => {
    setScopeTab(next);
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    if (next === "all") params.delete("scope");
    else params.set("scope", next);
    router.push(`/app/actions${params.toString() ? `?${params.toString()}` : ""}`);
  };
  const [taskFilter, setTaskFilter] = useState<"all" | "mine">("all");
  const [assignedToMe, setAssignedToMe] = useState<boolean>(false);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [activeCategory, setActiveCategory] = useState<"all" | "blocked" | "review" | "verified">("all");
  const [docModal, setDocModal] = useState<{ documentId: string; fileName: string; fileUrl: string | null; initialFieldName?: string | null } | null>(null);
  const [exceptionSlideOver, setExceptionSlideOver] = useState<{ exceptionId: string; shipmentId: string | undefined } | null>(null);
  const [notesByDecision, setNotesByDecision] = useState<Record<string, string>>({});
  const [selectedDecisionIds, setSelectedDecisionIds] = useState<Set<string>>(new Set());
  const [bulkConfirmDialog, setBulkConfirmDialog] = useState<{
    action: "APPROVE" | "REJECT";
    ids: string[];
    overrideCount: number;
  } | null>(null);
  const [bulkConfirmInput, setBulkConfirmInput] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [bulkApproveLoading, setBulkApproveLoading] = useState(false);
  // Rejecting a decision is a legal position: it needs a structured reason code
  // AND a note before it can fire. Both the single-card and bulk Reject routes
  // go through this dialog instead of mutating on the first click.
  const [rejectDialog, setRejectDialog] = useState<
    | { mode: "single"; decisionId: string }
    | { mode: "bulk"; ids: string[]; overrideCount: number }
    | null
  >(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  useEffect(() => {
    setLocalGroups(initialGroups);
  }, [initialGroups]);

  useEffect(() => {
    setScopeTab(scope);
  }, [scope]);

  // Derive available team members from both props and local shipment groups
  const teamMemberEntries: [string, { id: string; name: string }][] = [
    ...teamMembers.map((m): [string, { id: string; name: string }] => [
      m.id,
      { id: m.id, name: [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.id },
    ]),
    ...localGroups
      .filter((g) => g.assignedBrokerId)
      .map((g): [string, { id: string; name: string }] => [
        g.assignedBrokerId!,
        { id: g.assignedBrokerId!, name: g.assignedBrokerName ?? g.assignedBrokerId! },
      ]),
    ...localGroups.flatMap((g) =>
      g.items
        .filter((i): i is Extract<ActionItem, { kind: "exception" }> => i.kind === "exception" && i.assignedToUser !== null)
        .map((i): [string, { id: string; name: string }] => [
          i.assignedToUser!.id ?? i.assignedToUserId ?? "",
          {
            id: i.assignedToUser!.id ?? i.assignedToUserId ?? "",
            name: [i.assignedToUser!.firstName, i.assignedToUser!.lastName].filter(Boolean).join(" ") || i.assignedToUser!.email,
          },
        ])
    ),
  ];
  const effectiveTeamMembers = Array.from(new Map(teamMemberEntries).values()).filter((m) => m.id);

  // Derive available clients
  const clients = Array.from(
    new Map(
      localGroups
        .filter((g) => g.clientId)
        .map((g) => [g.clientId!, { id: g.clientId!, name: g.clientName ?? g.clientId! }])
    ).values()
  );

  const filteredGroups = localGroups.filter((g) => {
    if (priorityFilter !== "all" && g.priority !== priorityFilter) return false;
    if (clientFilter !== "all" && g.clientId !== clientFilter) return false;
    if (kindFilter !== "all" && !g.items.some((i) => i.kind === kindFilter)) return false;
    if (statusFilter !== "all" && !g.items.some((i) => (i.kind === "decision" ? i.status : i.kind === "exception" ? i.status : "") === statusFilter)) return false;
    if (assignedToMe || taskFilter === "mine" || assigneeFilter !== "all") {
      const targetId = (assignedToMe || taskFilter === "mine") ? userId : assigneeFilter;
      const isAssignedBroker = g.assignedBrokerId === targetId;
      const hasMatch = g.items.some(
        (item) => item.kind === "exception" && item.assignedToUserId === targetId
      );
      if (!isAssignedBroker && !hasMatch) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.shipmentNumber.toLowerCase().includes(q) ||
      (g.clientName ?? "").toLowerCase().includes(q) ||
      g.items.some((item) =>
        (item.kind === "decision"
          ? item.agentName
          : item.kind === "exception"
            ? item.type
            : item.title
        )
          .toLowerCase()
          .includes(q)
      )
    );
  });

  // Order the shipment list by the B-1 queue score (deadline × dollars ×
  // blocking) when the server supplied it — severity is an input to that score,
  // not the sort key. Fall back to the server's priority+age order otherwise.
  const rankOf = (shipmentNumber: string): number =>
    queueRankByShipment[shipmentNumber]?.score ?? -1;
  const haveRanks = Object.keys(queueRankByShipment).length > 0;
  if (haveRanks) {
    filteredGroups.sort((a, b) => rankOf(b.shipmentNumber) - rankOf(a.shipmentNumber));
  }

  const initialGroup = initialShipmentId
    ? filteredGroups.find((g) => g.shipmentId === initialShipmentId) ?? filteredGroups[0]
    : filteredGroups[0];

  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(initialGroup?.shipmentId ?? "");

  useEffect(() => {
    if (filteredGroups.length > 0 && !filteredGroups.some((g) => g.shipmentId === selectedShipmentId)) {
      setSelectedShipmentId(filteredGroups[0].shipmentId);
    }
  }, [filteredGroups, selectedShipmentId]);

  const selectedGroup = filteredGroups.find((g) => g.shipmentId === selectedShipmentId);

  const docLookup = new Map(documents.map((d) => [d.id, d]));

  const { actionLoadingId, runDecisionAction, markDecisionOpened } = useDecisionActions((decisionId, newStatus) => {
    setLocalGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((item) =>
          item.kind === "decision" && item.id === decisionId
            ? { ...item, status: newStatus }
            : item
        ),
      }))
    );
  });

  const handleDecisionAction = async (
    decisionId: string,
    action: "APPROVE" | "REJECT" | "RE_EVALUATE"
  ) => {
    // Reject always routes through the dialog — it can't fire without a reason.
    if (action === "REJECT") {
      setRejectDialog({ mode: "single", decisionId });
      return;
    }
    const ok = await runDecisionAction(decisionId, action, notesByDecision[decisionId]);
    if (ok) {
      setActionSuccess(
        action === "APPROVE"
          ? "Approved & signed into audit log."
          : "Re-evaluation requested."
      );
      router.refresh();
    }
  };

  const submitReject = async (reasonCode: string, note: string) => {
    if (!rejectDialog) return;
    setRejectLoading(true);
    try {
      if (rejectDialog.mode === "single") {
        const ok = await runDecisionAction(rejectDialog.decisionId, "REJECT", note, reasonCode);
        if (ok) {
          setActionSuccess("Rejected & signed into audit log.");
          router.refresh();
        }
      } else {
        const res = await fetch("/api/decisions/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decisionIds: rejectDialog.ids,
            action: "REJECT",
            humanNotes: note,
            rejectionReasonCode: reasonCode,
          }),
        });
        const data = (await res.json()) as { succeeded?: number };
        if (res.ok) {
          const ids = rejectDialog.ids;
          setLocalGroups((prev) =>
            prev.map((g) => ({
              ...g,
              items: g.items.map((item) =>
                item.kind === "decision" && ids.includes(item.id)
                  ? { ...item, status: "Rejected", triageState: "REJECTED" }
                  : item
              ),
            }))
          );
          setSelectedDecisionIds(new Set());
          setActionSuccess(
            `${data.succeeded ?? ids.length} decision${(data.succeeded ?? ids.length) !== 1 ? "s" : ""} rejected & signed into audit log.`
          );
          router.refresh();
        }
      }
    } finally {
      setRejectLoading(false);
      setRejectDialog(null);
    }
  };

  const triggerBulkDecision = (action: "APPROVE" | "REJECT", ids: string[]) => {
    const overrideCount = ids.filter((id) => {
      for (const g of localGroups) {
        const item = g.items.find((i) => i.kind === "decision" && i.id === id);
        if (item && item.kind === "decision" && typeof item.raw.confidence === "number" && item.raw.confidence < 70) return true;
      }
      return false;
    }).length;
    if (action === "REJECT") {
      setRejectDialog({ mode: "bulk", ids, overrideCount });
      return;
    }
    setBulkConfirmDialog({ action, ids, overrideCount });
    setBulkConfirmInput("");
  };

  const executeBulkDecision = async () => {
    if (!bulkConfirmDialog) return;
    const { action, ids } = bulkConfirmDialog;
    setBulkApproveLoading(true);
    try {
      const res = await fetch("/api/decisions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionIds: ids, action, humanNotes: action === "APPROVE" ? "Bulk approved" : "Bulk rejected" }),
      });
      const data = await res.json() as { succeeded?: number; failed?: number };
      if (res.ok) {
        const newStatus = action === "APPROVE" ? "Approved" : "Rejected";
        const newTriageState = action === "APPROVE" ? "APPROVED" : "REJECTED";
        setLocalGroups((prev) =>
          prev.map((g) => ({
            ...g,
            items: g.items.map((item) =>
              item.kind === "decision" && ids.includes(item.id)
                ? { ...item, status: newStatus, triageState: newTriageState }
                : item
            ),
          }))
        );
        setSelectedDecisionIds(new Set());
        setActionSuccess(`${data.succeeded ?? ids.length} decision${(data.succeeded ?? ids.length) !== 1 ? "s" : ""} ${action === "APPROVE" ? "approved" : "rejected"} & signed into audit log.`);
        router.refresh();
      }
    } finally {
      setBulkApproveLoading(false);
      setBulkConfirmDialog(null);
    }
  };

  const handleBulkApprove = (decisionIds: string[]) => triggerBulkDecision("APPROVE", decisionIds);

  const toggleDecisionSelection = (id: string) => {
    setSelectedDecisionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllInBucket = (ids: string[]) => {
    setSelectedDecisionIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleExceptionResolved = (exceptionId: string) => {
    setLocalGroups((prev) =>
      prev
        .map((g) => ({
          ...g,
          items: g.items.filter((item) => !(item.kind === "exception" && item.id === exceptionId)),
        }))
        .filter((g) => g.items.length > 0)
    );
    setActionSuccess("Exception closed and recorded in the audit log.");
  };

  // ── Keyboard-first triage ────────────────────────────────────────────────
  // A broker under filing pressure should be able to clear a queue without
  // reaching for the mouse. j/k walk the shipment list; a/r/e act on the next
  // unresolved decision in the open shipment; x toggles it into a bulk set.
  const [showShortcuts, setShowShortcuts] = useState(false);

  const nextActionableDecisionId = (() => {
    if (!selectedGroup) return null;
    const d = selectedGroup.items.find(
      (i) => i.kind === "decision" && categorize(i) !== "verified"
    );
    return d ? d.id : null;
  })();

  useEffect(() => {
    if (activeLane !== "operations") return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      // Don't steal keys while a modal owns the screen.
      if (rejectDialog || bulkConfirmDialog || docModal || exceptionSlideOver) {
        if (e.key === "Escape") {
          setRejectDialog(null);
          setBulkConfirmDialog(null);
          setDocModal(null);
          setExceptionSlideOver(null);
        }
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setShowShortcuts(false);
        return;
      }

      const idx = filteredGroups.findIndex((g) => g.shipmentId === selectedShipmentId);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = filteredGroups[Math.min(idx + 1, filteredGroups.length - 1)];
        if (next) { setSelectedShipmentId(next.shipmentId); setActionSuccess(null); }
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = filteredGroups[Math.max(idx - 1, 0)];
        if (prev) { setSelectedShipmentId(prev.shipmentId); setActionSuccess(null); }
        return;
      }

      if (!canWrite || !nextActionableDecisionId) return;
      if (e.key === "a") { e.preventDefault(); handleDecisionAction(nextActionableDecisionId, "APPROVE"); }
      else if (e.key === "r") { e.preventDefault(); handleDecisionAction(nextActionableDecisionId, "REJECT"); }
      else if (e.key === "e") { e.preventDefault(); handleDecisionAction(nextActionableDecisionId, "RE_EVALUATE"); }
      else if (e.key === "x") { e.preventDefault(); toggleDecisionSelection(nextActionableDecisionId); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });


  return (
    <div className="space-y-5 max-w-[1600px] mx-auto pb-12">
      {canReadPga && <PgaHoldQueue canReview={canReviewPga} />}
      {/* Header toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-border shadow-2xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <TriangleAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-ink tracking-tight">Today</h1>
            <p className="text-xs text-ink-muted" aria-live="polite">{localGroups.reduce((n, g) => n + g.items.length, 0)} open items across {localGroups.length} shipments</p>
          </div>
          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            className="hidden md:flex items-center gap-1 ml-1 px-2 py-1 rounded-lg border border-border text-[10px] font-bold text-ink-muted hover:text-ink hover:border-brand/50 transition-colors cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <kbd className="font-mono">?</kbd>
          </button>
        </div>

        {/* Filter bar: search + task/assignee/client filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shipment or agent…"
              className="pl-9 pr-4 py-2 bg-surface-muted border border-border focus:border-brand focus:bg-white rounded-xl text-xs text-ink w-48 transition-all outline-none font-medium"
            />
          </div>

          {/* Scope Tabs: My queue · Team queue · Unassigned · All */}
          <div className="flex items-center bg-surface-muted border border-border rounded-xl p-1 gap-1">
            <button
              onClick={() => goToScope("mine")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                scopeTab === "mine" ? "bg-brand text-white shadow-2xs" : "text-ink-muted hover:text-ink"
              }`}
            >
              My queue
            </button>
            <button
              onClick={() => goToScope("team")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                scopeTab === "team" ? "bg-brand text-white shadow-2xs" : "text-ink-muted hover:text-ink"
              }`}
            >
              Team queue
            </button>
            <button
              onClick={() => goToScope("unassigned")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                scopeTab === "unassigned" ? "bg-brand text-white shadow-2xs" : "text-ink-muted hover:text-ink"
              }`}
            >
              Unassigned
            </button>
            <button
              onClick={() => goToScope("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                scopeTab === "all" ? "bg-brand text-white shadow-2xs" : "text-ink-muted hover:text-ink"
              }`}
            >
              All queue
            </button>
          </div>

          {/* Category / Kind filter dropdown */}
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="py-1.5 pl-3 pr-7 bg-surface-muted border border-border rounded-xl text-xs font-semibold text-ink focus:outline-none focus:border-brand appearance-none cursor-pointer"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
          >
            <option value="all">All Categories</option>
            <option value="decision">Decisions</option>
            <option value="exception">Exceptions</option>
            <option value="document">Documents</option>
            <option value="filing">Filings</option>
            <option value="tender">Tenders</option>
            <option value="carrier_invoice">Carrier Invoices</option>
          </select>

          {/* Shipment / Item Status filter dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 pl-3 pr-7 bg-surface-muted border border-border rounded-xl text-xs font-semibold text-ink focus:outline-none focus:border-brand appearance-none cursor-pointer"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
          >
            <option value="all">All Statuses</option>
            <option value="BLOCKED">Blocked</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="Approved">Approved</option>
            <option value="AUTO_VERIFIED">Auto-Verified</option>
            <option value="RESOLVED">Resolved</option>
            <option value="WAIVED">Waived</option>
          </select>

          {/* Team Members dropdown */}
          {teamMembers.length > 0 && (
            <select
              value={assigneeFilter}
              onChange={(e) => { setAssigneeFilter(e.target.value); setTaskFilter("all"); setAssignedToMe(false); }}
              className="py-1.5 pl-3 pr-7 bg-surface-muted border border-border rounded-xl text-xs font-semibold text-ink focus:outline-none focus:border-brand appearance-none cursor-pointer"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
            >
              <option value="all">Team Members</option>
              {taskFilter === "all" && (
                <option value={userId}>My Tasks ({userName})</option>
              )}
              {effectiveTeamMembers.filter((m) => m.id !== userId).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}

          {/* Client dropdown */}
          {clients.length > 0 && (
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="py-1.5 pl-3 pr-7 bg-surface-muted border border-border rounded-xl text-xs font-semibold text-ink focus:outline-none focus:border-brand appearance-none cursor-pointer"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
            >
              <option value="all">Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Lane strip: Operations is the shipment inbox below; Compliance and
          Billing are cross-domain triage that deep-link to their own surfaces. */}
      {(complianceLane || billingLane) && (
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-border shadow-2xs overflow-x-auto">
          {([
            { lane: "operations" as const, label: "Operations", count: operationsCount ?? localGroups.reduce((n, g) => n + g.items.length, 0), critical: 0, show: true },
            { lane: "compliance" as const, label: "Compliance", count: Math.max(0, (complianceLane?.openCount ?? 0) - laneDisposed.compliance), critical: complianceLane?.criticalCount ?? 0, show: !!complianceLane },
            { lane: "billing" as const, label: "Billing", count: Math.max(0, (billingLane?.openCount ?? 0) - laneDisposed.billing), critical: billingLane?.criticalCount ?? 0, show: !!billingLane },
          ]).filter((l) => l.show).map((l) => {
            const isActive = activeLane === l.lane;
            return (
              <button
                key={l.lane}
                onClick={() => goToLane(l.lane)}
                aria-current={isActive ? "true" : undefined}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive ? "bg-brand text-white shadow-2xs" : "text-ink-muted hover:text-ink hover:bg-surface-muted"
                }`}
              >
                <span>{l.label}</span>
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center ${
                  isActive ? "bg-white/25 text-white" : l.critical > 0 ? "bg-red-100 text-red-700" : "bg-surface-muted text-ink-muted"
                }`}>
                  {l.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {activeLane !== "operations" ? (
        <TodayLanePanel
          summary={activeLane === "compliance" ? complianceLane ?? null : billingLane ?? null}
          lane={activeLane}
          canResolveCompliance={canResolveCompliance}
          canResolveBilling={canResolveBilling}
          canWaiveBilling={canWaiveBilling}
          onDisposed={onLaneDisposed}
        />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: shipment list */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-border shadow-2xs space-y-3">
            <div className="border-b border-border pb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink shrink-0">
                Shipments ({filteredGroups.length})
              </h3>
              <div className="flex items-center gap-0.5 bg-surface-muted p-0.5 rounded-lg border border-border">
                {(["all", "critical", "high", "normal"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriorityFilter(p)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-all ${
                      priorityFilter === p
                        ? p === "all"
                          ? "bg-white text-ink shadow-2xs"
                          : p === "critical"
                            ? "bg-red-500 text-white shadow-2xs"
                            : p === "high"
                              ? "bg-amber-400 text-white shadow-2xs"
                              : "bg-gray-400 text-white shadow-2xs"
                        : "text-ink-muted"
                    }`}
                  >
                    {p === "all" ? "All" : PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 max-h-[76vh] overflow-y-auto pr-1">
              {filteredGroups.map((g) => {
                const isSelected = g.shipmentId === selectedShipmentId;
                const declaredVal = g.items.reduce(
                  (acc, item) => acc + (item.kind === "decision" ? (item.raw.valueAtRisk ?? item.raw.totalValue ?? 0) : 0),
                  0
                );
                const valueAtRiskDisplay = declaredVal > 0
                  ? `$${(declaredVal >= 1000 ? (declaredVal / 1000).toFixed(0) + "k" : declaredVal.toFixed(0))} declared value`
                  : null;
                const isFilingBlocked =
                  g.priority === "critical" ||
                  g.items.some(
                    (i) => (i.kind === "decision" && (i.triageState === "BLOCKED" || i.status === "BLOCKED")) || (i.kind === "exception" && i.severity === "Critical")
                  );

                return (
                  <button
                    key={g.shipmentId}
                    type="button"
                    onClick={() => { setSelectedShipmentId(g.shipmentId); setActionSuccess(null); }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all text-xs cursor-pointer space-y-2 block ${
                      isSelected
                        ? "bg-blue-50/80 border-brand shadow-md ring-2 ring-brand/20"
                        : "bg-surface-muted border-border hover:border-brand hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Link
                        href={`/app/shipments/${g.shipmentId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono font-bold text-brand text-sm hover:underline cursor-pointer shrink-0"
                      >
                        {g.shipmentNumber}
                      </Link>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isFilingBlocked && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200 shrink-0 whitespace-nowrap">
                            FILING BLOCKED
                          </span>
                        )}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[g.priority]}`} />
                        <span className={`text-[10px] font-semibold whitespace-nowrap ${PRIORITY_TEXT[g.priority]}`}>
                          {PRIORITY_LABEL[g.priority]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-ink-muted">
                      {g.clientName ? (
                        <p className="truncate">
                          Importer: <span className="text-ink">{g.clientName}</span>
                        </p>
                      ) : (
                        <span />
                      )}
                      {valueAtRiskDisplay && (
                        <span className="font-mono font-bold text-ink shrink-0">{valueAtRiskDisplay}</span>
                      )}
                    </div>

                    {urgencyByShipment[g.shipmentNumber] && (() => {
                      const u = urgencyByShipment[g.shipmentNumber];
                      const DEADLINE_LABELS: Record<string, string> = {
                        ISF_10_2: "ISF", ENTRY_FILING: "Entry Filing",
                        ENTRY_SUMMARY: "Entry Summary", DUTY_PAYMENT: "Duty Payment",
                        LAST_FREE_DAY: "Last Free Day",
                      };
                      return (
                        <CountdownChip
                          label={DEADLINE_LABELS[u.deadlineType] ?? u.deadlineType.replace(/_/g, " ")}
                          dueAt={new Date(u.dueAt)}
                          estimated={u.estimated}
                          exposureUsd={u.exposureUsd}
                          warnDays={u.deadlineType === "ENTRY_FILING" ? 5 : 3}
                        />
                      );
                    })()}

                    {queueRankByShipment[g.shipmentNumber]?.reason && (
                      <p className="text-[10px] font-semibold text-ink-muted flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 text-ink-muted/60 shrink-0" />
                        <span className="truncate">{queueRankByShipment[g.shipmentNumber].reason}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] text-ink-muted bg-white border border-border rounded-lg px-2 py-0.5 font-medium">
                        {g.items.length} item{g.items.length !== 1 ? "s" : ""}
                      </span>
                      {g.decisionCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-ink-muted bg-white border border-border rounded-lg px-2 py-0.5">
                          <Scale className="w-3 h-3" />
                          {g.decisionCount} decision{g.decisionCount > 1 ? "s" : ""}
                        </span>
                      )}
                      {g.exceptionCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-ink-muted bg-white border border-border rounded-lg px-2 py-0.5">
                          <TriangleAlert className="w-3 h-3" />
                          {g.exceptionCount} exception{g.exceptionCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {filteredGroups.length === 0 && (
                <p className="p-8 text-center text-xs text-ink-muted">
                  {localGroups.length === 0 ? "No open actions in this queue." : "No shipments match this filter."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: action detail */}
        <div className="lg:col-span-8">
          {selectedGroup ? (
            <div className="bg-white rounded-2xl border border-border shadow-2xs p-6 space-y-4">
              {/* Shipment header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/app/shipments/${selectedGroup.shipmentId}`}
                      className="font-mono font-extrabold text-brand text-lg hover:underline cursor-pointer"
                    >
                      {selectedGroup.shipmentNumber}
                    </Link>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      selectedGroup.priority === "critical"
                        ? "bg-red-50 border-red-200 text-red-700"
                        : selectedGroup.priority === "high"
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-gray-50 border-gray-200 text-gray-600"
                    }`}>
                      {PRIORITY_LABEL[selectedGroup.priority]}
                    </span>
                    {urgencyByShipment[selectedGroup.shipmentNumber] && (() => {
                      const u = urgencyByShipment[selectedGroup.shipmentNumber];
                      const DEADLINE_LABELS: Record<string, string> = {
                        ISF_10_2: "ISF", ENTRY_FILING: "Entry Filing",
                        ENTRY_SUMMARY: "Entry Summary", DUTY_PAYMENT: "Duty Payment",
                        LAST_FREE_DAY: "Last Free Day",
                      };
                      return (
                        <CountdownChip
                          label={DEADLINE_LABELS[u.deadlineType] ?? u.deadlineType.replace(/_/g, " ")}
                          dueAt={new Date(u.dueAt)}
                          estimated={u.estimated}
                          exposureUsd={u.exposureUsd}
                          warnDays={u.deadlineType === "ENTRY_FILING" ? 5 : 3}
                        />
                      );
                    })()}
                  </div>
                  {(() => {
                    const openCount = selectedGroup.items.filter((i) => categorize(i) !== "verified").length;
                    const verifiedCount = selectedGroup.items.filter((i) => categorize(i) === "verified").length;
                    return (
                      <p className="text-xs text-ink-muted mt-0.5">
                        <span className="font-semibold text-ink">{openCount}</span> open action{openCount !== 1 ? "s" : ""}
                        {verifiedCount > 0 && <span className="text-emerald-700 font-semibold ml-2">· {verifiedCount} verified</span>}
                      </p>
                    );
                  })()}
                  {queueRankByShipment[selectedGroup.shipmentNumber]?.reason && (
                    <p className="text-[11px] font-semibold text-ink-muted mt-1 flex items-center gap-1">
                      <span className="text-ink-muted/60">Why now:</span>
                      {queueRankByShipment[selectedGroup.shipmentNumber].reason}
                    </p>
                  )}
                </div>
                <Link
                  href={`/app/shipments/${selectedGroup.shipmentId}`}
                  className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
                >
                  Open shipment →
                </Link>
              </div>

              {/* Success banner */}
              {actionSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {actionSuccess}
                </div>
              )}

              {/* Action scorecard */}
              <ActionScorecard
                items={selectedGroup.items}
                activeCategory={activeCategory}
                onCategoryClick={(c) => setActiveCategory((prev) => (prev === c ? "all" : c))}
              />

              {/* Action cards — ordered Blocked → Review → Verified */}
              <div className="space-y-3 max-h-[64vh] overflow-y-auto pr-1">
                {(["blocked", "review", "verified"] as const).map((cat) => {
                  const catItems = selectedGroup.items.filter((item) => categorize(item) === cat);
                  if (catItems.length === 0) return null;
                  if (activeCategory !== "all" && activeCategory !== cat) return null;
                  return (
                    <div key={cat} className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                          cat === "blocked" ? "text-red-600" : cat === "review" ? "text-amber-600" : "text-emerald-600"
                        }`}>
                          {cat === "blocked" ? "Blocked" : cat === "review" ? "Needs Review" : "Verified"}
                        </span>
                        <span className={`w-full h-px ${
                          cat === "blocked" ? "bg-red-100" : cat === "review" ? "bg-amber-100" : "bg-emerald-100"
                        }`} />
                        <span className={`text-[10px] font-semibold shrink-0 ${
                          cat === "blocked" ? "text-red-400" : cat === "review" ? "text-amber-400" : "text-emerald-400"
                        }`}>{catItems.length}</span>
                        {cat === "review" && canWrite && (() => {
                          const reviewDecisionIds = catItems
                            .filter((i): i is Extract<ActionItem, { kind: "decision" }> => i.kind === "decision")
                            .map((i) => i.id);
                          if (reviewDecisionIds.length < 2) return null;
                          const allSelected = reviewDecisionIds.every((id) => selectedDecisionIds.has(id));
                          return (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => selectAllInBucket(reviewDecisionIds)}
                                className="px-2 py-1 rounded-lg border border-border text-[10px] font-bold text-ink-muted hover:text-ink hover:border-brand transition-colors whitespace-nowrap"
                              >
                                {allSelected ? "Deselect All" : "Select All"}
                              </button>
                              <button
                                onClick={() => handleBulkApprove(reviewDecisionIds)}
                                disabled={bulkApproveLoading}
                                className="px-2.5 py-1 rounded-lg bg-ink text-white text-[10px] font-bold disabled:opacity-40 hover:bg-ink/80 transition-colors whitespace-nowrap"
                              >
                                {bulkApproveLoading ? "Approving…" : `Approve All (${reviewDecisionIds.length})`}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                      {catItems.map((item) =>
                        item.kind === "decision" ? (
                          <AgentResultCard
                            key={item.id}
                            item={item}
                            note={notesByDecision[item.id] ?? ""}
                            onNoteChange={(v) => setNotesByDecision((prev) => ({ ...prev, [item.id]: v }))}
                            onAction={handleDecisionAction}
                            loading={actionLoadingId === item.id}
                            canWrite={canWrite}
                            verified={cat === "verified"}
                            selected={selectedDecisionIds.has(item.id)}
                            keyboardTarget={item.id === nextActionableDecisionId}
                            onToggleSelect={() => toggleDecisionSelection(item.id)}
                            onDocClick={(docId, fileName, fieldName) => {
                              const doc = docLookup.get(docId);
                              setDocModal({ documentId: docId, fileName, fileUrl: doc?.fileUrl ?? null, initialFieldName: fieldName ?? null });
                            }}
                          />
                        ) : item.kind === "tender" || item.kind === "carrier_invoice" ? (
                          <FreightActionCard key={item.id} item={item} />
                        ) : (
                          <ExceptionCard
                            key={item.id}
                            item={item}
                            shipmentId={selectedGroup.shipmentId}
                            canWrite={canWrite}
                            canWaive={canWaive}
                            canEscalate={canEscalate}
                            onResolved={() => handleExceptionResolved(item.id)}
                            verified={cat === "verified"}
                            onDocClick={(docId, fileName) => {
                              const doc = docLookup.get(docId);
                              setDocModal({ documentId: docId, fileName, fileUrl: doc?.fileUrl ?? null });
                            }}
                            onOpenSlideOver={() => setExceptionSlideOver({ exceptionId: item.id, shipmentId: selectedGroup.shipmentId })}
                            documents={documents}
                          />
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-3xl border border-border text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
              <h3 className="text-sm font-bold text-ink">
                {localGroups.length === 0 && scopeTab === "mine"
                  ? "Your queue is empty"
                  : localGroups.length === 0
                    ? "No open actions"
                    : "No shipments match this filter"}
              </h3>
              <p className="text-xs text-ink-muted max-w-sm mx-auto">
                {localGroups.length === 0 && scopeTab === "mine"
                  ? "Nothing is assigned to you right now. Switch to Team, Unassigned, or All above to pick up other work."
                  : localGroups.length === 0
                    ? "Every AI decision has been reviewed and every exception is resolved. Nice work — check back after the next document run."
                    : "Try adjusting your search, priority filter, or the category / status dropdowns."}
              </p>
              {localGroups.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowShortcuts(true)}
                  className="text-[11px] font-semibold text-brand hover:underline inline-flex items-center gap-1"
                >
                  <Keyboard className="w-3.5 h-3.5" /> Learn the keyboard shortcuts
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Floating selection toolbar */}
      {selectedDecisionIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 bg-ink text-white rounded-2xl shadow-xl border border-white/10 animate-in slide-in-from-bottom-2">
          <span className="text-sm font-semibold">{selectedDecisionIds.size} item{selectedDecisionIds.size !== 1 ? "s" : ""} selected</span>
          <div className="w-px h-5 bg-white/20" />
          <select
            onChange={(e) => {
              if (e.target.value) {
                const targetId = e.target.value;
                const items = Array.from(selectedDecisionIds).map((id) => ({ kind: "decision" as const, id }));
                fetch("/api/work/assign", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ items, action: "assign", assigneeUserId: targetId }),
                }).then((res) => {
                  if (res.ok) {
                    setSelectedDecisionIds(new Set());
                    setActionSuccess(`Assigned ${items.length} items to team member.`);
                    router.refresh();
                  }
                });
              }
            }}
            defaultValue=""
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors border border-indigo-400 cursor-pointer"
          >
            <option value="" disabled>Assign to...</option>
            {effectiveTeamMembers.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => triggerBulkDecision("APPROVE", Array.from(selectedDecisionIds))}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            Approve
          </button>
          <button
            onClick={() => triggerBulkDecision("REJECT", Array.from(selectedDecisionIds))}
            className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-400 transition-colors cursor-pointer"
          >
            Reject
          </button>
          <button
            onClick={() => setSelectedDecisionIds(new Set())}
            className="ml-1 text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk confirmation dialog (Approve only — Reject uses RejectDialog) */}
      {bulkConfirmDialog && (
        <BulkConfirmDialog
          action={bulkConfirmDialog.action}
          count={bulkConfirmDialog.ids.length}
          overrideCount={bulkConfirmDialog.overrideCount}
          confirmInput={bulkConfirmInput}
          onConfirmInputChange={setBulkConfirmInput}
          loading={bulkApproveLoading}
          onConfirm={executeBulkDecision}
          onCancel={() => setBulkConfirmDialog(null)}
        />
      )}

      {/* Reject dialog — reason code + note, for a single card or a bulk set */}
      {rejectDialog && (
        <RejectDialog
          count={rejectDialog.mode === "bulk" ? rejectDialog.ids.length : 1}
          overrideCount={rejectDialog.mode === "bulk" ? rejectDialog.overrideCount : 0}
          loading={rejectLoading}
          onConfirm={submitReject}
          onCancel={() => setRejectDialog(null)}
        />
      )}

      {/* Keyboard shortcuts help */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-2xl border border-border shadow-2xl p-6 w-full max-w-sm mx-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-brand" />
              <h3 className="text-base font-bold text-ink">Keyboard shortcuts</h3>
            </div>
            <dl className="space-y-1.5 text-xs">
              {[
                ["j  /  ↓", "Next shipment"],
                ["k  /  ↑", "Previous shipment"],
                ["a", "Approve next open decision"],
                ["r", "Reject next open decision"],
                ["e", "Re-evaluate next open decision"],
                ["x", "Select it for a bulk action"],
                ["?", "Toggle this help"],
                ["Esc", "Close dialogs"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <dd className="text-ink-muted">{desc}</dd>
                  <dt>
                    <kbd className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-surface-muted border border-border text-ink">
                      {key}
                    </kbd>
                  </dt>
                </div>
              ))}
            </dl>
            <p className="text-[10px] text-ink-muted pt-1 border-t border-border">
              a / r / e act on the top “Needs review” card of the open shipment.
            </p>
          </div>
        </div>
      )}

      {/* Exception detail slide-over */}
      {exceptionSlideOver && (
        <ExceptionSlideOver
          exceptionId={exceptionSlideOver.exceptionId}
          shipmentId={exceptionSlideOver.shipmentId}
          canWrite={canWrite}
          canWaive={canWaive}
          teamMembers={effectiveTeamMembers}
          onResolved={() => {
            handleExceptionResolved(exceptionSlideOver.exceptionId);
            setExceptionSlideOver(null);
          }}
          onClose={() => setExceptionSlideOver(null)}
        />
      )}

      {/* Document review modal */}
      {docModal && (() => {
        const modalDecisions = (selectedGroup?.items ?? [])
          .filter((i): i is Extract<ActionItem, { kind: "decision" }> =>
            i.kind === "decision" && i.raw.documentId === docModal.documentId
          )
          .map((i) => i.raw);
        return (
          <Modal isOpen titleId="doc-modal-title" onClose={() => setDocModal(null)} size="xl">
            <ModalHeader titleId="doc-modal-title" title={docModal.fileName} onClose={() => setDocModal(null)} />
            <ModalBody>
              <DocumentReviewPanel
                documentId={docModal.documentId}
                fileName={docModal.fileName}
                fileUrl={docModal.fileUrl}
                initialFieldName={docModal.initialFieldName}
                proxyUrl={documentViewUrl(docModal.documentId)}
                decisions={modalDecisions}
                onReviewAction={async (decisionId, action) => {
                  await handleDecisionAction(decisionId, action);
                }}
                onReviewStart={markDecisionOpened}
                actionLoadingId={actionLoadingId}
                onClose={() => setDocModal(null)}
              />
            </ModalBody>
          </Modal>
        );
      })()}
    </div>
  );
}

function categorize(item: ActionItem): TriageCategory {
  if (item.kind === "exception") {
    // Critical exceptions block downstream work the same way a blocked decision does.
    if (item.severity === "Critical") return "blocked";
    return "review";
  }

  if (item.kind === "tender" || item.kind === "carrier_invoice") {
    return "review";
  }

  // Delegate to the single source of truth in decisionState.ts.
  return triageDecision({
    status: item.status,
    triageState: item.triageState ?? item.raw.triageState,
    proposedDescription: item.proposedDescription,
  });
}

function ActionScorecard({
  items,
  activeCategory,
  onCategoryClick,
}: {
  items: ActionItem[];
  activeCategory: "all" | "blocked" | "review" | "verified";
  onCategoryClick: (c: "blocked" | "review" | "verified") => void;
}) {
  const blocked = items.filter((i) => categorize(i) === "blocked").length;
  const review = items.filter((i) => categorize(i) === "review").length;
  const verified = items.filter((i) => categorize(i) === "verified").length;

  const tile = (
    cat: "blocked" | "review" | "verified",
    count: number,
    label: string,
    colors: { border: string; bg: string; active: string; num: string; text: string }
  ) => {
    const isActive = activeCategory === cat;
    return (
      <button
        key={cat}
        onClick={() => onCategoryClick(cat)}
        className={`rounded-xl border p-3 text-left w-full transition-all cursor-pointer ring-2 ${
          isActive ? `${colors.active} ring-current/30` : `${colors.border} ${colors.bg} ring-transparent hover:ring-current/10`
        }`}
      >
        <p className={`text-xl font-extrabold ${colors.num}`}>{count}</p>
        <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${colors.text}`}>{label}</p>
      </button>
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-surface-muted/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-brand/10 flex items-center justify-center">
            <Scale className="w-3.5 h-3.5 text-brand" />
          </div>
          <span className="text-xs font-bold text-ink uppercase tracking-wider">AI Review</span>
        </div>
        {activeCategory !== "all" && (
          <button onClick={() => onCategoryClick(activeCategory)} className="text-[10px] text-brand font-semibold hover:underline">
            Clear filter ×
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tile("blocked", blocked, "Blocked", {
          border: "border-red-200", bg: "bg-red-50", active: "border-red-400 bg-red-100",
          num: "text-red-700", text: "text-red-600",
        })}
        {tile("review", review, "Needs Review", {
          border: "border-amber-200", bg: "bg-amber-50", active: "border-amber-400 bg-amber-100",
          num: "text-amber-700", text: "text-amber-600",
        })}
        {tile("verified", verified, "Verified", {
          border: "border-emerald-200", bg: "bg-emerald-50", active: "border-emerald-400 bg-emerald-100",
          num: "text-emerald-700", text: "text-emerald-600",
        })}
      </div>
    </div>
  );
}

function DecisionBody({ item }: { item: Extract<ActionItem, { kind: "decision" }> }) {
  const label = decisionGroupLabel(item.raw);
  const ev = (item.raw.evidenceItems && typeof item.raw.evidenceItems === "object"
    ? item.raw.evidenceItems
    : {}) as Record<string, unknown>;

  if (label === "HTS Classification") {
    const fields = editableFieldsFor(item.raw);
    const hts = fields[0]?.value;
    const confMatch = item.decisionSummary?.match(/Confidence:\s*(\d+)%/i);
    const productMatch = item.decisionSummary?.match(/Classification for ([^:]+):/i);
    return (
      <div className="space-y-1.5">
        {hts && <Row label="HS Code" value={hts} highlight />}
        {productMatch?.[1] && <Row label="Product" value={productMatch[1].trim()} />}
        {confMatch?.[1] && <Row label="Confidence" value={`${confMatch[1]}%`} />}
        {!hts && !productMatch && <p className="text-[11px] text-ink-muted">{item.decisionSummary}</p>}
      </div>
    );
  }

  if (label === "Origin") {
    const quals = Array.isArray(ev.qualifications) ? (ev.qualifications as { countryOfOrigin?: string; ftaProgram?: string }[]) : [];
    const primary = quals[0];
    if (primary?.countryOfOrigin) {
      const fta = !primary.ftaProgram || primary.ftaProgram === "NONE" || primary.ftaProgram === "UNDETERMINED"
        ? "None"
        : primary.ftaProgram.endsWith("_CANDIDATE")
        ? `${primary.ftaProgram.replace("_CANDIDATE", "")} (candidate — pending review)`
        : primary.ftaProgram;
      return (
        <div className="space-y-1.5">
          <Row label="Country of Origin" value={primary.countryOfOrigin} highlight />
          <Row label="FTA Program" value={fta} />
          {quals.length > 1 && <Row label="Line items" value={String(quals.length)} />}
        </div>
      );
    }
  }

  if (label === "Compliance") {
    const flags = Array.isArray(ev.flags) ? (ev.flags as { severity: string; summary: string }[]) : [];
    if (flags.length === 0) return <p className="text-[11px] text-ink-muted">{item.decisionSummary || "No issues identified."}</p>;
    return (
      <div className="space-y-1.5">
        {flags.map((f, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px]">
            <span className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] shrink-0 ${
              f.severity === "HIGH" || f.severity === "CRITICAL"
                ? "bg-red-100 text-red-700"
                : f.severity === "MEDIUM"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
            }`}>{f.severity}</span>
            <span className="text-ink">{f.summary}</span>
          </div>
        ))}
      </div>
    );
  }

  if (label === "Valuation") {
    const value = typeof ev.enteredCustomsValue === "number" ? ev.enteredCustomsValue : null;
    const adjustments = Array.isArray(ev.adjustments) ? ev.adjustments : [];
    if (value !== null) return (
      <div className="space-y-1.5">
        <Row label="Entered customs value" value={`$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} highlight />
        <Row label="Method" value="Method 1 — transaction value" />
        <Row label="Adjustments" value={adjustments.length > 0 ? `${adjustments.length} applied` : "None"} />
      </div>
    );
  }

  if (label === "Document Intelligence") {
    const agency = typeof ev.primaryAgency === "string" ? ev.primaryAgency : null;
    const hasInvoice = Boolean(ev.hasCommercialInvoice);
    const lineItems = typeof ev.lineItemCount === "number" ? ev.lineItemCount : null;
    return (
      <div className="space-y-1.5">
        {agency && <Row label="Regulatory body" value={agency} highlight />}
        <Row label="Commercial invoice" value={hasInvoice ? "Present" : "Missing"} />
        {lineItems !== null && <Row label="Line items" value={String(lineItems)} />}
      </div>
    );
  }

  if (label === "Product Intelligence") {
    const profiles = Array.isArray(ev.profiles) ? (ev.profiles as { materialComposition?: string; essentialCharacter?: string; endUse?: string }[]) : [];
    const p = profiles[0];
    if (p) return (
      <div className="space-y-1.5">
        {p.materialComposition && <Row label="Material" value={p.materialComposition} highlight />}
        {p.essentialCharacter && <Row label="Essential character" value={p.essentialCharacter} />}
        {p.endUse && <Row label="End use" value={p.endUse} />}
      </div>
    );
  }

  return <p className="text-[11px] text-ink-muted leading-relaxed">{item.decisionSummary || "No details available."}</p>;
}

interface EvidenceField {
  fieldName: string;
  currentValue?: string | null;
  value?: string | null;
  pageNumber?: number | null;
  confidence?: number | null;
  source?: string | null;
}

/**
 * Collapsed-by-default list of the extraction fields a decision rests on. Reads
 * `/api/documents/:id/extractions` on first open. Each row jumps the document
 * viewer to that value's page + bounding box -- the "prove every line item"
 * path, on the card instead of two clicks away.
 */
function EvidenceExpander({
  documentId,
  onFieldClick,
}: {
  documentId: string;
  onFieldClick: (fieldName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<EvidenceField[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || fields !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/documents/${documentId}/extractions`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        const rf: EvidenceField[] = Array.isArray(data?.reviewFields) ? data.reviewFields : [];
        setFields(rf);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, documentId, fields, loading]);

  const shown = (fields ?? []).filter((f) => (f.currentValue ?? f.value ?? "").toString().trim() !== "");

  return (
    <div className="border-t border-border/40 pt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted hover:text-ink transition-colors cursor-pointer"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} />
        Evidence{fields ? ` (${shown.length})` : ""}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          {loading && <p className="text-[10px] text-ink-muted px-1">Loading source fields…</p>}
          {error && <p className="text-[10px] text-red-600 px-1">Couldn’t load evidence: {error}</p>}
          {fields && shown.length === 0 && !loading && (
            <p className="text-[10px] text-ink-muted px-1">No per-field extraction is recorded for this document.</p>
          )}
          {shown.map((f) => {
            const val = (f.currentValue ?? f.value ?? "").toString();
            const conf = typeof f.confidence === "number" ? Math.round(f.confidence) : null;
            return (
              <button
                key={f.fieldName}
                onClick={() => onFieldClick(f.fieldName)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg border border-border/60 bg-white hover:border-brand hover:bg-brand/5 transition-colors text-left cursor-pointer group"
                title="Open the document at this value"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] text-ink-muted capitalize">
                    {f.fieldName.replace(/[_.]/g, " ")}
                  </span>
                  <span className="block text-[11px] font-semibold text-ink truncate">{val}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {f.pageNumber ? (
                    <span className="text-[9px] font-mono text-ink-muted">p.{f.pageNumber}</span>
                  ) : null}
                  {conf !== null && (
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                        conf >= 90
                          ? "bg-emerald-100 text-emerald-700"
                          : conf >= 70
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {conf}%
                    </span>
                  )}
                  <FileText className="w-3 h-3 text-ink-muted group-hover:text-brand" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[11px]">
      <span className="text-ink-muted shrink-0">{label}</span>
      <span className={`text-right font-semibold ${highlight ? "text-ink" : "text-ink-muted"}`}>{value}</span>
    </div>
  );
}

/**
 * The screenshot test (issue #202, Gap 8): on its face, every card must say who
 * decided, when, on what evidence, and under what authority. A human sign-off
 * and a machine verification must never be mistakable for each other.
 */
function ProvenanceFooter({ item }: { item: Extract<ActionItem, { kind: "decision" }> }) {
  const confidence = typeof item.raw.confidence === "number" ? item.raw.confidence : null;
  const reviewer = item.raw.reviewedByUser;
  const reviewerName = reviewer
    ? ([reviewer.firstName, reviewer.lastName].filter(Boolean).join(" ") || reviewer.email)
    : null;
  const license = reviewer?.brokerLicenseNumber ?? null;
  const category = categorize(item);
  const isAutoVerified =
    !reviewerName &&
    (item.status === "AUTO_VERIFIED" ||
      item.status === "Auto-Approved" ||
      item.status === "Verified" ||
      item.triageState === "AUTO_VERIFIED" ||
      Boolean(item.raw.autoApproved));

  const when = item.raw.updatedAt ? new Date(item.raw.updatedAt) : null;
  const formattedDate = when
    ? when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const confidenceChip =
    confidence !== null ? (
      <span
        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border tabular-nums ${
          confidence >= 90
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : confidence >= 70
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-red-50 border-red-200 text-red-700"
        }`}
        title="Model confidence in the proposed answer"
      >
        {confidence}% confident
      </span>
    ) : null;

  // Human sign-off — the authority line an auditor is looking for.
  if (reviewerName) {
    const rejected = category === "blocked" && (item.status === "Rejected" || item.triageState === "REJECTED");
    return (
      <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border/40">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            rejected
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          {rejected ? <X className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
          {rejected ? "Rejected" : "Approved"} by {reviewerName}
        </span>
        {license && (
          <span
            className="text-[10px] font-semibold text-ink-muted tabular-nums"
            title="Customs broker license of the reviewer"
          >
            License #{license}
          </span>
        )}
        {formattedDate && <span className="text-[10px] text-ink-muted">{formattedDate}</span>}
        {confidenceChip}
      </div>
    );
  }

  // Machine verification — deliberately distinct: not a human approval.
  if (isAutoVerified) {
    return (
      <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border/40">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-violet-50 border-violet-200 text-violet-700"
          title={
            "Verified automatically by the confidence policy — not a licensed human sign-off. " +
            "Stays on the record for the next audit." +
            (item.raw.autoApprovalPolicy ? ` Policy: ${item.raw.autoApprovalPolicy}.` : "")
          }
        >
          <Zap className="w-3 h-3" />
          Auto-verified
          {item.raw.autoApprovalPolicy ? ` · ${item.raw.autoApprovalPolicy}` : ""}
        </span>
        {confidenceChip}
        {formattedDate && <span className="text-[10px] text-ink-muted">{formattedDate}</span>}
      </div>
    );
  }

  if (!confidenceChip) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-border/40">
      {confidenceChip}
      <span className="text-[10px] text-ink-muted">Awaiting review</span>
    </div>
  );
}

function AgentResultCard({
  item,
  note,
  onNoteChange,
  onAction,
  loading,
  canWrite,
  verified = false,
  selected = false,
  keyboardTarget = false,
  onToggleSelect,
  onDocClick,
}: {
  item: Extract<ActionItem, { kind: "decision" }>;
  note: string;
  onNoteChange: (v: string) => void;
  onAction: (id: string, action: "APPROVE" | "REJECT" | "RE_EVALUATE") => void;
  loading: boolean;
  canWrite: boolean;
  verified?: boolean;
  selected?: boolean;
  keyboardTarget?: boolean;
  onToggleSelect?: () => void;
  onDocClick: (docId: string, fileName: string, fieldName?: string) => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const label = reviewerLabel(item.raw);
  const effectiveCategory = categorize(item);
  const docId = item.documentId || item.raw.documentId;
  const isApproved = effectiveCategory === "verified";

  return (
    <div className={`border rounded-2xl p-4 space-y-3 transition-all ${
      selected
        ? "border-brand bg-blue-50/60 ring-2 ring-brand/20"
        : keyboardTarget && !verified
          ? "border-brand/60 bg-white ring-1 ring-brand/30"
        : verified
          ? "border-emerald-200 bg-emerald-50/40 opacity-80"
          : effectiveCategory === "blocked"
            ? "border-red-300 bg-red-50/60"
            : "border-amber-200 bg-amber-50/40"
    }`}>
      {/* Card header: checkbox + doc link + approved pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {!verified && onToggleSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand/30 shrink-0 cursor-pointer"
            />
          )}
        <div className="min-w-0 space-y-0.5">
          {item.documentName && docId ? (
            <button
              onClick={() => onDocClick(docId, item.documentName!)}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline cursor-pointer max-w-full text-left"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item.documentName}</span>
            </button>
          ) : item.documentName ? (
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item.documentName}</span>
            </div>
          ) : null}
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
        </div>
        </div>
        {isApproved && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 bg-emerald-50 border-emerald-200 text-emerald-700">
            Approved
          </span>
        )}
      </div>

      {/* Extracted data */}
      <DecisionBody item={item} />

      {/* Evidence — the source fields this decision rests on, straight from the
          document, each a click away from its exact spot on the page. */}
      {docId && (
        <EvidenceExpander
          documentId={docId}
          onFieldClick={(fieldName) => onDocClick(docId, item.documentName ?? "Document", fieldName)}
        />
      )}

      {/* Provenance footer */}
      <ProvenanceFooter item={item} />

      {/* Note */}
      {showNote && (
        <textarea
          rows={2}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Add a note for the audit log…"
          className="w-full px-3 py-2 rounded-xl border border-border text-xs text-ink resize-none focus:outline-none focus:border-brand"
        />
      )}

      {/* Actions — compact; hide approve/reject when already approved */}
      {canWrite && (
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          {!isApproved && (
            <button
              onClick={() => onAction(item.id, "APPROVE")}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-ink text-white text-xs font-semibold disabled:opacity-40 hover:bg-ink/80 transition-colors"
            >
              {loading ? "Saving…" : "Approve"}
            </button>
          )}
          {!isApproved && (
            <button
              onClick={() => onAction(item.id, "REJECT")}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-ink hover:border-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
            >
              Reject…
            </button>
          )}
          <button
            onClick={() => onAction(item.id, "RE_EVALUATE")}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-40 transition-colors"
          >
            Re-evaluate
          </button>
          {!showNote && (
            <button onClick={() => setShowNote(true)} className="text-xs text-ink-muted hover:text-ink">
              + Note
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function parseExceptionDetails(item: Extract<ActionItem, { kind: "exception" }>) {
  const desc = item.description;
  const notFoundMatch = desc.match(/^(.*?)\s+was not found on\s+(.*?)\.?$/i);
  const isExtractedField = desc.includes("(Extracted from");
  const isDocMissing = desc.toLowerCase().includes("missing:") || desc.toLowerCase().includes("missing");

  const lineItemMatch = desc.match(/^(.*?)\s+could not be extracted for (.*?)\s+on\s+(.*?)\s*(--|$)/i);
  if (lineItemMatch) {
    const fieldName = lineItemMatch[1].trim();
    const lineDetails = lineItemMatch[2].trim();
    const docName = lineItemMatch[3].trim();

    return {
      category: "DATA MISMATCH",
      title: `Line Item ${fieldName} Missing`,
      sourceDoc: docName,
      summaryPrefix: `${fieldName} could not be extracted for ${lineDetails} on `,
      sourceDocText: docName,
      summarySuffix: " -- confirm before filing.",
      actionExpected: `Review line items on ${docName} and confirm ${fieldName.toLowerCase()} values.`,
    };
  }

  const lineItemLegacyMatch = desc.match(/^(.*?)\s+could not be extracted for (.*?)$/i);
  if (lineItemLegacyMatch) {
    const fieldName = lineItemLegacyMatch[1].trim();
    const rest = lineItemLegacyMatch[2].trim();

    return {
      category: "DATA MISMATCH",
      title: `Line Item ${fieldName} Missing`,
      sourceDoc: null,
      summaryPrefix: `${fieldName} could not be extracted for ${rest}`,
      sourceDocText: null,
      summarySuffix: "",
      actionExpected: `Review and confirm ${fieldName.toLowerCase()} for affected line items.`,
    };
  }

  if (notFoundMatch) {
    const fieldName = notFoundMatch[1].trim();
    const docName = notFoundMatch[2].trim();

    return {
      category: "MISSING FIELD",
      title: `Missing Field: ${fieldName}`,
      sourceDoc: docName,
      summaryPrefix: `'${fieldName}' was not found on `,
      sourceDocText: docName,
      summarySuffix: ".",
      actionExpected: `Upload a revised document containing ${fieldName}, or resolve with verified value.`,
    };
  }

  if (isExtractedField) {
    const match = desc.match(/^(.*?)\s*\(Extracted from (.*?)\)$/);
    const fieldName = match ? match[1].trim() : desc;
    const docName = match ? match[2].trim() : "uploaded document";

    return {
      category: "MISSING FIELD",
      title: `Missing Field: ${fieldName}`,
      sourceDoc: docName,
      summaryPrefix: `'${fieldName}' was not detected during extraction from `,
      sourceDocText: docName,
      summarySuffix: ".",
      actionExpected: `Upload a revised document containing ${fieldName}, or resolve with verified value.`,
    };
  }

  if (isDocMissing) {
    const docTypeMatch = desc.match(/^(.*?\s+Missing):/i);
    const title = docTypeMatch ? docTypeMatch[1].trim() : "Missing Document";
    const docName = title.replace(/\s+Missing/i, "");

    return {
      category: "MISSING DOCUMENT",
      title: title,
      sourceDoc: null,
      summaryPrefix: `Required document '${docName}' has not been uploaded.`,
      sourceDocText: null,
      summarySuffix: "",
      actionExpected: `Upload ${docName} to clear pre-filing gate.`,
    };
  }

  return {
    category: item.type.replace(/_/g, " ").toUpperCase(),
    title: item.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    sourceDoc: null,
    summaryPrefix: desc,
    sourceDocText: null,
    summarySuffix: "",
    actionExpected: "Review exception details and resolve or waive.",
  };
}

function ExceptionCard({
  item,
  shipmentId,
  canWrite,
  canWaive,
  canEscalate = false,
  onResolved,
  verified = false,
  onDocClick,
  onOpenSlideOver,
  documents = [],
}: {
  item: Extract<ActionItem, { kind: "exception" }>;
  shipmentId?: string;
  canWrite: boolean;
  canWaive: boolean;
  canEscalate?: boolean;
  onResolved: () => void;
  verified?: boolean;
  onDocClick?: (docId: string, fileName: string) => void;
  onOpenSlideOver?: () => void;
  documents?: DocSummary[];
}) {
  const [resolved, setResolved] = useState(false);

  if (resolved) {
    return (
      <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4">
        <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          Exception closed
        </div>
      </div>
    );
  }

  const parsed = parseExceptionDetails(item);

  // Find target document by ID, explicit filename match, or fallback to shipment's primary document
  const targetDocId = item.documentId || item.raw.documentId;
  const targetDoc = targetDocId
    ? documents.find((d) => d.id === targetDocId)
    : parsed.sourceDocText
      ? documents.find((d) => d.fileName.toLowerCase() === parsed.sourceDocText!.toLowerCase()) || documents[0]
      : documents[0];

  const docNameToDisplay = parsed.sourceDocText || (targetDoc ? targetDoc.fileName : null);
  const showOnPrefix = !parsed.sourceDocText && Boolean(targetDoc);

  const severityClass =
    item.severity === "Critical"
      ? "bg-red-50 border-red-200 text-red-700"
      : item.severity === "High"
        ? "bg-amber-50 border-amber-200 text-amber-700"
        : "bg-gray-50 border-gray-200 text-gray-600";

  // The DB's `blocking` column is the source of truth (filing readiness gates
  // read it directly) -- fall back to severity only for synthetic items that
  // never went through createExceptionItem (e.g. the missing-document cards
  // built in shipmentActions.ts, which carry no `blocking` field).
  const isBlocking = item.raw.blocking ?? (item.severity === "Critical" || item.severity === "High");

  const now = new Date();
  const created = new Date(item.createdAt);
  const diffMs = Math.max(0, now.getTime() - created.getTime());
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const ageText = diffDays > 0 ? `${diffDays}d ago` : diffHours > 0 ? `${diffHours}h ago` : "just now";

  // Calculate expiry countdown (24h for Critical, 72h for High, 120h for others)
  const expiryHoursMax = item.severity === "Critical" ? 24 : item.severity === "High" ? 72 : 120;
  const expiryDate = new Date(created.getTime() + expiryHoursMax * 3600 * 1000);
  const expiryMsRemaining = expiryDate.getTime() - now.getTime();
  const isExpired = expiryMsRemaining <= 0;
  // Clamping a negative remainder to 0h reads as "about to expire" when the
  // item is actually overdue -- show how overdue instead.
  const expiryHoursRemaining = Math.round(Math.abs(expiryMsRemaining) / (1000 * 3600));

  return (
    <div className={`border rounded-2xl p-4 space-y-3 ${
      verified
        ? "border-emerald-200 bg-emerald-50/40 opacity-75"
        : item.severity === "Critical"
          ? "border-red-300 bg-red-50/60"
          : "border-amber-200 bg-amber-50/40"
    }`}>
      {/* Header: Category Badge + Title + Severity + Blocking */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600/90">
            {parsed.category}
          </span>
          <h4 className="text-sm font-bold text-ink truncate">
            {parsed.title}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isBlocking && (
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200">
              FILING BLOCKER
            </span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${severityClass}`}>
            {item.severity}
          </span>
        </div>
      </div>

      {/* Summary with Hyperlinked Document Name */}
      <p className="text-xs text-ink leading-relaxed font-medium">
        {parsed.summaryPrefix}
        {showOnPrefix && " on "}
        {docNameToDisplay ? (
          targetDoc && onDocClick ? (
            <button
              onClick={() => onDocClick(targetDoc.id, targetDoc.fileName)}
              className="font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer align-baseline"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>{docNameToDisplay}</span>
            </button>
          ) : (
            <span className="font-bold text-ink">{docNameToDisplay}</span>
          )
        ) : null}
        {parsed.summarySuffix}
      </p>

      {/* Action Expected Banner */}
      <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs text-amber-900 flex items-start gap-2">
        <Upload className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-[10px] uppercase tracking-wider block text-amber-800">Action Required</span>
          <span className="text-[11px]">{parsed.actionExpected}</span>
        </div>
      </div>

      {/* Age, expiry countdown chip, action link, and Details button */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-[11px] text-ink-muted">
        <div className="flex items-center gap-2">
          <span>Created {ageText}</span>
          <span className="text-border">•</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            isExpired || expiryHoursRemaining <= 12 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"
          }`}>
            {isExpired ? `Expired ${expiryHoursRemaining}h ago` : `Expires in ${expiryHoursRemaining}h`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenSlideOver && (
            <button
              type="button"
              onClick={onOpenSlideOver}
              className="text-brand font-semibold hover:underline"
            >
              Details →
            </button>
          )}
          {shipmentId && (
            <Link
              href={`/app/shipments/${shipmentId}`}
              className="text-ink-muted font-semibold hover:underline flex items-center gap-1"
            >
              Shipment →
            </Link>
          )}
        </div>
      </div>

      {canWrite && (
        <ExceptionQuickActions
          exceptionId={item.id}
          version={item.version}
          canWaive={canWaive}
          canEscalate={canEscalate}
          documentId={targetDoc?.id || item.documentId || item.raw.documentId}
          onResolved={() => { setResolved(true); onResolved(); }}
        />
      )}
    </div>
  );
}

function BulkConfirmDialog({
  action,
  count,
  overrideCount,
  confirmInput,
  onConfirmInputChange,
  loading,
  onConfirm,
  onCancel,
}: {
  action: "APPROVE" | "REJECT";
  count: number;
  overrideCount: number;
  confirmInput: string;
  onConfirmInputChange: (v: string) => void;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const needsConfirmText = overrideCount > 0;
  const canSubmit = !needsConfirmText || confirmInput.trim() === "CONFIRM";

  const overrideNote = overrideCount > 0
    ? ` (${overrideCount} low-confidence override${overrideCount !== 1 ? "s" : ""})`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-ink">
            {action === "APPROVE" ? "Approve" : "Reject"} {count} decision{count !== 1 ? "s" : ""}
          </h3>
          <p className="text-xs text-ink-muted">
            {action === "APPROVE"
              ? `Approve ${count} decision${count !== 1 ? "s" : ""}${overrideNote} and sign into audit log?`
              : `Reject ${count} decision${count !== 1 ? "s" : ""}${overrideNote} and return to queue?`}
          </p>
        </div>

        {needsConfirmText && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
            <p className="text-xs text-amber-900 font-medium">
              This includes {overrideCount} low-confidence decision{overrideCount !== 1 ? "s" : ""}. Type <span className="font-mono font-bold">CONFIRM</span> to proceed.
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => onConfirmInputChange(e.target.value)}
              placeholder="Type CONFIRM"
              className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs text-ink focus:outline-none focus:border-brand font-mono"
              autoFocus
            />
          </div>
        )}

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canSubmit || loading}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition-colors ${
              action === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
            }`}
          >
            {loading ? "Processing…" : action === "APPROVE" ? "Approve" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A rejection is a legal position — the API requires both a structured reason
 * code (analytics) and a free-text note (the story), so this dialog collects
 * both before anything is written. Used for a single card and for bulk reject.
 */
function RejectDialog({
  count,
  overrideCount,
  loading,
  onConfirm,
  onCancel,
}: {
  count: number;
  overrideCount: number;
  loading: boolean;
  onConfirm: (reasonCode: string, note: string) => void;
  onCancel: () => void;
}) {
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const selected = REJECTION_REASONS.find((r) => r.code === reasonCode) ?? null;
  const canSubmit = reasonCode !== "" && note.trim().length > 0 && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-ink">
            Reject {count} decision{count !== 1 ? "s" : ""}
          </h3>
          <p className="text-xs text-ink-muted">
            Both a reason and a note are recorded in the audit log.
            {overrideCount > 0 && (
              <span className="text-amber-700 font-semibold">
                {" "}{overrideCount} {overrideCount === 1 ? "is" : "are"} low-confidence.
              </span>
            )}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Reason</label>
          <div className="grid gap-1.5 max-h-56 overflow-y-auto pr-1">
            {REJECTION_REASONS.map((r) => (
              <button
                key={r.code}
                type="button"
                onClick={() => setReasonCode(r.code)}
                className={`text-left px-3 py-2 rounded-xl border text-xs transition-all cursor-pointer ${
                  reasonCode === r.code
                    ? "border-brand bg-blue-50/70 ring-2 ring-brand/20"
                    : "border-border hover:border-brand/50 hover:bg-surface-muted"
                }`}
              >
                <span className="font-semibold text-ink">{r.label}</span>
                {r.hint && <span className="block text-[10px] text-ink-muted mt-0.5">{r.hint}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Note <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
            placeholder={
              selected?.code === "OTHER"
                ? "Explain why this is being rejected…"
                : "What does the reviewer need to know? (audit log)"
            }
            className="w-full px-3 py-2 rounded-xl border border-border text-xs text-ink resize-none focus:outline-none focus:border-brand"
          />
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reasonCode, note.trim())}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-colors"
          >
            {loading ? "Rejecting…" : `Reject ${count > 1 ? count : ""}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}

function FreightActionCard({
  item,
}: {
  item: Extract<ActionItem, { kind: "tender" | "carrier_invoice" }>;
}) {
  const isTender = item.kind === "tender";
  return (
    <div className="border border-border bg-white rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-ink uppercase tracking-wide">
          {isTender ? "Tender Action" : "Carrier Invoice Match"}
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          {item.status}
        </span>
      </div>
      <p className="text-xs text-ink font-medium">{item.title || item.description}</p>
      <div className="flex items-center gap-2 pt-1">
        {isTender ? (
          <>
            <button className="px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-colors">
              Review Tender Response
            </button>
            <button className="px-3 py-1.5 rounded-xl border border-border text-ink text-xs font-bold hover:bg-surface-muted transition-colors">
              Send Tender
            </button>
          </>
        ) : (
          <>
            <button className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors">
              Review Invoice Mismatch
            </button>
            <button className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors">
              Override Mismatch
            </button>
          </>
        )}
      </div>
    </div>
  );
}

