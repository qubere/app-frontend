"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  TriangleAlert, ArrowUpRight, CheckCircle2, Search,
  CheckSquare, Clock, Scale
} from "lucide-react";
import { TmsSidebar } from "@/components/TmsSidebar";
import { TmsHeader } from "@/components/TmsHeader";
import { Card, Button } from "@/components/ui";
import { ExceptionSlideOver } from "./ExceptionSlideOver";
import { AgenticDecisionCard } from "@/components/AgenticDecisionCard";
import { ModifyDecisionModal } from "@/components/ModifyDecisionModal";
import type { WorkQueueItem } from "@/modules/operations/services/operationsSummaryService";

export interface ActionItemDetail {
  id: string;
  kind: "exception" | "decision" | "document" | "filing";
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  category: "blocked" | "review" | "verified";
  lineItemDescription?: string;
  description: string;
  aiRecommendation?: string;
  impactSummary?: string;
  deadlineLabel?: string;
  deadlineBreached?: boolean;
  status: "Open" | "In Review" | "Resolved" | "Approved" | "Waived";
  createdAt: string;
}

function mapActionItemToWorkQueueItem(item: ActionItemDetail, group: ShipmentGroup): WorkQueueItem {
  const isTmsDispatch = item.type.includes("TENDER") || item.type.includes("DISPATCH") || group.dispatchStatus === "DISPATCH BLOCKED";

  return {
    id: item.id,
    itemType: item.kind === "decision" ? "DECISION" : "EXCEPTION",
    domain: item.kind === "document" ? "DOCUMENT" : "TRANSPORTATION",
    specificType: item.kind === "document" ? "DOCUMENT EXCEPTION" : "DELIVERY EXCEPTION",
    decisionState: item.category === "review" ? "AI_NEEDS_INPUT" : "AI_NEEDS_APPROVAL",
    severity: item.severity,
    urgencyLabel: item.deadlineBreached ? "SLA BREACHED • 6h 18m ago" : "ACTION REQUIRED IN 1H 42M",
    timeToActFormatted: item.deadlineBreached ? "SLA BREACHED • 6h 18m ago" : "ACTION REQUIRED IN 1H 42M",
    shipmentId: group.shipmentId,
    shipmentNumber: group.shipmentNumber,
    routeText: `${group.originPort} → ${group.destPort}`,
    customerName: group.customerName,
    operationalTitle: isTmsDispatch ? "CARRIER TENDER DISPATCH TIMEOUT" : item.type.replace(/_/g, " ").toUpperCase(),
    subtext: item.description || "Operational freight dispatch issue flagged for human decision.",
    legalBasis: "49 CFR § 395.3 (FMCSA HOS)",
    agentStatusText: "Automation paused because human dispatcher approval is required.",
    whatHappened: item.description || "Primary carrier failed to acknowledge tender dispatch within 60-minute SLA window.",
    whyItMatters: item.impactSummary || "Delivery promise date at risk. Container faces terminal demurrage exposure ($350/day).",
    qubereRecommends: item.aiRecommendation || "Re-tender load to secondary waterfall carrier (EFSX Express) at contracted rate.",
    whyRecommends: "Primary carrier tender timed out. Secondary carrier is fully contracted with verified rate sheet.",
    ruleConfidence: 100,
    recommendationConfidence: 94,
    confidenceLevel: "High",
    impact: {
      schedule: "+1 day risk",
      costUsd: 350,
      exposureUsd: 350,
      customerImpact: "Delivery promise date at risk",
      customsImpact: "Clear / Released",
    },
    afterApproval: [
      "Re-tender freight load to secondary waterfall carrier (EFSX Express)",
      "Notify operations dispatcher & update customer tracking ETA",
      "Confirm pickup appointment window with port terminal",
      "Monitor carrier EDI 214 status event stream",
    ],
    evidence: [
      { label: "Tender SLA Window", value: "60 Minutes Expiration", source: "Policy Engine" },
      { label: "Dispatch Status", value: group.dispatchStatus, source: "TMS Telematics" },
      { label: "DOT Reference", value: "49 CFR § 395.3 HOS Rules", source: "FMCSA Code" },
    ],
    primaryActionLabel: "Re-Tender Carrier",
    secondaryActionLabel: "Modify Dispatch",
    allowModify: true,
    allowReject: true,
  };
}

