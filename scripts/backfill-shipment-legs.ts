import { PrismaClient, LegMode, LegType, LegStatus } from "@prisma/client";

const db = new PrismaClient({ log: ["warn", "error"] });

function mapModeToLegMode(mode: string | null | undefined): LegMode {
  if (!mode) return LegMode.OCEAN;
  const m = mode.toUpperCase();
  if (m.includes("AIR")) return LegMode.AIR;
  if (m.includes("RAIL")) return LegMode.RAIL;
  if (m.includes("TRUCK") || m.includes("DRAY") || m.includes("ROAD")) return LegMode.TRUCK;
  if (m.includes("BARGE")) return LegMode.BARGE;
  if (m.includes("COURIER") || m.includes("PARCEL")) return LegMode.COURIER;
  return LegMode.OCEAN;
}

function inferLegType(sequence: number, totalLegs: number, mode: LegMode): LegType {
  if (totalLegs === 1) return LegType.MAIN_CARRIAGE;
  if (sequence === 1 && (mode === LegMode.TRUCK || mode === LegMode.RAIL)) return LegType.EXPORT_HAULAGE;
  if (sequence === totalLegs && (mode === LegMode.TRUCK || mode === LegMode.RAIL)) return LegType.IMPORT_HAULAGE;
  if (sequence > 1 && sequence < totalLegs && mode === LegMode.OCEAN) return LegType.TRANSSHIPMENT;
  return LegType.MAIN_CARRIAGE;
}

function mapStatusToLegStatus(status: string | null | undefined): LegStatus {
  if (!status) return LegStatus.PLANNED;
  const s = status.toUpperCase();
  if (s.includes("DELIVERED") || s.includes("COMPLETED")) return LegStatus.COMPLETED;
  if (s.includes("ARRIVED") || s.includes("DISCHARGED")) return LegStatus.ARRIVED;
  if (s.includes("TRANSIT") || s.includes("DEPARTED")) return LegStatus.IN_TRANSIT;
  if (s.includes("READY") || s.includes("GATE_IN")) return LegStatus.READY_FOR_PICKUP;
  if (s.includes("BOOKED")) return LegStatus.BOOKED;
  if (s.includes("CANCEL")) return LegStatus.CANCELLED;
  if (s.includes("EXCEPTION") || s.includes("DELAY")) return LegStatus.EXCEPTION;
  return LegStatus.PLANNED;
}

