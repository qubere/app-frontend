"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  FileCheck2,
  Radio,
  Route,
  Ship,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ShipmentTrackingProjection, TrackingHealth } from "@/modules/tracking/shipmentTracking";

interface ShipmentTrackingPanelProps {
  projection: ShipmentTrackingProjection;
}

const movementStages = [
  ["NOT_STARTED", "Booked"],
  ["PRE_CARRIAGE", "Pre-carriage"],
  ["AT_ORIGIN_PORT", "Origin terminal"],
  ["IN_TRANSIT", "In transit"],
  ["AT_TRANSSHIPMENT", "Transshipment"],
  ["AT_DESTINATION_PORT", "Arrived"],
  ["DISCHARGED", "Discharged"],
  ["AVAILABLE", "Available"],
  ["GATED_OUT", "Gate out"],
  ["DELIVERED", "Delivered"],
] as const;

const customsStages = [
  ["NOT_STARTED", "Not started"],
  ["PREPARING", "Preparing"],
  ["READY", "Ready"],
  ["FILED", "Filed"],
  ["ACCEPTED", "Accepted"],
  ["RELEASED", "Released"],
] as const;

const healthStyle: Record<TrackingHealth, string> = {
  ON_TRACK: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ATTENTION: "bg-amber-50 text-amber-700 border-amber-200",
  CRITICAL: "bg-rose-50 text-rose-700 border-rose-200",
  STALE: "bg-slate-100 text-slate-700 border-slate-200",
  NOT_TRACKED: "bg-slate-100 text-slate-600 border-slate-200",
};

const sourceStyle = {
  CONNECTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WAITING: "bg-blue-50 text-blue-700 border-blue-200",
  STALE: "bg-amber-50 text-amber-700 border-amber-200",
  ERROR: "bg-rose-50 text-rose-700 border-rose-200",
  INACTIVE: "bg-slate-100 text-slate-700 border-slate-200",
  NOT_CONFIGURED: "bg-slate-100 text-slate-600 border-slate-200",
} as const;

function formatDateTime(value: Date | null, timeZone?: string | null): string {
  if (!value) return "Not available";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      ...(timeZone ? { timeZone } : {}),
    }).format(value);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(value);
  }
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function etaDelta(minutes: number | null): string | null {
  if (minutes === null || minutes === 0) return null;
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  const duration = [hours ? `${hours}h` : null, remainder ? `${remainder}m` : null].filter(Boolean).join(" ");
  return minutes < 0 ? `${duration} earlier` : `${duration} later`;
}

