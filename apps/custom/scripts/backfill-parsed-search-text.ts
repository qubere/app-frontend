import { backfillParsedSearchText } from "../src/modules/documents/processing/backfillParsedSearchText";

async function main() {
  console.log("[backfill-parsed-search-text] Starting backfill for historical documents...");
  const result = await backfillParsedSearchText();
  console.log("[backfill-parsed-search-text] Completed backfill:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-parsed-search-text] Fatal error:", err);
  process.exit(1);
});
