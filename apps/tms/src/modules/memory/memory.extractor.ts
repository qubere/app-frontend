import { TmsHybridMemoryRetriever } from "./memory.retriever";
import { TmsMemoryRepository } from "./memory.repository";
import type { TmsMemoryCandidate, TmsMemoryRecord } from "./memory.types";

function sameRule(left: TmsMemoryRecord, right: TmsMemoryCandidate): boolean {
  return Boolean(
    left.scope?.ruleKey && right.scope?.ruleKey && left.scope.ruleKey === right.scope.ruleKey
  );
}

export class TmsMemoryExtractor {
  static async process(candidate: TmsMemoryCandidate): Promise<TmsMemoryRecord | null> {
    if (!candidate.accountId || !candidate.sourceId || !candidate.content.trim()) return null;
    try {
      const processed = await TmsMemoryRepository.findByEvidenceSource(
        candidate.accountId,
        candidate.sourceType,
        candidate.sourceId
      );
      if (processed) return processed;

      const existing = await TmsMemoryRepository.findActiveForSubject(
        candidate.accountId,
        candidate.task,
        candidate.subjectType,
        candidate.subjectId,
        30
      );
      const duplicate = existing.find((memory) =>
        memory.content === candidate.content &&
        JSON.stringify(memory.scope?.outcome ?? null) === JSON.stringify(candidate.scope?.outcome ?? null)
      );
      if (duplicate) return TmsMemoryRepository.reinforce(duplicate, candidate);

      const superseded = candidate.sourceType === "HUMAN_DECISION"
        ? existing.find((memory) => sameRule(memory, candidate) && memory.content !== candidate.content)
        : undefined;
      const embedding = await TmsHybridMemoryRetriever.embed(candidate.content);
      const created = await TmsMemoryRepository.create(candidate, embedding);
      if (superseded) await TmsMemoryRepository.supersede(candidate.accountId, superseded.id, created.id);
      return created;
    } catch (error) {
      // The worker is retried by Inngest. Core TMS writes never depend on this projection.
      console.error("[TmsMemoryExtractor] Failed to process candidate", error);
      throw error;
    }
  }
}
