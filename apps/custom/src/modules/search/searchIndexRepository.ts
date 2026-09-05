import { db } from "@/lib/db";
import { EMBEDDING_DIMENSIONS } from "@/modules/memory/memory.types";

/**
 * Cross-entity semantic index kinds. Business-operational kinds (higher
 * priority in merged omnibox results) come first; shared reference-data
 * kinds (rulings, HTS, sanctions lists, AD/CVD) come last -- they're global,
 * not tenant-scoped, and are surfaced as "suggestions" rather than exact
 * record jumps.
 */
export const SEARCH_INDEX_KINDS = [
  "shipment",
  "document",
  "person",
  "product",
  "importer",
  "party",
  "client",
  "ruling",
  "hts_node",
  "denied_party",
  "adcvd",
] as const;
export type SearchIndexKind = (typeof SEARCH_INDEX_KINDS)[number];

export interface SearchIndexUpsertInput {
  kind: SearchIndexKind;
  entityId: string;
  accountId: string | null;
  title: string;
  subtitle?: string | null;
  href: string;
  searchText: string;
  contentHash: string;
  embedding: number[];
}

export interface SearchIndexSuggestion {
  kind: SearchIndexKind;
  entityId: string;
  title: string;
  subtitle: string | null;
  href: string;
  similarity: number;
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((value) => (Number.isFinite(value) ? value : 0)).join(",")}]`;
}

export class SearchIndexRepository {
  /** contentHash of every currently-indexed row for a kind, keyed by entityId -- lets a refresh job skip re-embedding unchanged rows. */
  static async existingHashes(kind: SearchIndexKind): Promise<Map<string, string>> {
    const rows = await db.searchIndexEntry.findMany({
      where: { kind },
      select: { entityId: true, contentHash: true },
    });
    return new Map(rows.map((row) => [row.entityId, row.contentHash]));
  }

  static async upsert(input: SearchIndexUpsertInput): Promise<void> {
    const id = `${input.kind}:${input.entityId}`;
    await db.searchIndexEntry.upsert({
      where: { kind_entityId: { kind: input.kind, entityId: input.entityId } },
      update: {
        accountId: input.accountId,
        title: input.title,
        subtitle: input.subtitle ?? null,
        href: input.href,
        searchText: input.searchText,
        contentHash: input.contentHash,
        embedding: input.embedding,
      },
      create: {
        id,
        kind: input.kind,
        entityId: input.entityId,
        accountId: input.accountId,
        title: input.title,
        subtitle: input.subtitle ?? null,
        href: input.href,
        searchText: input.searchText,
        contentHash: input.contentHash,
        embedding: input.embedding,
      },
    });

    if (input.embedding.length === EMBEDDING_DIMENSIONS) {
      await db.$executeRaw`
        UPDATE "SearchIndexEntry"
        SET "embeddingVector" = ${toVectorLiteral(input.embedding)}::vector
        WHERE "kind" = ${input.kind} AND "entityId" = ${input.entityId}
      `;
    }
  }

  /** Drops index rows for a kind whose source entity no longer exists (hard-deleted, not soft-deleted -- callers pass the live id set). */
  static async pruneMissing(kind: SearchIndexKind, liveEntityIds: string[]): Promise<number> {
    const result = await db.searchIndexEntry.deleteMany({
      where: { kind, entityId: { notIn: liveEntityIds } },
    });
    return result.count;
  }

  /**
   * Vector-similarity suggestions across one or more kinds, scoped to an
   * account for tenant-owned kinds. Shared reference kinds (ruling/hts_node/
   * denied_party/adcvd) have `accountId IS NULL` and are matched regardless
   * of the caller's account.
   */
  static async vectorSuggestions(
    embedding: number[],
    limit: number,
    options: { accountId: string; kinds?: SearchIndexKind[] } = { accountId: "" }
  ): Promise<SearchIndexSuggestion[]> {
    if (embedding.length !== EMBEDDING_DIMENSIONS) return [];
    const vector = toVectorLiteral(embedding);
    const kindFilter = options.kinds && options.kinds.length > 0 ? options.kinds : null;

    const rows = await db.$queryRaw<
      Array<{ kind: string; entityId: string; title: string; subtitle: string | null; href: string; similarity: number }>
    >`
      SELECT "kind", "entityId", "title", "subtitle", "href",
             1 - ("embeddingVector" <=> ${vector}::vector) AS similarity
      FROM "SearchIndexEntry"
      WHERE "embeddingVector" IS NOT NULL
        AND ("accountId" = ${options.accountId} OR "accountId" IS NULL)
        AND (${kindFilter}::text[] IS NULL OR "kind" = ANY(${kindFilter}))
      ORDER BY "embeddingVector" <=> ${vector}::vector
      LIMIT ${limit}
    `;

    return rows
      .filter((row) => row.similarity > 0.55)
      .map((row) => ({
        kind: row.kind as SearchIndexKind,
        entityId: row.entityId,
        title: row.title,
        subtitle: row.subtitle,
        href: row.href,
        similarity: row.similarity,
      }));
  }
}
