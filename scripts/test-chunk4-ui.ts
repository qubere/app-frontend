import { PrismaClient } from "@prisma/client";
import { getShipmentTrackingProjection } from "../apps/custom/src/modules/tracking/shipmentTracking";

const db = new PrismaClient();

async function main() {
  console.log("🧪 Running Chunk 4 Journey Ribbon UI Data Contract Verification...");

  const shipment = await db.shipment.findFirst({
    where: { shipmentNumber: "SHP-TGT-2026-001" },
  });

  if (!shipment) {
    throw new Error("❌ Demo shipment SHP-TGT-2026-001 not found in DB!");
  }

  const projection = await getShipmentTrackingProjection(shipment.accountId, shipment.id);
  if (!projection || !projection.journey) {
    throw new Error("❌ Journey projection missing from tracking projection!");
  }

  const journey = projection.journey;
  console.log(`  Shipment: ${journey.shipmentNumber}`);
  console.log(`  Headline: ${journey.journeyStatus.headline}`);
  console.log(`  Stops count: ${journey.stops.length}`);
  console.log(`  Legs count: ${journey.legs.length}`);
  console.log(`  Percent complete: ${journey.journeyStatus.percentComplete}%`);

  if (journey.stops.length !== 5) {
    throw new Error(`❌ Expected 5 shared stops, got ${journey.stops.length}`);
  }

  if (journey.legs.length !== 4) {
    throw new Error(`❌ Expected 4 legs, got ${journey.legs.length}`);
  }

  let totalMissingDocs = 0;
  journey.legs.forEach((leg) => {
    console.log(`    Leg ${leg.sequence} (${leg.legType} - ${leg.mode}): ${leg.documents.onFile}/${leg.documents.total} docs on file (${leg.documents.missingRequired} missing required)`);
    totalMissingDocs += leg.documents.missingRequired;
  });

  if (totalMissingDocs !== 2) {
    throw new Error(`❌ Expected exactly 2 missing required document slots (Arrival Notice & Delivery Order), got ${totalMissingDocs}`);
  }

  console.log("✅ Chunk 4 Journey Ribbon UI Contract PASSED 100%!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
