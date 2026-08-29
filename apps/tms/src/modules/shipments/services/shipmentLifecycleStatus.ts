export type LifecycleStageState = "COMPLETE" | "ACTIVE" | "UPCOMING" | "BLOCKED";

export type MovementDetail = {
  movementId: string;
  mode: string;
  status: string;
};

export type LifecycleStage = {
  index: number;
  label: string;
  state: LifecycleStageState;
  detail: string | null;
  movements?: MovementDetail[];
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  actorName?: string | null;
  actorRole?: string | null;
  referenceNumber?: string | null;
  durationText?: string | null;
};

export type ShipmentLifecycleStatus = {
  currentStageIndex: number; // 0-8
  stages: LifecycleStage[];
};

function calcDurationText(start?: string | Date | null, end?: string | Date | null): string | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
  const diffMs = e - s;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "< 1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export function computeShipmentLifecycleStatus(shipment: any): ShipmentLifecycleStatus {
  const dbLegs = shipment.legs ?? [];
  const shipmentMovements = shipment.shipmentMovements ?? [];

  // Map the canonical ShipmentLeg model onto the movement shape this function
  // (and the ribbon) consumes. LegStatus -> Movement.status vocabulary:
  //   PLANNED/BOOKED/READY_FOR_PICKUP -> PLANNED|BOOKED
  //   IN_TRANSIT -> IN_TRANSIT, ARRIVED -> ARRIVED
  //   COMPLETED -> DELIVERED (leg handed off), EXCEPTION -> DELAYED
  const legStatusToMovement = (s: string): string => {
    switch (s) {
      case "BOOKED":
      case "READY_FOR_PICKUP":
        return "BOOKED";
      case "IN_TRANSIT":
        return "IN_TRANSIT";
      case "ARRIVED":
        return "ARRIVED";
      case "COMPLETED":
        return "DELIVERED";
      case "EXCEPTION":
        return "DELAYED";
      case "CANCELLED":
        return "CANCELLED";
      default:
        return "PLANNED";
    }
  };

  const movements = dbLegs.length > 0
    ? dbLegs.map((leg: any) => ({
        id: leg.id,
        mode: leg.mode,
        status: legStatusToMovement(leg.status),
        actualStart: leg.actualDeparture,
        actualEnd: leg.actualArrival,
        createdAt: leg.createdAt,
        carrierName: leg.carrierName,
        vesselName: leg.vesselName,
        voyageNumber: leg.voyageNumber,
        bookingNumber: leg.bookingNumber,
        containerNumber: null,
        terminalName: leg.destinationStop?.name ?? null,
      }))
    : shipmentMovements.map((sm: any) => sm.movement).filter(Boolean);

  const hasMultiLeg = movements.length > 1;
  const movementsSummary: MovementDetail[] | undefined = hasMultiLeg
    ? movements.map((m: any) => ({
        movementId: m.id,
        mode: m.mode || "TRUCK",
        status: m.status || "PLANNED",
      }))
    : undefined;

  const tenders = shipment.tenders ?? [];
  const latestTender = tenders[0];
  const acceptedTender = tenders.find((t: any) => t.status === "ACCEPTED");

  const customsFilings = shipment.customsFilings ?? [];
  const latestFiling = customsFilings[0];
  const isCustomsReleased = customsFilings.some((f: any) =>
    ["Released", "RELEASED", "ACCEPTED", "BrokerApproved"].includes(f.filingStatus)
  );
  const isCustomsBlocked =
    latestFiling &&
    ["Rejected", "REJECTED", "CustomsHold", "HOLD", "ValidationFailed"].includes(latestFiling.filingStatus);

  const proofsOfDelivery = shipment.proofOfDeliveries ?? shipment.proofsOfDelivery ?? [];
  const carrierInvoices = shipment.carrierInvoices ?? [];
  const latestInvoice = carrierInvoices[0];

  const anyInTransit = movements.some((m: any) => m.status === "IN_TRANSIT");
  const anyArrived = movements.some((m: any) => m.status === "ARRIVED");
  const anyDelivered = movements.some((m: any) =>
    ["DELIVERED", "COMPLETED"].includes(m.status)
  );
  const anyDispatched = movements.some(
    (m: any) => m.actualStart && m.status === "BOOKED"
  );
  const allMovementsCancelled =
    movements.length > 0 && movements.every((m: any) => m.status === "CANCELLED");

  const isDeliveredOrPod =
    proofsOfDelivery.length > 0 ||
    anyDelivered ||
    shipment.status === "DELIVERED" ||
    shipment.status === "Completed";

  const isAuditedAndSettled = carrierInvoices.some(
    (inv: any) => inv.matchStatus === "MATCHED" && inv.settlementStatus === "PAID"
  );
  const isMatchedPendingPaid = carrierInvoices.some(
    (inv: any) => inv.matchStatus === "MATCHED" && inv.settlementStatus !== "PAID"
  );
  const isInvoiceDisputed = carrierInvoices.some((inv: any) =>
    ["DISPUTED", "EXCEPTION"].includes(inv.matchStatus)
  );

  // ---------------------------------------------------------------------------
  // Evaluate 9 stages sequentially
  // ---------------------------------------------------------------------------

  // Stage 0: Draft / Order Created
  const stage0Complete =
    shipment.status !== "Draft" ||
    !!acceptedTender ||
    movements.length > 0 ||
    isCustomsReleased ||
    isDeliveredOrPod;
  const stage0State: LifecycleStageState = stage0Complete ? "COMPLETE" : "ACTIVE";
  const stage0Detail = stage0Complete
    ? shipment.createdAt
      ? `Order created on ${new Date(shipment.createdAt).toLocaleDateString()}`
      : "Order created."
    : "Draft order created. Pending tender issuance or carrier booking.";

  // Stage 1: Sourcing / Tendering
  let stage1State: LifecycleStageState = "UPCOMING";
  let stage1Detail: string | null = "No tender issued yet.";
  if (acceptedTender || anyInTransit || anyArrived || anyDelivered || isDeliveredOrPod) {
    stage1State = "COMPLETE";
    stage1Detail = acceptedTender
      ? `Tender accepted by carrier.`
      : "Carrier tendering complete.";
  } else if (latestTender && ["DRAFT", "SENT"].includes(latestTender.status)) {
    stage1State = "ACTIVE";
    stage1Detail =
      latestTender.status === "SENT"
        ? "Tender issued; awaiting carrier response."
        : "Tender draft created.";
  } else if (
    latestTender &&
    ["REJECTED", "EXPIRED", "CANCELLED"].includes(latestTender.status)
  ) {
    stage1State = "BLOCKED";
    stage1Detail = `Tender ${latestTender.status.toLowerCase()} by carrier. Resourcing required.`;
  } else if (stage0State === "COMPLETE") {
    stage1State = "ACTIVE";
    stage1Detail = "Ready for carrier tendering.";
  }

  // Stage 2: Booked / Scheduled
  let stage2State: LifecycleStageState = "UPCOMING";
  let stage2Detail: string | null = "Awaiting booking confirmation.";
  if (allMovementsCancelled) {
    stage2State = "BLOCKED";
    stage2Detail = "All transport movements for this shipment are cancelled.";
  } else if (
    anyDispatched ||
    anyInTransit ||
    anyArrived ||
    anyDelivered ||
    isDeliveredOrPod
  ) {
    stage2State = "COMPLETE";
    stage2Detail =
      movements.length > 1
        ? `${movements.length} legs scheduled and booked.`
        : "Movement booked with carrier.";
  } else if (
    acceptedTender ||
    movements.some((m: any) => ["BOOKED", "PLANNED"].includes(m.status))
  ) {
    stage2State = "ACTIVE";
    stage2Detail = "Booking confirmed; scheduled for pickup.";
  } else if (stage1State === "COMPLETE") {
    stage2State = "ACTIVE";
    stage2Detail = "Tender accepted; finalizing movement booking.";
  }

  // Stage 3: Customs Cleared
  let stage3State: LifecycleStageState = "UPCOMING";
  let stage3Detail: string | null = "Customs filing pending.";
  if (isCustomsReleased) {
    stage3State = "COMPLETE";
    stage3Detail = latestFiling?.releasedAt
      ? `Customs entry cleared on ${new Date(latestFiling.releasedAt).toLocaleDateString()}`
      : "Customs entry released.";
  } else if (isCustomsBlocked) {
    stage3State = "BLOCKED";
    stage3Detail =
      latestFiling.filingStatus === "CustomsHold"
        ? "Customs hold placed on shipment."
        : `Customs entry filing ${latestFiling.filingStatus.toLowerCase()}.`;
  } else if (latestFiling) {
    stage3State = "ACTIVE";
    stage3Detail = `Customs filing in progress (${latestFiling.filingStatus}).`;
  } else if (stage2State === "COMPLETE" || anyInTransit || isDeliveredOrPod) {
    stage3State = "COMPLETE";
    stage3Detail = "No customs clearance required or filing cleared.";
  } else if (stage2State === "ACTIVE") {
    stage3State = "UPCOMING";
    stage3Detail = "Awaiting customs documentation.";
  }

  const allArrivedOrDelivered =
    movements.length > 0 &&
    movements.every((m: any) => ["ARRIVED", "DELIVERED", "COMPLETED"].includes(m.status));
  const allDelivered =
    movements.length > 0 &&
    movements.every((m: any) => ["DELIVERED", "COMPLETED"].includes(m.status));

  // Stage 4: Dispatched / At Pickup
  let stage4State: LifecycleStageState = "UPCOMING";
  let stage4Detail: string | null = "Awaiting dispatch to pickup.";
  if (anyInTransit || anyArrived || anyDelivered || isDeliveredOrPod) {
    stage4State = "COMPLETE";
    stage4Detail = "Driver dispatched and pickup completed.";
  } else if (anyDispatched) {
    stage4State = "ACTIVE";
    stage4Detail = "Driver dispatched to pickup location; arrival imminent.";
  } else if (stage2State === "COMPLETE" || stage3State === "COMPLETE") {
    stage4State = "ACTIVE";
    stage4Detail = "Ready for driver dispatch to origin.";
  }

  // Stage 5: In Transit
  let stage5State: LifecycleStageState = "UPCOMING";
  let stage5Detail: string | null = "Awaiting transit start.";
  if (allArrivedOrDelivered || anyDelivered || isDeliveredOrPod) {
    stage5State = "COMPLETE";
    stage5Detail = "Linehaul transit completed.";
  } else if (anyInTransit) {
    stage5State = "ACTIVE";
    stage5Detail = hasMultiLeg
      ? "Shipment in transit across active legs."
      : "Shipment en route to destination facility.";
  } else if (movements.some((m: any) => m.status === "DELAYED")) {
    stage5State = "BLOCKED";
    stage5Detail = "Transit delayed due to exception.";
  } else if (stage4State === "COMPLETE") {
    stage5State = "ACTIVE";
    stage5Detail = "Dispatched; transit starting.";
  }

  // Stage 6: Arrived
  let stage6State: LifecycleStageState = "UPCOMING";
  let stage6Detail: string | null = "Awaiting arrival at destination.";
  if (allDelivered || isDeliveredOrPod) {
    stage6State = "COMPLETE";
    stage6Detail = "Arrived at destination facility.";
  } else if (anyArrived) {
    stage6State = "ACTIVE";
    stage6Detail = "Arrived at destination facility; preparing for final delivery.";
  } else if (stage5State === "COMPLETE") {
    stage6State = "ACTIVE";
    stage6Detail = "Transit complete; arrival check-in in progress.";
  }

  // Stage 7: Delivered / POD Uploaded
  let stage7State: LifecycleStageState = "UPCOMING";
  let stage7Detail: string | null = "Pending delivery and POD.";
  if (isDeliveredOrPod) {
    stage7State = "COMPLETE";
    stage7Detail = proofsOfDelivery.length > 0
      ? `Proof of delivery uploaded (${proofsOfDelivery.length} document).`
      : "Shipment delivered to consignee.";
  } else if (stage6State === "COMPLETE" || anyArrived) {
    stage7State = "ACTIVE";
    stage7Detail = "Arrived at destination; awaiting POD upload.";
  }

  // Stage 8: Audited & Settled
  let stage8State: LifecycleStageState = "UPCOMING";
  let stage8Detail: string | null = "Awaiting carrier invoice and audit settlement.";
  if (isAuditedAndSettled) {
    stage8State = "COMPLETE";
    stage8Detail = latestInvoice?.settledAt
      ? `Carrier invoice matched and settled on ${new Date(latestInvoice.settledAt).toLocaleDateString()}.`
      : "Carrier invoice 3-way matched and settled.";
  } else if (isInvoiceDisputed) {
    stage8State = "BLOCKED";
    stage8Detail = `Carrier invoice audit ${latestInvoice?.matchStatus?.toLowerCase() ?? "disputed"}; exception resolution required.`;
  } else if (isMatchedPendingPaid || carrierInvoices.length > 0) {
    stage8State = "ACTIVE";
    stage8Detail = isMatchedPendingPaid
      ? "Carrier invoice 3-way matched; pending final settlement payment."
      : "Carrier invoice ingested; automated audit matching in progress.";
  } else if (stage7State === "COMPLETE") {
    stage8State = "ACTIVE";
    stage8Detail = "Delivered; awaiting carrier invoice submission.";
  }

  const rawStages: Array<{
    label: string;
    state: LifecycleStageState;
    detail: string | null;
    startedAt?: string | Date | null;
    completedAt?: string | Date | null;
    actorName?: string | null;
    actorRole?: string | null;
    referenceNumber?: string | null;
  }> = [
    {
      label: "Draft / Order Created",
      state: stage0State,
      detail: stage0Detail,
      startedAt: shipment.createdAt,
      completedAt: stage0Complete ? (acceptedTender?.createdAt ?? shipment.createdAt) : null,
      actorName: shipment.createdByUser
        ? [shipment.createdByUser.firstName, shipment.createdByUser.lastName].filter(Boolean).join(" ")
        : (shipment.importerName ?? shipment.client?.name ?? "Operations Lead"),
      actorRole: "Order Owner",
      referenceNumber: shipment.shipmentNumber,
    },
    {
      label: "Sourcing / Tendering",
      state: stage1State,
      detail: stage1Detail,
      startedAt: latestTender?.createdAt ?? (stage0Complete ? shipment.createdAt : null),
      completedAt: acceptedTender ? (acceptedTender.acceptedAt ?? acceptedTender.updatedAt) : null,
      actorName: acceptedTender?.carrierName ?? shipment.carrierName ?? (latestTender ? "Autonomous Tender Engine" : null),
      actorRole: acceptedTender ? "Awarded Carrier" : "Freight Sourcing",
      referenceNumber: acceptedTender
        ? `Tender #${acceptedTender.tenderNumber || acceptedTender.id?.slice(-6)}`
        : (latestTender ? `Tender #${latestTender.id?.slice(-6)}` : null),
    },
    {
      label: "Booked / Scheduled",
      state: stage2State,
      detail: stage2Detail,
      startedAt: movements[0]?.createdAt ?? acceptedTender?.updatedAt,
      completedAt: stage2State === "COMPLETE" ? (movements[0]?.actualStart ?? movements[0]?.bookedAt ?? shipment.updatedAt) : null,
      actorName: shipment.carrierName ?? movements[0]?.carrierParty?.names?.[0]?.rawName ?? "Carrier Dispatch",
      actorRole: "Booking Carrier",
      referenceNumber: movements[0]?.bookingNumber ?? (shipment.trackingIdentifiers?.[0] ? `${shipment.trackingIdentifiers[0].type}: ${shipment.trackingIdentifiers[0].value}` : null),
    },
    {
      label: "Customs Cleared",
      state: stage3State,
      detail: stage3Detail,
      startedAt: latestFiling?.createdAt ?? shipment.createdAt,
      completedAt: isCustomsReleased ? (latestFiling?.releasedAt ?? latestFiling?.updatedAt) : null,
      actorName: latestFiling?.filingParty ?? shipment.customsBroker ?? "Customs Broker / CBP",
      actorRole: "Broker Filer",
      referenceNumber: latestFiling?.entryNumber
        ? `Entry #${latestFiling.entryNumber}`
        : (latestFiling?.id ? `Filing #${latestFiling.id.slice(-6)}` : null),
    },
    {
      label: "Dispatched / At Pickup",
      state: stage4State,
      detail: stage4Detail,
      startedAt: movements[0]?.dispatchedAt ?? movements[0]?.actualStart ?? shipment.createdAt,
      completedAt: stage4State === "COMPLETE" ? (movements[0]?.pickupCompletedAt ?? movements[0]?.actualStart) : null,
      actorName: movements[0]?.driverName ?? shipment.carrierName ?? "Fleet Dispatch",
      actorRole: "Dispatch / Driver",
      referenceNumber: movements[0]?.pickupApptNumber ? `Appt #${movements[0].pickupApptNumber}` : null,
    },
    {
      label: "In Transit",
      state: stage5State,
      detail: stage5Detail,
      startedAt: movements[0]?.actualStart ?? shipment.estimatedDeparture,
      completedAt: stage5State === "COMPLETE" ? (movements[movements.length - 1]?.actualEnd ?? shipment.estimatedArrival) : null,
      actorName: movements[0]?.carrierName ?? shipment.carrierName ?? "Linehaul Transport",
      actorRole: "Carrier Operator",
      referenceNumber: movements[0]?.vesselName
        ? `${movements[0].vesselName} (${movements[0].voyageNumber || 'Vessel'})`
        : (movements[0]?.containerNumber ?? null),
    },
    {
      label: "Arrived",
      state: stage6State,
      detail: stage6Detail,
      startedAt: movements[movements.length - 1]?.arrivedAt ?? shipment.estimatedArrival,
      completedAt: stage6State === "COMPLETE" ? (movements[movements.length - 1]?.actualEnd ?? shipment.estimatedArrival) : null,
      actorName: movements[movements.length - 1]?.terminalName ?? shipment.portOfEntry ?? "Destination Hub",
      actorRole: "Port / Terminal Operator",
      referenceNumber: shipment.portOfEntry ? `Port: ${shipment.portOfEntry}` : null,
    },
    {
      label: "Delivered / POD Uploaded",
      state: stage7State,
      detail: stage7Detail,
      startedAt: proofsOfDelivery[0]?.uploadedAt ?? shipment.deliveredAt,
      completedAt: isDeliveredOrPod ? (proofsOfDelivery[0]?.uploadedAt ?? shipment.deliveredAt) : null,
      actorName: proofsOfDelivery[0]?.uploadedBy?.name ?? shipment.consigneeName ?? "Consignee Receiver",
      actorRole: "Consignee / Driver",
      referenceNumber: proofsOfDelivery[0]?.documentNumber
        ? `POD #${proofsOfDelivery[0].documentNumber}`
        : (proofsOfDelivery[0]?.id ? `Doc #${proofsOfDelivery[0].id.slice(-6)}` : null),
    },
    {
      label: "Audited & Settled",
      state: stage8State,
      detail: stage8Detail,
      startedAt: latestInvoice?.createdAt,
      completedAt: isAuditedAndSettled ? (latestInvoice?.settledAt ?? latestInvoice?.updatedAt) : null,
      actorName: latestInvoice?.approvedBy ?? "Qubere Freight Audit Engine",
      actorRole: "Auditor / Payables",
      referenceNumber: latestInvoice?.invoiceNumber
        ? `Invoice #${latestInvoice.invoiceNumber}`
        : (latestInvoice?.id ? `Inv #${latestInvoice.id.slice(-6)}` : null),
    },
  ];

  const stages: LifecycleStage[] = rawStages.map((s, idx) => ({
    index: idx,
    label: s.label,
    state: s.state,
    detail: s.detail,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    actorName: s.actorName,
    actorRole: s.actorRole,
    referenceNumber: s.referenceNumber,
    durationText: calcDurationText(s.startedAt, s.completedAt),
    ...(movementsSummary ? { movements: movementsSummary } : {}),
  }));

  // Determine current active or blocked stage index
  let currentStageIndex = stages.findIndex((s) => s.state === "ACTIVE");
  if (currentStageIndex === -1) {
    currentStageIndex = stages.findIndex((s) => s.state === "BLOCKED");
  }
  if (currentStageIndex === -1) {
    // If all complete, return last stage (8), otherwise find last COMPLETE stage
    const lastCompleteIdx = stages.map((s) => s.state).lastIndexOf("COMPLETE");
    currentStageIndex = lastCompleteIdx !== -1 ? lastCompleteIdx : 0;
  }

  return {
    currentStageIndex,
    stages,
  };
}
