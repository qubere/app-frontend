import { db } from "@/lib/db";

export type MovementStatus =
  | "NOT_STARTED"
  | "PRE_CARRIAGE"
  | "AT_ORIGIN_PORT"
  | "IN_TRANSIT"
  | "AT_TRANSSHIPMENT"
  | "AT_DESTINATION_PORT"
  | "DISCHARGED"
  | "AVAILABLE"
  | "GATED_OUT"
  | "DELIVERED"
  | "CANCELLED"
  | "UNKNOWN";

export type CustomsTrackingStatus =
  | "NOT_STARTED"
  | "PREPARING"
  | "READY"
  | "FILED"
  | "ACCEPTED"
  | "REJECTED"
  | "HOLD"
  | "RELEASED"
  | "CANCELLED";

export type TrackingHealth = "ON_TRACK" | "ATTENTION" | "CRITICAL" | "STALE" | "NOT_TRACKED";

export interface TrackingIdentifierRecord {
  type: string;
  value: string;
  issuer: string;
  isPrimary: boolean;
}

export interface TrackingLegRecord {
  id: string;
  sequence: number;
  mode: string;
  carrierCode: string | null;
  carrierName: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  flightNumber: string | null;
  originName: string | null;
  originUnlocode: string | null;
  destinationName: string | null;
  destinationUnlocode: string | null;
  plannedDeparture: Date | null;
  estimatedDeparture: Date | null;
  actualDeparture: Date | null;
  plannedArrival: Date | null;
  estimatedArrival: Date | null;
  actualArrival: Date | null;
  status: string;
}

export interface TrackingEventRecord {
  id: string;
  eventType: string;
  classifier: string;
  occurredAt: Date;
  receivedAt: Date;
  sourceUpdatedAt: Date | null;
  locationName: string | null;
  unlocode: string | null;
  timezone: string | null;
  provider: string;
  sourceType: string;
  confidence: number | null;
  isInferred: boolean;
  isCorrection: boolean;
}

export interface EtaObservationRecord {
  estimatedAt: Date;
  eta: Date;
  previousEta: Date | null;
  deltaMinutes: number | null;
  provider: string;
  confidence: number | null;
  reasonCode: string | null;
}

export interface TrackingSubscriptionRecord {
  provider: string;
  status: string;
  lastEventAt: Date | null;
  lastSyncAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorCode: string | null;
}

export interface TrackingDeadlineRecord {
  id: string;
  type: string;
  deadlineClass: string;
  status: string;
  dueAt: Date | null;
  estimated: boolean;
}

export interface ShipmentTrackingProjection {
  shipmentId: string;
  shipmentNumber: string;
  mode: string | null;
  movement: {
    status: MovementStatus;
    currentLocation: string | null;
    nextStop: string | null;
    eta: Date | null;
    etaDeltaMinutes: number | null;
    etaProvider: string | null;
    lastCarrierEventAt: Date | null;
    lastSynchronizedAt: Date | null;
  };
  customs: {
    status: CustomsTrackingStatus;
    readiness: number | null;
    blockingExceptionCount: number;
    filingId: string | null;
  };
  health: {
    status: TrackingHealth;
    reasonCodes: string[];
    isDataStale: boolean;
  };
  nextAction: {
    type: "START_TRACKING" | "RESOLVE_EXCEPTION" | "CHECK_TRACKING_SOURCE" | "COMPLETE_CUSTOMS";
    title: string;
    detail: string;
    dueAt: Date | null;
  } | null;
  identifiers: TrackingIdentifierRecord[];
  legs: TrackingLegRecord[];
  events: TrackingEventRecord[];
  deadlines: TrackingDeadlineRecord[];
  subscriptions: TrackingSubscriptionRecord[];
  journey?: {
    shipmentId: string;
    shipmentNumber: string;
    journeyStatus: {
      overallStage: string;
      headline: string;
      percentComplete: number;
      blocked: boolean;
      blockingReasons: string[];
    };
    stops: Array<{
      id: string;
      sequence: number;
      role: string | null;
      name: string;
      unlocode: string | null;
      firmsCode: string | null;
      timezone: string | null;
    }>;
    legs: Array<{
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
        plannedDeparture: Date | null; estimatedDeparture: Date | null; actualDeparture: Date | null;
        plannedArrival: Date | null; estimatedArrival: Date | null; actualArrival: Date | null;
      };
      documents: {
        total: number; onFile: number; missingRequired: number;
        rows: Array<{
          legDocumentId: string;
          slotKey: string;
          slotLabel: string;
          expectedDocType: string;
          requirement: string;
          requirementReason: string | null;
          status: "MISSING" | "RECEIVED" | "REVIEW_REQUIRED" | "PROCESSED";
          document: { id: string; fileName: string; fileUrl: string | null; confidence: number | null } | null;
        }>;
      };
      events: TrackingEventRecord[];
      eta: { current: Date | null; deltaMinutes: number | null; provider: string | null };
      inference: { source: string; confidence: number | null; needsConfirmation: boolean } | null;
    }>;
    customs: { status: CustomsTrackingStatus };
    inferenceProposal: {
      inputsHash: string;
      confidence: number;
      createdAtIso: string;
      changes: Array<{ type: string; description: string; legSequence?: number }>;
    } | null;
  };
}

