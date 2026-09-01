/** Validates both hand-authored and release-generated product-help content. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import generatedProductHelp from "@/app/app/support/generatedProductHelp.json";
import {
  SUPPORT_ARTICLES,
  SUPPORT_MODULES,
  type SupportArticle,
} from "@/app/app/support/supportContent";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const appRouterRoot = resolve(repositoryRoot, "apps/custom/src/app");
const moduleIds = new Set(SUPPORT_MODULES.map((module) => module.id));

function routeFile(href: string): string {
  const path = href.split("?")[0].replace(/\/$/, "") || "/";
  return resolve(appRouterRoot, `.${path}/page.tsx`);
}

function validateArticle(article: SupportArticle, label: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.id)) {
    throw new Error(`${label}: invalid stable id ${article.id}`);
  }
  if (!moduleIds.has(article.moduleId)) throw new Error(`${label}: invalid module ${article.moduleId}`);
  if (article.question.length < 10) throw new Error(`${label}: question is too short`);
  if (article.answer.length < 20) throw new Error(`${label}: answer is too short`);
  if (article.steps.length < 2 || article.steps.length > 6) {
    throw new Error(`${label}: expected 2-6 steps`);
  }
  if (article.tags.length < 2) throw new Error(`${label}: expected at least two search tags`);
  if (article.href && !existsSync(routeFile(article.href))) {
    throw new Error(`${label}: route does not exist: ${article.href}`);
  }
}

function main(): void {
  const generated = generatedProductHelp as {
    version: number;
    sourceCommit: string | null;
    articles: SupportArticle[];
    archivedArticleIds: string[];
  };
  if (generated.version !== 1) throw new Error("Unsupported generated product-help version");
  if (new Set(generated.archivedArticleIds).size !== generated.archivedArticleIds.length) {
    throw new Error("Generated product-help contains duplicate archived ids");
  }
  const generatedIds = new Set<string>();
  for (const article of generated.articles) {
    if (generatedIds.has(article.id)) throw new Error(`Duplicate generated article ${article.id}`);
    generatedIds.add(article.id);
    validateArticle(article, `generated article ${article.id}`);
  }
  for (const archivedId of generated.archivedArticleIds) {
    if (generatedIds.has(archivedId)) {
      throw new Error(`${archivedId} cannot be generated and archived simultaneously`);
    }
  }

  const finalIds = new Set<string>();
  for (const article of SUPPORT_ARTICLES) {
    if (finalIds.has(article.id)) throw new Error(`Duplicate final article ${article.id}`);
    finalIds.add(article.id);
  }

  const source = readFileSync(
    resolve(repositoryRoot, "apps/custom/src/app/app/support/supportContent.ts"),
    "utf8"
  );
  if (!source.includes("BASE_SUPPORT_ARTICLES")) {
    throw new Error("Hand-authored support corpus export is missing");
  }
  console.log(
    `Validated ${SUPPORT_ARTICLES.length} published guides (${generated.articles.length} generated overlays, ${generated.archivedArticleIds.length} archived).`
  );
}

main();
