'use client';

import { Check, Clock3, AlertCircle, Ship, Plane, Truck, TrainFront } from 'lucide-react';
import type { ShipmentProgress } from '@/lib/shipment-progress';

const label = (value: string) => value.toLowerCase().replaceAll('_', ' ');
const date = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not available';
const stateClasses: Record<string, string> = {
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-800', active: 'border-blue-300 bg-blue-50 text-blue-800',
  blocked: 'border-red-200 bg-red-50 text-red-800', review: 'border-amber-200 bg-amber-50 text-amber-800', pending: 'border-slate-200 bg-slate-50 text-slate-500',
};
const arrived = (leg: ShipmentProgress['legs'][number]) => !!leg.actualArrival || ['COMPLETED', 'DELIVERED'].includes(leg.status.toUpperCase());
const moving = (leg: ShipmentProgress['legs'][number]) => ['IN_TRANSIT', 'ARRIVED', 'EN_ROUTE', 'DISPATCHED'].includes(leg.status.toUpperCase());
const legIcon = (mode: string) => mode.toUpperCase().includes('AIR') ? Plane : mode.toUpperCase().includes('RAIL') ? TrainFront : ['TRUCK', 'COURIER'].includes(mode.toUpperCase()) ? Truck : Ship;

export function ShipmentMilestones({ progress, onTracking }: { progress: ShipmentProgress; onTracking: () => void }) {
  const legs = progress.legs;
  const activeLeg = legs.find(l => !arrived(l) && moving(l));
  const stops = legs.length ? [
    { ...legs[0].origin, done: !!legs[0].actualDeparture || arrived(legs[0]), active: false },
    ...legs.map(l => ({ ...l.destination, done: arrived(l), active: l.id === activeLeg?.id })),
  ] : progress.stops.map(s => ({ ...s, done: !!s.actualArrival || !!s.actualDeparture, active: false }));
  return <div className="space-y-5">
    {progress.workflow.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Filing progress">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><h2 className="font-semibold">Filing progress</h2><p className="text-xs text-slate-500">{progress.currentStage ? label(progress.currentStage) : 'Your broker has not started recording progress yet.'}</p></div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {progress.workflow.map((step, i) => <li key={step.key} aria-current={['active', 'review', 'blocked'].includes(step.state) ? 'step' : undefined} className={`rounded-xl border p-3 ${stateClasses[step.state]}`}>
          <div className="flex justify-between items-center text-xs"><span>{String(i + 1).padStart(2, '0')}</span>{step.state === 'complete' ? <Check className="h-4 w-4" /> : ['blocked', 'review'].includes(step.state) ? <AlertCircle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</div>
          <p className="text-xs font-semibold mt-2">{step.label}</p><p className="text-[11px] mt-1 capitalize">{step.state === 'review' ? 'Broker review' : step.state === 'active' ? 'In progress' : step.state}</p>
          <div className={`h-1 rounded-full mt-3 ${step.state === 'complete' ? 'bg-emerald-500' : step.state === 'active' ? 'bg-blue-600' : 'bg-current opacity-20'}`} />
        </li>)}
      </ol>
    </section>}
    <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-label="Shipment milestones">
      <div className="flex flex-wrap justify-between items-start gap-3"><div><h2 className="font-semibold">Shipment milestones</h2><p className="text-sm text-slate-500 mt-1">{activeLeg ? `Leg ${activeLeg.sequence} · ${label(activeLeg.mode)} to ${activeLeg.destination.name}` : legs.length ? `${legs.filter(arrived).length} of ${legs.length} legs arrived` : 'Route updates from your service provider'}</p></div><button onClick={onTracking} className="text-sm font-medium text-[#0071E3] hover:underline">View tracking details →</button></div>
      {stops.length ? <div className="overflow-x-auto mt-7 pb-3"><ol className="flex min-w-max" aria-label="Shipment route">
        {stops.map((stop, i) => <li key={`${stop.id}-${i}`} className="relative w-44 pr-5 last:pr-0">
          {i < stops.length - 1 && <div aria-hidden="true" className={`absolute left-7 right-0 top-3 h-1 ${stops[i + 1].done ? 'bg-emerald-500' : stops[i + 1].active ? 'bg-blue-600' : 'bg-slate-200'}`} />}
          <span className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${stop.done ? 'bg-emerald-500 border-emerald-500 text-white' : stop.active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white text-slate-500'}`}>{stop.done ? <Check className="h-4 w-4" /> : i + 1}</span>
          <p className="mt-3 text-xs font-semibold pr-3">{stop.name}</p>{stop.unlocode && <p className="text-[11px] text-slate-500 mt-1">{stop.unlocode}</p>}
          <span className="text-[11px] text-slate-500">{stop.done ? 'Reached' : stop.active ? 'En route' : 'Upcoming'}</span>
        </li>)}
      </ol></div> : <p className="mt-5 text-sm text-slate-500">Your service provider has not added route milestones yet.</p>}
      {legs.length > 0 && <div className="grid gap-3 mt-5 md:grid-cols-2 xl:grid-cols-4">{legs.map(l => { const Icon = legIcon(l.mode); return <div key={l.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0 text-slate-500" /><span className="text-xs font-semibold capitalize">{label(l.legType)}</span></div><p className="text-xs text-slate-500 mt-2">{l.carrierName || 'Carrier pending'}</p><p className="text-xs font-medium mt-2 capitalize">{label(l.status)}</p></div>; })}</div>}
    </section>
  </div>;
}

export function ShipmentTracking({ progress }: { progress: ShipmentProgress }) {
  return <div className="space-y-5">
    <div className="grid gap-4 md:grid-cols-3">{[['Current arrival estimate', progress.eta], ['Previous estimate', progress.previousEta], ['Last free day', progress.lastFreeDay]].map(([title, value]) => <section key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-xs text-slate-500">{title}</h3><p className="font-semibold mt-2">{date(value)}</p></section>)}</div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Tracking references</h2>{progress.references.length ? <dl className="grid gap-4 mt-4 md:grid-cols-3">{progress.references.map((r, i) => <div key={i}><dt className="text-xs text-slate-500">{r.type}{r.issuer ? ` · ${r.issuer}` : ''}</dt><dd className="text-sm font-mono mt-1 break-all">{r.value}</dd></div>)}</dl> : <p className="text-sm text-slate-500 mt-3">Tracking references have not been added yet.</p>}</section>
    {progress.legs.map(l => <section key={l.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold text-sm">Leg {l.sequence}: {l.origin.name} → {l.destination.name}</h2><span className="text-xs capitalize text-slate-500">{label(l.status)}</span></div><p className="text-sm text-slate-500 mt-2">{l.carrierName || 'Carrier pending'} · {label(l.mode)}</p>
      <dl className="grid gap-4 mt-5 sm:grid-cols-2 lg:grid-cols-3">{[
        ['Vessel / flight', [l.vesselName, l.voyageNumber, l.flightNumber].filter(Boolean).join(' · ') || 'Not available'], ['Bill of lading', l.billOfLadingNumber || 'Not available'], ['Booking', l.bookingNumber || 'Not available'],
        ['Planned departure', date(l.plannedDeparture)], ['Estimated departure', date(l.estimatedDeparture)], ['Actual departure', date(l.actualDeparture)],
        ['Planned arrival', date(l.plannedArrival)], ['Estimated arrival', date(l.estimatedArrival)], ['Actual arrival', date(l.actualArrival)],
      ].map(([title, value]) => <div key={title}><dt className="text-xs text-slate-500">{title}</dt><dd className="text-sm mt-1">{value}</dd></div>)}</dl>
    </section>)}
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Milestone history</h2>{progress.events.length ? <ol className="divide-y divide-slate-100 mt-3">{progress.events.map(e => <li key={e.id} className="py-4 flex flex-wrap justify-between gap-3"><div><p className="text-sm font-medium capitalize">{label(e.eventType)}</p><p className="text-xs text-slate-500 mt-1">{e.locationName || 'Location unavailable'} · {e.provider}</p></div><div className="text-right"><p className="text-xs text-slate-500">{date(e.occurredAt)}</p><p className="text-xs capitalize mt-1">{label(e.classifier)}</p></div></li>)}</ol> : <p className="text-sm text-slate-500 mt-3">No tracking events have been received yet.</p>}</section>
  </div>;
}