export interface BuildTrackingProjectionInput {
  shipment: {
    id: string;
    shipmentNumber: string;
    transportMode: string | null;
    estimatedArrival: Date | null;
    readinessScore: number | null;
  };
  identifiers: TrackingIdentifierRecord[];
  legs: TrackingLegRecord[];
  events: TrackingEventRecord[];
  etaObservations: EtaObservationRecord[];
  subscriptions: TrackingSubscriptionRecord[];
  deadlines: TrackingDeadlineRecord[];
  openExceptions: { blocking: boolean; severity: string | null }[];
  latestFiling: { id: string; filingStatus: string } | null;
  now?: Date;
}

const MOVEMENT_EVENT_STATUS: Array<[RegExp, MovementStatus]> = [
  [/(CANCELLED|CANCELED)/, "CANCELLED"],
  [/(DELIVERED|DELIVERY_COMPLETED)/, "DELIVERED"],
  [/(GATE_OUT|GATED_OUT|PICKUP_COMPLETED)/, "GATED_OUT"],
  [/(AVAILABLE|CARGO_AVAILABLE)/, "AVAILABLE"],
  [/(DISCHARGED|DISCHARGE)/, "DISCHARGED"],
  [/(TRANSSHIPMENT.*ARRIVAL|ARRIVED.*TRANSSHIPMENT)/, "AT_TRANSSHIPMENT"],
  [/(ARRIVED|ARRIVAL|VESSEL_ARRIVAL)/, "AT_DESTINATION_PORT"],
  [/(DEPARTED|DEPARTURE|VESSEL_DEPARTURE|LOADED_ON_VESSEL)/, "IN_TRANSIT"],
  [/(GATE_IN|GATED_IN|RECEIVED_AT_ORIGIN)/, "AT_ORIGIN_PORT"],
  [/(PICKED_UP|PRE_CARRIAGE)/, "PRE_CARRIAGE"],
  [/(BOOKED|BOOKING_CONFIRMED)/, "NOT_STARTED"],
];

function movementStatus(events: TrackingEventRecord[], legs: TrackingLegRecord[]): MovementStatus {
  const actual = events
    .filter((event) => event.classifier === "ACTUAL")
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0];
  // No verified events -> fall back to the furthest-along leg's status (the
  // earliest leg still moving, or the last leg if all are done), not leg[0].
  const orderedLegs = [...legs].sort((a, b) => a.sequence - b.sequence);
  const fallbackLeg =
    orderedLegs.find((leg) => leg.status && !/^(PLANNED|BOOKED|NOT_STARTED)$/i.test(leg.status)) ??
    orderedLegs[orderedLegs.length - 1];
  const candidate = actual?.eventType ?? fallbackLeg?.status;
  if (!candidate) return "UNKNOWN";
  const normalized = candidate.toUpperCase().replace(/[ -]+/g, "_");
  return MOVEMENT_EVENT_STATUS.find(([pattern]) => pattern.test(normalized))?.[1] ?? "UNKNOWN";
}

