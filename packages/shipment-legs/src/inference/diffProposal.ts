import type { InferredLeg } from "./inferLegs";

export interface ExistingLegSnapshot {
  id: string;
  sequence: number;
  legType: string;
  mode: string;
  originName: string;
  destinationName: string;
  confirmedAt: Date | string | null;
  actualDeparture: Date | string | null;
  actualArrival: Date | string | null;
}

export interface LegChangeProposal {
  type: "ADD" | "UPDATE" | "REMOVE" | "NOTE";
  description: string;
  legSequence?: number;
  legId?: string;
  details?: Record<string, unknown>;
}

export interface JourneyDiffProposal {
  shipmentId: string;
  inputsHash: string;
  confidence: number;
  /** True when there is at least one actionable change. */
  hasChanges: boolean;
  changes: LegChangeProposal[];
  proposedLegs: InferredLeg[];
  createdAtIso: string;
}

/**
 * Compare the legs already on the shipment with a fresh inference and describe
 * the delta. Legs that already have real tracking actuals are never proposed
 * for change — only downstream additions.
 */
export function generateDiffProposal(
  shipmentId: string,
  createdAtIso: string,
  existingLegs: ExistingLegSnapshot[],
  inference: { inputsHash: string; legs: InferredLeg[]; overallConfidence: number }
): JourneyDiffProposal {
  const changes: LegChangeProposal[] = [];
  const inferred = inference.legs;
  const frozen = existingLegs.some((l) => l.actualDeparture || l.actualArrival);

  if (existingLegs.length === 0) {
    inferred.forEach((leg) => {
      changes.push({
        type: "ADD",
        legSequence: leg.sequence,
        description: `Add leg ${leg.sequence}: ${leg.legType.replace(/_/g, " ").toLowerCase()} (${leg.mode.toLowerCase()}) — ${leg.originName} → ${leg.destinationName}`,
        details: { leg },
      });
    });
  } else if (frozen) {
    // Only append legs beyond what exists; never rewrite a leg mid-transit.
    for (let i = existingLegs.length; i < inferred.length; i++) {
      const leg = inferred[i];
      changes.push({
        type: "ADD",
        legSequence: leg.sequence,
        description: `Add leg ${leg.sequence}: ${leg.legType.replace(/_/g, " ").toLowerCase()} (${leg.mode.toLowerCase()}) — ${leg.originName} → ${leg.destinationName}`,
        details: { leg },
      });
    }
    if (inferred.length <= existingLegs.length) {
      changes.push({
        type: "NOTE",
        description: "Route already has tracking actuals — no downstream legs to add from the current documents.",
      });
    }
  } else {
    // Unfrozen: reconcile position-by-position.
    const max = Math.max(existingLegs.length, inferred.length);
    for (let i = 0; i < max; i++) {
      const cur = existingLegs[i];
      const next = inferred[i];
      if (cur && !next) {
        changes.push({
          type: "REMOVE",
          legSequence: cur.sequence,
          legId: cur.id,
          description: `Remove leg ${cur.sequence}: ${cur.legType.replace(/_/g, " ").toLowerCase()} — ${cur.originName} → ${cur.destinationName} (no longer supported by documents)`,
        });
      } else if (!cur && next) {
        changes.push({
          type: "ADD",
          legSequence: next.sequence,
          description: `Add leg ${next.sequence}: ${next.legType.replace(/_/g, " ").toLowerCase()} (${next.mode.toLowerCase()}) — ${next.originName} → ${next.destinationName}`,
          details: { leg: next },
        });
      } else if (cur && next) {
        const diffs: string[] = [];
        if (cur.legType !== next.legType) diffs.push(`type ${cur.legType} → ${next.legType}`);
        if (cur.mode !== next.mode) diffs.push(`mode ${cur.mode} → ${next.mode}`);
        if (cur.destinationName !== next.destinationName && !cur.confirmedAt) {
          diffs.push(`destination "${cur.destinationName}" → "${next.destinationName}"`);
        }
        if (diffs.length > 0) {
          changes.push({
            type: "UPDATE",
            legSequence: cur.sequence,
            legId: cur.id,
            description: `Update leg ${cur.sequence}: ${diffs.join(", ")}`,
            details: { leg: next },
          });
        }
      }
    }
  }

  const actionable = changes.filter((c) => c.type !== "NOTE");

  return {
    shipmentId,
    inputsHash: inference.inputsHash,
    confidence: inference.overallConfidence,
    hasChanges: actionable.length > 0,
    changes,
    proposedLegs: inferred,
    createdAtIso,
  };
}
