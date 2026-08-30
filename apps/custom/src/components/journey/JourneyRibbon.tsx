"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Anchor,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  FileWarning,
  Plus,
  Plane,
  Truck,
  Train,
  ChevronDown,
  ChevronUp,
  Trash2,
  Sparkles,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import { PreFilingReadiness, type CategoryDetail } from "@/app/app/shipments/[id]/PreFilingReadiness";
import type { ReadinessBreakdown } from "@/lib/shipmentReadiness";

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
  slotKey: string;
  slotLabel: string;
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
  documents: { total: number; onFile: number; missingRequired: number; rows: LegDocRow[] };
  events?: Array<{ id: string; eventType: string; classifier: string; occurredAt: Date | string }>;
  eta: { current: Date | string | null; deltaMinutes: number | null; provider: string | null };
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
  inferenceProposal: {
    inputsHash: string;
    confidence: number;
    createdAtIso: string;
    changes: Array<{ type: string; description: string; legSequence?: number }>;
  } | null;
}

export interface JourneyDocOption {
  id: string;
  fileName: string;
  docType: string | null;
}

export interface JourneyReadinessProps {
  categories: CategoryDetail[];
  overallStatus: {
    text: string;
    subtext: string;
    type: "BLOCKED" | "REVIEW_REQUIRED" | "INFO_REQUIRED" | "WARNINGS" | "READY";
  };
  readinessBreakdown?: ReadinessBreakdown;
}

interface JourneyRibbonProps {
  data?: JourneyData;
  canManage?: boolean;
  documents?: JourneyDocOption[];
  readiness?: JourneyReadinessProps;
}

const LEG_TYPE_OPTIONS = ["EXPORT_HAULAGE", "MAIN_CARRIAGE", "TRANSSHIPMENT", "IMPORT_HAULAGE", "ON_CARRIAGE"];
const MODE_OPTIONS = ["OCEAN", "AIR", "RAIL", "TRUCK", "BARGE", "COURIER"];

function ModeIcon({ mode, className = "w-4 h-4" }: { mode: string; className?: string }) {
  const m = mode.toUpperCase();
  if (m.includes("AIR")) return <Plane className={className} />;
  if (m.includes("TRUCK") || m.includes("DRAY") || m.includes("COURIER")) return <Truck className={className} />;
  if (m.includes("RAIL") || m.includes("TRAIN")) return <Train className={className} />;
  return <Anchor className={className} />;
}

