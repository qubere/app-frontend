/**
 * Governed Promotion Policy Engine — Safety & Lock Evaluator
 *
 * Evaluates resolved hydration candidates against registry promotion policies,
 * calibrated decision scores, risk classes, and human lock constraints.
 *
 * Invariant #4: Human-locked values are NEVER automatically overwritten.
 * Invariant #7: Only allowlisted policies and materializers may promote values.
 * Invariant #11: Consequential fields enforce strict explicit source policies.
 */

import { db } from "@qubere/db";
import type { ResolvedCandidate } from "../resolution/corroborationConflictResolver";
import { CANONICAL_FIELD_REGISTRY_V1 } from "../registry/canonicalRegistryV1";
import { HydrationLogger } from "../logging/hydrationLogger";

export interface PromotionDecision {
  candidate: ResolvedCandidate;
  shouldPromote: boolean;
  reason: string;
  isHumanLocked: boolean;
}

export class PromotionPolicyEngine {
  /**
   * Evaluates a candidate for automatic promotion into canonical Fact and materialized structures.
   */
  public static async evaluateCandidate(
    shipmentId: string | undefined,
    resolvedCandidate: ResolvedCandidate,
    accountId?: string
  ): Promise<PromotionDecision> {
    const { proposal, status, calibratedScore } = resolvedCandidate;
    const fieldKey = proposal.targetFieldKey;

    HydrationLogger.info(`Evaluating candidate promotion for field ${fieldKey}`, {
      shipmentId,
      fieldKey,
      calibratedScore,
      status,
    });
    const definition = CANONICAL_FIELD_REGISTRY_V1[fieldKey];

    if (!definition) {
      return {
        candidate: resolvedCandidate,
        shouldPromote: false,
        reason: `FAIL_CLOSED: Definition for field '${fieldKey}' not found in registry.`,
        isHumanLocked: false,
      };
    }

    // 1. Invariant #4: Human Lock Protection Check (Tenant-scoped)
    if (shipmentId) {
      const factWhere: any = {
        shipmentId,
        field: (definition.materializerConfig.targetColumn as string) || fieldKey,
      };
      if (accountId) {
        factWhere.shipment = { accountId };
      }

      const existingFact = await db.fact.findFirst({
        where: factWhere,
        orderBy: { createdAt: "desc" },
      });

      if (existingFact && (existingFact.sourceType === "USER_ENTERED" || Boolean((existingFact as unknown as { isHumanLocked?: boolean }).isHumanLocked))) {
        return {
          candidate: resolvedCandidate,
          shouldPromote: false,
          reason: `HUMAN_LOCK_PROTECTION: Field '${fieldKey}' is locked by a human edit. Automatic promotion rejected.`,
          isHumanLocked: true,
        };
      }
    }

    // 2. Reject status CONFLICT or ABSTAINED
    if (status === "CONFLICT") {
      return {
        candidate: resolvedCandidate,
        shouldPromote: false,
        reason: `CONFLICT_REJECTED: Candidate has contradictory evidence across documents.`,
        isHumanLocked: false,
      };
    }

    if (proposal.status === "ABSTAINED") {
      return {
        candidate: resolvedCandidate,
        shouldPromote: false,
        reason: `ABSTAINED: ${proposal.abstainReason || "Proposal abstained from promotion."}`,
        isHumanLocked: false,
      };
    }

    // 3. Risk Class & Score Threshold Checks (Invariant #11)
    const isConsequential = definition.riskClass === "CONSEQUENTIAL";
    const minScoreThreshold = isConsequential ? 90.0 : 80.0;

    if (isConsequential && resolvedCandidate.corroborationScore === 0) {
      return {
        candidate: resolvedCandidate,
        shouldPromote: false,
        reason: `CONSEQUENTIAL_REQUIRES_REVIEW: Consequential risk field '${fieldKey}' requires multi-document corroboration or human review.`,
        isHumanLocked: false,
      };
    }

    if (calibratedScore < minScoreThreshold) {
      return {
        candidate: resolvedCandidate,
        shouldPromote: false,
        reason: `SCORE_TOO_LOW: Calibrated decision score (${calibratedScore}) is below required threshold (${minScoreThreshold}) for risk class '${definition.riskClass}'.`,
        isHumanLocked: false,
      };
    }

    // 4. Policy Rules Evaluation
    switch (definition.promotionPolicy) {
      case "EXPLICIT_SOURCE_POLICY_ONLY":
        if (isConsequential && proposal.evidenceReferences.length === 0) {
          return {
            candidate: resolvedCandidate,
            shouldPromote: false,
            reason: `EXPLICIT_POLICY: Consequential field '${fieldKey}' requires explicit grounded source evidence.`,
            isHumanLocked: false,
          };
        }
        break;

      case "REQUIRES_ENTITY_RESOLUTION":
        if (!proposal.proposedValue || String(proposal.proposedValue).trim() === "") {
          return {
            candidate: resolvedCandidate,
            shouldPromote: false,
            reason: `ENTITY_RESOLUTION: Legal entity name is empty.`,
            isHumanLocked: false,
          };
        }
        break;

      case "REQUIRES_HIGH_CONFIDENCE_OR_CORROBORATION":
        if (calibratedScore < 95.0 && resolvedCandidate.corroborationScore === 0) {
          return {
            candidate: resolvedCandidate,
            shouldPromote: false,
            reason: `REQUIRES_CORROBORATION: Score (${calibratedScore}) requires multi-document corroboration.`,
            isHumanLocked: false,
          };
        }
        break;
    }

    return {
      candidate: resolvedCandidate,
      shouldPromote: true,
      reason: `PROMOTED: Passed governed policy '${definition.promotionPolicy}' with calibrated score ${calibratedScore}.`,
      isHumanLocked: false,
    };
  }
}
