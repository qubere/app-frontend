"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FileCheck2,
  Link2,
  Radio,
  Route,
  ShieldCheck,
  Ship,
} from "lucide-react";
import { Card } from "@/components/ui";

const movementMilestones = [
  { label: "Departed", events: ["VESSEL_DEPARTED", "DEPARTED", "PICKED_UP"] },
  { label: "In transit", events: ["IN_TRANSIT", "POSITION_UPDATE", "TRACKING_UPDATE"] },
  { label: "Arrived", events: ["PORT_ARRIVED", "ARRIVED"] },
  { label: "Discharged", events: ["CONTAINER_DISCHARGED", "DISCHARGED"] },
  { label: "Gate out", events: ["GATE_OUT_PORT", "GATE_OUT"] },
  { label: "Delivered", events: ["DELIVERED", "POD_RECEIVED"] },
] as const;

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function formatDateTime(value: string | Date | null | undefined): string {
  const date = asDate(value);
  if (!date) return "Not reported";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function relativeAge(value: string | Date | null | undefined, now: number): string {
  const date = asDate(value);
  if (!date) return "Never";
  const minutes = Math.max(0, Math.round((now - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function titleCase(value: string | null | undefined): string {
  if (!value) return "Update";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function StatusPill({ tone, children }: { tone: "good" | "warn" | "muted" | "bad"; children: React.ReactNode }) {
  const styles = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    muted: "border-slate-200 bg-slate-50 text-slate-700",
    bad: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${styles[tone]}`}>{children}</span>;
}

function MovementRail({ events }: { events: any[] }) {
  const eventTypes = new Set(events.map((event) => String(event.eventType).toUpperCase()));
  const reached = movementMilestones.map((milestone) => milestone.events.some((event) => eventTypes.has(event)));
  const currentIndex = reached.reduce((latest, done, index) => (done ? index : latest), -1);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[680px] grid-cols-6 gap-2">
        {movementMilestones.map((milestone, index) => {
          const complete = reached[index];
          const current = index === currentIndex;
          return (
            <div key={milestone.label}>
              <div className={`h-1.5 rounded-full ${complete ? "bg-emerald-500" : "bg-slate-200"}`} />
              <div className="mt-2 flex items-center gap-1.5">
                {complete ? (
                  current ? <Radio className="h-3.5 w-3.5 text-emerald-600" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Circle className="h-3 w-3 text-slate-300" />
                )}
                <span className={`text-[10px] ${current ? "font-extrabold text-ink" : "font-semibold text-ink-muted"}`}>{milestone.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomsRail({ filing }: { filing: any }) {
  const responses = filing?.responses ?? [];
  const responseText = responses.map((response: any) => `${response.code} ${response.status} ${response.title}`.toUpperCase()).join(" ");
  const submitted = Boolean(filing?.submittedAt);
  const accepted = submitted && (responseText.includes("ACK") || String(filing?.filingStatus).toUpperCase() === "ACCEPTED");
  const released = Boolean(filing?.releasedAt) || responseText.includes("RELE") || String(filing?.filingStatus).toUpperCase() === "RELEASED";
  const stages = [
    { label: "Prepared", done: Boolean(filing) },
    { label: "Submitted", done: submitted },
    { label: "Accepted", done: accepted },
    { label: "Released", done: released },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {stages.map((stage) => (
        <div key={stage.label}>
          <div className={`h-1.5 rounded-full ${stage.done ? "bg-blue-600" : "bg-slate-200"}`} />
          <div className="mt-2 flex items-center gap-1.5">
            {stage.done ? <CheckCircle2 className="h-3.5 w-3.5 text-blue-700" /> : <Circle className="h-3 w-3 text-slate-300" />}
            <span className={`text-[10px] ${stage.done ? "font-extrabold text-ink" : "font-semibold text-ink-muted"}`}>{stage.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShipmentTrackingExperience({ shipment }: { shipment: any }) {
  const [now] = useState(() => Date.now());
  const events = shipment.trackingEvents ?? [];
  const latestEvent = events[0];
  const latestEta = shipment.etaObservations?.[0];
  const connections = shipment.trackingConnections ?? [];
  const subscriptions = shipment.trackingSubscriptions ?? [];
  const activeConnections = connections.filter((connection: any) => connection.status === "ACTIVE");
  const latestFiling = shipment.customsFilings?.[0];
  const authorityResponses = latestFiling?.responses ?? [];
  const latestAuthorityResponse = [...authorityResponses].sort(
    (left: any, right: any) => Number(asDate(right.receivedAt)) - Number(asDate(left.receivedAt))
  )[0];
  const lastSignal = asDate(latestEvent?.receivedAt);
  const signalAgeHours = lastSignal ? (now - lastSignal.getTime()) / 3_600_000 : null;
  const trackingState = !activeConnections.length
    ? "NOT_CONFIGURED"
    : signalAgeHours == null
      ? "WAITING"
      : signalAgeHours > 24
        ? "STALE"
        : "LIVE";
  const customsAlert = authorityResponses.find((response: any) =>
    /HOLD|EXAM|PTT|REQUEST|RFRA/i.test(`${response.code} ${response.title} ${response.status}`)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 shadow-2xs md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-brand" />
            <h2 className="text-base font-extrabold text-ink">Shipment visibility</h2>
          </div>
          <p className="mt-1 text-xs font-medium text-ink-muted">Movement and customs are shown as separate, source-backed rails.</p>
        </div>
        {trackingState === "LIVE" ? (
          <StatusPill tone="good">Live · {relativeAge(latestEvent?.receivedAt, now)}</StatusPill>
        ) : trackingState === "STALE" ? (
          <StatusPill tone="warn">Stale · {relativeAge(latestEvent?.receivedAt, now)}</StatusPill>
        ) : trackingState === "WAITING" ? (
          <StatusPill tone="muted">Connected · awaiting first signal</StatusPill>
        ) : (
          <StatusPill tone="muted">Tracking not configured</StatusPill>
        )}
      </div>

      {trackingState === "NOT_CONFIGURED" && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
          <div>
            <p className="text-xs font-extrabold text-ink">No authoritative movement source is connected</p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">Add the broker&apos;s tracking provider or Qubere&apos;s generic webhook connection. Until then, this workspace will not invent carrier, container, location, or release data.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Latest movement</p>
            <Ship className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-3 text-lg font-extrabold text-ink">{latestEvent ? titleCase(latestEvent.eventType) : "No verified event"}</p>
          <p className="mt-1 text-xs font-medium text-ink-muted">{latestEvent?.locationName ?? latestEvent?.unlocode ?? "Location not reported"}</p>
        </Card>
        <Card className="border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Current ETA</p>
            <Clock3 className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-3 text-base font-extrabold text-ink">{formatDateTime(latestEta?.eta ?? shipment.estimatedArrival)}</p>
          <p className="mt-1 text-xs font-medium text-ink-muted">{latestEta?.provider ? `Source: ${latestEta.provider}` : "No ETA observation history"}</p>
        </Card>
        <Card className="border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Customs authority</p>
            <FileCheck2 className="h-4 w-4 text-brand" />
          </div>
          <p className="mt-3 text-lg font-extrabold text-ink">{latestAuthorityResponse?.title ?? (latestFiling ? "Awaiting authority response" : "No filing linked")}</p>
          <p className="mt-1 text-xs font-medium text-ink-muted">{latestAuthorityResponse ? `${latestAuthorityResponse.code} · ${formatDateTime(latestAuthorityResponse.receivedAt)}` : "No authoritative release response received"}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
        <div className="space-y-4">
          <Card className="space-y-4 border border-border bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Movement rail</h3>
                <p className="mt-1 text-[11px] font-medium text-ink-muted">Completed only when a normalized provider event exists.</p>
              </div>
              <Activity className="h-4 w-4 text-brand" />
            </div>
            <MovementRail events={events} />
          </Card>

          <Card className="space-y-4 border border-border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Customs rail</h3>
                <p className="mt-1 text-[11px] font-medium text-ink-muted">Release is credited only to a filing timestamp or parsed authority response.</p>
              </div>
              <ShieldCheck className="h-4 w-4 text-brand" />
            </div>
            <CustomsRail filing={latestFiling} />
            {customsAlert ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <p className="text-xs font-extrabold text-amber-950">{customsAlert.title}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-amber-900">{customsAlert.description}</p>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-medium text-ink-muted">Hold, exam, PTT, and release remain unknown until the ABI/ABILITY response feed supplies them. Liquidation is not connected.</p>
            )}
          </Card>

          <Card className="border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Verified timeline</h3>
                <p className="mt-1 text-[11px] font-medium text-ink-muted">Newest provider event first</p>
              </div>
              <Radio className="h-4 w-4 text-brand" />
            </div>
            {events.length ? (
              <div className="mt-4 divide-y divide-border/70">
                {events.slice(0, 30).map((event: any) => (
                  <div key={event.id} className="grid gap-2 py-3 md:grid-cols-[145px_minmax(0,1fr)_auto] md:items-center">
                    <div>
                      <p className="text-[11px] font-bold text-ink">{formatDateTime(event.occurredAt)}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-ink-muted">Received {relativeAge(event.receivedAt, now)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-ink">{titleCase(event.eventType)}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-ink-muted">{event.locationName ?? event.unlocode ?? "Location not reported"}</p>
                    </div>
                    <div className="flex items-center gap-2 md:justify-end">
                      {event.rawPayloadHash && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-label="Payload archived and hashed" />}
                      <StatusPill tone="muted">{event.provider}</StatusPill>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs font-medium text-ink-muted">No provider events have been received for this shipment.</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border border-border bg-white p-5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Connections</h3>
            <div className="mt-3 space-y-3">
              {connections.length ? connections.map((connection: any) => {
                const hasError = connection.status === "ERROR" || Boolean(connection.lastErrorAt);
                return (
                  <div key={connection.id} className="rounded-xl border border-border bg-slate-50/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-extrabold text-ink">{connection.name}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-ink-muted">{connection.trackingProviderDefinition?.displayName ?? connection.provider}</p>
                      </div>
                      <StatusPill tone={hasError ? "bad" : connection.status === "ACTIVE" ? "good" : "muted"}>{connection.status}</StatusPill>
                    </div>
                    <p className="mt-2 text-[10px] font-medium text-ink-muted">Last event {relativeAge(connection.lastEventAt, now)}</p>
                    {connection.lastErrorMessage && <p className="mt-1 text-[10px] font-semibold text-rose-700">{connection.lastErrorMessage}</p>}
                  </div>
                );
              }) : (
                <p className="rounded-xl bg-slate-50 p-3 text-[11px] font-medium text-ink-muted">No account or client connection is available.</p>
              )}
            </div>
          </Card>

          <Card className="border border-border bg-white p-5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Tracking references</h3>
            <div className="mt-3 space-y-2">
              {(shipment.trackingIdentifiers ?? []).length ? shipment.trackingIdentifiers.map((identifier: any) => (
                <div key={identifier.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">{identifier.type}</span>
                  <span className="truncate font-mono font-bold text-ink">{identifier.value}</span>
                </div>
              )) : <p className="text-[11px] font-medium text-ink-muted">No bill, booking, container, or PRO reference on file.</p>}
            </div>
          </Card>

          <Card className="border border-border bg-white p-5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">Subscriptions</h3>
            <div className="mt-3 space-y-2">
              {subscriptions.length ? subscriptions.map((subscription: any) => (
                <div key={subscription.id} className="flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-ink">{subscription.provider}</p>
                    <p className="text-[10px] font-medium text-ink-muted">Synced {relativeAge(subscription.lastSyncAt, now)}</p>
                  </div>
                  <StatusPill tone={subscription.status === "ACTIVE" ? "good" : subscription.status === "FAILED" ? "bad" : "muted"}>{subscription.status}</StatusPill>
                </div>
              )) : <p className="text-[11px] font-medium text-ink-muted">No provider subscription has been established.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
