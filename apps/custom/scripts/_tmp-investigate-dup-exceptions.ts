import dotenv from "dotenv";
dotenv.config({ path: "apps/custom/.env.local" });
import { db } from "@qubere/db";

async function main() {
  const groups = await db.exceptionItem.groupBy({
    by: ["shipmentId", "type", "description"],
    _count: { id: true },
    having: { id: { _count: { gt: 5 } } },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });
  console.log("Duplicate exception groups:", JSON.stringify(groups, null, 2));

  if (groups.length > 0) {
    const shipmentId = groups[0].shipmentId;
    console.log("\nShipment with dup exceptions:", shipmentId);

    const jobs = await db.pipelineJob.findMany({
      where: { shipmentId: shipmentId ?? undefined },
      select: { id: true, status: true, createdAt: true, workflowType: true },
      orderBy: { createdAt: "asc" },
    });
    console.log("PipelineJobs for that shipment:", JSON.stringify(jobs, null, 2));

    const docs = await db.shipmentDocument.findMany({
      where: { shipmentId: shipmentId ?? undefined },
      select: { id: true, fileName: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    console.log("Docs for that shipment:", JSON.stringify(docs, null, 2));

    const exSample = await db.exceptionItem.findMany({
      where: { shipmentId: shipmentId ?? undefined, type: groups[0].type, description: groups[0].description ?? undefined },
      select: { id: true, createdAt: true, status: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    });
    console.log("Sample dup exceptions (first 5):", JSON.stringify(exSample, null, 2));
    const exCount = await db.exceptionItem.count({
      where: { shipmentId: shipmentId ?? undefined, type: groups[0].type, description: groups[0].description ?? undefined },
    });
    console.log("Total dup count:", exCount);
  }

  // Check if PipelineJob model has a workflowType field distinguishing TMS vs customs
  const schemaSample = await db.pipelineJob.findFirst({ select: { workflowType: true } });
  console.log("\nSample workflowType field present:", JSON.stringify(schemaSample));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
