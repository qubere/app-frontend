"use client";

import { useState } from "react";
import {
  Anchor,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  FileCheck2,
  FileWarning,
  MapPin,
  Plus,
  Plane,
  Truck,
  Train,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit2,
  Sparkles,
  FileText,
  Check,
} from "lucide-react";

export interface JourneyStop {
  id: string;
  sequence: number;
  role: string | null;
  name: string;
  unlocode: string | null;
  firmsCode: string | null;
  timezone: string | null;
}

export interface LegDocRow {
  legDocumentId: string;
  expectedDocType: string;
  requirement: string;
  requirementReason: string | null;
  status: "MISSING" | "RECEIVED" | "REVIEW_REQUIRED" | "PROCESSED";
  document: { id: string; fileName: string; fileUrl: string | null; confidence: number | null } | null;
}

export interface JourneyLeg {
  id: string;
  sequence: number;
  legType: string;
  mode: string;
  status: string;
  statusReason: string | null;
  origin: { stopId: string; name: string; unlocode: string | null };
  destination: { stopId: string; name: string; unlocode: string | null };
  carrier: { name: string | null; scac: string | null };
  conveyance: { vesselName?: string; voyageNumber?: string; flightNumber?: string; imoNumber?: string };
  references: { billOfLadingNumber?: string; billOfLadingType?: string; bookingNumber?: string };
  timeline: {
    plannedDeparture: Date | string | null;
    estimatedDeparture: Date | string | null;
    actualDeparture: Date | string | null;
    plannedArrival: Date | string | null;
    estimatedArrival: Date | string | null;
    actualArrival: Date | string | null;
  };
  documents: {
    total: number;
    onFile: number;
    missingRequired: number;
    rows: LegDocRow[];
  };
  inference: { source: string; confidence: number | null; needsConfirmation: boolean } | null;
}

export interface JourneyData {
  shipmentId: string;
  shipmentNumber: string;
  journeyStatus: {
    overallStage: string;
    headline: string;
    percentComplete: number;
    blocked: boolean;
    blockingReasons: string[];
  };
  stops: JourneyStop[];
  legs: JourneyLeg[];
  customs: { status: string };
  inferenceProposal?: any | null;
}

interface JourneyRibbonProps {
  data: JourneyData;
  onRefresh?: () => void;
}

function ModeIcon({ mode, className = "w-4 h-4" }: { mode: string; className?: string }) {
  const m = mode.toUpperCase();
  if (m.includes("AIR")) return <Plane className={className} />;
  if (m.includes("TRUCK") || m.includes("DRAY")) return <Truck className={className} />;
  if (m.includes("RAIL") || m.includes("TRAIN")) return <Train className={className} />;
  return <Anchor className={className} />;
}

