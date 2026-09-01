/**
 * Publishes the reviewed, code-owned support corpus into Postgres and pgvector.
 * This is an explicit release step, never a side effect of a GET request.
 *
 * Run from the repository root:
 *   npm --workspace @qubere/custom run sync:product-help
 */
import * as dotenv from "dotenv";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// npm executes workspace scripts with apps/custom as the current directory,
// while Prisma migrations are normally run from the repository root. Resolve
// the root .env from this file so both commands target the same database.
// When the repository root .env exists, it must win over stale variables
// exported by a developer's shell; that is the same file Prisma CLI loads for
// the documented migration command. In deployed/CI environments the file is
// absent, so injected process-level variables remain authoritative.
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRootEnv = resolve(scriptDirectory, "../../../.env");
dotenv.config({ path: repositoryRootEnv, override: true });

import { SUPPORT_ARTICLES, SUPPORT_MODULES } from "@/app/app/support/supportContent";

const SOURCE_PATH = "apps/custom/src/app/app/support/supportContent.ts";

function articleSearchText(article: (typeof SUPPORT_ARTICLES)[number]): string {
  const supportModule = SUPPORT_MODULES.find((item) => item.id === article.moduleId);
  return [
    article.question,
    article.answer,
    article.steps.join(" "),
    article.tags.join(" "),
    supportModule?.name ?? article.moduleId,
    supportModule?.description ?? "",
  ].join("\n");
}

async function main() {
  // Dynamic imports are intentional: ESM static imports execute before the
  // dotenv call above, which can initialize Prisma/Gemini against stale or
  // missing environment variables.
  const [{ db }, { HybridMemoryRetriever }, { ProductHelpRepository }] = await Promise.all([
    import("@qubere/db"),
    import("@/modules/memory/memory.retriever"),
    import("@/modules/support/productHelp"),
  ]);
  database = db;

  const [databaseIdentity] = await db.$queryRaw<
    Array<{ databaseName: string; schemaName: string; productHelpTableExists: boolean }>
  >`
    SELECT
      current_database() AS "databaseName",
      current_schema() AS "schemaName",
      to_regclass('public."ProductHelpArticle"') IS NOT NULL AS "productHelpTableExists"
  `;
  if (!databaseIdentity?.productHelpTableExists) {
    throw new Error(
      `ProductHelpArticle is missing from ${databaseIdentity?.databaseName ?? "the selected database"}. ` +
        "Run the migration against the same root .env/DATABASE_URL used by this sync."
    );
  }
  console.log(
    `Publishing product help to ${databaseIdentity.databaseName}.${databaseIdentity.schemaName}...`
  );

  const activeIds: string[] = [];
  let published = 0;

  for (const article of SUPPORT_ARTICLES) {
    const searchText = articleSearchText(article);
    const contentHash = createHash("sha256").update(searchText).digest("hex");
    const existing = await db.productHelpArticle.findUnique({
      where: { id: article.id },
      select: { contentHash: true, embedding: true },
    });
    const embedding =
      existing?.contentHash === contentHash && existing.embedding.length === 768
        ? existing.embedding
        : await HybridMemoryRetriever.embedQuery(searchText);

    await ProductHelpRepository.upsert({
      article,
      aliases: article.tags,
      sourcePath: SOURCE_PATH,
      contentHash,
      searchText,
      embedding,
    });
    activeIds.push(article.id);
    published += 1;
  }

  const archived = await ProductHelpRepository.archiveMissing(activeIds);
  console.log(`Published ${published} product-help articles; archived ${archived} stale articles.`);
}

let database: { $disconnect(): Promise<void> } | null = null;

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (database) await database.$disconnect();
  });
