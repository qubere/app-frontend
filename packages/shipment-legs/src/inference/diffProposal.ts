import { InferredLeg } from "./inferLegs";

export interface LegChangeProposal {
  type: "ADD" | "UPDATE" | "REMOVE" | "CHECKLIST_ADD";
  description: string;
  legSequence?: number;
  expectedDocType?: string;
  details?: Record<string, any>;
}

export interface JourneyDiffProposal {
  proposalId: string;
  shipmentId: string;
  confidence: number;
  changes: LegChangeProposal[];
  proposedLegs: InferredLeg[];
  createdAt: string;
}

export function generateDiffProposal(
  shipmentId: string,
  existingLegCount: number,
  inferredLegs: InferredLeg[],
  overallConfidence: number
): JourneyDiffProposal {
  const changes: LegChangeProposal[] = [];

  if (existingLegCount === 0) {
    inferredLegs.forEach((leg) => {
      changes.push({
        type: "ADD",
        description: `Add leg ${leg.sequence}: ${leg.legType} (${leg.mode}) ${leg.originName} → ${leg.destinationName}`,
        legSequence: leg.sequence,
        details: leg,
      });
    });
  } else if (inferredLegs.length > existingLegCount) {
    for (let i = existingLegCount; i < inferredLegs.length; i++) {
      const leg = inferredLegs[i];
      changes.push({
        type: "ADD",
        description: `Add leg ${leg.sequence}: ${leg.legType} (${leg.mode}) ${leg.originName} → ${leg.destinationName}`,
        legSequence: leg.sequence,
        details: leg,
      });
    }
  }

  return {
    proposalId: `prop-${Date.now()}`,
    shipmentId,
    confidence: overallConfidence,
    changes,
    proposedLegs: inferredLegs,
    createdAt: new Date().toISOString(),
  };
}
