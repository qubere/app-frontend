/**
 * scripts/seed-multileg-demo.ts
 *
 * Seeds a full 4-leg ocean import journey onto the EXISTING demo shipment
 * SHP-TGT-2026-001 (Target account) so the multi-leg experience can be demoed
 * against real rendered UI (the Journey Ribbon on the customs shipment detail
 * page). multirole@qubere.ai has an OWNER membership on the Target account.
 *
 * NON-DESTRUCTIVE: the shipment, its line items, its commercial-invoice
 * documents and its client link are all left intact. Only the leg-related
 * artifacts this script owns are cleared and rebuilt (legs, stops, the
 * "MLG · " documents, tracking events/ETA/identifiers/deadlines).
 *
 * Idempotent — safe to re-run.
 *
 * Run from repo root:
 *   npx tsx apps/custom/scripts/seed-multileg-demo.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import { db, withDataModeContext } from "@qubere/db";
import { LegMode, LegStatus, LegType, DocumentType, LegDocumentRequirement } from "@prisma/client";
import { inferLegDocuments } from "@qubere/shipment-legs";

const SHIPMENT_NUMBER = "SHP-TGT-2026-001";
const DOC_PREFIX = "MLG · ";

function assertNotProduction() {
  if (/app\.qubere\.ai/i.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("SECURITY_VIOLATION: refusing to seed demo data against app.qubere.ai");
  }
}

async function seed() {
  assertNotProduction();

  const shipment = await db.shipment.findFirst({
    where: {
      shipmentNumber: SHIPMENT_NUMBER,
      deletedAt: null,
      account: { OR: [{ slug: "target" }, { name: { contains: "Target" } }] },
    },
    select: { id: true, accountId: true, estimatedArrival: true, shipmentNumber: true, account: { select: { name: true } } },
  });

  if (!shipment) {
    throw new Error(
      `Shipment ${SHIPMENT_NUMBER} not found on a Target account. Run the base demo seed first, or adjust SHIPMENT_NUMBER.`
    );
  }

  const { id: shipmentId, accountId } = shipment;
  const eta = shipment.estimatedArrival ?? new Date("2026-08-31T06:00:00Z");
  const at = (hours: number) => new Date(eta.getTime() + hours * 3_600_000);
  console.log(`Seeding 4-leg journey onto ${shipment.shipmentNumber} (${shipmentId}) — account ${shipment.account.name}`);

  // --- clear this script's own artifacts -----------------------------------
  await db.trackingEvent.deleteMany({ where: { shipmentId } });
  await db.etaObservation.deleteMany({ where: { shipmentId } });
  await db.shipmentLeg.deleteMany({ where: { shipmentId } }); // cascades ShipmentLegDocument
  await db.legInferenceRun.deleteMany({ where: { shipmentId } });
  await db.shipmentStop.deleteMany({ where: { shipmentId } });
  await db.trackingSubscription.deleteMany({ where: { shipmentId } });
  await db.shipmentTrackingIdentifier.deleteMany({ where: { shipmentId } });
  await db.complianceDeadline.deleteMany({ where: { shipmentId } });
  await db.shipmentDocument.deleteMany({ where: { shipmentId, fileName: { startsWith: DOC_PREFIX } } });
  await db.exceptionItem.deleteMany({ where: { shipmentId, code: "MISSING_LEG_DOCUMENT" } });
  console.log("  cleared prior leg artifacts");

  // --- tracking identifiers ----------------------------------------------
  await db.shipmentTrackingIdentifier.createMany({
    data: [
      { accountId, shipmentId, type: "BOOKING", value: "COSU6620149", issuer: "COSCO", isPrimary: true },
      { accountId, shipmentId, type: "MBL", value: "COSU7223841650", issuer: "COSCO", isPrimary: false },
      { accountId, shipmentId, type: "HBL", value: "SNKO2208841", issuer: "Seanko Logistics", isPrimary: false },
      { accountId, shipmentId, type: "CONTAINER", value: "CBHU8842190", issuer: "COSCO", isPrimary: false },
      { accountId, shipmentId, type: "CONTAINER", value: "TCLU7761334", issuer: "COSCO", isPrimary: false },
    ],
  });

  // --- 5 shared stops ---------------------------------------------------
  const mkStop = (sequence: number, type: string, role: string, name: string, unlocode: string | null, tz: string, extra: Record<string, unknown> = {}) =>
    db.shipmentStop.create({
      data: { accountId, shipmentId, sequence, type, role, name, unlocode, timezone: tz, ...extra },
    });

  const s1 = await mkStop(1, "ORIGIN", "ORIGIN", "Shenzhen Factory — Longgang", "CNSZX", "Asia/Shanghai", { actualDeparture: at(-30 * 24) });
  const s2 = await mkStop(2, "PORT", "PORT_OF_LADING", "Yantian International Container Terminal", "CNYTN", "Asia/Shanghai", { actualArrival: at(-29 * 24 - 6), actualDeparture: at(-27 * 24) });
  const s3 = await mkStop(3, "PORT", "TRANSSHIPMENT", "Busan New Port (PNC)", "KRPUS", "Asia/Seoul", { actualArrival: at(-20 * 24), actualDeparture: at(-18 * 24) });
  const s4 = await mkStop(4, "PORT", "PORT_OF_DISCHARGE", "APM Terminals Pier 400 — Los Angeles / Long Beach", "USLAX", "America/Los_Angeles", { estimatedArrival: eta, firmsCode: "W185" });
  const s5 = await mkStop(5, "DC", "DESTINATION", "Target Import Distribution Center — Rialto, CA", "USRIA", "America/Los_Angeles", { estimatedArrival: at(3 * 24) });

  // --- 4 legs ---------------------------------------------------------
  const leg1 = await db.shipmentLeg.create({
    data: {
      accountId, shipmentId, sequence: 1, legType: LegType.EXPORT_HAULAGE, mode: LegMode.TRUCK, status: LegStatus.COMPLETED,
      originStopId: s1.id, destinationStopId: s2.id, carrierName: "Sinotrans Ltd (export drayage)", carrierScac: "SNTR",
      bookingNumber: "COSU6620149", actualDeparture: at(-30 * 24), actualArrival: at(-29 * 24 - 6),
      source: "MANUAL", confirmedAt: new Date(),
    },
  });
  const leg2 = await db.shipmentLeg.create({
    data: {
      accountId, shipmentId, sequence: 2, legType: LegType.MAIN_CARRIAGE, mode: LegMode.OCEAN, status: LegStatus.COMPLETED,
      originStopId: s2.id, destinationStopId: s3.id, carrierName: "COSCO Shipping Lines", carrierScac: "COSU",
      vesselName: "COSCO SHIPPING ARIES", imoNumber: "9795612", voyageNumber: "072E",
      billOfLadingNumber: "COSU7223841650", billOfLadingType: "MASTER", bookingNumber: "COSU6620149",
      actualDeparture: at(-27 * 24), actualArrival: at(-20 * 24), source: "MANUAL", confirmedAt: new Date(),
    },
  });
  const leg3 = await db.shipmentLeg.create({
    data: {
      accountId, shipmentId, sequence: 3, legType: LegType.TRANSSHIPMENT, mode: LegMode.OCEAN, status: LegStatus.IN_TRANSIT,
      originStopId: s3.id, destinationStopId: s4.id, carrierName: "COSCO Shipping Lines", carrierScac: "COSU",
      vesselName: "COSCO SHIPPING LIBRA", imoNumber: "9757155", voyageNumber: "118E",
      billOfLadingNumber: "COSU7223841650", billOfLadingType: "MASTER", bookingNumber: "COSU6620149",
      actualDeparture: at(-18 * 24), plannedArrival: at(-14), estimatedArrival: eta,
      source: "MANUAL", confirmedAt: new Date(),
    },
  });
  const leg4 = await db.shipmentLeg.create({
    data: {
      accountId, shipmentId, sequence: 4, legType: LegType.IMPORT_HAULAGE, mode: LegMode.TRUCK, status: LegStatus.PLANNED,
      originStopId: s4.id, destinationStopId: s5.id, carrierName: "Hub Group (import drayage)", carrierScac: "HUBG",
      plannedDeparture: at(2 * 24), plannedArrival: at(3 * 24), estimatedArrival: at(3 * 24),
      source: "MANUAL", confirmedAt: new Date(),
    },
  });
  console.log("  created 5 stops + 4 legs");

  // --- per-leg document checklist (via the shared inference catalog) ------
  const legs = [
    { leg: leg1, type: LegType.EXPORT_HAULAGE, mode: LegMode.TRUCK, isFinal: false },
    { leg: leg2, type: LegType.MAIN_CARRIAGE, mode: LegMode.OCEAN, isFinal: false },
    { leg: leg3, type: LegType.TRANSSHIPMENT, mode: LegMode.OCEAN, isFinal: false },
    { leg: leg4, type: LegType.IMPORT_HAULAGE, mode: LegMode.TRUCK, isFinal: true },
  ];

  // Which slots have a document on file in this demo (slotKey -> [docType, fileName, status]).
  const filled: Record<string, [DocumentType, string, string]> = {
    BOOKING_CONFIRMATION: [DocumentType.OTHER, "Leg 1 — Booking Confirmation COSU6620149.pdf", "Processed"],
    SHIPPING_INSTRUCTIONS: [DocumentType.OTHER, "Leg 1 — Shipping Instructions.pdf", "Processed"],
    PACKING_LIST: [DocumentType.PACKING_LIST, "Leg 1 — Packing List.pdf", "Processed"],
    MBL: [DocumentType.BILL_OF_LADING, "Leg 2 — Master Bill of Lading COSU7223841650.pdf", "Processed"],
    ISF_10_2: [DocumentType.ISF, "Leg 2 — ISF 10+2 Filing.pdf", "Received"],
    CERT_OF_ORIGIN: [DocumentType.CERTIFICATE_OF_ORIGIN, "Leg 3 — Certificate of Origin (CN).pdf", "Processed"],
    CBP_RELEASE: [DocumentType.ENTRY_SUMMARY, "Leg 4 — CBP 7501 Entry Summary.pdf", "Received"],
    // ARRIVAL_NOTICE + DELIVERY_ORDER left MISSING on purpose.
  };

  let displayOrder = 200;
  for (const { leg, type, mode, isFinal } of legs) {
    const { slots } = inferLegDocuments(type, mode, { isUsImport: true, hasPreferenceClaim: false, isFinalLeg: isFinal });
    for (const slot of slots) {
      const hit = filled[slot.slotKey];
      let documentId: string | null = null;
      if (hit) {
        const doc = await db.shipmentDocument.create({
          data: {
            accountId, shipmentId, docType: slot.slotLabel, documentType: hit[0],
            fileName: `${DOC_PREFIX}${hit[1]}`, status: hit[2], required: true,
            portalVisibility: "INTERNAL", source: "UPLOAD", displayOrder: displayOrder++,
            confidence: 90,
          },
        });
        documentId = doc.id;
      }
      await db.shipmentLegDocument.create({
        data: {
          accountId, legId: leg.id, documentId,
          slotKey: slot.slotKey, slotLabel: slot.slotLabel, expectedDocType: slot.expectedDocType,
          requirement: slot.requirement as LegDocumentRequirement, requirementReason: slot.requirementReason,
          source: "INFERRED", confidence: 0.9,
        },
      });
    }
  }
  console.log("  created per-leg document checklists (2 required gaps: Arrival Notice, Delivery Order)");

  // --- tracking events --------------------------------------------------
  const ev = (
    n: number, legId: string, stopId: string, eventType: string,
    classifier: "PLANNED" | "ESTIMATED" | "ACTUAL", sourceType: "CARRIER" | "TERMINAL" | "PROVIDER" | "SYSTEM",
    provider: string, hours: number, locationName: string, unlocode: string, tz: string
  ) => ({
    accountId, shipmentId, legId, shipmentStopId: stopId, eventType, classifier, sourceType, provider,
    occurredAt: at(hours), receivedAt: classifier === "ACTUAL" ? at(hours + 1) : new Date(),
    locationName, unlocode, timezone: tz, providerEventId: `mlg-${n}`, idempotencyKey: `mlg-${shipmentId}-${n}`,
    confidence: classifier === "ACTUAL" ? 1 : 0.7, isInferred: classifier !== "ACTUAL",
  });
  await db.trackingEvent.createMany({
    data: [
      ev(1, leg1.id, s1.id, "BOOKING_CONFIRMED", "ACTUAL", "CARRIER", "COSCO eCommerce", -30 * 24 - 12, "Shenzhen", "CNSZX", "Asia/Shanghai"),
      ev(2, leg1.id, s2.id, "GATE_IN", "ACTUAL", "TERMINAL", "Yantian ICT", -29 * 24 - 6, "Yantian", "CNYTN", "Asia/Shanghai"),
      ev(3, leg2.id, s2.id, "LOADED_ON_VESSEL", "ACTUAL", "TERMINAL", "Yantian ICT", -27 * 24 - 4, "Yantian", "CNYTN", "Asia/Shanghai"),
      ev(4, leg2.id, s2.id, "VESSEL_DEPARTURE", "ACTUAL", "CARRIER", "COSCO AIS", -27 * 24, "Yantian", "CNYTN", "Asia/Shanghai"),
      ev(5, leg2.id, s3.id, "VESSEL_ARRIVAL", "ACTUAL", "CARRIER", "COSCO AIS", -20 * 24, "Busan", "KRPUS", "Asia/Seoul"),
      ev(6, leg2.id, s3.id, "DISCHARGED", "ACTUAL", "TERMINAL", "Busan PNC", -19 * 24 - 12, "Busan", "KRPUS", "Asia/Seoul"),
      ev(7, leg3.id, s3.id, "LOADED_ON_VESSEL", "ACTUAL", "TERMINAL", "Busan PNC", -18 * 24 - 6, "Busan", "KRPUS", "Asia/Seoul"),
      ev(8, leg3.id, s3.id, "VESSEL_DEPARTURE", "ACTUAL", "CARRIER", "COSCO AIS", -18 * 24, "Busan", "KRPUS", "Asia/Seoul"),
      ev(9, leg3.id, s4.id, "VESSEL_ARRIVAL", "ESTIMATED", "PROVIDER", "Qubere ETA model", 0, "Los Angeles / Long Beach", "USLAX", "America/Los_Angeles"),
      ev(10, leg4.id, s4.id, "DISCHARGE", "PLANNED", "SYSTEM", "Qubere plan", 1 * 24, "APM Pier 400", "USLAX", "America/Los_Angeles"),
      ev(11, leg4.id, s4.id, "GATE_OUT", "PLANNED", "SYSTEM", "Qubere plan", 2 * 24, "APM Pier 400", "USLAX", "America/Los_Angeles"),
      ev(12, leg4.id, s5.id, "DELIVERED", "PLANNED", "SYSTEM", "Qubere plan", 3 * 24, "Target DC Rialto", "USRIA", "America/Los_Angeles"),
    ],
  });

  // --- ETA drift (+14h into Long Beach) --------------------------------
  await db.etaObservation.createMany({
    data: [
      { accountId, shipmentId, legId: leg3.id, shipmentStopId: s4.id, estimatedAt: at(-18 * 24), eta: at(-14), previousEta: null, deltaMinutes: null, provider: "COSCO schedule", confidence: 0.6, reasonCode: "INITIAL_SCHEDULE" },
      { accountId, shipmentId, legId: leg3.id, shipmentStopId: s4.id, estimatedAt: at(-3 * 24), eta, previousEta: at(-14), deltaMinutes: 14 * 60, provider: "Qubere ETA model", confidence: 0.82, reasonCode: "PORT_CONGESTION" },
    ],
  });

  await db.trackingSubscription.create({
    data: {
      accountId, shipmentId, provider: "COSCO AIS", providerTrackingId: "COSU7223841650",
      status: "ACTIVE", startedAt: at(-31 * 24), lastEventAt: at(-18 * 24), lastSyncAt: new Date(Date.now() - 2 * 3_600_000),
    },
  });

  // --- compliance deadlines ------------------------------------------
  await db.complianceDeadline.createMany({
    data: [
      { accountId, shipmentId, type: "ISF_10_2", deadlineClass: "REGULATORY", status: "SATISFIED", anchorEvent: "LADING", anchorAt: at(-27 * 24 - 24), estimated: false, dueAt: at(-27 * 24 - 24), ruleId: "ISF_10_2", ruleCitation: "19 CFR 149.2(b)", satisfiedAt: at(-28 * 24), satisfiedBy: "SYSTEM" },
      { accountId, shipmentId, type: "ENTRY_FILING", deadlineClass: "REGULATORY", status: "OPEN", anchorEvent: "ARRIVAL", anchorAt: eta, estimated: true, dueAt: at(15 * 24), ruleId: "ENTRY_FILING", ruleCitation: "19 CFR 142.3", penaltyBasis: "up to $5,000 per violation" },
      { accountId, shipmentId, type: "LAST_FREE_DAY", deadlineClass: "COMMERCIAL", status: "OPEN", anchorEvent: "CARRIER_TERMS", anchorAt: eta, estimated: true, dueAt: at(3 * 24), ruleId: "LAST_FREE_DAY", ruleCitation: "Carrier free-time tariff", penaltyBasis: "demurrage ~$285/container/day after LFD" },
    ],
  });

  // --- one blocking exception for the missing import-leg delivery order --
  await db.exceptionItem.create({
    data: {
      accountId, shipmentId, type: "missing_document", category: "DOCUMENT", code: "MISSING_LEG_DOCUMENT",
      severity: "High", status: "Open", blocking: true,
      description: "Leg 4 (import haulage): Delivery Order missing — required before terminal gate-out at LA/LB Pier 400.",
    },
  });

  // --- ensure a customs filing exists so the customs rail shows FILED ---
  const filing = await db.customsFiling.findFirst({ where: { shipmentId } });
  if (!filing) {
    await db.customsFiling.create({
      data: { accountId, shipmentId, filingType: "ENTRY_SUMMARY", filingStatus: "Transmitted", entryNumber: "2704-8841920-1" },
    });
  }

  console.log(`\n✓ Done. Open ${SHIPMENT_NUMBER} — the Journey Ribbon shows the 4-leg route.`);
}

async function main() {
  await withDataModeContext(null, seed);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
