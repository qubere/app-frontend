import { PrismaClient, LegMode, LegType, LegStatus, LegDocumentRequirement } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("===============================================================");
  console.log("🚀 END-TO-END USER ACTION & DB MUTATION SIMULATION SUITE");
  console.log("===============================================================");

  const shipment = await db.shipment.findFirst({
    where: { shipmentNumber: "SHP-TGT-2026-001" },
    include: {
      legs: {
        orderBy: { sequence: "asc" },
        include: { originStop: true, destinationStop: true, legDocuments: true },
      },
    },
  });

  if (!shipment) {
    throw new Error("❌ Seed shipment SHP-TGT-2026-001 not found!");
  }

  const sId = shipment.id;
  const baseUrl = "http://localhost:3000";

  console.log(`\n--- USER ACTION 1: View Journey Ribbon Projection (GET /api/shipments/SHP-TGT-2026-001/legs) ---`);
  const getRes = await fetch(`${baseUrl}/api/shipments/SHP-TGT-2026-001/legs`);
  if (!getRes.ok) throw new Error(`GET failed: ${getRes.status}`);
  const getJson = await getRes.json();

  console.log(`  Journey Headline: "${getJson.journey.journeyStatus.headline}"`);
  console.log(`  Legs Count: ${getJson.journey.legs.length}`);
  console.log(`  Stops Count: ${getJson.journey.stops.length}`);

  if (getJson.journey.legs.length !== 4) throw new Error("Expected 4 legs");
  if (getJson.journey.stops.length !== 5) throw new Error("Expected 5 stops");
  console.log("  ✅ User View Assertion PASSED!");

  console.log(`\n--- USER ACTION 2: User Clicks "+ Add Leg" Button (POST /api/shipments/${sId}/legs) ---`);
  const postRes = await fetch(`${baseUrl}/api/shipments/${sId}/legs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      legType: LegType.ON_CARRIAGE,
      mode: LegMode.TRUCK,
      destinationName: "Target Store #1042 (Pasadena CA)",
      carrierName: "Local Final Mile Express",
      billOfLadingNumber: "HBL-LOCAL-9920",
    }),
  });

  if (!postRes.ok) throw new Error(`POST failed: ${postRes.status}`);
  const postJson = await postRes.json();
  const newLegId = postJson.leg.id;
  console.log(`  Created Leg 5 ID: ${newLegId}`);

  // DB Verification after User Action 2
  const dbCheck1 = await db.shipmentLeg.findUnique({
    where: { id: newLegId },
    include: { originStop: true, destinationStop: true },
  });

  if (!dbCheck1) throw new Error("❌ DB Failure: Leg 5 not found in DB!");
  if (dbCheck1.sequence !== 5) throw new Error("❌ DB Failure: Leg 5 sequence mismatch!");
  if (dbCheck1.originStopId !== shipment.legs[3].destinationStopId) {
    throw new Error("❌ DB Failure: Shared stop invariant broken on newly added leg!");
  }
  console.log(`  ✅ DB Verification PASSED: Leg 5 (ON_CARRIAGE) created with origin equal to Leg 4 destination ("${dbCheck1.originStop.name}").`);

  console.log(`\n--- USER ACTION 3: User Edits Leg 5 Carrier & Timeline (PATCH /api/shipments/${sId}/legs/${newLegId}) ---`);
  const patchRes = await fetch(`${baseUrl}/api/shipments/${sId}/legs/${newLegId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      carrierName: "Pasadena Local Logistics Corp",
      status: LegStatus.BOOKED,
      plannedDeparture: "2026-09-02T10:00:00Z",
    }),
  });

  if (!patchRes.ok) throw new Error(`PATCH failed: ${patchRes.status}`);

  // DB Verification after User Action 3
  const dbCheck2 = await db.shipmentLeg.findUnique({ where: { id: newLegId } });
  if (dbCheck2?.carrierName !== "Pasadena Local Logistics Corp" || dbCheck2?.status !== LegStatus.BOOKED) {
    throw new Error("❌ DB Failure: Leg 5 PATCH update not mutated in DB!");
  }
  console.log("  ✅ DB Verification PASSED: Leg 5 carrierName and status updated in DB.");

  console.log(`\n--- USER ACTION 4: User Fills Document Slot Gap on Leg 4 (POST /api/shipments/${sId}/legs/${shipment.legs[3].id}/documents) ---`);
  const leg4Id = shipment.legs[3].id;
  const sampleDoc = await db.shipmentDocument.findFirst({ where: { shipmentId: sId } });

  const docRes = await fetch(`${baseUrl}/api/shipments/${sId}/legs/${leg4Id}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: sampleDoc?.id,
      expectedDocType: "OTHER",
      requirement: "REQUIRED",
      requirementReason: "Delivery Order uploaded by broker",
    }),
  });

  if (!docRes.ok) throw new Error(`Leg Document POST failed: ${docRes.status}`);

  // DB Verification after User Action 4
  const dbCheck3 = await db.shipmentLegDocument.findFirst({
    where: { legId: leg4Id, expectedDocType: "OTHER" as any },
  });

  if (!dbCheck3 || dbCheck3.documentId !== sampleDoc?.id) {
    throw new Error("❌ DB Failure: Delivery order slot not updated with documentId!");
  }
  console.log("  ✅ DB Verification PASSED: Leg 4 checklist slot filled with attached document in DB.");

  console.log(`\n--- USER ACTION 5: User Deletes Leg 5 (DELETE /api/shipments/${sId}/legs/${newLegId}) ---`);
  const deleteRes = await fetch(`${baseUrl}/api/shipments/${sId}/legs/${newLegId}`, {
    method: "DELETE",
  });

  if (!deleteRes.ok) throw new Error(`DELETE failed: ${deleteRes.status}`);

  // DB Verification after User Action 5
  const dbCheck4 = await db.shipmentLeg.findUnique({ where: { id: newLegId } });
  if (dbCheck4 !== null) throw new Error("❌ DB Failure: Leg 5 still present in DB after delete!");

  const finalDbLegs = await db.shipmentLeg.findMany({
    where: { shipmentId: sId },
    orderBy: { sequence: "asc" },
  });

  if (finalDbLegs.length !== 4) throw new Error("❌ DB Failure: Expected 4 legs after deleting Leg 5");
  console.log("  ✅ DB Verification PASSED: Leg 5 deleted and leg sequence restored to 4.");

  console.log("\n===============================================================");
  console.log("🎉 ALL E2E USER ACTIONS & DB MUTATIONS PASSED WITH 100% SUCCESS!");
  console.log("===============================================================");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