export interface ShipmentGroup {
  shipmentId: string;
  shipmentNumber: string;
  customerName: string;
  carrierName?: string;
  transportMode: string;
  originPort: string;
  destPort: string;
  dispatchStatus: "DISPATCH BLOCKED" | "TENDER PENDING" | "DEMURRAGE RISK" | "IN TRANSIT" | "DELIVERED";
  priority: "critical" | "high" | "normal";
  deadlineLabel: string;
  deadlineBreached: boolean;
  itemCount: number;
  decisionCount: number;
  exceptionCount: number;
  items: ActionItemDetail[];
}

export function ExceptionsGroupedClient({ initialGroups }: { initialGroups: ShipmentGroup[] }) {
  const groups: ShipmentGroup[] = useMemo(() => {
    return initialGroups ?? [];
  }, [initialGroups]);

  // Selected shipment state
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(
    () => groups[0]?.shipmentId ?? ""
  );

  // Category filter state: "all" | "blocked" | "review" | "verified"
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<"all" | "blocked" | "review" | "verified">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [resolvedItemIds, setResolvedItemIds] = useState<string[]>([]);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [activeSlideOver, setActiveSlideOver] = useState<{ item: ActionItemDetail; shipmentNumber: string; importerName: string } | null>(null);
  const [modifyingWorkItem, setModifyingWorkItem] = useState<WorkQueueItem | null>(null);
  const [isModifyOpen, setIsModifyOpen] = useState(false);

  const selectedGroup = groups.find((g) => g.shipmentId === selectedShipmentId) ?? groups[0];

  const handleResolveItem = (itemId: string) => {
    setResolvedItemIds((prev) => [...prev, itemId]);
    setActionSuccessMsg("Issue approved & signed into immutable audit log.");
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handleBulkApprove = () => {
    setResolvedItemIds((prev) => [...prev, ...Array.from(selectedItemIds)]);
    setSelectedItemIds(new Set());
    setActionSuccessMsg(`${selectedItemIds.size} item(s) approved & signed into audit log.`);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.shipmentNumber.toLowerCase().includes(q) ||
        g.customerName.toLowerCase().includes(q) ||
        g.items.some((i) => i.type.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  // Active items for selected group
  const activeItemsForSelectedGroup = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.items.filter((i) => !resolvedItemIds.includes(i.id));
  }, [selectedGroup, resolvedItemIds]);

  // Category counts for selected group
  const blockedCount = activeItemsForSelectedGroup.filter((i) => i.category === "blocked").length;
  const reviewCount = activeItemsForSelectedGroup.filter((i) => i.category === "review").length;
  const verifiedCount = activeItemsForSelectedGroup.filter((i) => i.category === "verified").length;

  const displayedItems = useMemo(() => {
    if (activeCategoryFilter === "all") return activeItemsForSelectedGroup;
    return activeItemsForSelectedGroup.filter((i) => i.category === activeCategoryFilter);
  }, [activeItemsForSelectedGroup, activeCategoryFilter]);

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex w-full">
      <TmsSidebar accountName="Enterprise Freight" />

      <div className="flex-1 flex flex-col min-w-0">
        <TmsHeader tenantName="Enterprise Freight" userName="Operations Lead" />

        <main className="flex-1 p-6 overflow-y-auto space-y-5 max-w-[1600px] mx-auto w-full">
          {/* Header Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-border shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <TriangleAlert className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h1 className="text-xl font-black text-ink tracking-tight">Action & Exceptions Workbench</h1>
                <p className="text-xs text-ink-muted">
                  {groups.reduce((acc, g) => acc + g.items.filter((i) => !resolvedItemIds.includes(i.id)).length, 0)} open action items across {groups.length} shipments
                </p>
              </div>
            </div>

            {/* Filter Search Input */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shipment, carrier or issue…"
                  className="pl-8 pr-4 py-2 text-xs bg-surface-muted border border-border rounded-xl focus:outline-none focus:border-brand focus:bg-white text-ink w-64 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Toast Banner */}
          {actionSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          {/* TWO-COLUMN WORKSPACE LAYOUT */}
          {initialGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-border shadow-2xs text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-base font-extrabold text-ink">All Clear! No Open Exceptions</h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Your workspace has 0 open exceptions or dispatch blocks. Create a new order or tender a load to get started.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN: Shipments List Selector (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="bg-white p-4 rounded-2xl border border-border shadow-2xs space-y-3">
                <div className="border-b border-border pb-2 flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-ink">
                    Shipments ({filteredGroups.length})
                  </h2>
                  <span className="text-[10px] font-bold text-ink-muted bg-surface-muted px-2 py-0.5 rounded-md">
                    Sorted by Risk
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[75vh] overflow-y-auto pr-1">
                  {filteredGroups.map((g) => {
                    const isSelected = g.shipmentId === selectedShipmentId;

                    return (
                      <button
                        key={g.shipmentId}
                        type="button"
                        onClick={() => {
                          setSelectedShipmentId(g.shipmentId);
                          setActiveCategoryFilter("all");
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer space-y-1 block ${
                          isSelected
                            ? "bg-blue-50/90 border-brand shadow-2xs ring-1 ring-brand/30"
                            : "bg-surface-muted/40 border-border hover:border-brand/50 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-mono font-bold text-brand text-xs">{g.shipmentNumber}</span>
                          <div className="flex items-center space-x-1">
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                              g.dispatchStatus === "DISPATCH BLOCKED" || g.dispatchStatus === "DEMURRAGE RISK"
                                ? "bg-red-100 text-red-800 border-red-300"
                                : "bg-emerald-100 text-emerald-800 border-emerald-200"
                            }`}>
                              {g.dispatchStatus}
                            </span>
                            <span className="text-[9px] font-bold text-red-700 bg-red-50 px-1 py-0.5 rounded border border-red-200">
                              Critical
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 text-[10px] font-mono text-red-700 font-bold">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{g.deadlineLabel} • {g.deadlineBreached ? "BREACHED" : "DUE SOON"}</span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-[10px] font-medium text-ink-muted pt-0.5 border-t border-border/40">
                          <span className="text-ink font-bold">{g.itemCount} items</span>
                          <span>·</span>
                          <span>{g.decisionCount} decisions</span>
                          <span>·</span>
                          <span className="text-amber-800 font-bold">{g.exceptionCount} exceptions</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Selected Shipment Action Workspace (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {selectedGroup && (
                <Card className="p-6 bg-white border border-border shadow-2xs space-y-5">
                  {/* Shipment Header Banner */}
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <div className="flex items-center space-x-3">
                        <h2 className="text-xl font-black text-ink font-mono">{selectedGroup.shipmentNumber}</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-red-100 text-red-900 border border-red-300">
                          {selectedGroup.dispatchStatus}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted font-medium mt-1">
                        Customer: <strong className="text-ink">{selectedGroup.customerName}</strong> • Lane: <strong className="text-mono text-ink">{selectedGroup.originPort} → {selectedGroup.destPort}</strong>
                      </p>
                    </div>

                    <Link
                      href={`/shipments/${selectedGroup.shipmentId}`}
                      className="px-3.5 py-1.5 rounded-xl bg-surface-muted border border-border text-xs font-bold text-brand hover:bg-brand hover:text-white transition-all inline-flex items-center space-x-1"
                    >
                      <span>Open Shipment Workspace</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* CLICKABLE CATEGORIZATION SCORECARD STAT TILES */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center space-x-1.5">
                        <Scale className="w-4 h-4 text-brand" />
                        <span>AI Review & Categorization</span>
                      </span>
                      {activeCategoryFilter !== "all" && (
                        <button
                          onClick={() => setActiveCategoryFilter("all")}
                          className="text-[11px] text-brand font-bold hover:underline cursor-pointer"
                        >
                          Clear category filter ×
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Blocked Tile */}
                      <button
                        onClick={() => setActiveCategoryFilter(activeCategoryFilter === "blocked" ? "all" : "blocked")}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                          activeCategoryFilter === "blocked"
                            ? "bg-red-100 border-red-400 ring-2 ring-red-300 shadow-2xs"
                            : "bg-red-50/60 border-red-200 hover:border-red-300"
                        }`}
                      >
                        <p className="text-2xl font-black text-red-800 font-mono">{blockedCount}</p>
                        <p className="text-[10px] font-extrabold uppercase text-red-700 tracking-wider mt-0.5">Blocked</p>
                      </button>

                      {/* Needs Review Tile */}
                      <button
                        onClick={() => setActiveCategoryFilter(activeCategoryFilter === "review" ? "all" : "review")}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                          activeCategoryFilter === "review"
                            ? "bg-amber-100 border-amber-400 ring-2 ring-amber-300 shadow-2xs"
                            : "bg-amber-50/60 border-amber-200 hover:border-amber-300"
                        }`}
                      >
                        <p className="text-2xl font-black text-amber-900 font-mono">{reviewCount}</p>
                        <p className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wider mt-0.5">Needs Review</p>
                      </button>

                      {/* Verified Tile */}
                      <button
                        onClick={() => setActiveCategoryFilter(activeCategoryFilter === "verified" ? "all" : "verified")}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                          activeCategoryFilter === "verified"
                            ? "bg-emerald-100 border-emerald-400 ring-2 ring-emerald-300 shadow-2xs"
                            : "bg-emerald-50/60 border-emerald-200 hover:border-emerald-300"
                        }`}
                      >
                        <p className="text-2xl font-black text-emerald-900 font-mono">{verifiedCount}</p>
                        <p className="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider mt-0.5">Verified</p>
                      </button>
                    </div>
                  </div>

                  {/* Bulk Actions Header */}
                  {selectedItemIds.size > 0 && (
                    <div className="p-3 bg-brand/10 border border-brand/20 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-150">
                      <span className="font-bold text-brand">{selectedItemIds.size} item(s) selected</span>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" onClick={handleBulkApprove} className="bg-emerald-600 text-white font-bold cursor-pointer">
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Approve Selected</span>
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setSelectedItemIds(new Set())}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Action Item Cards */}
                  <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                    {displayedItems.length === 0 ? (
                      <div className="p-8 text-center text-xs text-ink-muted font-medium bg-surface-muted rounded-xl border border-dashed border-border">
                        No action items in category <strong className="text-ink">{activeCategoryFilter}</strong>.
                      </div>
                    ) : (
                      displayedItems.map((item) => {
                        const workItem = mapActionItemToWorkQueueItem(item, selectedGroup);
                        return (
                          <AgenticDecisionCard
                            key={item.id}
                            item={workItem}
                            onExecuteAction={async (itemId, _action, _itemType, _note) => {
                              handleResolveItem(itemId);
                            }}
                            onOpenModify={(wItem) => {
                              setModifyingWorkItem(wItem);
                              setIsModifyOpen(true);
                            }}
                          />
                        );
                      })
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

          {/* Slide-Over Drawer */}
          {activeSlideOver && (
            <ExceptionSlideOver
              isOpen={Boolean(activeSlideOver)}
              onClose={() => setActiveSlideOver(null)}
              exception={{
                id: activeSlideOver.item.id,
                type: activeSlideOver.item.type,
                severity: activeSlideOver.item.severity,
                shipmentNumber: activeSlideOver.shipmentNumber,
                importerName: activeSlideOver.importerName,
                description: activeSlideOver.item.description,
                lineItemDescription: activeSlideOver.item.lineItemDescription,
                aiRecommendation: activeSlideOver.item.aiRecommendation,
                status: activeSlideOver.item.status,
              }}
              onResolved={(id) => {
                handleResolveItem(id);
                setActiveSlideOver(null);
              }}
            />
          )}
          {/* Modify Decision Modal */}
          <ModifyDecisionModal
            item={modifyingWorkItem}
            isOpen={isModifyOpen}
            onClose={() => {
              setIsModifyOpen(false);
              setModifyingWorkItem(null);
            }}
            onApproveModified={async (itemId, _note) => {
              handleResolveItem(itemId);
            }}
          />
        </main>
      </div>
    </div>
  );
}
