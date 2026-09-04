/**
 * One-time database DDL reconciliation script for migration 20260903170000.
 *
 * Applies missing DDL columns on databases where 20260903170000 was marked applied
 * in _prisma_migrations without the DDL executing.
 *
 * Invocation (Cloud Run VPC / Cloud SQL Proxy):
 *   npx tsx apps/custom/scripts/run-demo-db-migration.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("=== RUNNING ONE-TIME DDL RECONCILIATION FOR MIGRATION 20260903170000 ===");

  console.log("1. Adding InboundEmail.bodyText...");
  await db.$executeRawUnsafe(`ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "bodyText" TEXT;`);

  console.log("2. Adding DocumentShipmentCandidate.reasoning...");
  await db.$executeRawUnsafe(`ALTER TABLE "DocumentShipmentCandidate" ADD COLUMN IF NOT EXISTS "reasoning" TEXT;`);

  console.log("3. Adding InboundAddress.autoAttachPolicy...");
  await db.$executeRawUnsafe(`ALTER TABLE "InboundAddress" ADD COLUMN IF NOT EXISTS "autoAttachPolicy" TEXT NOT NULL DEFAULT 'CONFIDENT';`);

  const presentColumns = await db.$queryRawUnsafe<Array<{ c: string }>>(`
    SELECT table_name || '.' || column_name AS c 
    FROM information_schema.columns 
    WHERE (table_name='InboundAddress' AND column_name='autoAttachPolicy')
       OR (table_name='InboundEmail' AND column_name='bodyText')
       OR (table_name='DocumentShipmentCandidate' AND column_name='reasoning')
  `);

  console.log("✅ PRESENT COLUMNS:", JSON.stringify(presentColumns));

  if (!presentColumns || presentColumns.length < 3) {
    throw new Error(`DDL reconciliation incomplete: expected 3 columns, found ${presentColumns?.length ?? 0}`);
  }

  // Ensure _prisma_migrations row is present so prisma migrate deploy doesn't fail on fresh environments
  const migrationName = "20260903170000_inbound_body_llm_match_autoattach";
  const migrationRow = await db.$queryRawUnsafe<Array<unknown>>(`
    SELECT id FROM "_prisma_migrations" WHERE migration_name = $1 OR id = $1
  `, migrationName).catch(() => []);

  if (!migrationRow || migrationRow.length === 0) {
    console.log(`ℹ️ Migration row missing in _prisma_migrations. Registering '${migrationName}'...`);
    await db.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
      VALUES ($1, '535', NOW(), $1, NULL, NULL, NOW(), 1)
      ON CONFLICT DO NOTHING;
    `, migrationName).catch((err) => {
      console.warn("Could not auto-register migration row. Please run: npx prisma migrate resolve --applied " + migrationName, err?.message);
    });
  } else {
    console.log(`✅ Migration '${migrationName}' already registered in _prisma_migrations.`);
  }

  console.log("\n🎉 DDL RECONCILIATION COMPLETE AND VERIFIED!");
}

main()
  .catch((err) => {
    console.error("❌ DDL Reconciliation failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