function fmt(val?: Date | string | null): string {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusClasses(status: string): { seg: string; pill: string; dot: string } {
  switch (status) {
    case "COMPLETED":
      return { seg: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500 text-white" };
    case "IN_TRANSIT":
    case "ARRIVED":
      return { seg: "bg-blue-600", pill: "bg-blue-100 text-blue-800", dot: "bg-blue-600 text-white" };
    case "EXCEPTION":
      return { seg: "bg-rose-500", pill: "bg-rose-100 text-rose-800", dot: "bg-rose-500 text-white" };
    case "CANCELLED":
      return { seg: "bg-slate-400", pill: "bg-slate-200 text-slate-600", dot: "bg-slate-400 text-white" };
    default:
      return { seg: "bg-slate-200", pill: "bg-slate-200 text-slate-700", dot: "bg-white border-2 border-slate-300 text-slate-500" };
  }
}

export function JourneyRibbon({ data, canManage = false, documents = [], readiness }: JourneyRibbonProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [showReadinessAudit, setShowReadinessAudit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAddLeg, setShowAddLeg] = useState(false);
  const [attachTarget, setAttachTarget] = useState<{ legId: string; row: LegDocRow } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const journeyStatus = data?.journeyStatus;
  const stops = data?.stops ?? [];
  const legs = data?.legs ?? [];
  const customs = data?.customs;
  const inferenceProposal = data?.inferenceProposal;
  const shipmentId = data?.shipmentId;

  if (legs.length === 0 && !readiness) return null;

  const customsCleared = customs ? (customs.status === "RELEASED" || customs.status === "ACCEPTED") : false;

  async function call(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Request failed (${res.status})`);
        return false;
      }
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const addLeg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!shipmentId) return;
    const fd = new FormData(e.currentTarget);
    const ok = await call(`/api/shipments/${shipmentId}/legs`, {
      method: "POST",
      body: JSON.stringify({
        legType: fd.get("legType"),
        mode: fd.get("mode"),
        destinationName: fd.get("destinationName"),
        destinationUnlocode: fd.get("destinationUnlocode") || undefined,
        carrierName: fd.get("carrierName") || undefined,
        vesselName: fd.get("vesselName") || undefined,
        billOfLadingNumber: fd.get("billOfLadingNumber") || undefined,
      }),
    });
    if (ok) setShowAddLeg(false);
  };

  const deleteLeg = (legId: string) =>
    shipmentId ? call(`/api/shipments/${shipmentId}/legs/${legId}`, { method: "DELETE" }) : Promise.resolve(false);

  const confirmLeg = (legId: string) =>
    shipmentId ? call(`/api/shipments/${shipmentId}/legs/${legId}`, {
      method: "PATCH",
      body: JSON.stringify({ confirmed: true }),
    }) : Promise.resolve(false);

  const attachDoc = async (documentId: string) => {
    if (!attachTarget || !shipmentId) return;
    const ok = await call(`/api/shipments/${shipmentId}/legs/${attachTarget.legId}/documents`, {
      method: "POST",
      body: JSON.stringify({ documentId, slotKey: attachTarget.row.slotKey, slotLabel: attachTarget.row.slotLabel }),
    });
    if (ok) setAttachTarget(null);
  };

  const detachDoc = (legId: string, legDocumentId: string) =>
    shipmentId ? call(`/api/shipments/${shipmentId}/legs/${legId}/documents?legDocumentId=${encodeURIComponent(legDocumentId)}`, {
      method: "DELETE",
    }) : Promise.resolve(false);

  const acceptProposal = () =>
    inferenceProposal && shipmentId &&
    call(`/api/shipments/${shipmentId}/legs/infer/accept`, {
      method: "POST",
      body: JSON.stringify({ inputsHash: inferenceProposal.inputsHash }),
    });

  const rejectProposal = () =>
    inferenceProposal && shipmentId &&
    call(`/api/shipments/${shipmentId}/legs/infer/reject`, {
      method: "POST",
      body: JSON.stringify({ inputsHash: inferenceProposal.inputsHash }),
    });

  const gridCols = legs?.length ? { gridTemplateColumns: `repeat(${legs.length}, minmax(0, 1fr))` } : {};
  const railWidth = legs?.length ? `${Math.min(legs.length * 280, 1400)}px` : "100%";

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-2xs space-y-5">
      {/* Header — only shown when transport legs exist */}
      {legs.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
              {journeyStatus?.headline || "Shipment Journey & Compliance Command"}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {`${legs.length} leg${legs.length === 1 ? "" : "s"} · ${journeyStatus?.percentComplete ?? 0}% complete`}
              {journeyStatus?.blocked && journeyStatus?.blockingReasons?.length > 0 && (
                <span className="text-rose-600 font-semibold"> · {journeyStatus.blockingReasons[0]}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {readiness && (
              <span
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${
                  readiness.overallStatus.type === "BLOCKED"
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : readiness.overallStatus.type === "REVIEW_REQUIRED"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : readiness.overallStatus.type === "INFO_REQUIRED"
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
              >
                <span>Readiness: {readiness.overallStatus.text}</span>
              </span>
            )}

            {canManage && (
              <button
                onClick={() => setShowAddLeg(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add leg
              </button>
            )}

            {customs && (
              <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200/80 text-xs font-bold">
                <span className="text-slate-400 font-medium">Customs</span>
                <span className={customsCleared ? "text-emerald-700 font-extrabold" : "text-amber-700 font-extrabold"}>
                  {customs.status.replace(/_/g, " ")}
                </span>
              </span>
            )}

            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Inference proposal card */}
      {canManage && inferenceProposal && inferenceProposal.changes.length > 0 && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" />
            <p className="text-xs font-extrabold text-violet-900">
              Qubere detected a route change from the shipment&rsquo;s documents
            </p>
            <span className="text-[10px] font-bold text-violet-500">
              confidence {(inferenceProposal.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <ul className="text-[11px] text-violet-900 space-y-0.5 pl-6 list-disc">
            {inferenceProposal.changes.slice(0, 6).map((c, i) => (
              <li key={i}>{c.description}</li>
            ))}
          </ul>
          <div className="flex items-center gap-2 pt-1">
            <button
              disabled={busy}
              onClick={acceptProposal}
              className="px-3 py-1 rounded-lg bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 disabled:opacity-50"
            >
              Accept
            </button>
            <button
              disabled={busy}
              onClick={rejectProposal}
              className="px-3 py-1 rounded-lg border border-violet-300 text-violet-700 text-[11px] font-bold hover:bg-violet-100 disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Rail */}
      {legs.length > 0 && (
        <div className="overflow-x-auto pb-1 flex justify-center">
          <div style={{ width: railWidth, minWidth: `${Math.max(legs.length * 200, 280)}px` }} className="space-y-3 max-w-full">
          {/* stop labels */}
          <div className="grid gap-2" style={gridCols}>
            {legs.map((leg, i) => {
              const from = stops[i] ?? { name: leg.origin.name, unlocode: leg.origin.unlocode, sequence: i + 1 };
              const to = stops[i + 1] ?? { name: leg.destination.name, unlocode: leg.destination.unlocode, sequence: i + 2 };
              const sc = statusClasses(leg.status);
              return (
                <div key={leg.id} className="relative flex items-start justify-between gap-1">
                  <div className="flex flex-col items-center text-center w-16 shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold ${sc.dot}`}>
                      {leg.status === "COMPLETED" ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : i + 1}
                    </div>
                    <span className="text-[10px] font-bold text-slate-800 mt-1 leading-tight line-clamp-2" title={from.name}>
                      {from.name}
                    </span>
                    <span className="text-[8px] font-bold uppercase text-slate-400">{from.unlocode || ""}</span>
                  </div>
                  <div className="flex-1 pt-3">
                    <div className={`h-1 rounded-full ${sc.seg}`} />
                  </div>
                  {i === legs.length - 1 && (
                    <div className="flex flex-col items-center text-center w-16 shrink-0">
                      <div className="w-6 h-6 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-[10px] font-extrabold text-slate-500">
                        {i + 2}
                      </div>
                      <span className="text-[10px] font-bold text-slate-800 mt-1 leading-tight line-clamp-2" title={to.name}>
                        {to.name}
                      </span>
                      <span className="text-[8px] font-bold uppercase text-slate-400">{to.unlocode || ""}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* leg cards */}
          <div className="grid gap-2" style={gridCols}>
            {legs.map((leg) => {
              const sc = statusClasses(leg.status);
              const needsConfirm = leg.inference?.needsConfirmation;
              return (
                <button
                  key={leg.id}
                  onClick={() => {
                    setExpanded(true);
                  }}
                  className={`text-left p-3 rounded-2xl border transition ${
                    leg.status === "EXCEPTION"
                      ? "bg-rose-50/80 border-rose-200"
                      : needsConfirm
                        ? "bg-amber-50/70 border-amber-300 border-dashed"
                        : "bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1 min-w-0">
                      <ModeIcon mode={leg.mode} className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      <span className="text-[10px] font-bold uppercase text-slate-900 truncate">
                        {leg.legType.replace(/_/g, " ")}
                      </span>
                    </span>
                    {leg.status !== "COMPLETED" && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase shrink-0 ${sc.pill}`}>
                        {leg.status.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-1 text-[10px]">
                    <span className="text-slate-500 truncate">{leg.carrier.name || "Carrier TBD"}</span>
                    {leg.documents.missingRequired > 0 ? (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[8px] font-extrabold shrink-0">
                        <FileWarning className="w-3 h-3" /> {leg.documents.missingRequired} missing
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-800 text-[8px] font-bold shrink-0">
                        <FileCheck2 className="w-3 h-3" /> {leg.documents.onFile}/{leg.documents.total}
                      </span>
                    )}
                  </div>
                  {needsConfirm && (
                    <span className="mt-1.5 block text-[9px] font-bold text-amber-700">Needs confirmation</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* Expanded per-leg detail */}
      {expanded && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          {legs.map((leg) => (
            <div key={leg.id} className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                    <ModeIcon mode={leg.mode} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900">
                      Leg {leg.sequence} of {legs.length} · {leg.legType.replace(/_/g, " ")}
                    </p>
                    <p className="text-[11px] text-slate-600 truncate">
                      {leg.origin.name}
                      {leg.origin.unlocode ? ` (${leg.origin.unlocode})` : ""} → {leg.destination.name}
                      {leg.destination.unlocode ? ` (${leg.destination.unlocode})` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${statusClasses(leg.status).pill}`}>
                    {leg.status.replace(/_/g, " ")}
                  </span>
                  {canManage && leg.inference?.needsConfirmation && (
                    <button
                      disabled={busy}
                      onClick={() => confirmLeg(leg.id)}
                      className="px-2 py-1 rounded-lg bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600 disabled:opacity-50"
                    >
                      Confirm route
                    </button>
                  )}
                  {canManage && !leg.timeline.actualDeparture && !leg.timeline.actualArrival && (
                    <button
                      disabled={busy}
                      onClick={() => deleteLeg(leg.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      title="Delete leg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {leg.status === "EXCEPTION" && leg.statusReason && (
                <p className="mt-2 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">
                  {leg.statusReason}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-[11px]">
                <div className="bg-white p-2.5 rounded-xl border border-slate-100 space-y-0.5">
                  <p className="text-[9px] font-extrabold uppercase text-slate-400">Carrier &amp; conveyance</p>
                  <p className="font-bold text-slate-800">{leg.carrier.name || "Not assigned"}</p>
                  {leg.conveyance.vesselName && (
                    <p className="text-slate-600">
                      {leg.conveyance.vesselName}
                      {leg.conveyance.voyageNumber ? ` · voy ${leg.conveyance.voyageNumber}` : ""}
                    </p>
                  )}
                  {leg.conveyance.flightNumber && <p className="text-slate-600">Flight {leg.conveyance.flightNumber}</p>}
                  {leg.references.billOfLadingNumber && (
                    <p className="font-mono text-slate-600">
                      {leg.references.billOfLadingType || "B/L"} {leg.references.billOfLadingNumber}
                    </p>
                  )}
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-100 space-y-0.5">
                  <p className="text-[9px] font-extrabold uppercase text-slate-400">Timeline</p>
                  <p className="text-slate-700">
                    Departed <span className="font-semibold">{fmt(leg.timeline.actualDeparture || leg.timeline.plannedDeparture)}</span>
                  </p>
                  <p className="text-slate-700">
                    Arriving{" "}
                    <span className="font-semibold">
                      {fmt(leg.timeline.actualArrival || leg.eta.current || leg.timeline.plannedArrival)}
                    </span>
                    {leg.eta.deltaMinutes != null && leg.eta.deltaMinutes !== 0 && (
                      <span className={leg.eta.deltaMinutes > 0 ? "text-amber-700" : "text-emerald-700"}>
                        {" "}
                        ({leg.eta.deltaMinutes > 0 ? "+" : ""}
                        {Math.round(leg.eta.deltaMinutes / 60)}h)
                      </span>
                    )}
                  </p>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                  <p className="text-[9px] font-extrabold uppercase text-slate-400">Leg documents</p>
                  <div className="space-y-1">
                    {leg.documents.rows.map((row) => (
                      <div key={row.legDocumentId} className="flex items-center justify-between gap-1.5">
                        <span className="flex items-center gap-1 min-w-0" title={row.requirementReason || row.slotLabel}>
                          {row.status === "MISSING" ? (
                            <AlertTriangle
                              className={`w-3 h-3 shrink-0 ${
                                row.requirement === "REQUIRED" || row.requirement === "CONDITIONAL"
                                  ? "text-amber-600"
                                  : "text-slate-300"
                              }`}
                            />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-800 truncate">{row.slotLabel}</span>
                        </span>
                        {row.document ? (
                          <span className="flex items-center gap-1 shrink-0">
                            <a
                              href={row.document.fileUrl || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-mono text-blue-600 underline truncate max-w-[90px]"
                            >
                              {row.document.fileName}
                            </a>
                            {canManage && (
                              <button
                                disabled={busy}
                                onClick={() => detachDoc(leg.id, row.legDocumentId)}
                                className="text-slate-300 hover:text-rose-600"
                                title="Detach"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ) : canManage ? (
                          <button
                            onClick={() => setAttachTarget({ legId: leg.id, row })}
                            className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded hover:bg-amber-100 shrink-0"
                          >
                            Attach
                          </button>
                        ) : (
                          <span className="text-[9px] font-bold uppercase text-slate-400 shrink-0">
                            {row.requirement === "OPTIONAL" || row.requirement === "INFO_ONLY" ? "optional" : "missing"}
                          </span>
                        )}
                      </div>
                    ))}
                    {leg.documents.rows.length === 0 && (
                      <p className="text-[10px] text-slate-400">No document checklist for this leg.</p>
                    )}
                  </div>
                </div>
              </div>

              {leg.events && leg.events.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {leg.events.slice(0, 4).map((ev) => (
                    <span
                      key={ev.id}
                      className="text-[9px] font-semibold text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5"
                    >
                      {ev.eventType.replace(/_/g, " ")} · {fmt(ev.occurredAt)}
                      {ev.classifier !== "ACTUAL" ? ` (${ev.classifier.toLowerCase()})` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add-leg modal */}
      {showAddLeg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">Add transport leg</h3>
              <button onClick={() => setShowAddLeg(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={addLeg} className="space-y-3 text-xs">
              <label className="block">
                <span className="font-bold text-slate-700">Leg type</span>
                <select name="legType" defaultValue="MAIN_CARRIAGE" className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-white">
                  {LEG_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-bold text-slate-700">Mode</span>
                <select name="mode" defaultValue="OCEAN" className="w-full mt-1 p-2 rounded-xl border border-slate-200 bg-white">
                  {MODE_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-bold text-slate-700">Destination name</span>
                <input name="destinationName" required placeholder="e.g. Los Angeles / Long Beach" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </label>
              <label className="block">
                <span className="font-bold text-slate-700">Destination UN/LOCODE</span>
                <input name="destinationUnlocode" placeholder="e.g. USLAX" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </label>
              <label className="block">
                <span className="font-bold text-slate-700">Carrier</span>
                <input name="carrierName" placeholder="e.g. COSCO Shipping" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </label>
              <label className="block">
                <span className="font-bold text-slate-700">Vessel / conveyance</span>
                <input name="vesselName" placeholder="e.g. COSCO SHIPPING LIBRA" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </label>
              <label className="block">
                <span className="font-bold text-slate-700">Bill of lading #</span>
                <input name="billOfLadingNumber" placeholder="e.g. COSU7223841650" className="w-full mt-1 p-2 rounded-xl border border-slate-200" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddLeg(false)} className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50">
                  {busy ? "Adding…" : "Add leg"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach-document modal */}
      {attachTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl space-y-3 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                Attach a document — {attachTarget.row.slotLabel}
              </h3>
              <button onClick={() => setAttachTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            {documents.length === 0 ? (
              <p className="text-xs text-slate-500">
                No documents are attached to this shipment yet. Upload one from the Documents section first.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {documents.map((d) => (
                  <button
                    key={d.id}
                    disabled={busy}
                    onClick={() => attachDoc(d.id)}
                    className="w-full text-left py-2.5 px-1 hover:bg-slate-50 flex items-center justify-between gap-2 disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800 truncate">{d.fileName}</span>
                      {d.docType && <span className="block text-[10px] text-slate-500">{d.docType}</span>}
                    </span>
                    <Plus className="w-4 h-4 text-blue-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Integrated 10-Point Compliance & Readiness Banner */}
      {readiness && (
        <div className={`space-y-3 ${legs.length > 0 ? "pt-4 border-t border-slate-200/80" : ""}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <span>10-Point Regulatory Compliance &amp; Filing Readiness Audit</span>
            </h3>
          </div>
          <PreFilingReadiness
            categories={readiness.categories}
            overallStatus={readiness.overallStatus}
            readinessBreakdown={readiness.readinessBreakdown}
          />
        </div>
      )}
    </div>
  );
}
