import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { HybridMemoryRetriever } from "@/modules/memory/memory.retriever";

const EMBEDDING_DIMENSIONS = 768;
const RRF_K = 60;

export interface ProductHelpArticleView {
  id: string;
  moduleId: string;
  question: string;
  answer: string;
  steps: string[];
  href?: string;
  actionLabel?: string;
  tags: string[];
  popular?: boolean;
}

export interface ProductHelpSuggestion {
  id: string;
  moduleId: string;
  question: string;
  href?: string;
}

type ProductHelpRow = {
  id: string;
  moduleId: string;
  question: string;
  answer: string;
  steps: Prisma.JsonValue;
  href: string | null;
  actionLabel: string | null;
  tags: string[];
  popular: boolean;
};

function stepsFromJson(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((step): step is string => typeof step === "string");
}

function toView(row: ProductHelpRow): ProductHelpArticleView {
  return {
    id: row.id,
    moduleId: row.moduleId,
    question: row.question,
    answer: row.answer,
    steps: stepsFromJson(row.steps),
    href: row.href ?? undefined,
    actionLabel: row.actionLabel ?? undefined,
    tags: row.tags,
    popular: row.popular,
  };
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((value) => (Number.isFinite(value) ? value : 0)).join(",")}]`;
}

async function hydrateRanked(ids: string[]): Promise<ProductHelpArticleView[]> {
  if (ids.length === 0) return [];
  const rows = await db.productHelpArticle.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
  });
  const byId = new Map(rows.map((row) => [row.id, toView(row)]));
  return ids.map((id) => byId.get(id)).filter((row): row is ProductHelpArticleView => Boolean(row));
}

export class ProductHelpRepository {
  static async listPublished(): Promise<ProductHelpArticleView[]> {
    const rows = await db.productHelpArticle.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ popular: "desc" }, { moduleId: "asc" }, { question: "asc" }],
    });
    return rows.map(toView);
  }

  /** Prefix/substring lookup only: autocomplete must never pay for an embedding call. */
  static async autocomplete(query: string, limit = 8): Promise<ProductHelpSuggestion[]> {
    const clean = query.trim();
    if (clean.length < 2) return [];
    const prefix = `${clean}%`;
    const contains = `%${clean}%`;
    const rows = await db.$queryRaw<Array<ProductHelpSuggestion & { href: string | null }>>`
      SELECT id, "moduleId", question, href
      FROM "ProductHelpArticle"
      WHERE status = 'PUBLISHED'
        AND (
          question ILIKE ${contains}
          OR EXISTS (
            SELECT 1 FROM unnest(aliases) AS alias
            WHERE alias ILIKE ${contains}
          )
        )
      ORDER BY
        CASE WHEN question ILIKE ${prefix} THEN 0 ELSE 1 END,
        "popular" DESC,
        length(question),
        question
      LIMIT ${limit}
    `;
    return rows.map((row) => ({ ...row, href: row.href ?? undefined }));
  }

  static async lexicalIds(query: string, limit: number, moduleId?: string): Promise<string[]> {
    const clean = query.trim();
    if (!clean) return [];
    const contains = `%${clean}%`;
    const moduleFilter = moduleId || null;
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "ProductHelpArticle"
      WHERE status = 'PUBLISHED'
        AND (${moduleFilter}::text IS NULL OR "moduleId" = ${moduleFilter})
        AND (
          "contentTsv" @@ websearch_to_tsquery('simple', ${clean})
          OR "searchText" ILIKE ${contains}
        )
      ORDER BY
        ts_rank("contentTsv", websearch_to_tsquery('simple', ${clean})) DESC,
        "popular" DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => row.id);
  }

  static async vectorIds(embedding: number[], limit: number, moduleId?: string): Promise<string[]> {
    if (embedding.length !== EMBEDDING_DIMENSIONS) return [];
    const vector = toVectorLiteral(embedding);
    const moduleFilter = moduleId || null;
    const rows = await db.$queryRaw<Array<{ id: string; similarity: number }>>`
      SELECT id, 1 - ("embeddingVector" <=> ${vector}::vector) AS similarity
      FROM "ProductHelpArticle"
      WHERE status = 'PUBLISHED'
        AND "embeddingVector" IS NOT NULL
        AND (${moduleFilter}::text IS NULL OR "moduleId" = ${moduleFilter})
      ORDER BY "embeddingVector" <=> ${vector}::vector
      LIMIT ${limit}
    `;
    return rows.filter((row) => row.similarity > 0.1).map((row) => row.id);
  }

  static async search(query: string, options: { limit?: number; moduleId?: string } = {}): Promise<ProductHelpArticleView[]> {
    const clean = query.trim();
    if (!clean) return [];
    const limit = Math.min(Math.max(options.limit ?? 8, 1), 20);
    const candidateLimit = limit * 3;
    const embedding = await HybridMemoryRetriever.embedQuery(clean);
    const [lexical, vector] = await Promise.all([
      this.lexicalIds(clean, candidateLimit, options.moduleId),
      this.vectorIds(embedding, candidateLimit, options.moduleId),
    ]);

    const scores = new Map<string, number>();
    lexical.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1.25 / (RRF_K + rank + 1)));
    vector.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank + 1)));
    const ids = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
    return hydrateRanked(ids);
  }

  /**
   * Fast path for interactive product help. Most broker questions use words
   * that exist in the reviewed guide, so avoid an embedding request unless
   * lexical search genuinely found nothing. The full hybrid search remains
   * the fallback for conceptual or differently worded questions.
   */
  static async searchInteractive(
    query: string,
    options: { limit?: number; moduleId?: string } = {}
  ): Promise<ProductHelpArticleView[]> {
    const clean = query.trim();
    if (!clean) return [];
    const limit = Math.min(Math.max(options.limit ?? 8, 1), 20);
    const lexical = await this.lexicalIds(clean, limit, options.moduleId);
    if (lexical.length > 0) return hydrateRanked(lexical);
    return this.search(clean, options);
  }

  static async upsert(input: {
    article: ProductHelpArticleView;
    aliases: string[];
    sourcePath: string;
    contentHash: string;
    searchText: string;
    embedding: number[];
  }): Promise<void> {
    const { article } = input;
    await db.productHelpArticle.upsert({
      where: { id: article.id },
      update: {
        moduleId: article.moduleId,
        question: article.question,
        answer: article.answer,
        steps: article.steps,
        href: article.href ?? null,
        actionLabel: article.actionLabel ?? null,
        tags: article.tags,
        aliases: input.aliases,
        popular: Boolean(article.popular),
        status: "PUBLISHED",
        sourcePath: input.sourcePath,
        contentHash: input.contentHash,
        searchText: input.searchText,
        embedding: input.embedding,
        publishedAt: new Date(),
      },
      create: {
        id: article.id,
        moduleId: article.moduleId,
        question: article.question,
        answer: article.answer,
        steps: article.steps,
        href: article.href ?? null,
        actionLabel: article.actionLabel ?? null,
        tags: article.tags,
        aliases: input.aliases,
        popular: Boolean(article.popular),
        status: "PUBLISHED",
        sourcePath: input.sourcePath,
        contentHash: input.contentHash,
        searchText: input.searchText,
        embedding: input.embedding,
      },
    });

    if (input.embedding.length === EMBEDDING_DIMENSIONS) {
      await db.$executeRaw`
        UPDATE "ProductHelpArticle"
        SET "embeddingVector" = ${toVectorLiteral(input.embedding)}::vector
        WHERE id = ${article.id}
      `;
    }
  }

  static async archiveMissing(activeIds: string[]): Promise<number> {
    const result = await db.productHelpArticle.updateMany({
      where: { id: { notIn: activeIds }, status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    });
    return result.count;
  }
}