function Rail({
  label,
  stages,
  current,
  blocked,
}: {
  label: string;
  stages: readonly (readonly [string, string])[];
  current: string;
  blocked?: boolean;
}) {
  const currentIndex = stages.findIndex(([status]) => status === current);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">{label}</h4>
        <span className={`text-[10px] font-bold ${blocked ? "text-rose-700" : "text-ink"}`}>
          {titleCase(current)}
        </span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="grid gap-1 min-w-[720px]" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
          {stages.map(([status, stageLabel], index) => {
            const complete = currentIndex >= 0 && index < currentIndex;
            const active = status === current;
            return (
              <div key={status} className="min-w-0">
                <div className={`h-1.5 rounded-full ${complete ? "bg-emerald-500" : active ? (blocked ? "bg-rose-500" : "bg-brand") : "bg-slate-200"}`} />
                <p className={`mt-1.5 text-[9px] truncate ${active ? "font-extrabold text-ink" : "font-semibold text-ink-muted"}`}>
                  {stageLabel}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ShipmentTrackingPanel({ projection }: ShipmentTrackingPanelProps) {
  const router = useRouter();
  if (!projection) return null;

  const isUnconfigured = projection.health?.reasonCodes?.includes("TRACKING_NOT_CONFIGURED") ?? true;
  const delta = etaDelta(projection.movement?.etaDeltaMinutes ?? null);
  const activeDeadlines = (projection.deadlines ?? []).filter((deadline) => deadline.status === "OPEN").slice(0, 4);

  return (
    <div className="space-y-6">
      {projection.nextAction && (
        <div
          onClick={() => {
            if (
              projection.nextAction?.type === "CONFIGURE_TRACKING" ||
              projection.nextAction?.type === "CHECK_TRACKING_SOURCE"
            ) {
              router.push("/app/admin/settings?section=integrations");
              return;
            }
            const targetId =
              projection.nextAction?.type === "RESOLVE_EXCEPTION"
                ? "exceptions-panel"
                : projection.nextAction?.type === "START_TRACKING"
                ? "waterfall-view"
                : "exceptions-panel";

            const el = document.getElementById(targetId) || document.getElementById("exceptions-panel");
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("ring-2", "ring-brand", "ring-offset-2", "transition-all");
              setTimeout(() => el.classList.remove("ring-2", "ring-brand", "ring-offset-2"), 2500);
            }
          }}
          className={`rounded-3xl border p-5 flex items-start justify-between gap-4 cursor-pointer hover:shadow-md transition-all group ${
            projection.health.status === "CRITICAL"
              ? "bg-rose-50 border-rose-200 hover:border-rose-300"
              : projection.health.status === "ATTENTION" || projection.health.status === "STALE"
                ? "bg-amber-50 border-amber-200 hover:border-amber-300"
                : "bg-slate-50 border-slate-200 hover:border-slate-300"
          }`}
          title="Click to resolve this blocker in Action Items"
        >
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${projection.health.status === "CRITICAL" ? "text-rose-600" : "text-amber-600"}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-extrabold text-ink group-hover:text-brand transition-colors">
                  {projection.nextAction.title}
                </p>
                <span className="text-[10px] font-extrabold uppercase bg-white/80 text-ink-muted px-2 py-0.5 rounded-full border border-border">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-1 leading-5">{projection.nextAction.detail}</p>
              {projection.nextAction.dueAt && (
                <p className="text-[10px] font-bold uppercase tracking-wider mt-2 text-ink">
                  Due {formatDateTime(projection.nextAction.dueAt)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-bold text-brand group-hover:translate-x-0.5 transition-transform shrink-0 pt-0.5">
            <span>
              {projection.nextAction.type === "CONFIGURE_TRACKING"
                ? "Connect source"
                : projection.nextAction.type === "CHECK_TRACKING_SOURCE"
                  ? "Review connection"
                  : "Resolve action"}
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="apple-card rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Movement</p>
            <Ship className="w-4 h-4 text-brand" />
          </div>
          <p className="text-lg font-extrabold text-ink mt-3">{titleCase(projection.movement.status)}</p>
          <p className="text-xs text-ink-muted mt-1">
            {projection.movement.currentLocation ?? (isUnconfigured ? "No verified movement source" : "Location not reported")}
          </p>
        </div>

        <div className="apple-card rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Current ETA</p>
            <Clock3 className="w-4 h-4 text-brand" />
          </div>
          <p className="text-base font-extrabold text-ink mt-3">{formatDateTime(projection.movement.eta)}</p>
          <p className={`text-xs mt-1 font-semibold ${projection.movement.etaDeltaMinutes && projection.movement.etaDeltaMinutes < 0 ? "text-amber-700" : "text-ink-muted"}`}>
            {delta ?? (projection.movement.etaProvider ? `Source: ${projection.movement.etaProvider}` : "No ETA history")}
          </p>
        </div>

        <div className="apple-card rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Customs</p>
            <FileCheck2 className="w-4 h-4 text-brand" />
          </div>
          <p className="text-lg font-extrabold text-ink mt-3">{titleCase(projection.customs.status)}</p>
          <p className="text-xs text-ink-muted mt-1">
            {projection.customs.readiness === null ? "Readiness not evaluated" : `${projection.customs.readiness}% filing readiness`}
          </p>
        </div>

        <div className="apple-card rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Tracking source</p>
            <Radio className="w-4 h-4 text-brand" />
          </div>
          <p className="text-sm font-extrabold text-ink mt-3 truncate">
            {projection.source.providerDisplayName ?? projection.source.connectionName ?? "No source connected"}
          </p>
          <span className={`inline-flex mt-2 px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase ${sourceStyle[projection.source.state]}`}>
            {titleCase(projection.source.state)}
          </span>
          <p className="text-xs text-ink-muted mt-2">
            {projection.source.scope ? `${titleCase(projection.source.scope)} scope · ` : ""}
            Last sync {formatDateTime(projection.source.lastSyncAt)}
          </p>
          {projection.source.lastErrorMessage && (
            <p className="text-[10px] text-rose-700 mt-1 line-clamp-2">{projection.source.lastErrorMessage}</p>
          )}
          <p className={`text-[10px] font-bold mt-2 ${healthStyle[projection.health.status].includes("rose") ? "text-rose-700" : "text-ink-muted"}`}>
            Overall health: {titleCase(projection.health.status)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-6">
        <div className="apple-card rounded-3xl border border-border bg-white p-6 shadow-sm space-y-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-ink flex items-center gap-2">
                <Route className="w-4 h-4 text-brand" /> Physical movement and customs rail
              </h3>
              <p className="text-xs text-ink-muted mt-1">Movement and customs remain independent so an arrival never implies release.</p>
            </div>
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">{projection.mode ?? "Mode not set"}</span>
          </div>

          <Rail label="Physical movement" stages={movementStages} current={projection.movement.status} />
          <Rail
            label="Customs clearance"
            stages={customsStages}
            current={projection.customs.status}
            blocked={projection.customs.blockingExceptionCount > 0 || ["REJECTED", "HOLD"].includes(projection.customs.status)}
          />
        </div>

        <div className="space-y-6">
          <div className="apple-card rounded-3xl border border-border bg-white p-5 shadow-sm">
            <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">Tracking references</h3>
            {projection.identifiers.length > 0 ? (
              <div className="mt-4 space-y-3">
                {projection.identifiers.map((identifier) => (
                  <div key={`${identifier.type}:${identifier.value}:${identifier.issuer}`} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-ink-muted">{identifier.type}</p>
                      <p className="font-mono text-xs font-bold text-ink mt-0.5 break-all">{identifier.value}</p>
                    </div>
                    {identifier.isPrimary && <span className="text-[9px] font-bold text-brand uppercase">Primary</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-muted mt-3">No MBL, booking, container, airway bill, PRO, or tracking number is connected.</p>
            )}
          </div>

          <div className="apple-card rounded-3xl border border-border bg-white p-5 shadow-sm">
            <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">Upcoming clocks</h3>
            {activeDeadlines.length > 0 ? (
              <div className="mt-4 space-y-3">
                {activeDeadlines.map((deadline) => (
                  <div key={deadline.id} className="flex items-start gap-3">
                    <Clock3 className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-ink">{titleCase(deadline.type)}</p>
                      <p className="text-[10px] text-ink-muted mt-0.5">
                        {formatDateTime(deadline.dueAt)}{deadline.estimated ? " · estimated anchor" : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-muted mt-3">No open regulatory or commercial deadlines are currently computable.</p>
            )}
          </div>
        </div>
      </div>

      <div className="apple-card rounded-3xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-ink">Verified event timeline</h3>
            <p className="text-xs text-ink-muted mt-1">Planned, estimated, and actual events stay distinct with their source and receive time.</p>
          </div>
          <span className="text-[10px] font-bold text-ink-muted">{projection.events.length} events</span>
        </div>

        {projection.events.length > 0 ? (
          <div className="mt-5 divide-y divide-border">
            {projection.events.slice(0, 30).map((event) => (
              <div key={event.id} className="py-4 flex items-start gap-3">
                {event.classifier === "ACTUAL" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-extrabold text-ink">{titleCase(event.eventType)}</p>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[9px] font-extrabold text-ink-muted">{event.classifier}</span>
                    {event.isInferred && <span className="text-[9px] font-bold text-amber-700">Inferred</span>}
                    {event.isCorrection && <span className="text-[9px] font-bold text-brand">Correction</span>}
                  </div>
                  <p className="text-[10px] text-ink-muted mt-1">
                    {event.locationName ?? event.unlocode ?? "Location not reported"} · {formatDateTime(event.occurredAt, event.timezone)}
                  </p>
                  <p className="text-[9px] text-ink-muted mt-1">
                    Source: {event.provider} ({titleCase(event.sourceType)}) · Received {formatDateTime(event.receivedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <Radio className="w-7 h-7 text-slate-400 mx-auto" />
            <p className="text-sm font-extrabold text-ink mt-3">No verified tracking events</p>
            <p className="text-xs text-ink-muted mt-1 max-w-xl mx-auto">
              This is not the same as “no movement.” Qubere has no connected source reporting movement for this shipment yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
