import { db } from "@qubere/db";
import { EMBEDDING_DIMENSIONS } from "./memory.types";
import type {
  TmsAgentTask,
  TmsMemoryCandidate,
  TmsMemoryRecord,
  TmsMemorySubjectType,
} from "./memory.types";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((value) => Number.isFinite(value) ? value : 0).join(",")}]`;
}

export class TmsMemoryRepository {
  static async create(candidate: TmsMemoryCandidate, embedding: number[]): Promise<TmsMemoryRecord> {
    const observedAt = candidate.observedAt ? new Date(candidate.observedAt) : new Date();
    const eventKey = `TMS:${candidate.accountId}:${candidate.sourceId}`;
    let memory: { id: string };
    try {
      memory = await db.$transaction(async (tx) => {
        const created = await tx.accountMemory.create({
          data: {
            accountId: candidate.accountId,
            domain: "TMS",
            task: candidate.task,
            agentName: candidate.agentName ?? null,
            type: candidate.type,
            subjectType: candidate.subjectType,
            subjectId: candidate.subjectId ?? null,
            content: candidate.content,
            confidence: candidate.confidence,
            validFrom: observedAt,
            sourceType: candidate.sourceType,
            sourceId: candidate.sourceId,
            eventKey,
            embedding,
            searchVector: [candidate.content, candidate.subjectId, ...Object.values(candidate.scope ?? {})]
              .filter((value) => typeof value === "string" || typeof value === "number")
              .join(" ")
              .toLowerCase(),
            scope: (candidate.scope ?? {}) as any,
            lastObservedAt: observedAt,
          },
        });
        await tx.memoryEvidence.create({
          data: {
            accountId: candidate.accountId,
            memoryId: created.id,
            sourceType: candidate.sourceType,
            sourceId: candidate.sourceId,
            eventKey,
            excerpt: candidate.evidenceExcerpt,
            confidence: candidate.confidence,
          },
        });
        if (embedding.length === EMBEDDING_DIMENSIONS) {
          await tx.$executeRaw`
            UPDATE "AccountMemory"
            SET "embeddingVector" = ${toVectorLiteral(embedding)}::vector
            WHERE id = ${created.id} AND "accountId" = ${candidate.accountId}
          `;
        }
        return created;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        const existing = await this.findByEventKey(candidate.accountId, eventKey);
        if (existing) return existing;
      }
      throw error;
    }

    return this.findById(candidate.accountId, memory.id) as Promise<TmsMemoryRecord>;
  }

  static async findById(accountId: string, id: string): Promise<TmsMemoryRecord | null> {
    const memory = await db.accountMemory.findFirst({
      where: { id, accountId, domain: "TMS" },
      include: { evidence: true },
    });
    return memory as unknown as TmsMemoryRecord | null;
  }

  static async findByEventKey(accountId: string, eventKey: string): Promise<TmsMemoryRecord | null> {
    const memory = await db.accountMemory.findFirst({
      where: { accountId, domain: "TMS", eventKey },
      include: { evidence: true },
    });
    if (memory) return memory as unknown as TmsMemoryRecord;
    const evidence = await db.memoryEvidence.findFirst({ where: { accountId, eventKey } });
    return evidence ? this.findById(accountId, evidence.memoryId) : null;
  }

  static async findByEvidenceSource(accountId: string, sourceType: string, sourceId: string) {
    const byEventKey = await this.findByEventKey(accountId, `TMS:${accountId}:${sourceId}`);
    if (byEventKey) return byEventKey;
    const evidence = await db.memoryEvidence.findFirst({
      where: { accountId, sourceType: sourceType as any, sourceId },
      orderBy: { createdAt: "desc" },
    });
    return evidence ? this.findById(accountId, evidence.memoryId) : null;
  }

  static async reinforce(memory: TmsMemoryRecord, candidate: TmsMemoryCandidate): Promise<TmsMemoryRecord> {
    await db.$transaction([
      db.memoryEvidence.create({
        data: {
          accountId: candidate.accountId,
          memoryId: memory.id,
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          eventKey: `TMS:${candidate.accountId}:${candidate.sourceId}`,
          excerpt: candidate.evidenceExcerpt,
          confidence: candidate.confidence,
        },
      }),
      db.accountMemory.update({
        where: { id: memory.id, accountId: candidate.accountId },
        data: {
          confidence: Math.max(memory.confidence, candidate.confidence),
          occurrenceCount: { increment: 1 },
          lastObservedAt: candidate.observedAt ? new Date(candidate.observedAt) : new Date(),
        },
      }),
    ]);
    return this.findById(candidate.accountId, memory.id) as Promise<TmsMemoryRecord>;
  }

  static async supersede(accountId: string, oldMemoryId: string, newMemoryId: string): Promise<void> {
    const now = new Date();
    await db.$transaction([
      db.accountMemory.update({ where: { id: oldMemoryId, accountId }, data: { validUntil: now } }),
      db.accountMemory.update({ where: { id: newMemoryId, accountId }, data: { supersedesMemoryId: oldMemoryId } }),
    ]);
  }

  static async findActiveForSubject(
    accountId: string,
    task: TmsAgentTask,
    subjectType: TmsMemorySubjectType,
    subjectId?: string | null,
    limit = 25
  ): Promise<TmsMemoryRecord[]> {
    const memories = await db.accountMemory.findMany({
      where: {
        accountId,
        domain: "TMS",
        task,
        subjectType,
        ...(subjectId ? { subjectId } : {}),
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      include: { evidence: true },
      orderBy: { lastObservedAt: "desc" },
      take: limit,
    });
    return memories as unknown as TmsMemoryRecord[];
  }

  private static async hydrate(accountId: string, ids: string[]): Promise<TmsMemoryRecord[]> {
    if (ids.length === 0) return [];
    const memories = await db.accountMemory.findMany({
      where: { accountId, domain: "TMS", id: { in: ids } },
      include: { evidence: true },
    });
    const byId = new Map(memories.map((memory) => [memory.id, memory as unknown as TmsMemoryRecord]));
    return ids.map((id) => byId.get(id)).filter((memory): memory is TmsMemoryRecord => Boolean(memory));
  }

  static async findLexicalMatches(
    accountId: string,
    query: string,
    task: TmsAgentTask,
    subjectTypes: TmsMemorySubjectType[],
    limit: number
  ): Promise<TmsMemoryRecord[]> {
    if (!query.trim()) return [];
    const tokens = query.trim().split(/\s+/).filter((token) => token.length > 1).slice(0, 24);
    if (tokens.length === 0) return [];
    const webQuery = tokens.map((token) => `"${token.replaceAll('"', '')}"`).join(" OR ");
    const likeTerms = tokens.map((token) => `%${token}%`);
    const ids = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "AccountMemory"
      WHERE "accountId" = ${accountId}
        AND domain = 'TMS'::"AccountMemoryDomain"
        AND task = ${task}
        AND ("validUntil" IS NULL OR "validUntil" > now())
        AND "subjectType"::text = ANY(${subjectTypes}::text[])
        AND (
          "contentTsv" @@ websearch_to_tsquery('simple', ${webQuery})
          OR content ILIKE ANY(${likeTerms}::text[])
          OR "subjectId" ILIKE ANY(${likeTerms}::text[])
          OR COALESCE(scope::text, '') ILIKE ANY(${likeTerms}::text[])
        )
      ORDER BY ts_rank("contentTsv", websearch_to_tsquery('simple', ${webQuery})) DESC,
               "lastObservedAt" DESC
      LIMIT ${limit}
    `;
    return this.hydrate(accountId, ids.map(({ id }) => id));
  }

  static async findVectorMatches(
    accountId: string,
    embedding: number[],
    task: TmsAgentTask,
    subjectTypes: TmsMemorySubjectType[],
    limit: number
  ): Promise<TmsMemoryRecord[]> {
    if (embedding.length !== EMBEDDING_DIMENSIONS) return [];
    const vector = toVectorLiteral(embedding);
    const rows = await db.$queryRaw<Array<{ id: string; similarity: number }>>`
      SELECT id, 1 - ("embeddingVector" <=> ${vector}::vector) AS similarity
      FROM "AccountMemory"
      WHERE "accountId" = ${accountId}
        AND domain = 'TMS'::"AccountMemoryDomain"
        AND task = ${task}
        AND "embeddingVector" IS NOT NULL
        AND ("validUntil" IS NULL OR "validUntil" > now())
        AND "subjectType"::text = ANY(${subjectTypes}::text[])
      ORDER BY "embeddingVector" <=> ${vector}::vector
      LIMIT ${limit}
    `;
    return this.hydrate(accountId, rows.filter(({ similarity }) => similarity > 0.1).map(({ id }) => id));
  }

  static async findRecent(
    accountId: string,
    task: TmsAgentTask,
    subjectTypes: TmsMemorySubjectType[],
    limit: number
  ): Promise<TmsMemoryRecord[]> {
    const memories = await db.accountMemory.findMany({
      where: {
        accountId,
        domain: "TMS",
        task,
        subjectType: { in: subjectTypes },
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      include: { evidence: true },
      orderBy: [{ lastObservedAt: "desc" }, { confidence: "desc" }],
      take: limit,
    });
    return memories as unknown as TmsMemoryRecord[];
  }
}
