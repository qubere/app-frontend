import { TmsHybridMemoryRetriever } from "./memory.retriever";
import type {
  ScoredTmsMemory,
  TmsAccountMemoryContext,
  TmsAgentTask,
  TmsMemoryScope,
} from "./memory.types";

export class TmsAccountContextBuilder {
  static async build(params: {
    accountId: string;
    task: TmsAgentTask;
    query?: string;
    scope?: TmsMemoryScope;
    limit?: number;
  }): Promise<TmsAccountMemoryContext> {
    let memories: ScoredTmsMemory[] = [];
    let retrievalStatus: TmsAccountMemoryContext["retrievalStatus"] = "EMPTY";
    try {
      memories = await TmsHybridMemoryRetriever.search(params);
      retrievalStatus = memories.length > 0 ? "AVAILABLE" : "EMPTY";
    } catch (error) {
      // Memory is derived context. A retrieval outage must not block freight execution.
      console.error("[TmsAccountContextBuilder] Retrieval failed; continuing without memory", error);
      retrievalStatus = "UNAVAILABLE";
    }
    return {
      accountId: params.accountId,
      task: params.task,
      memories,
      memoryCount: memories.length,
      formattedText: this.format(params.task, memories),
      retrievalStatus,
    };
  }

  private static format(task: TmsAgentTask, memories: ScoredTmsMemory[]): string {
    if (memories.length === 0) return `ACCOUNT OPERATING MEMORY (${task}): None relevant.`;
    const lines = [`ACCOUNT OPERATING MEMORY (${task}):`];
    memories.forEach((memory, index) => {
      const authority = memory.sourceType === "HUMAN_DECISION"
        ? "[HUMAN APPROVED]"
        : memory.sourceType === "CUSTOMER_INSTRUCTION"
          ? "[CUSTOMER INSTRUCTION]"
          : memory.sourceType === "TENDER_OUTCOME" || memory.sourceType === "INVOICE_AUDIT"
            ? "[VERIFIED OUTCOME]"
            : "[HISTORICAL SIGNAL]";
      lines.push(`${index + 1}. ${authority} ${memory.content} (${Math.round(memory.confidence * 100)}% confidence; ${memory.occurrenceCount} observation(s))`);
    });
    lines.push("Use memory to improve recommendations, but never override current shipment facts, safety rules, policy gates, or explicit human instructions.");
    return lines.join("\n");
  }

  static summarizeForEvidence(context: TmsAccountMemoryContext) {
    return context.memories.map((memory) => ({
      memoryId: memory.id,
      content: memory.content,
      sourceType: memory.sourceType,
      confidence: memory.confidence,
      score: memory.score,
      lexicalRank: memory.lexicalRank,
      vectorRank: memory.vectorRank,
      scopeMatches: memory.scopeMatches,
      scope: memory.scope,
      lastObservedAt: memory.lastObservedAt,
    }));
  }

  static carrierPreferenceAdjustment(
    context: TmsAccountMemoryContext,
    carrier: { carrierId: string; carrierName?: string | null; scac?: string | null }
  ): number {
    return Math.max(-20, Math.min(20, context.memories.reduce((total, memory) => {
      const scope = memory.scope;
      if (!scope) return total;
      const matches = scope.carrierId === carrier.carrierId ||
        (carrier.scac && scope.scac === carrier.scac) ||
        (carrier.carrierName && scope.carrierName === carrier.carrierName);
      if (!matches) return total;
      const outcome = scope.outcome;
      const multiplier = Math.min(3, memory.occurrenceCount);
      if (memory.sourceType === "HUMAN_DECISION" && outcome === "APPROVED") return total + 5 * multiplier;
      if (memory.sourceType === "HUMAN_DECISION" && outcome === "REJECTED") return total - 7 * multiplier;
      if (memory.sourceType === "TENDER_OUTCOME" && outcome === "ACCEPTED") return total + 3 * multiplier;
      if (memory.sourceType === "TENDER_OUTCOME" && (outcome === "REJECTED" || outcome === "EXPIRED")) return total - 3 * multiplier;
      return total;
    }, 0)));
  }

  static rememberedTargetMargin(context: TmsAccountMemoryContext): number | null {
    const memory = context.memories.find((item) =>
      item.sourceType === "HUMAN_DECISION" &&
      item.scope?.outcome === "APPROVED" &&
      typeof item.scope.targetMarginPct === "number" &&
      item.scope.targetMarginPct >= 0 && item.scope.targetMarginPct <= 95
    );
    const targetMarginPct = memory?.scope?.targetMarginPct;
    return typeof targetMarginPct === "number" ? targetMarginPct : null;
  }

  static rememberedIntakeDefaults(context: TmsAccountMemoryContext): {
    mode?: string;
    equipment?: string;
    serviceLevel?: string;
    incoterm?: string;
    customsRequired?: boolean;
  } {
    const memory = context.memories.find((item) =>
      item.sourceType === "HUMAN_DECISION" && item.scope?.outcome === "APPROVED"
    );
    if (!memory?.scope) return {};
    return {
      mode: typeof memory.scope.mode === "string" ? memory.scope.mode : undefined,
      equipment: typeof memory.scope.equipment === "string" ? memory.scope.equipment : undefined,
      serviceLevel: typeof memory.scope.serviceLevel === "string" ? memory.scope.serviceLevel : undefined,
      incoterm: typeof memory.scope.incoterm === "string" ? memory.scope.incoterm : undefined,
      customsRequired: typeof memory.scope.customsRequired === "boolean" ? memory.scope.customsRequired : undefined,
    };
  }
}
