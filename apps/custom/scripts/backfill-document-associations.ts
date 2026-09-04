/**
 * Backfill DocumentAssociation rows for pre-existing ShipmentDocument rows
 * that already have a direct shipmentId link (the only association mechanism
 * that existed before DocumentAssociation was introduced).
 *
 * Run once per environment after the 20260831000000_document_association
 * migration lands:
 *   npx tsx scripts/backfill-document-associations.ts
 *
 * Safe to re-run: skips any (documentId, SHIPMENT, shipmentId) pair that
 * already has an active association row.
 */
import { db } from "../src/lib/db";

const BATCH_SIZE = 500;

async function run() {
  let cursor: string | null = null;
  let totalCreated = 0;
  let totalSkipped = 0;

  console.log("Backfilling DocumentAssociation rows from ShipmentDocument.shipmentId …");

  while (true) {
    const rows = await db.shipmentDocument.findMany({
      where: { shipmentId: { not: null } },
      select: { id: true, accountId: true, shipmentId: true },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row.shipmentId) continue;

      const existing = await db.documentAssociation.findFirst({
        where: {
          accountId: row.accountId,
          documentId: row.id,
          entityType: "SHIPMENT",
          entityId: row.shipmentId,
          active: true,
        },
        select: { id: true },
      });
      if (existing) {
        totalSkipped++;
        continue;
      }

      const shipment = await db.shipment.findUnique({
        where: { id: row.shipmentId },
        select: { shipmentNumber: true },
      });

      await db.documentAssociation.create({
        data: {
          accountId: row.accountId,
          documentId: row.id,
          entityType: "SHIPMENT",
          entityId: row.shipmentId,
          entityDisplayId: shipment?.shipmentNumber ?? null,
          relationshipType: "GENERAL",
          source: "MIGRATION",
          linkedBy: "SYSTEM",
        },
      });
      totalCreated++;
    }

    cursor = rows[rows.length - 1]!.id;
  }

  console.log(`Done. Created ${totalCreated}, skipped (already active) ${totalSkipped}.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
