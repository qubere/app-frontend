import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🧪 Running Chunk 1 Database Verification...");

  const shipment = await db.shipment.findFirst({
    where: { shipmentNumber: "SHP-TGT-2026-001" },
    include: {
      legs: {
        orderBy: { sequence: "asc" },
        include: {
          originStop: true,
          destinationStop: true,
          legDocuments: true,
        },
      },
    },
  });

  if (!shipment) {
    throw new Error("❌ Shipment SHP-TGT-2026-001 not found!");
  }

  console.log(`  Found Shipment: ${shipment.shipmentNumber} (ID: ${shipment.id})`);
  console.log(`  Leg count: ${shipment.legs.length}`);

  if (shipment.legs.length !== 4) {
    throw new Error(`❌ Expected 4 legs, got ${shipment.legs.length}`);
  }

  // Verify sequence contiguity and shared stops
  for (let i = 0; i < shipment.legs.length; i++) {
    const leg = shipment.legs[i];
    if (leg.sequence !== i + 1) {
      throw new Error(`❌ Sequence gap: Expected ${i + 1}, got ${leg.sequence}`);
    }

    console.log(`  Leg ${leg.sequence} (${leg.legType} - ${leg.mode}): ${leg.originStop.name} -> ${leg.destinationStop.name} [Status: ${leg.status}, Docs: ${leg.legDocuments.length}]`);

    if (i > 0) {
      const prevLeg = shipment.legs[i - 1];
      if (leg.originStopId !== prevLeg.destinationStopId) {
        throw new Error(`❌ Shared stop invariant violated between Leg ${prevLeg.sequence} and Leg ${leg.sequence}: dest ${prevLeg.destinationStopId} != origin ${leg.originStopId}`);
      }
    }
  }

  const missingDocs = await db.shipmentLegDocument.count({
    where: { leg: { shipmentId: shipment.id }, documentId: null },
  });

  console.log(`  Missing document checklist gaps found: ${missingDocs}`);
  if (missingDocs < 2) {
    throw new Error(`❌ Expected at least 2 missing document slots in seed, found ${missingDocs}`);
  }

  console.log("✅ Chunk 1 Database Verification PASSED 100%!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
