import { backfillInboundEmailBodyText } from "../src/modules/documents/processing/inboundEmailWorker";

async function main() {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 50;

  console.log(`Starting InboundEmail.bodyText backfill (limit=${limit})...`);
  const result = await backfillInboundEmailBodyText({ limit });
  console.log(`Backfill finished. Processed: ${result.processedCount}, Updated: ${result.updatedCount}`);
}

main().catch((err) => {
  console.error("Backfill script error:", err);
  process.exit(1);
});
