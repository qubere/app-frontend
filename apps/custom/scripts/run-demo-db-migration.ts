import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  console.log("Running DDL migration statements one by one...");

  await db.$executeRawUnsafe(`ALTER TABLE "InboundEmail" ADD COLUMN IF NOT EXISTS "bodyText" TEXT;`);
  console.log("1. InboundEmail.bodyText -> DONE");

  await db.$executeRawUnsafe(`ALTER TABLE "DocumentShipmentCandidate" ADD COLUMN IF NOT EXISTS "reasoning" TEXT;`);
  console.log("2. DocumentShipmentCandidate.reasoning -> DONE");

  await db.$executeRawUnsafe(`ALTER TABLE "InboundAddress" ADD COLUMN IF NOT EXISTS "autoAttachPolicy" TEXT NOT NULL DEFAULT 'CONFIDENT';`);
  console.log("3. InboundAddress.autoAttachPolicy -> DONE");

  const check = await db.$queryRawUnsafe(`
    SELECT table_name || '.' || column_name AS c 
    FROM information_schema.columns 
    WHERE (table_name='InboundAddress' AND column_name='autoAttachPolicy')
       OR (table_name='InboundEmail' AND column_name='bodyText')
       OR (table_name='DocumentShipmentCandidate' AND column_name='reasoning')
  `);
  console.log("PRESENT COLUMNS:", JSON.stringify(check));
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
