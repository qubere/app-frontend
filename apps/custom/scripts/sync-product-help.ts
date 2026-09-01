/**
 * Publishes the reviewed, code-owned support corpus into Postgres and pgvector.
 * This is an explicit release step, never a side effect of a GET request.
 *
 * Run from the repository root:
 *   npm --workspace @qubere/custom run sync:product-help
 */
import * as dotenv from "dotenv";
import { createHash } from "node:crypto";
dotenv.config();

import { db } from "@qubere/db";
import { SUPPORT_ARTICLES, SUPPORT_MODULES } from "@/app/app/support/supportContent";
import { HybridMemoryRetriever } from "@/modules/memory/memory.retriever";
import { ProductHelpRepository } from "@/modules/support/productHelp";

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

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