function formatDate(val?: Date | string | null): string {
  if (!val) return "Not set";
  const d = new Date(val);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function JourneyRibbon({ data, onRefresh }: JourneyRibbonProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [attachingLegId, setAttachingLegId] = useState<string | null>(null);
  const [attachDocType, setAttachDocType] = useState<string>("BILL_OF_LADING");

  const [loading, setLoading] = useState(false);

  const { journeyStatus, stops, legs, customs } = data;

  const handleAddLeg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const body = {
      legType: formData.get("legType"),
      mode: formData.get("mode"),
      destinationName: formData.get("destinationName"),
      carrierName: formData.get("carrierName"),
      vesselName: formData.get("vesselName"),
      billOfLadingNumber: formData.get("billOfLadingNumber"),
    };

    try {
      const res = await fetch(`/api/shipments/${data.shipmentId}/legs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowAddModal(false);
        if (onRefresh) onRefresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLeg = async (legId: string) => {
    if (!confirm("Are you sure you want to delete this leg?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shipments/${data.shipmentId}/legs/${legId}`, {
        method: "DELETE",
      });
      if (res.ok && onRefresh) {
        onRefresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAttachDocument = async (legId: string, expectedDocType: string) => {
    const docId = prompt("Enter document ID to attach (or leave blank to create checklist gap slot):");
    setLoading(true);
    try {
      const res = await fetch(`/api/shipments/${data.shipmentId}/legs/${legId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: docId || null,
          expectedDocType,
          requirement: "REQUIRED",
        }),
      });
      if (res.ok && onRefresh) {
        onRefresh();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!data.legs || data.legs.length === 0 || journeyStatus.headline === "No journey scheduled") {
    return null;
  }

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-2xs space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{journeyStatus.headline}</h2>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200/80 text-xs font-bold text-slate-700">
            <span className="text-slate-400 font-medium">Customs:</span>
            <span className={customs.status === "RELEASED" || customs.status === "ACCEPTED" || customs.status === "FILED" ? "text-emerald-600 font-extrabold" : "text-amber-600 font-extrabold"}>
              {customs.status}
            </span>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            {expanded ? "Collapse Details" : "Expand Details"}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-2xs transition"
          >
            <Plus className="w-4 h-4" /> Add Leg
          </button>
        </div>
      </div>

      {/* Apple 2-Tier Journey Timeline Rail */}
      <div className="overflow-x-auto pt-2 pb-2">
        <div className="min-w-[840px] px-2 space-y-5">
          
          {/* TIER 1: Timeline Nodes & Continuous Track Line (4-Column Grid Aligned) */}
          <div className="grid grid-cols-4 gap-3 px-4">
            {legs.map((leg, index) => {
              const fromStop = stops[index] || { sequence: index + 1, name: "Stop", role: "STOP", unlocode: null };
              const toStop = stops[index + 1] || null;
              const isLast = index === legs.length - 1;
              const isCompleted = leg.status === "COMPLETED";
              const isInTransit = leg.status === "IN_TRANSIT";

              return (
                <div key={leg.id} className="relative flex items-center justify-between">
                  {/* Track Line connecting fromStop to toStop */}
                  <div className="absolute left-3 right-3 top-3 h-0.5 bg-slate-200 -z-0">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isCompleted ? "bg-emerald-500 w-full" : isInTransit ? "bg-blue-600 w-1/2" : "w-0"
                      }`}
                    />
                  </div>

                  {/* Left Stop Node (fromStop) */}
                  <div className="flex flex-col items-center z-10 shrink-0 cursor-pointer group">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shadow-2xs transition-all ${
                        isInTransit
                          ? "bg-blue-600 text-white ring-4 ring-blue-100 border border-blue-400"
                          : isCompleted
                          ? "bg-emerald-500 text-white border border-emerald-400"
                          : "bg-white border-2 border-slate-300 text-slate-500"
                      }`}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : fromStop.sequence}
                    </div>

                    <span className="text-xs font-bold text-slate-800 mt-2 truncate max-w-[100px] text-center" title={fromStop.name}>
                      {fromStop.name.split(" ")[0]}
                    </span>
                    <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400 text-center">
                      {fromStop.unlocode || fromStop.role || "STOP"}
                    </span>
                  </div>

                  {/* Right Stop Node (Only on the last column to close the timeline rail) */}
                  {isLast && toStop && (
                    <div className="flex flex-col items-center z-10 shrink-0 cursor-pointer group">
                      <div className="w-6 h-6 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-[10px] font-extrabold text-slate-500 shadow-2xs">
                        {toStop.sequence}
                      </div>

                      <span className="text-xs font-bold text-slate-800 mt-2 truncate max-w-[100px] text-center" title={toStop.name}>
                        {toStop.name.split(" ")[0]}
                      </span>
                      <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400 text-center">
                        {toStop.unlocode || toStop.role || "STOP"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* TIER 2: Per-Leg Status Cards (100% Vertically Aligned Under Connecting Stops) */}
          <div className="grid grid-cols-4 gap-3 px-4">
            {legs.map((leg) => {
              const isCompleted = leg.status === "COMPLETED";
              const isInTransit = leg.status === "IN_TRANSIT";
              const isException = leg.status === "EXCEPTION";

              return (
                <div
                  key={leg.id}
                  onClick={() => {
                    setExpanded(true);
                    setSelectedLegId(leg.id);
                  }}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-3 shadow-2xs ${
                    isCompleted
                      ? "bg-emerald-50/70 border-emerald-200/70 text-emerald-950 hover:bg-emerald-100/80"
                      : isInTransit
                      ? "bg-blue-50/90 border-blue-300/90 text-blue-950 ring-2 ring-blue-200/60 hover:bg-blue-100/90"
                      : isException
                      ? "bg-rose-50/80 border-rose-200 text-rose-950 hover:bg-rose-100/80"
                      : "bg-slate-50/80 border-slate-200/80 text-slate-800 hover:bg-slate-100/80"
                  }`}
                >
                  {/* Card Header: Mode & Leg Title */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ModeIcon mode={leg.mode} className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      <p className="text-[11px] font-bold text-slate-900 tracking-wide uppercase truncate">
                        {leg.legType.replace(/_/g, " ")}
                      </p>
                    </div>

                    {/* Status Pill (Rendered only when NOT completed) */}
                    {!isCompleted && (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase shrink-0 ${
                        isInTransit ? "bg-blue-100 text-blue-800" : isException ? "bg-rose-100 text-rose-800" : "bg-slate-200/80 text-slate-700"
                      }`}>
                        {leg.status.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>

                  {/* Card Footer: Document Checklist Badge & Carrier Info */}
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-slate-500 font-medium truncate max-w-[110px]" title={leg.carrier.name || "Carrier not set"}>
                      {leg.carrier.name ? leg.carrier.name.split(" ")[0] : "Pending Carrier"}
                    </span>

                    <div className="shrink-0">
                      {leg.documents.missingRequired > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100/90 border border-amber-300/80 text-amber-900 text-[9px] font-extrabold flex items-center gap-1">
                          <FileWarning className="w-3 h-3 text-amber-600" />
                          ⚠ {leg.documents.missingRequired} missing
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-white/90 border border-emerald-300 text-emerald-800 text-[9px] font-bold flex items-center gap-1 shadow-2xs">
                          <FileCheck2 className="w-3 h-3 text-emerald-600" />
                          {leg.documents.onFile}/{leg.documents.total} docs
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Expanded Per-Leg Detail Cards */}
      {expanded && (
        <div className="space-y-4 border-t border-slate-100 pt-5">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Per-Leg Journey Breakdown</h3>

          {legs.map((leg) => {
            const isSelected = selectedLegId === leg.id;

            return (
              <div
                key={leg.id}
                className={`rounded-2xl border transition p-5 ${
                  isSelected ? "border-blue-500 ring-2 ring-blue-100 bg-white" : "border-slate-200 bg-slate-50/50"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                      <ModeIcon mode={leg.mode} className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">Leg {leg.sequence} of {legs.length}</span>
                        <span className="text-xs font-extrabold text-slate-900">{leg.legType.replace("_", " ")}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold">
                          {leg.mode}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 mt-0.5">
                        {leg.origin.name} ({leg.origin.unlocode || "POL"}) → {leg.destination.name} ({leg.destination.unlocode || "POD"})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                        leg.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : leg.status === "IN_TRANSIT"
                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {leg.status}
                    </span>

                    <button
                      onClick={() => handleDeleteLeg(leg.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Delete Leg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs">
                  {/* Carrier & Conveyance */}
                  <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">Carrier & Conveyance</p>
                    <p className="font-bold text-slate-800">{leg.carrier.name || "Carrier not assigned"}</p>
                    {leg.conveyance.vesselName && (
                      <p className="text-slate-600">Vessel: {leg.conveyance.vesselName} (Voy {leg.conveyance.voyageNumber || "N/A"})</p>
                    )}
                    {leg.references.billOfLadingNumber && (
                      <p className="font-mono text-slate-600">MBL: {leg.references.billOfLadingNumber}</p>
                    )}
                  </div>

                  {/* Timeline */}
                  <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400">Timeline</p>
                    <p className="text-slate-700">Departed: <span className="font-semibold">{formatDate(leg.timeline.actualDeparture || leg.timeline.plannedDeparture)}</span></p>
                    <p className="text-slate-700">Arrival: <span className="font-semibold">{formatDate(leg.timeline.actualArrival || leg.timeline.estimatedArrival || leg.timeline.plannedArrival)}</span></p>
                  </div>

                  {/* Leg Documents Checklist */}
                  <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">Required Leg Documents</p>
                      <button
                        onClick={() => handleAttachDocument(leg.id, "OTHER")}
                        className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> Add Doc
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {leg.documents.rows.map((row) => (
                        <div key={row.legDocumentId} className="flex items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {row.document ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            )}
                            <span className="font-bold text-slate-800 truncate" title={row.requirementReason || row.expectedDocType}>
                              {row.expectedDocType.replace("_", " ")}
                            </span>
                          </div>

                          {row.document ? (
                            <a
                              href={row.document.fileUrl || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-mono text-blue-600 underline truncate max-w-[120px]"
                            >
                              {row.document.fileName}
                            </a>
                          ) : (
                            <button
                              onClick={() => handleAttachDocument(leg.id, row.expectedDocType)}
                              className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 transition"
                            >
                              Attach Doc
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Leg Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">Add Leg to Route</h3>
            <form onSubmit={handleAddLeg} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Leg Type</label>
                <select name="legType" className="w-full mt-1 p-2 rounded-xl border border-slate-200">
                  <option value="EXPORT_HAULAGE">EXPORT HAULAGE</option>
                  <option value="MAIN_CARRIAGE">MAIN CARRIAGE</option>
                  <option value="TRANSSHIPMENT">TRANSSHIPMENT</option>
                  <option value="IMPORT_HAULAGE">IMPORT HAULAGE</option>
                  <option value="ON_CARRIAGE">ON CARRIAGE</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Mode</label>
                <select name="mode" className="w-full mt-1 p-2 rounded-xl border border-slate-200">
                  <option value="OCEAN">OCEAN</option>
                  <option value="TRUCK">TRUCK</option>
                  <option value="AIR">AIR</option>
                  <option value="RAIL">RAIL</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Destination Name</label>
                <input name="destinationName" required placeholder="e.g. Busan Port / Long Beach" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </div>

              <div>
                <label className="font-bold text-slate-700">Carrier Name</label>
                <input name="carrierName" placeholder="e.g. COSCO Shipping" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </div>

              <div>
                <label className="font-bold text-slate-700">Vessel / Conveyance Name</label>
                <input name="vesselName" placeholder="e.g. COSCO LIBRA" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </div>

              <div>
                <label className="font-bold text-slate-700">Bill of Lading Number</label>
                <input name="billOfLadingNumber" placeholder="e.g. COSU7223841650" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold border border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add Leg"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
