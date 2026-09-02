import type { Prisma } from '@prisma/client';

const timeline = { plannedDeparture: true, estimatedDeparture: true, actualDeparture: true, plannedArrival: true, estimatedArrival: true, actualArrival: true } as const;
export const shipmentProgressInclude = {
  stageHistory: { orderBy: { enteredAt: 'desc' }, take: 100, select: { stage: true, enteredAt: true, exitedAt: true, outcome: true } },
  trackingStops: { orderBy: { sequence: 'asc' }, select: { id: true, name: true, unlocode: true, ...timeline } },
  legs: { orderBy: { sequence: 'asc' }, select: {
    id: true, sequence: true, legType: true, mode: true, status: true, carrierName: true, vesselName: true, voyageNumber: true, flightNumber: true, billOfLadingNumber: true, bookingNumber: true,
    originStop: { select: { id: true, name: true, unlocode: true } }, destinationStop: { select: { id: true, name: true, unlocode: true } }, ...timeline,
  } },
  transportLegs: { orderBy: { sequence: 'asc' }, select: {
    id: true, sequence: true, mode: true, status: true, carrierName: true, vesselName: true, voyageNumber: true, flightNumber: true,
    originName: true, originUnlocode: true, destinationName: true, destinationUnlocode: true, ...timeline,
  } },
  trackingIdentifiers: { select: { type: true, value: true, issuer: true } },
  trackingEvents: { where: { corrections: { none: {} } }, orderBy: { occurredAt: 'desc' }, take: 50, select: { id: true, eventType: true, classifier: true, occurredAt: true, locationName: true, provider: true } },
  etaObservations: { orderBy: { estimatedAt: 'desc' }, take: 1, select: { eta: true, previousEta: true, estimatedAt: true } },
} as const satisfies Prisma.ShipmentInclude;

type ProgressSource = Pick<Prisma.ShipmentGetPayload<{ include: typeof shipmentProgressInclude }>, keyof typeof shipmentProgressInclude | 'currentStage' | 'stageStatus' | 'estimatedArrival' | 'lastFreeDay'>;
const iso = (date: Date | null | undefined) => date?.toISOString() ?? null;
const stages = [
  ['DOCUMENT_INTAKE', 'Document intake'], ['CLASSIFICATION', 'Classification'], ['VALUATION', 'Valuation'],
  ['ORIGIN', 'Origin'], ['COMPLIANCE', 'Compliance'], ['FILING_PREP', 'Filing prep'], ['READY_TO_FILE', 'Ready to file'],
] as const;

export function buildShipmentProgress(s: ProgressSource) {
  const workflow = stages.map(([key, label]) => {
    const history = s.stageHistory.find(h => h.stage === key);
    const current = s.currentStage === key;
    const completed = current ? s.stageStatus === 'COMPLETE' : !!history?.exitedAt && ['ADVANCED', 'GATE_APPROVED'].includes(history.outcome ?? '');
    const state = completed ? 'complete' : current ? s.stageStatus === 'BLOCKED' ? 'blocked' : s.stageStatus === 'GATE_PENDING' ? 'review' : 'active' : 'pending';
    return { key, label, state, completedAt: completed ? iso(history?.exitedAt) : null };
  });
  const legs = s.legs.length ? s.legs.map(l => ({
    id: l.id, sequence: l.sequence, legType: l.legType as string, mode: l.mode as string, status: l.status as string,
    origin: l.originStop, destination: l.destinationStop, carrierName: l.carrierName, vesselName: l.vesselName, voyageNumber: l.voyageNumber, flightNumber: l.flightNumber,
    billOfLadingNumber: l.billOfLadingNumber, bookingNumber: l.bookingNumber,
    plannedDeparture: iso(l.plannedDeparture), estimatedDeparture: iso(l.estimatedDeparture), actualDeparture: iso(l.actualDeparture),
    plannedArrival: iso(l.plannedArrival), estimatedArrival: iso(l.estimatedArrival), actualArrival: iso(l.actualArrival),
  })) : s.transportLegs.map(l => ({
    id: l.id, sequence: l.sequence, legType: l.mode, mode: l.mode, status: l.status,
    origin: { id: `${l.id}-origin`, name: l.originName || 'Origin pending', unlocode: l.originUnlocode },
    destination: { id: `${l.id}-destination`, name: l.destinationName || 'Destination pending', unlocode: l.destinationUnlocode },
    carrierName: l.carrierName, vesselName: l.vesselName, voyageNumber: l.voyageNumber, flightNumber: l.flightNumber, billOfLadingNumber: null, bookingNumber: null,
    plannedDeparture: iso(l.plannedDeparture), estimatedDeparture: iso(l.estimatedDeparture), actualDeparture: iso(l.actualDeparture),
    plannedArrival: iso(l.plannedArrival), estimatedArrival: iso(l.estimatedArrival), actualArrival: iso(l.actualArrival),
  }));
  const eta = s.etaObservations[0];
  return {
    workflow, currentStage: s.currentStage,
    legs,
    stops: s.trackingStops.map(stop => ({ id: stop.id, name: stop.name, unlocode: stop.unlocode, actualArrival: iso(stop.actualArrival), actualDeparture: iso(stop.actualDeparture) })),
    references: s.trackingIdentifiers.map(r => ({ type: r.type, value: r.value, issuer: r.issuer })),
    events: s.trackingEvents.map(e => ({ id: e.id, eventType: e.eventType, classifier: e.classifier, occurredAt: iso(e.occurredAt)!, locationName: e.locationName, provider: e.provider })),
    eta: iso(eta?.eta ?? s.estimatedArrival), previousEta: iso(eta?.previousEta), etaUpdatedAt: iso(eta?.estimatedAt), lastFreeDay: iso(s.lastFreeDay),
  };
}
export type ShipmentProgress = ReturnType<typeof buildShipmentProgress>;
