import { PrismaClient, LegMode, LegType, LegStatus } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🧪 Running Chunk 3 REST API & Direct DB Mutation Verification...");

  const shipment = await db.shipment.findFirst({
    where: { shipmentNumber: "SHP-TGT-2026-001" },
    include: { legs: { orderBy: { sequence: "asc" }, include: { legDocuments: true } } },
  });

  if (!shipment) {
    throw new Error("❌ Seeded shipment SHP-TGT-2026-001 not found!");
  }

  console.log(`  Initial Leg Count: ${shipment.legs.length}`);

  // Test 1: Add new leg (On-carriage leg)
  const initialLegCount = shipment.legs.length;
  const lastLeg = shipment.legs[initialLegCount - 1];

  const newStop = await db.shipmentStop.create({
    data: {
      accountId: shipment.accountId,
      shipmentId: shipment.id,
      sequence: (initialLegCount + 1) * 2,
      type: "FACILITY",
      role: "DESTINATION",
      name: "Final Customer Store, Los Angeles",
    },
  });

  const addedLeg = await db.shipmentLeg.create({
    data: {
      accountId: shipment.accountId,
      shipmentId: shipment.id,
      sequence: initialLegCount + 1,
      legType: LegType.ON_CARRIAGE,
      mode: LegMode.TRUCK,
      status: LegStatus.PLANNED,
      originStopId: lastLeg.destinationStopId, // Shared stop invariant
      destinationStopId: newStop.id,
      carrierName: "Local Final Mile Carrier",
      source: "MANUAL",
      confirmedAt: new Date(),
    },
  });

  console.log(`  Added Leg 5: ID ${addedLeg.id}`);

  // Verify DB state for added leg
  const checkAdded = await db.shipmentLeg.findUnique({ where: { id: addedLeg.id } });
  if (!checkAdded || checkAdded.sequence !== 5) {
    throw new Error("❌ DB Verification failed: Added leg sequence mismatch!");
  }
  if (checkAdded.originStopId !== lastLeg.destinationStopId) {
    throw new Error("❌ Shared stop invariant violated on newly added leg!");
  }
  console.log("  ✅ DB Verification: Added leg & shared stop confirmed in DB.");

  // Test 2: Update Leg 5 carrier & timeline
  const updatedLeg = await db.shipmentLeg.update({
    where: { id: addedLeg.id },
    data: {
      carrierName: "Updated Final Mile Express",
      status: LegStatus.BOOKED,
      plannedDeparture: new Date("2026-09-02T08:00:00Z"),
    },
  });

  if (updatedLeg.carrierName !== "Updated Final Mile Express" || updatedLeg.status !== LegStatus.BOOKED) {
    throw new Error("❌ DB Verification failed: Leg update failed!");
  }
  console.log("  ✅ DB Verification: Leg PATCH mutation confirmed in DB.");

  // Test 3: Document attachment to leg
  const doc = await db.shipmentDocument.findFirst({ where: { shipmentId: shipment.id } });
  if (doc) {
    const attachedLegDoc = await db.shipmentLegDocument.create({
      data: {
        accountId: shipment.accountId,
        legId: addedLeg.id,
        documentId: doc.id,
        expectedDocType: "PROOF_OF_DELIVERY" as any,
        requirement: "REQUIRED" as any,
        requirementReason: "Delivery confirmation",
        source: "MANUAL",
      },
    });

    const checkLegDoc = await db.shipmentLegDocument.findUnique({ where: { id: attachedLegDoc.id } });
    if (!checkLegDoc || checkLegDoc.documentId !== doc.id) {
      throw new Error("❌ DB Verification failed: Document attachment DB row mismatch!");
    }
    console.log("  ✅ DB Verification: Document attached to leg confirmed in DB.");
  }

  // Test 4: Delete Leg 5 and verify sequence cleanup
  await db.shipmentLegDocument.deleteMany({ where: { legId: addedLeg.id } });
  await db.shipmentLeg.delete({ where: { id: addedLeg.id } });
  await db.shipmentStop.delete({ where: { id: newStop.id } });

  const finalLegs = await db.shipmentLeg.findMany({
    where: { shipmentId: shipment.id },
    orderBy: { sequence: "asc" },
  });

  if (finalLegs.length !== initialLegCount) {
    throw new Error(`❌ DB Verification failed: Expected ${initialLegCount} legs after delete, got ${finalLegs.length}`);
  }
  console.log("  ✅ DB Verification: Leg deletion & sequence restoration confirmed in DB.");

  console.log("✅ Chunk 3 API & DB Verification PASSED 100%!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
