/**
 * Corroboration & Conflict Resolver — Shipment-Level Candidate Resolution Engine
 *
 * Compares hydration candidates across all documents in a multi-document shipment context.
 * Equal normalized values corroborate each other (boosts corroboration score).
 * Contradictory normalized values flag explicit CONFLICT / NEEDS_REVIEW states.
 */

import type { HydrationProposal } from "../types/canonicalRegistry";
import { calculateCalibratedScore } from "../validation/calibratedScoreCalculator";

export interface ResolvedCandidate {
  proposal: HydrationProposal;
  corroboratingDocumentIds: string[];
  corroborationScore: number;
  calibratedScore: number;
  status: "PROMOTED" | "NEEDS_REVIEW" | "CONFLICT" | "ABSTAINED";
  conflictReason?: string;
}

export class CorroborationConflictResolver {
  /**
   * Resolves candidates across multiple documents for a shipment packet.
   */
  public static resolveShipmentProposals(
    documentProposalsMap: Map<string, HydrationProposal[]>
  ): ResolvedCandidate[] {
    const allProposals: Array<{ documentId: string; proposal: HydrationProposal }> = [];

    for (const [docId, proposals] of documentProposalsMap.entries()) {
      for (const p of proposals) {
        allProposals.push({ documentId: docId, proposal: p });
      }
    }

    // Group proposals by targetFieldKey + targetEntityRef
    const grouped = new Map<string, Array<{ documentId: string; proposal: HydrationProposal }>>();
    for (const item of allProposals) {
      const groupKey = `${item.proposal.targetFieldKey}:${item.proposal.targetEntityRef || "default"}`;
      const list = grouped.get(groupKey) || [];
      list.push(item);
      grouped.set(groupKey, list);
    }

    const results: ResolvedCandidate[] = [];

    for (const [, items] of grouped.entries()) {
      if (items.length === 0) continue;

      const first = items[0];

      if (items.length === 1) {
        // Single document proposal
        const calibratedScore = calculateCalibratedScore({
          mappingConfidence: first.proposal.mappingConfidence,
          extractionConfidence: 95,
          validationScore: first.proposal.status === "PROPOSED" ? 100 : 0,
          corroborationScore: 0,
        });

        results.push({
          proposal: first.proposal,
          corroboratingDocumentIds: [first.documentId],
          corroborationScore: 0,
          calibratedScore,
          status: first.proposal.status === "PROPOSED" ? "PROMOTED" : "ABSTAINED",
        });
        continue;
      }

      // Multi-document proposals for the same key
      const normValues = items.map((i) =>
        String(i.proposal.proposedValue).trim().toLowerCase()
      );
      const uniqueNormValues = new Set(normValues);

      const docIds = Array.from(new Set(items.map((i) => i.documentId)));

      if (uniqueNormValues.size === 1) {
        // Corroboration requires > 1 distinct independent documents
        const isIndependentCorroboration = docIds.length > 1;
        const corroborationScore = isIndependentCorroboration ? 100 : 0;
        const calibratedScore = calculateCalibratedScore({
          mappingConfidence: first.proposal.mappingConfidence,
          extractionConfidence: 95,
          validationScore: 100,
          corroborationScore,
        });

        results.push({
          proposal: {
            ...first.proposal,
            mappingConfidence: isIndependentCorroboration
              ? Math.min(100, first.proposal.mappingConfidence + 5)
              : first.proposal.mappingConfidence,
            reasoning: isIndependentCorroboration
              ? `Corroborated by ${docIds.length} independent documents (${docIds.join(", ")}).`
              : `Single document proposal extracted from ${docIds.join(", ")}.`,
          },
          corroboratingDocumentIds: docIds,
          corroborationScore,
          calibratedScore,
          status: "PROMOTED",
        });
      } else {
        // Conflict! Independent documents report contradictory values.
        const _docIds = Array.from(new Set(items.map((i) => i.documentId)));
        const calibratedScore = calculateCalibratedScore({
          mappingConfidence: first.proposal.mappingConfidence,
          extractionConfidence: 95,
          validationScore: 100,
          corroborationScore: 0,
        });

        for (const item of items) {
          results.push({
            proposal: item.proposal,
            corroboratingDocumentIds: [item.documentId],
            corroborationScore: 0,
            calibratedScore,
            status: "CONFLICT",
            conflictReason: `Contradictory values observed across documents (${Array.from(uniqueNormValues).join(" vs ")}).`,
          });
        }
      }
    }

    return results;
  }
}