export async function runBackfill() {
  console.log("🚀 Starting ShipmentLeg Backfill Job...");

  const shipments = await db.shipment.findMany({
    include: {
      transportLegs: { orderBy: { sequence: "asc" }, include: { stops: { orderBy: { sequence: "asc" } } } },
      shipmentMovements: { include: { movement: true }, orderBy: { sequence: "asc" } },
      trackingStops: { orderBy: { sequence: "asc" } },
    },
  });

  let migratedCount = 0;

  for (const shipment of shipments) {
    const existingLegs = await db.shipmentLeg.findMany({
      where: { shipmentId: shipment.id },
    });

    if (existingLegs.length > 0) {
      console.log(`  Skipping shipment ${shipment.shipmentNumber} — already has ${existingLegs.length} ShipmentLeg(s).`);
      continue;
    }

    const hasTransportLegs = shipment.transportLegs.length > 0;
    const hasMovements = shipment.shipmentMovements.length > 0;

    if (!hasTransportLegs && !hasMovements) {
      continue;
    }

    console.log(`  Backfilling shipment ${shipment.shipmentNumber} (TransportLegs: ${shipment.transportLegs.length}, Movements: ${shipment.shipmentMovements.length})...`);

    if (hasTransportLegs) {
      const rawLegs = shipment.transportLegs;
      const totalLegs = rawLegs.length;

      let lastStopId: string | null = null;

      for (let i = 0; i < totalLegs; i++) {
        const tLeg = rawLegs[i];
        const mode = mapModeToLegMode(tLeg.mode);
        const legType = inferLegType(i + 1, totalLegs, mode);
        const legStatus = mapStatusToLegStatus(tLeg.status);

        // Dedupe or create shared origin stop
        let originStopId: string;
        if (lastStopId) {
          originStopId = lastStopId;
        } else {
          const originName = tLeg.originName || `${shipment.shipmentNumber} Origin`;
          const createdOrigin = await db.shipmentStop.create({
            data: {
              accountId: shipment.accountId,
              shipmentId: shipment.id,
              sequence: i * 2 + 1,
              type: i === 0 ? "FACILITY" : "PORT",
              role: i === 0 ? "ORIGIN" : "TRANSSHIPMENT",
              name: originName,
              unlocode: tLeg.originUnlocode,
            },
          });
          originStopId = createdOrigin.id;
        }

        // Create destination stop
        const destName = tLeg.destinationName || `${shipment.shipmentNumber} Destination`;
        const createdDest = await db.shipmentStop.create({
          data: {
            accountId: shipment.accountId,
            shipmentId: shipment.id,
            sequence: i * 2 + 2,
            type: i === totalLegs - 1 ? "DC" : "PORT",
            role: i === totalLegs - 1 ? "DESTINATION" : "TRANSSHIPMENT",
            name: destName,
            unlocode: tLeg.destinationUnlocode,
          },
        });
        const destStopId = createdDest.id;
        lastStopId = destStopId; // for next leg's shared origin

        // Extract potential movement info if present
        const matchingMovement = shipment.shipmentMovements[i]?.movement;

        await db.shipmentLeg.create({
          data: {
            accountId: shipment.accountId,
            shipmentId: shipment.id,
            sequence: i + 1,
            legType,
            mode,
            status: legStatus,
            originStopId,
            destinationStopId: destStopId,
            carrierName: tLeg.carrierName || matchingMovement?.carrier || shipment.carrierName,
            carrierScac: tLeg.carrierCode || matchingMovement?.carrierCode,
            vesselName: tLeg.vesselName || matchingMovement?.vesselName,
            imoNumber: tLeg.imoNumber,
            voyageNumber: tLeg.voyageNumber || matchingMovement?.voyageNumber,
            flightNumber: tLeg.flightNumber,
            billOfLadingNumber: matchingMovement?.mblNumber || matchingMovement?.hblNumber,
            billOfLadingType: matchingMovement?.mblNumber ? "MASTER" : undefined,
            bookingNumber: matchingMovement?.bookingNumber,
            plannedDeparture: tLeg.plannedDeparture,
            estimatedDeparture: tLeg.estimatedDeparture,
            actualDeparture: tLeg.actualDeparture,
            plannedArrival: tLeg.plannedArrival,
            estimatedArrival: tLeg.estimatedArrival,
            actualArrival: tLeg.actualArrival,
            source: "MANUAL",
            confirmedAt: new Date(),
          },
        });
      }
      migratedCount++;
    } else if (hasMovements) {
      const rawMovements = shipment.shipmentMovements;
      const totalLegs = rawMovements.length;
      let lastStopId: string | null = null;

      for (let i = 0; i < totalLegs; i++) {
        const sm = rawMovements[i];
        const m = sm.movement;
        const mode = mapModeToLegMode(m?.mode);
        const legType = inferLegType(sm.sequence || i + 1, totalLegs, mode);
        const legStatus = mapStatusToLegStatus(m?.status);

        let originStopId: string;
        if (lastStopId) {
          originStopId = lastStopId;
        } else {
          const createdOrigin = await db.shipmentStop.create({
            data: {
              accountId: shipment.accountId,
              shipmentId: shipment.id,
              sequence: i * 2 + 1,
              type: i === 0 ? "FACILITY" : "PORT",
              role: i === 0 ? "ORIGIN" : "TRANSSHIPMENT",
              name: m?.originName || `Origin Stop ${i + 1}`,
              unlocode: m?.originCode,
            },
          });
          originStopId = createdOrigin.id;
        }

        const createdDest = await db.shipmentStop.create({
          data: {
            accountId: shipment.accountId,
            shipmentId: shipment.id,
            sequence: i * 2 + 2,
            type: i === totalLegs - 1 ? "DC" : "PORT",
            role: i === totalLegs - 1 ? "DESTINATION" : "TRANSSHIPMENT",
            name: m?.destinationName || `Destination Stop ${i + 1}`,
            unlocode: m?.destinationCode,
          },
        });
        const destStopId = createdDest.id;
        lastStopId = destStopId;

        await db.shipmentLeg.create({
          data: {
            accountId: shipment.accountId,
            shipmentId: shipment.id,
            sequence: sm.sequence || i + 1,
            legType,
            mode,
            status: legStatus,
            originStopId,
            destinationStopId: destStopId,
            carrierName: m?.carrier || shipment.carrierName,
            carrierScac: m?.carrierCode,
            vesselName: m?.vesselName,
            voyageNumber: m?.voyageNumber,
            billOfLadingNumber: m?.mblNumber || m?.hblNumber,
            bookingNumber: m?.bookingNumber,
            source: "MANUAL",
            confirmedAt: new Date(),
          },
        });
      }
      migratedCount++;
    }
  }

  console.log(`✅ Backfill complete! Migrated ${migratedCount} shipment(s) to ShipmentLeg.`);
}

if (require.main === module) {
  runBackfill()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Backfill failed:", err);
      process.exit(1);
    });
}
