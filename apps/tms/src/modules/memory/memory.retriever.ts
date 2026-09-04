import { GoogleGenAI } from "@google/genai";
import { TmsMemoryRepository } from "./memory.repository";
import { fuseTmsMemoryResults } from "./memory.scorer";
import { EMBEDDING_DIMENSIONS, TASK_SUBJECT_TYPES } from "./memory.types";
import type { ScoredTmsMemory, TmsMemorySearchQuery } from "./memory.types";

export function generateDeterministicEmbedding(text: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  const vector = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().trim();
  for (let index = 0; index < normalized.length; index++) {
    const charCode = normalized.charCodeAt(index);
    vector[(index * 31 + charCode) % dimensions] += Math.sin(charCode + index) * 0.1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export class TmsHybridMemoryRetriever {
  private static aiClient = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;

  static async embed(text: string): Promise<number[]> {
    if (!text.trim()) return [];
    if (this.aiClient) {
      try {
        const response = await this.aiClient.models.embedContent({
          model: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
          contents: text,
          config: { outputDimensionality: EMBEDDING_DIMENSIONS },
        });
        const payload = response as any;
        const values = payload.embedding?.values ?? payload.embeddings?.[0]?.values;
        if (Array.isArray(values) && values.length === EMBEDDING_DIMENSIONS) return values;
      } catch {
        // Fallback to lexical retrieval gracefully without console stack trace noise
        return [];
      }
    }
    return [];
  }

  static async search(params: TmsMemorySearchQuery): Promise<ScoredTmsMemory[]> {
    const subjectTypes = params.subjectTypes ?? TASK_SUBJECT_TYPES[params.task];
    const scopeTerms = Object.values(params.scope ?? {})
      .filter((value) => typeof value === "string" || typeof value === "number")
      .map(String);
    const query = [params.query ?? "", ...scopeTerms].filter(Boolean).join(" ").trim();
    const limit = params.limit ?? 8;

    if (!query) {
      const recent = await TmsMemoryRepository.findRecent(
        params.accountId,
        params.task,
        subjectTypes,
        limit * 2
      );
      return fuseTmsMemoryResults(recent, [], limit, params.scope);
    }

    const embedding = await this.embed(query);
    const [lexical, vector] = await Promise.all([
      TmsMemoryRepository.findLexicalMatches(params.accountId, query, params.task, subjectTypes, limit * 3),
      TmsMemoryRepository.findVectorMatches(params.accountId, embedding, params.task, subjectTypes, limit * 3),
    ]);
    return fuseTmsMemoryResults(lexical, vector, limit, params.scope);
  }
}
