import type { ScoredTmsMemory, TmsMemoryRecord, TmsMemoryScope } from "./memory.types";

const SOURCE_WEIGHTS: Record<string, number> = {
  HUMAN_DECISION: 1.6,
  CUSTOMER_INSTRUCTION: 1.5,
  TENDER_OUTCOME: 1.3,
  INVOICE_AUDIT: 1.25,
  CARRIER_PERFORMANCE: 1.2,
  TRACKING_OUTCOME: 1.1,
  VERIFIED_DOCUMENT: 1.0,
  AGENT_INFERENCE: 0.55,
};

const TYPE_WEIGHTS: Record<string, number> = {
  PROCEDURE: 1.4,
  DECISION: 1.3,
  PREFERENCE: 1.25,
  EXCEPTION: 1.1,
  FACT: 1.0,
  PATTERN: 0.95,
};

const RRF_CONSTANT = 60;
const SCOPE_KEYS: Array<keyof TmsMemoryScope> = [
  "customerId", "carrierId", "scac", "laneKey", "mode", "equipment",
  "facilityId", "exceptionType", "chargeCode",
];

export function countScopeMatches(memoryScope: TmsMemoryScope | null, queryScope?: TmsMemoryScope): number {
  if (!memoryScope || !queryScope) return 0;
  return SCOPE_KEYS.reduce<number>((count, key) => {
    const expected = queryScope[key];
    const actual = memoryScope[key];
    return expected != null && actual != null && String(expected) === String(actual) ? count + 1 : count;
  }, 0);
}

export function fuseTmsMemoryResults(
  lexicalResults: TmsMemoryRecord[],
  vectorResults: TmsMemoryRecord[],
  limit = 10,
  queryScope?: TmsMemoryScope
): ScoredTmsMemory[] {
  const ranked = new Map<string, {
    memory: TmsMemoryRecord;
    lexicalRank: number | null;
    vectorRank: number | null;
    rrfScore: number;
  }>();

  lexicalResults.forEach((memory, index) => {
    ranked.set(memory.id, { memory, lexicalRank: index + 1, vectorRank: null, rrfScore: 1 / (RRF_CONSTANT + index + 1) });
  });
  vectorResults.forEach((memory, index) => {
    const current = ranked.get(memory.id) ?? { memory, lexicalRank: null, vectorRank: null, rrfScore: 0 };
    current.vectorRank = index + 1;
    current.rrfScore += 1 / (RRF_CONSTANT + index + 1);
    ranked.set(memory.id, current);
  });

  const now = Date.now();
  return [...ranked.values()]
    .map(({ memory, lexicalRank, vectorRank, rrfScore }) => {
      const ageDays = Math.max(0, (now - new Date(memory.lastObservedAt ?? memory.validFrom).getTime()) / 86_400_000);
      const ageDecay = 1 / (1 + ageDays / 365);
      const scopeMatches = countScopeMatches(memory.scope, queryScope);
      const scopeBoost = 1 + Math.min(0.75, scopeMatches * 0.15);
      const reinforcementBoost = 1 + Math.min(0.25, Math.log2(Math.max(1, memory.occurrenceCount)) * 0.05);
      const score = rrfScore *
        (SOURCE_WEIGHTS[memory.sourceType] ?? 1) *
        (TYPE_WEIGHTS[memory.type] ?? 1) *
        memory.confidence * ageDecay * scopeBoost * reinforcementBoost;
      return { ...memory, lexicalRank, vectorRank, rrfScore, scopeMatches, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
