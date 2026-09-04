import type { Metadata } from "next";
import { ProductHelpRepository } from "@/modules/support/productHelp";
import { SupportCenterClient } from "./SupportCenterClient";
import { SUPPORT_ARTICLES, type SupportArticle, type SupportModuleId } from "./supportContent";

export const metadata: Metadata = {
  title: "Help Center | Qubere",
  description: "Search task-based help for Qubere customs brokerage workflows.",
};

export default async function SupportPage() {
  let articles: SupportArticle[] = SUPPORT_ARTICLES;
  if (process.env.DATABASE_URL) {
    try {
      const published = await ProductHelpRepository.listPublished();
      if (published.length > 0) {
        articles = published.map((article) => ({
          ...article,
          moduleId: article.moduleId as SupportModuleId,
        }));
      }
    } catch (error) {
      // A deploy remains usable between application rollout and migration/sync.
      // The API routes use the same reviewed code-owned fallback.
      console.warn("[product-help] database corpus unavailable; rendering code-owned corpus", error);
    }
  }

  return <SupportCenterClient initialArticles={articles} />;
}