/** Map a canonical LegStatus onto a token movementStatus()'s regex table understands. */
function legStatusToMovementToken(status: string): string {
  switch (status) {
    case "READY_FOR_PICKUP":
      return "GATE_IN";
    case "IN_TRANSIT":
      return "DEPARTED";
    case "ARRIVED":
      return "ARRIVED";
    case "COMPLETED":
      return "DELIVERED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "BOOKED";
  }
}

function shipmentLegToTrackingRecord(leg: any): TrackingLegRecord {
  return {
    id: leg.id,
    sequence: leg.sequence,
    mode: leg.mode,
    carrierCode: leg.carrierScac ?? null,
    carrierName: leg.carrierName ?? null,
    vesselName: leg.vesselName ?? null,
    voyageNumber: leg.voyageNumber ?? null,
    flightNumber: leg.flightNumber ?? null,
    originName: leg.originStop?.name ?? null,
    originUnlocode: leg.originStop?.unlocode ?? null,
    destinationName: leg.destinationStop?.name ?? null,
    destinationUnlocode: leg.destinationStop?.unlocode ?? null,
    plannedDeparture: leg.plannedDeparture ?? null,
    estimatedDeparture: leg.estimatedDeparture ?? null,
    actualDeparture: leg.actualDeparture ?? null,
    plannedArrival: leg.plannedArrival ?? null,
    estimatedArrival: leg.estimatedArrival ?? null,
    actualArrival: leg.actualArrival ?? null,
    status: legStatusToMovementToken(leg.status),
  };
}

export function customsTrackingStatus(status: string | null | undefined): CustomsTrackingStatus {
  switch (status) {
    case "Preparing":
    case "ValidationFailed":
      return "PREPARING";
    case "ReadyForBrokerReview":
    case "BrokerApproved":
      return "READY";
    case "TransmissionPending":
    case "Transmitted":
      return "FILED";
    case "Accepted":
      return "ACCEPTED";
    case "Rejected":
      return "REJECTED";
    case "DocumentsRequested":
    case "CustomsHold":
      return "HOLD";
    case "Released":
    case "Closed":
      return "RELEASED";
    case "CancellationRequested":
    case "Cancelled":
      return "CANCELLED";
    default:
      return "NOT_STARTED";
  }
}

function staleAfterHours(mode: string | null): number {
  switch (mode?.toUpperCase()) {
    case "AIR":
      return 12;
    case "TRUCK":
    case "RAIL":
      return 6;
    case "PARCEL":
      return 24;
    default:
      return 72;
  }
}

function latestEta(observations: EtaObservationRecord[], shipmentEta: Date | null) {
  const ordered = [...observations].sort((a, b) => b.estimatedAt.getTime() - a.estimatedAt.getTime());
  const current = ordered[0];
  if (!current) {
    return { eta: shipmentEta, deltaMinutes: null, provider: null };
  }
  const previous = current.previousEta ?? ordered[1]?.eta ?? null;
  const deltaMinutes =
    current.deltaMinutes ?? (previous ? Math.round((current.eta.getTime() - previous.getTime()) / 60_000) : null);
  return { eta: current.eta, deltaMinutes, provider: current.provider };
}

