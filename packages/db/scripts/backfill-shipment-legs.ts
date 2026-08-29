/**
 * packages/db/scripts/backfill-shipment-legs.ts
 *
 * One-shot backfill: for every shipment that has legacy `TransportLeg` rows but
 * no canonical `ShipmentLeg` rows, synthesise the `ShipmentLeg` journey (plus
 * the shared `ShipmentStop`s) so the multi-leg Journey Ribbon shows the route.
 *
 * Existing tracking data is treated as broker-trusted: legs are written with
 * `source = "MANUAL"` and `confirmedAt = now()`, so inference will only ever
 * append to them, never rewrite.
 *
 * This does NOT touch `Movement` / `ShipmentMovement` — that model still backs
 * the apps/tms freight-ops domain and is out of scope here.
 *
 * Idempotent: skips any shipment that already has ShipmentLeg rows.
 *
 * Run:  npx tsx packages/db/scripts/backfill-shipment-legs.ts [--commit]
 * Without --commit it runs as a dry run and only reports what it would do.
 */
import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient, LegMode, LegType, LegStatus } from "@prisma/client";

const db = new PrismaClient({ log: ["warn", "error"] });
const COMMIT = process.argv.includes("--commit");

function toLegMode(mode: string | null | undefined): LegMode {
  const m = (mode ?? "").toUpperCase();
  if (m.includes("AIR")) return LegMode.AIR;
  if (m.includes("RAIL")) return LegMode.RAIL;
  if (m.includes("BARGE")) return LegMode.BARGE;
  if (m.includes("COURIER") || m.includes("PARCEL")) return LegMode.COURIER;
  if (m.includes("TRUCK") || m.includes("ROAD") || m.includes("DRAY")) return LegMode.TRUCK;
  return LegMode.OCEAN;
}

function toLegType(seq: number, total: number, mode: LegMode): LegType {
  if (total === 1) return LegType.MAIN_CARRIAGE;
  if (seq === 1 && (mode === LegMode.TRUCK || mode === LegMode.RAIL)) return LegType.EXPORT_HAULAGE;
  if (seq === total && (mode === LegMode.TRUCK || mode === LegMode.RAIL)) return LegType.IMPORT_HAULAGE;
  if (seq > 1 && seq < total && (mode === LegMode.OCEAN || mode === LegMode.AIR)) return LegType.TRANSSHIPMENT;
  return LegType.MAIN_CARRIAGE;
}

function toLegStatus(status: string | null | undefined): LegStatus {
  const s = (status ?? "").toUpperCase();
  if (s.includes("DELIVERED") || s.includes("COMPLETED")) return LegStatus.COMPLETED;
  if (s.includes("ARRIVED") || s.includes("DISCHARGED")) return LegStatus.ARRIVED;
  if (s.includes("TRANSIT") || s.includes("DEPARTED") || s.includes("LOADED")) return LegStatus.IN_TRANSIT;
  if (s.includes("READY") || s.includes("GATE_IN")) return LegStatus.READY_FOR_PICKUP;
  if (s.includes("BOOKED") || s.includes("BOOKING")) return LegStatus.BOOKED;
  if (s.includes("CANCEL")) return LegStatus.CANCELLED;
  if (s.includes("EXCEPTION") || s.includes("DELAY") || s.includes("ROLL")) return LegStatus.EXCEPTION;
  return LegStatus.PLANNED;
}

function roleFor(seq: number, total: number, mode: LegMode): string {
  if (seq === 1) return "ORIGIN";
  if (seq === total + 1) return "DESTINATION";
  if (mode === LegMode.AIR) return "AIRPORT";
  return "PORT";
}

async function main() {
  const shipments = await db.shipment.findMany({
    where: { deletedAt: null, transportLegs: { some: {} }, legs: { none: {} } },
    select: {
      id: true,
      accountId: true,
      shipmentNumber: true,
      transportLegs: { orderBy: { sequence: "asc" } },
    },
  });

  console.log(`${shipments.length} shipment(s) with TransportLeg rows and no ShipmentLeg rows${COMMIT ? "" : " (dry run)"}\n`);
  let created = 0;

  for (const s of shipments) {
    const tls = s.transportLegs;
    const total = tls.length;
    const modes = tls.map((tl) => toLegMode(tl.mode));

    // Points along the journey: leg1.origin, then each leg's destination.
    const points = [
      { name: tls[0].originName ?? "Origin", unlocode: tls[0].originUnlocode ?? null },
      ...tls.map((tl) => ({ name: tl.destinationName ?? "Destination", unlocode: tl.destinationUnlocode ?? null })),
    ];

    console.log(`${s.shipmentNumber}: ${total} legs — ${points.map((p) => p.name).join(" → ")}`);
    if (!COMMIT) continue;

    await db.$transaction(async (tx) => {
      const maxStop = await tx.shipmentStop.aggregate({ where: { shipmentId: s.id }, _max: { sequence: true } });
      let stopSeq = (maxStop._max.sequence ?? 0) + 1;

      const stopIds: string[] = [];
      for (let i = 0; i < points.length; i++) {
        const mode = modes[Math.min(i, modes.length - 1)];
        const stop = await tx.shipmentStop.create({
          data: {
            accountId: s.accountId,
            shipmentId: s.id,
            sequence: stopSeq++,
            type: roleFor(i + 1, total, mode),
            role: roleFor(i + 1, total, mode),
            name: points[i].name,
            unlocode: points[i].unlocode,
          },
        });
        stopIds.push(stop.id);
      }

      for (let i = 0; i < total; i++) {
        const tl = tls[i];
        const mode = modes[i];
        await tx.shipmentLeg.create({
          data: {
            accountId: s.accountId,
            shipmentId: s.id,
            sequence: i + 1,
            legType: toLegType(i + 1, total, mode),
            mode,
            status: toLegStatus(tl.status),
            originStopId: stopIds[i],
            destinationStopId: stopIds[i + 1],
            carrierName: tl.carrierName,
            carrierScac: tl.carrierCode,
            vesselName: tl.vesselName,
            imoNumber: tl.imoNumber,
            voyageNumber: tl.voyageNumber,
            flightNumber: tl.flightNumber,
            plannedDeparture: tl.plannedDeparture,
            estimatedDeparture: tl.estimatedDeparture,
            actualDeparture: tl.actualDeparture,
            plannedArrival: tl.plannedArrival,
            estimatedArrival: tl.estimatedArrival,
            actualArrival: tl.actualArrival,
            source: "MANUAL",
            confirmedAt: new Date(),
          },
        });
      }
    });
    created++;
  }

  console.log(`\n${COMMIT ? `Backfilled ${created} shipment(s).` : "Dry run complete. Re-run with --commit to write."}`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
