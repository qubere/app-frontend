import { db } from "@qubere/db";
import { getShipmentWorkspaceDetails } from "../apps/tms/src/modules/shipments/services/shipmentWorkspaceService";

async function main() {
  const shipmentId = "cmt5zprc701a5fx2fxhmudlzz";
  const shipment = await db.shipment.findFirst({
    where: { id: shipmentId },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      agentDecisions: { orderBy: { createdAt: "desc" } },
      transportationOrders: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!shipment) {
    console.log("Shipment not found in DB.");
    process.exit(0);
  }

  console.log("=== Shipment DB Record ===");
  console.log("Shipment Number:", shipment.shipmentNumber);
  console.log("countryOfExport:", shipment.countryOfExport);
  console.log("portOfEntry:", shipment.portOfEntry);
  console.log("destinationCountry:", shipment.destinationCountry);
  console.log("transportMode:", shipment.transportMode);

  console.log("\n=== Attached Documents ===");
  for (const doc of shipment.documents) {
    console.log(`Doc ID: ${doc.id} | File: ${doc.fileName} | docType: ${doc.docType} | confidence: ${doc.confidence}`);
    console.log(`Extracted JSON:`, doc.extractedJson);
  }

  console.log("\n=== Agent Decisions ===");
  for (const ad of shipment.agentDecisions) {
    console.log(`[${ad.agentName}] confidence: ${ad.confidence}% | summary: ${ad.summary}`);
  }

  console.log("\n=== Transportation Orders ===");
  for (const to of shipment.transportationOrders) {
    console.log(`TO ID: ${to.id} | origin:`, to.origin, "| destination:", to.destination, "| mode:", to.mode);
  }
}

main().catch(console.error).finally(() => process.exit(0));