export function buildTrackingProjection(input: BuildTrackingProjectionInput): ShipmentTrackingProjection {
  const now = input.now ?? new Date();
  const orderedEvents = [...input.events].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const lastActual = orderedEvents.find((event) => event.classifier === "ACTUAL") ?? null;
  const lastSync = input.subscriptions
    .flatMap((subscription) => [subscription.lastSyncAt, subscription.lastEventAt])
    .concat(orderedEvents.map((event) => event.receivedAt))
    .filter((value): value is Date => value !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const eta = latestEta(input.etaObservations, input.shipment.estimatedArrival);
  const blockers = input.openExceptions.filter(
    (exception) => exception.blocking || exception.severity === "Critical" || exception.severity === "High"
  ).length;
  const hasTrackingConfiguration = input.identifiers.length > 0 || input.subscriptions.length > 0 || input.events.length > 0;
  const freshnessAnchor = lastSync;
  const isDataStale =
    hasTrackingConfiguration &&
    (!freshnessAnchor || now.getTime() - freshnessAnchor.getTime() > staleAfterHours(input.shipment.transportMode) * 3_600_000);
  const failedSubscription = input.subscriptions.some((subscription) => subscription.status === "FAILED");
  const customs = customsTrackingStatus(input.latestFiling?.filingStatus);
  const reasonCodes: string[] = [];

  let health: TrackingHealth = "ON_TRACK";
  if (!hasTrackingConfiguration) reasonCodes.push("TRACKING_NOT_CONFIGURED");

  if (blockers > 0) {
    health = "CRITICAL";
    reasonCodes.push("CUSTOMS_BLOCKER_OPEN");
  } else if (!hasTrackingConfiguration) {
    health = "NOT_TRACKED";
  } else if (failedSubscription) {
    health = "ATTENTION";
    reasonCodes.push("TRACKING_PROVIDER_FAILED");
  } else if (isDataStale) {
    health = "STALE";
    reasonCodes.push("TRACKING_DATA_STALE");
  }

  if (eta.deltaMinutes !== null && eta.deltaMinutes < -360) {
    reasonCodes.push("ETA_MOVED_EARLIER");
    if (customs !== "RELEASED" && customs !== "ACCEPTED" && health === "ON_TRACK") health = "ATTENTION";
  }

  const nextOpenDeadline = [...input.deadlines]
    .filter((deadline) => deadline.status === "OPEN" && deadline.dueAt)
    .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity))[0];

  let nextAction: ShipmentTrackingProjection["nextAction"] = null;
  if (blockers > 0) {
    nextAction = {
      type: "RESOLVE_EXCEPTION",
      title: `Resolve ${blockers} customs blocker${blockers === 1 ? "" : "s"}`,
      detail: eta.eta
        ? "Clear the blocking evidence or approval before the current ETA to preserve pre-arrival clearance."
        : "Clear the blocking evidence or approval before filing.",
      dueAt: nextOpenDeadline?.dueAt ?? eta.eta,
    };
  } else if (!hasTrackingConfiguration) {
    nextAction = {
      type: "START_TRACKING",
      title: "Add a carrier reference to start tracking",
      detail: "Add an MBL, booking, container, MAWB, PRO, or tracking number. Qubere will not infer movement without a source.",
      dueAt: null,
    };
  } else if (failedSubscription || isDataStale) {
    nextAction = {
      type: "CHECK_TRACKING_SOURCE",
      title: failedSubscription ? "Tracking provider needs attention" : "Carrier data is stale",
      detail: "Verify the carrier reference and provider connection. No movement is inferred while the feed is stale.",
      dueAt: null,
    };
  } else if (eta.eta && eta.eta.getTime() - now.getTime() <= 72 * 3_600_000 && !["ACCEPTED", "RELEASED"].includes(customs)) {
    nextAction = {
      type: "COMPLETE_CUSTOMS",
      title: "Complete customs work before arrival",
      detail: "The shipment is approaching arrival and has not yet reached customs acceptance.",
      dueAt: nextOpenDeadline?.dueAt ?? eta.eta,
    };
  }

  const nextStop = [...input.legs]
    .sort((a, b) => a.sequence - b.sequence)
    .find((leg) => !leg.actualArrival)?.destinationName ?? null;

  return {
    shipmentId: input.shipment.id,
    shipmentNumber: input.shipment.shipmentNumber,
    mode: input.shipment.transportMode,
    movement: {
      status: movementStatus(orderedEvents, input.legs),
      currentLocation: lastActual?.locationName ?? lastActual?.unlocode ?? null,
      nextStop,
      eta: eta.eta,
      etaDeltaMinutes: eta.deltaMinutes,
      etaProvider: eta.provider,
      lastCarrierEventAt: lastActual?.occurredAt ?? null,
      lastSynchronizedAt: lastSync,
    },
    customs: {
      status: customs,
      readiness: input.shipment.readinessScore,
      blockingExceptionCount: blockers,
      filingId: input.latestFiling?.id ?? null,
    },
    health: { status: health, reasonCodes, isDataStale },
    nextAction,
    identifiers: input.identifiers,
    legs: [...input.legs].sort((a, b) => a.sequence - b.sequence),
    events: orderedEvents,
    deadlines: [...input.deadlines].sort(
      (a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity)
    ),
    subscriptions: input.subscriptions,
  };
}

