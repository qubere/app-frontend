import dotenv from "dotenv";
dotenv.config({ path: "apps/custom/.env.local" });
import { db } from "@qubere/db";

async function main() {
  const rows = await db.pipelineJob.groupBy({
    by: ["shipmentId"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });
  console.log("Shipments with >1 PipelineJob rows:", JSON.stringify(rows, null, 2));

  const topShipmentId = rows[0].shipmentId;
  const jobs = await db.pipelineJob.findMany({
    where: { shipmentId: topShipmentId },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, createdAt: true, startedAt: true, completedAt: true, currentStep: true, priority: true },
  });
  console.log(`\nJobs for shipment ${topShipmentId} (count=${jobs.length}):`);
  for (const j of jobs) console.log(JSON.stringify(j));

  const docs = await db.shipmentDocument.findMany({
    where: { shipmentId: topShipmentId },
    select: { id: true, fileName: true, checksum: true, createdAt: true, updatedAt: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nDocuments for shipment ${topShipmentId} (count=${docs.length}):`);
  for (const d of docs) console.log(JSON.stringify(d));

  // AuditLog around document uploads for this shipment, to see if it was repeated user uploads
  const audit = await db.auditLog.findMany({
    where: { entityId: topShipmentId, OR: [{ action: { contains: "upload" } }, { action: { contains: "UPLOAD" } }] },
    select: { action: true, createdAt: true, entity: true },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  console.log(`\nAuditLog entries mentioning upload for entityId=${topShipmentId}:`, JSON.stringify(audit, null, 2));

  // Broader: audit logs for ShipmentDocument entities tied to this shipment's docs
  const docIds = docs.map((d) => d.id);
  const auditDocs = await db.auditLog.findMany({
    where: { entity: "ShipmentDocument", entityId: { in: docIds } },
    select: { action: true, createdAt: true, entityId: true, metadata: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nAuditLog entries for ShipmentDocument entities:`, JSON.stringify(auditDocs, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
