/**
 * scripts/seed-multileg-demo.ts
 *
 * Seeds a full multi-leg ocean import journey onto ONE existing shipment so
 * the multi-leg experience can be demoed against real rendered UI (the
 * "Journey and clearance" panel on the customs shipment detail page reads
 * TransportLeg / ShipmentStop / TrackingEvent / EtaObservation /
 * ShipmentTrackingIdentifier / ComplianceDeadline directly).
 *
 * Target: SHP-TGT-2026-001 on the "Target" account. multirole@qubere.ai
 * (Frank) has an OWNER membership there, so it shows for the demo login.
 *
 * The canonical ShipmentLeg / ShipmentLegDocument models proposed in
 * docs/plans/features/MULTI-LEG-SHIPMENTS.md do not exist yet; this seed
 * populates the interim models that today's UI already renders, plus
 * per-leg ShipmentDocument rows (fileName prefixed "MLG · ") whose docType
 * makes the leg grouping obvious.
 *
 * Idempotent: deletes its own prior rows for this shipment, then recreates.
 *
 * Run from repo root:
 *   npx tsx apps/custom/scripts/seed-multileg-demo.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import { db } from "@qubere/db";

const SHIPMENT_NUMBER = "SHP-TGT-2026-001";
const ACCOUNT_ID = "cmt4zah2s000hfx0odci3e658"; // "Target"
const DOC_PREFIX = "MLG · ";

function assertNotProduction() {
  const url = process.env.DATABASE_URL ?? "";
  if (/app\.qubere\.ai/i.test(url)) {
    throw new Error("SECURITY_VIOLATION: refusing to seed demo data against app.qubere.ai");
  }
}
assertNotProduction();

// Anchor everything to the shipment's ETA so the story stays coherent if the
// shipment is re-seeded later.
function at(base: Date, deltaHours: number): Date {
  return new Date(base.getTime() + deltaHours * 3_600_000);
}

async function main() {
  const shipment = await db.shipment.findFirst({
    where: { shipmentNumber: SHIPMENT_NUMBER, accountId: ACCOUNT_ID, deletedAt: null },
    select: { id: true, accountId: true, estimatedArrival: true, shipmentNumber: true },
  });
  if (!shipment) {
    throw new Error(`Shipment ${SHIPMENT_NUMBER} not found on account ${ACCOUNT_ID}`);
  }
  const { id: shipmentId, accountId } = shipment;
  const eta = shipment.estimatedArrival ?? new Date();
  console.log(`Seeding multi-leg journey onto ${shipment.shipmentNumber} (${shipmentId}), ETA ${eta.toISOString()}`);

  // ---------------------------------------------------------------------------
  // 0. Clean prior seeded rows for this shipment (idempotency)
  // ---------------------------------------------------------------------------
  await db.trackingEvent.deleteMany({ where: { shipmentId } });
  await db.etaObservation.deleteMany({ where: { shipmentId } });
  await db.shipmentStop.deleteMany({ where: { shipmentId } });
  await db.transportLeg.deleteMany({ where: { shipmentId } });
  await db.shipmentEquipment.deleteMany({ where: { shipmentId } });
  await db.trackingSubscription.deleteMany({ where: { shipmentId } });
  await db.shipmentTrackingIdentifier.deleteMany({ where: { shipmentId } });
  await db.complianceDeadline.deleteMany({ where: { shipmentId } });
  await db.shipmentDocument.deleteMany({
    where: { shipmentId, fileName: { startsWith: DOC_PREFIX } },
  });
  console.log("  cleared prior seeded rows");

  // ---------------------------------------------------------------------------
  // 1. Stops (shared between adjacent legs — that's what makes transship legible)
  // ---------------------------------------------------------------------------
  const stopsData = [
    {
      sequence: 1,
      type: "ORIGIN",
      name: "Shenzhen Factory — Longgang District",
      unlocode: "CNSZX",
      timezone: "Asia/Shanghai",
      actualDeparture: at(eta, -30 * 24),
    },
    {
      sequence: 2,
      type: "PORT_OF_LADING",
      name: "Yantian International Container Terminal",
      unlocode: "CNYTN",
      firmsCode: null,
      timezone: "Asia/Shanghai",
      actualArrival: at(eta, -29 * 24 - 6),
      actualDeparture: at(eta, -27 * 24),
    },
    {
      sequence: 3,
      type: "TRANSSHIPMENT",
      name: "Busan New Port (PNC) — Transshipment",
      unlocode: "KRPUS",
      timezone: "Asia/Seoul",
      actualArrival: at(eta, -20 * 24),
      actualDeparture: at(eta, -18 * 24),
    },
    {
      sequence: 4,
      type: "PORT_OF_DISCHARGE",
      name: "APM Terminals Pier 400 — Los Angeles / Long Beach",
      unlocode: "USLAX",
      firmsCode: "W185",
      timezone: "America/Los_Angeles",
      estimatedArrival: eta,
    },
    {
      sequence: 5,
      type: "DESTINATION",
      name: "Target Import Distribution Center — Rialto, CA",
      unlocode: "USRIA",
      timezone: "America/Los_Angeles",
      estimatedArrival: at(eta, 3 * 24),
    },
  ];

  const stops: Record<number, string> = {};
  for (const s of stopsData) {
    const row = await db.shipmentStop.create({
      data: {
        accountId,
        shipmentId,
        sequence: s.sequence,
        type: s.type,
        name: s.name,
        unlocode: s.unlocode,
        firmsCode: (s as any).firmsCode ?? null,
        timezone: s.timezone,
        actualArrival: (s as any).actualArrival ?? null,
        actualDeparture: (s as any).actualDeparture ?? null,
        estimatedArrival: (s as any).estimatedArrival ?? null,
      },
    });
    stops[s.sequence] = row.id;
  }
  console.log(`  created ${stopsData.length} stops`);

  // ---------------------------------------------------------------------------
  // 2. Legs
  // ---------------------------------------------------------------------------
  const legsData = [
    {
      sequence: 1,
      mode: "TRUCK" as const,
      carrierName: "Sinotrans Ltd (export drayage)",
      carrierCode: "SNTR",
      originName: stopsData[0].name,
      originUnlocode: "CNSZX",
      destinationName: stopsData[1].name,
      destinationUnlocode: "CNYTN",
      actualDeparture: at(eta, -30 * 24),
      actualArrival: at(eta, -29 * 24 - 6),
      status: "COMPLETED",
      arrivesAtStop: 2,
    },
    {
      sequence: 2,
      mode: "OCEAN" as const,
      carrierName: "COSCO Shipping Lines",
      carrierCode: "COSU",
      vesselName: "COSCO SHIPPING ARIES",
      imoNumber: "9795612",
      voyageNumber: "072E",
      originName: stopsData[1].name,
      originUnlocode: "CNYTN",
      destinationName: stopsData[2].name,
      destinationUnlocode: "KRPUS",
      actualDeparture: at(eta, -27 * 24),
      actualArrival: at(eta, -20 * 24),
      status: "COMPLETED",
      arrivesAtStop: 3,
    },
    {
      sequence: 3,
      mode: "OCEAN" as const,
      carrierName: "COSCO Shipping Lines",
      carrierCode: "COSU",
      vesselName: "COSCO SHIPPING LIBRA",
      imoNumber: "9757155",
      voyageNumber: "118E",
      originName: stopsData[2].name,
      originUnlocode: "KRPUS",
      destinationName: stopsData[3].name,
      destinationUnlocode: "USLAX",
      actualDeparture: at(eta, -18 * 24),
      estimatedArrival: eta,
      status: "IN_TRANSIT",
      arrivesAtStop: 4,
    },
    {
      sequence: 4,
      mode: "TRUCK" as const,
      carrierName: "Hub Group (import drayage)",
      carrierCode: "HUBG",
      originName: stopsData[3].name,
      originUnlocode: "USLAX",
      destinationName: stopsData[4].name,
      destinationUnlocode: "USRIA",
      plannedDeparture: at(eta, 2 * 24),
      plannedArrival: at(eta, 3 * 24),
      estimatedArrival: at(eta, 3 * 24),
      status: "NOT_STARTED",
      arrivesAtStop: 5,
    },
  ];

  const legs: Record<number, string> = {};
  for (const l of legsData) {
    const row = await db.transportLeg.create({
      data: {
        accountId,
        shipmentId,
        sequence: l.sequence,
        mode: l.mode,
        carrierCode: l.carrierCode,
        carrierName: l.carrierName,
        vesselName: (l as any).vesselName ?? null,
        imoNumber: (l as any).imoNumber ?? null,
        voyageNumber: (l as any).voyageNumber ?? null,
        originName: l.originName,
        originUnlocode: l.originUnlocode,
        destinationName: l.destinationName,
        destinationUnlocode: l.destinationUnlocode,
        plannedDeparture: (l as any).plannedDeparture ?? null,
        actualDeparture: (l as any).actualDeparture ?? null,
        plannedArrival: (l as any).plannedArrival ?? null,
        estimatedArrival: (l as any).estimatedArrival ?? null,
        actualArrival: (l as any).actualArrival ?? null,
        status: l.status,
      },
    });
    legs[l.sequence] = row.id;
    // Link the stop this leg arrives at back to the leg (interim model has a
    // single-parent FK; the canonical model shares stops between legs).
    await db.shipmentStop.update({
      where: { id: stops[l.arrivesAtStop] },
      data: { transportLegId: row.id },
    });
  }
  console.log(`  created ${legsData.length} legs`);

  // ---------------------------------------------------------------------------
  // 3. Equipment (2 x 40HC containers, follow the whole route)
  // ---------------------------------------------------------------------------
  for (const containerNumber of ["CBHU8842190", "TCLU7761334"]) {
    await db.shipmentEquipment.create({
      data: {
        accountId,
        shipmentId,
        type: "CONTAINER",
        containerNumber,
        isoEquipmentCode: "45G1",
        sealNumbers: [`SEAL${containerNumber.slice(-5)}`],
        status: "IN_TRANSIT",
        currentLocationName: "Pacific Ocean — en route USLAX",
        lastEventAt: at(eta, -18 * 24),
      },
    });
  }
  console.log("  created 2 containers");

  // ---------------------------------------------------------------------------
  // 4. Tracking identifiers
  // ---------------------------------------------------------------------------
  const identifiers = [
    { type: "BOOKING", value: "COSU6620149", issuer: "COSCO", isPrimary: true },
    { type: "MBL", value: "COSU7223841650", issuer: "COSCO", isPrimary: false },
    { type: "HBL", value: "SNKO2208841", issuer: "Seanko Logistics", isPrimary: false },
    { type: "CONTAINER", value: "CBHU8842190", issuer: "COSCO", isPrimary: false },
    { type: "CONTAINER", value: "TCLU7761334", issuer: "COSCO", isPrimary: false },
  ];
  for (const i of identifiers) {
    await db.shipmentTrackingIdentifier.create({
      data: { accountId, shipmentId, type: i.type as any, value: i.value, issuer: i.issuer, isPrimary: i.isPrimary },
    });
  }
  console.log(`  created ${identifiers.length} tracking identifiers`);

  // ---------------------------------------------------------------------------
  // 5. Tracking events (planned / estimated / actual kept distinct)
  // ---------------------------------------------------------------------------
  const events: Array<{
    n: number;
    legSeq: number;
    stopSeq?: number;
    eventType: string;
    classifier: "PLANNED" | "ESTIMATED" | "ACTUAL";
    sourceType: "CARRIER" | "TERMINAL" | "PORT" | "PROVIDER" | "SYSTEM";
    provider: string;
    hours: number;
    locationName: string;
    unlocode: string;
    timezone: string;
  }> = [
    { n: 1, legSeq: 1, stopSeq: 1, eventType: "BOOKING_CONFIRMED", classifier: "ACTUAL", sourceType: "CARRIER", provider: "COSCO eCommerce", hours: -30 * 24 - 12, locationName: "Shenzhen", unlocode: "CNSZX", timezone: "Asia/Shanghai" },
    { n: 2, legSeq: 1, stopSeq: 2, eventType: "GATE_IN", classifier: "ACTUAL", sourceType: "TERMINAL", provider: "Yantian ICT", hours: -29 * 24 - 6, locationName: "Yantian", unlocode: "CNYTN", timezone: "Asia/Shanghai" },
    { n: 3, legSeq: 2, stopSeq: 2, eventType: "LOADED_ON_VESSEL", classifier: "ACTUAL", sourceType: "TERMINAL", provider: "Yantian ICT", hours: -27 * 24 - 4, locationName: "Yantian", unlocode: "CNYTN", timezone: "Asia/Shanghai" },
    { n: 4, legSeq: 2, stopSeq: 2, eventType: "VESSEL_DEPARTURE", classifier: "ACTUAL", sourceType: "CARRIER", provider: "COSCO AIS", hours: -27 * 24, locationName: "Yantian", unlocode: "CNYTN", timezone: "Asia/Shanghai" },
    { n: 5, legSeq: 2, stopSeq: 3, eventType: "VESSEL_ARRIVAL", classifier: "ACTUAL", sourceType: "CARRIER", provider: "COSCO AIS", hours: -20 * 24, locationName: "Busan", unlocode: "KRPUS", timezone: "Asia/Seoul" },
    { n: 6, legSeq: 2, stopSeq: 3, eventType: "DISCHARGED", classifier: "ACTUAL", sourceType: "TERMINAL", provider: "Busan PNC", hours: -19 * 24 - 12, locationName: "Busan", unlocode: "KRPUS", timezone: "Asia/Seoul" },
    { n: 7, legSeq: 3, stopSeq: 3, eventType: "LOADED_ON_VESSEL", classifier: "ACTUAL", sourceType: "TERMINAL", provider: "Busan PNC", hours: -18 * 24 - 6, locationName: "Busan", unlocode: "KRPUS", timezone: "Asia/Seoul" },
    { n: 8, legSeq: 3, stopSeq: 3, eventType: "VESSEL_DEPARTURE", classifier: "ACTUAL", sourceType: "CARRIER", provider: "COSCO AIS", hours: -18 * 24, locationName: "Busan", unlocode: "KRPUS", timezone: "Asia/Seoul" },
    { n: 9, legSeq: 3, stopSeq: 4, eventType: "VESSEL_ARRIVAL", classifier: "ESTIMATED", sourceType: "PROVIDER", provider: "Qubere ETA model", hours: 0, locationName: "Los Angeles / Long Beach", unlocode: "USLAX", timezone: "America/Los_Angeles" },
    { n: 10, legSeq: 4, stopSeq: 4, eventType: "DISCHARGE", classifier: "PLANNED", sourceType: "SYSTEM", provider: "Qubere plan", hours: 1 * 24, locationName: "APM Pier 400", unlocode: "USLAX", timezone: "America/Los_Angeles" },
    { n: 11, legSeq: 4, stopSeq: 4, eventType: "GATE_OUT", classifier: "PLANNED", sourceType: "SYSTEM", provider: "Qubere plan", hours: 2 * 24, locationName: "APM Pier 400", unlocode: "USLAX", timezone: "America/Los_Angeles" },
    { n: 12, legSeq: 4, stopSeq: 5, eventType: "DELIVERED", classifier: "PLANNED", sourceType: "SYSTEM", provider: "Qubere plan", hours: 3 * 24, locationName: "Target DC Rialto", unlocode: "USRIA", timezone: "America/Los_Angeles" },
  ];
  for (const e of events) {
    const occurredAt = at(eta, e.hours);
    await db.trackingEvent.create({
      data: {
        accountId,
        shipmentId,
        transportLegId: legs[e.legSeq],
        shipmentStopId: e.stopSeq ? stops[e.stopSeq] : null,
        eventType: e.eventType,
        classifier: e.classifier as any,
        occurredAt,
        receivedAt: e.classifier === "ACTUAL" ? at(occurredAt, 1) : new Date(),
        locationName: e.locationName,
        unlocode: e.unlocode,
        timezone: e.timezone,
        provider: e.provider,
        providerEventId: `mlg-${e.n}`,
        sourceType: e.sourceType as any,
        confidence: e.classifier === "ACTUAL" ? 1 : 0.7,
        isInferred: e.classifier !== "ACTUAL",
        idempotencyKey: `mlg-${shipmentId}-${e.n}`,
      },
    });
  }
  console.log(`  created ${events.length} tracking events`);

  // ---------------------------------------------------------------------------
  // 6. ETA observations (show a +14h drift into Long Beach)
  // ---------------------------------------------------------------------------
  await db.etaObservation.create({
    data: {
      accountId, shipmentId, transportLegId: legs[3], shipmentStopId: stops[4],
      estimatedAt: at(eta, -18 * 24), eta: at(eta, -14), previousEta: null,
      deltaMinutes: null, provider: "COSCO schedule", confidence: 0.6, reasonCode: "INITIAL_SCHEDULE",
    },
  });
  await db.etaObservation.create({
    data: {
      accountId, shipmentId, transportLegId: legs[3], shipmentStopId: stops[4],
      estimatedAt: at(eta, -3 * 24), eta, previousEta: at(eta, -14),
      deltaMinutes: 14 * 60, provider: "Qubere ETA model", confidence: 0.82, reasonCode: "PORT_CONGESTION",
    },
  });
  console.log("  created 2 ETA observations");

  // ---------------------------------------------------------------------------
  // 7. Tracking subscription (so control-tower health shows "configured")
  // ---------------------------------------------------------------------------
  await db.trackingSubscription.create({
    data: {
      accountId, shipmentId, provider: "COSCO AIS", providerTrackingId: "COSU7223841650",
      status: "ACTIVE" as any, startedAt: at(eta, -31 * 24),
      lastEventAt: at(eta, -18 * 24), lastSyncAt: at(new Date(), -2),
    },
  });
  console.log("  created tracking subscription");

  // ---------------------------------------------------------------------------
  // 8. Compliance deadlines
  // ---------------------------------------------------------------------------
  await db.complianceDeadline.create({
    data: {
      accountId, shipmentId, type: "ISF_10_2" as any, deadlineClass: "REGULATORY" as any,
      status: "SATISFIED" as any, anchorEvent: "LADING" as any, anchorAt: at(eta, -27 * 24 - 24),
      estimated: false, dueAt: at(eta, -27 * 24 - 24), ruleId: "ISF_10_2", ruleCitation: "19 CFR 149.2(b)",
      satisfiedAt: at(eta, -28 * 24), satisfiedBy: "SYSTEM",
    },
  });
  await db.complianceDeadline.create({
    data: {
      accountId, shipmentId, type: "ENTRY_FILING" as any, deadlineClass: "REGULATORY" as any,
      status: "OPEN" as any, anchorEvent: "ARRIVAL" as any, anchorAt: eta, estimated: true,
      dueAt: at(eta, 15 * 24), ruleId: "ENTRY_FILING", ruleCitation: "19 CFR 142.3",
      penaltyBasis: "up to $5,000 per violation",
    },
  });
  await db.complianceDeadline.create({
    data: {
      accountId, shipmentId, type: "LAST_FREE_DAY" as any, deadlineClass: "COMMERCIAL" as any,
      status: "OPEN" as any, anchorEvent: "ARRIVAL" as any, anchorAt: eta, estimated: true,
      dueAt: at(eta, 3 * 24), ruleId: "LAST_FREE_DAY", ruleCitation: "Carrier free-time tariff",
      penaltyBasis: "demurrage ~$285/container/day after LFD",
    },
  });
  console.log("  created 3 compliance deadlines");

  // ---------------------------------------------------------------------------
  // 9. Per-leg documents (fileName prefix "MLG · ", docType signals the leg)
  // ---------------------------------------------------------------------------
  const docs = [
    // Leg 1 — export haulage
    { leg: 1, docType: "Booking Confirmation", documentType: "OTHER", fileName: "Leg1 Export Haulage — Booking Confirmation COSU6620149.pdf", status: "Processed", required: true },
    { leg: 1, docType: "Shipping Instructions", documentType: "OTHER", fileName: "Leg1 Export Haulage — Shipping Instructions.pdf", status: "Processed", required: true },
    { leg: 1, docType: "Packing List", documentType: "PACKING_LIST", fileName: "Leg1 Export Haulage — Packing List.pdf", status: "Processed", required: true },
    // Leg 2 — main carriage A
    { leg: 2, docType: "Bill of Lading", documentType: "BILL_OF_LADING", fileName: "Leg2 Ocean — Master Bill of Lading COSU7223841650.pdf", status: "Processed", required: true },
    { leg: 2, docType: "ISF Filing", documentType: "ISF", fileName: "Leg2 Ocean — ISF 10+2 Filing.pdf", status: "Received", required: true },
    // Leg 3 — main carriage B
    { leg: 3, docType: "Certificate of Origin", documentType: "CERTIFICATE_OF_ORIGIN", fileName: "Leg3 Ocean — Certificate of Origin (CN).pdf", status: "Processed", required: true },
    { leg: 3, docType: "Arrival Notice", documentType: "OTHER", fileName: "Leg3 Ocean — Arrival Notice.pdf", status: "Missing", required: true },
    // Leg 4 — import haulage
    { leg: 4, docType: "Delivery Order", documentType: "OTHER", fileName: "Leg4 Import Haulage — Delivery Order.pdf", status: "Missing", required: true },
    { leg: 4, docType: "CBP Release", documentType: "ENTRY_SUMMARY", fileName: "Leg4 Import Haulage — CBP 7501 Entry Summary.pdf", status: "Received", required: true },
    { leg: 4, docType: "Proof of Delivery", documentType: "PROOF_OF_DELIVERY", fileName: "Leg4 Import Haulage — Proof of Delivery.pdf", status: "Missing", required: false },
  ];
  for (const [i, d] of docs.entries()) {
    await db.shipmentDocument.create({
      data: {
        accountId,
        shipmentId,
        docType: d.docType,
        documentType: d.documentType as any,
        fileName: `${DOC_PREFIX}${d.fileName}`,
        status: d.status,
        required: d.required,
        portalVisibility: "INTERNAL",
        source: "UPLOAD",
        displayOrder: 100 + i,
        confidence: d.status === "Missing" ? null : 90,
      },
    });
  }
  console.log(`  created ${docs.length} per-leg documents`);

  console.log("\nDone. Open the shipment's Tracking tab to see the 4-leg journey.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