export async function getShipmentTrackingProjection(
  accountId: string,
  shipmentId: string,
  now = new Date()
): Promise<ShipmentTrackingProjection | null> {
  const shipment = await db.shipment.findFirst({
    where: { id: shipmentId, accountId, deletedAt: null },
    select: {
      id: true,
      shipmentNumber: true,
      transportMode: true,
      estimatedArrival: true,
      readinessScore: true,
      trackingIdentifiers: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: { type: true, value: true, issuer: true, isPrimary: true },
      },
      trackingEvents: {
        orderBy: { occurredAt: "desc" },
        take: 100,
        select: {
          id: true,
          eventType: true,
          classifier: true,
          occurredAt: true,
          receivedAt: true,
          sourceUpdatedAt: true,
          locationName: true,
          unlocode: true,
          timezone: true,
          provider: true,
          sourceType: true,
          confidence: true,
          isInferred: true,
          isCorrection: true,
        },
      },
      etaObservations: {
        orderBy: { estimatedAt: "desc" },
        take: 20,
        select: {
          estimatedAt: true,
          eta: true,
          previousEta: true,
          deltaMinutes: true,
          provider: true,
          confidence: true,
          reasonCode: true,
        },
      },
      trackingSubscriptions: {
        select: {
          provider: true,
          status: true,
          lastEventAt: true,
          lastSyncAt: true,
          lastErrorAt: true,
          lastErrorCode: true,
        },
      },
      complianceDeadlines: {
        where: { status: "OPEN" },
        select: { id: true, type: true, deadlineClass: true, status: true, dueAt: true, estimated: true },
      },
      exceptionItems: {
        where: { status: { not: "Resolved" } },
        select: { blocking: true, severity: true },
      },
      customsFilings: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true, filingStatus: true },
      },
      legs: {
        orderBy: { sequence: "asc" },
        include: {
          originStop: true,
          destinationStop: true,
          events: { orderBy: { occurredAt: "desc" }, take: 40 },
          etaObservations: { orderBy: { estimatedAt: "desc" }, take: 5 },
          legDocuments: {
            orderBy: { createdAt: "asc" },
            include: {
              document: { select: { id: true, fileName: true, fileUrl: true, confidence: true, status: true } },
            },
          },
        },
      },
      legInferenceRuns: {
        where: { status: "PROPOSED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!shipment) return null;

  const baseProjection = buildTrackingProjection({
    shipment,
    identifiers: shipment.trackingIdentifiers,
    // The physical-movement rail derives from the canonical ShipmentLeg model
    // (the deprecated TransportLeg model is no longer read on the customs side).
    legs: (shipment.legs ?? []).map(shipmentLegToTrackingRecord),
    events: shipment.trackingEvents,
    etaObservations: shipment.etaObservations,
    subscriptions: shipment.trackingSubscriptions,
    deadlines: shipment.complianceDeadlines,
    openExceptions: shipment.exceptionItems,
    latestFiling: shipment.customsFilings[0] ?? null,
    now,
  });

  return {
    ...baseProjection,
    journey: assembleJourney(shipment, baseProjection.customs.status),
  };
}

// ---------------------------------------------------------------------------
// Multi-leg journey projection
// ---------------------------------------------------------------------------

type LegDocStatus = "MISSING" | "RECEIVED" | "REVIEW_REQUIRED" | "PROCESSED";

function legDocStatus(documentId: string | null, docStatus: string | null | undefined): LegDocStatus {
  if (!documentId) return "MISSING";
  const s = (docStatus ?? "").toUpperCase();
  if (s.includes("REVIEW") || s.includes("NEEDS_CLASSIFICATION") || s === "QUARANTINED") return "REVIEW_REQUIRED";
  if (s === "PROCESSED" || s === "COMPLETED" || s === "READY") return "PROCESSED";
  return "RECEIVED";
}

function legHeadline(leg: any, total: number): string {
  const dest = leg.destinationStop?.name ?? "destination";
  const state = String(leg.status).toLowerCase().replace(/_/g, " ");
  return `Leg ${leg.sequence} of ${total} · ${leg.mode.toLowerCase()} · ${state} → ${dest}`;
}

export function assembleJourney(
  shipment: any,
  customsStatus: CustomsTrackingStatus
): NonNullable<ShipmentTrackingProjection["journey"]> {
  const legs: any[] = [...(shipment.legs ?? [])].sort((a, b) => a.sequence - b.sequence);
  const total = legs.length;

  // Stops in journey order: first leg's origin, then each leg's destination.
  const orderedStops: any[] = [];
  const seen = new Set<string>();
  legs.forEach((leg, i) => {
    if (i === 0 && leg.originStop && !seen.has(leg.originStop.id)) {
      seen.add(leg.originStop.id);
      orderedStops.push(leg.originStop);
    }
    if (leg.destinationStop && !seen.has(leg.destinationStop.id)) {
      seen.add(leg.destinationStop.id);
      orderedStops.push(leg.destinationStop);
    }
  });

  // percentComplete weighted by planned duration when available, else even.
  const legWeight = (leg: any): number => {
    const start = leg.plannedDeparture ?? leg.estimatedDeparture ?? leg.actualDeparture;
    const end = leg.plannedArrival ?? leg.estimatedArrival ?? leg.actualArrival;
    if (start && end) {
      const ms = new Date(end).getTime() - new Date(start).getTime();
      if (ms > 0) return ms;
    }
    return 1;
  };
  const totalWeight = legs.reduce((a, l) => a + legWeight(l), 0) || 1;
  const doneWeight = legs
    .filter((l) => l.status === "COMPLETED")
    .reduce((a, l) => a + legWeight(l), 0);
  const percentComplete = total > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;

  const activeLeg = legs.find((l) => l.status !== "COMPLETED" && l.status !== "CANCELLED") ?? legs[legs.length - 1];
  const overallStage = activeLeg ? `${activeLeg.legType}_${activeLeg.status}` : "NOT_STARTED";
  const headline = total === 0
    ? "No journey scheduled"
    : activeLeg
      ? legHeadline(activeLeg, total)
      : "Journey complete";

  const legExceptions = legs.filter((l) => l.status === "EXCEPTION");
  const blockingExceptions = (shipment.exceptionItems ?? []).filter((e: any) => e.blocking);
  const blocked = legExceptions.length > 0 || blockingExceptions.length > 0;
  const blockingReasons = [
    ...legExceptions.map((l: any) => l.statusReason || `Leg ${l.sequence} exception`),
    ...blockingExceptions.map((e: any) => e.severity ? `${e.severity} exception` : "Blocking exception"),
  ];

  const journeyLegs = legs.map((leg) => {
    const rows = (leg.legDocuments ?? []).map((ld: any) => ({
      legDocumentId: ld.id,
      slotKey: ld.slotKey,
      slotLabel: ld.slotLabel,
      expectedDocType: ld.expectedDocType,
      requirement: ld.requirement,
      requirementReason: ld.requirementReason,
      status: legDocStatus(ld.documentId, ld.document?.status),
      document: ld.document
        ? { id: ld.document.id, fileName: ld.document.fileName, fileUrl: ld.document.fileUrl, confidence: ld.document.confidence }
        : null,
    }));
    const missingRequired = rows.filter(
      (r: any) => (r.requirement === "REQUIRED" || r.requirement === "CONDITIONAL") && r.status === "MISSING"
    ).length;

    const latestEta = (leg.etaObservations ?? [])[0];

    return {
      id: leg.id,
      sequence: leg.sequence,
      legType: leg.legType,
      mode: leg.mode,
      status: leg.status,
      statusReason: leg.statusReason,
      origin: { stopId: leg.originStopId, name: leg.originStop?.name ?? "", unlocode: leg.originStop?.unlocode ?? null },
      destination: { stopId: leg.destinationStopId, name: leg.destinationStop?.name ?? "", unlocode: leg.destinationStop?.unlocode ?? null },
      carrier: { name: leg.carrierName, scac: leg.carrierScac },
      conveyance: {
        vesselName: leg.vesselName || undefined,
        voyageNumber: leg.voyageNumber || undefined,
        flightNumber: leg.flightNumber || undefined,
        imoNumber: leg.imoNumber || undefined,
      },
      references: {
        billOfLadingNumber: leg.billOfLadingNumber || undefined,
        billOfLadingType: leg.billOfLadingType || undefined,
        bookingNumber: leg.bookingNumber || undefined,
      },
      timeline: {
        plannedDeparture: leg.plannedDeparture,
        estimatedDeparture: leg.estimatedDeparture,
        actualDeparture: leg.actualDeparture,
        plannedArrival: leg.plannedArrival,
        estimatedArrival: leg.estimatedArrival,
        actualArrival: leg.actualArrival,
      },
      documents: { total: rows.length, onFile: rows.filter((r: any) => r.document).length, missingRequired, rows },
      events: (leg.events ?? []).map((e: any) => ({
        id: e.id,
        eventType: e.eventType,
        classifier: e.classifier,
        occurredAt: e.occurredAt,
        receivedAt: e.receivedAt,
        sourceUpdatedAt: e.sourceUpdatedAt,
        locationName: e.locationName,
        unlocode: e.unlocode,
        timezone: e.timezone,
        provider: e.provider,
        sourceType: e.sourceType,
        confidence: e.confidence,
        isInferred: e.isInferred,
        isCorrection: e.isCorrection,
      })),
      eta: {
        current: latestEta?.eta ?? leg.estimatedArrival ?? leg.plannedArrival ?? null,
        deltaMinutes: latestEta?.deltaMinutes ?? null,
        provider: latestEta?.provider ?? null,
      },
      inference: {
        source: leg.source,
        confidence: leg.confidence,
        needsConfirmation: leg.source === "INFERRED" && leg.confirmedAt === null,
      },
    };
  });

  const pendingRun = (shipment.legInferenceRuns ?? [])[0];
  const inferenceProposal = pendingRun
    ? {
        inputsHash: pendingRun.inputsHash,
        confidence: pendingRun.overallConfidence,
        createdAtIso: new Date(pendingRun.createdAt).toISOString(),
        changes: Array.isArray((pendingRun.proposal as any)?.changes)
          ? (pendingRun.proposal as any).changes.map((c: any) => ({
              type: c.type,
              description: c.description,
              legSequence: c.legSequence,
            }))
          : [],
      }
    : null;

  return {
    shipmentId: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    journeyStatus: { overallStage, headline, percentComplete, blocked, blockingReasons },
    stops: orderedStops.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      role: s.role,
      name: s.name,
      unlocode: s.unlocode,
      firmsCode: s.firmsCode ?? null,
      timezone: s.timezone,
    })),
    legs: journeyLegs,
    customs: { status: customsStatus },
    inferenceProposal,
  };
}
