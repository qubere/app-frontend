/** Run from the repo root: npm --workspace @qubere/custom run seed:pga-holds -- --help */
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import type { PrismaClient } from "@prisma/client";
import { seedPgaHolds } from "./lib/pga-holds-demo";
import { assertDemoSeedingAllowed } from "../src/lib/environment";

async function main() {
  const { values } = parseArgs({ options: {
    "account-id": { type: "string" }, "shipment-id": { type: "string" },
    "user-id": { type: "string" }, "dry-run": { type: "boolean" },
    help: { type: "boolean" },
  } });
  if (values.help) {
    console.log("npm --workspace @qubere/custom run seed:pga-holds -- --account-id <id> --shipment-id <id> [--user-id <active-member-id>] [--dry-run]");
    console.log("Creates four synthetic holds in a DEMO/SANDBOX account. Existing demo records and broker edits are preserved.");
    return;
  }
  if (!values["account-id"]?.trim() || !values["shipment-id"]?.trim()) {
    throw new Error("Supply both --account-id and --shipment-id. Use --help for the command.");
  }
  const appDirectory = resolve(__dirname, "..");
  const appRequire = createRequire(resolve(appDirectory, "package.json"));
  // Use the installed Next version's own environment loader, with the same
  // app directory and precedence as `next dev`; no additional dependency.
  const nextRequire = createRequire(appRequire.resolve("next/package.json"));
  nextRequire("@next/env").loadEnvConfig(appDirectory, true);
  process.env.NODE_ENV ??= "development";
  assertDemoSeedingAllowed();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Configure apps/custom/.env.local or export your local app's database environment.");

  const { PrismaClient: Client } = appRequire("@prisma/client") as typeof import("@prisma/client");
  const db: PrismaClient = new Client();
  try {
    const result = await seedPgaHolds(db, {
      accountId: values["account-id"], shipmentId: values["shipment-id"],
      userId: values["user-id"], dryRun: values["dry-run"],
    });
    console.log(`${values["dry-run"] ? "Preview" : "Seed complete"}: ${result.account.name} / ${result.shipment.shipmentNumber}`);
    console.table(result.rows);
    console.log("Today: http://localhost:3000/app/actions");
    console.log(`Shipment: http://localhost:3000/app/shipments/${result.shipment.id}`);
    console.log(`API: http://localhost:3000/api/pga/holds?shipmentId=${result.shipment.id}`);
    console.log("The released hold is visible with 'Include released holds'. All evidence is synthetic; nothing was transmitted.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  const code = (error as { code?: string })?.code;
  if (code === "P2021" || code === "P2022") {
    console.error("PGA tables/columns are missing. Apply db:migrate:deploy to this database, then rerun the seed.");
  } else if (code === "P2034" || code === "P2002") {
    console.error("A concurrent seed or edit conflicted. No partial batch was saved; rerun the same command.");
  } else {
    console.error(error instanceof Error ? error.message : "PGA demo seed failed.");
  }
  process.exitCode = 1;
});
