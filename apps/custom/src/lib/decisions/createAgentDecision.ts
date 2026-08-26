import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Creates an AgentDecision row.
 *
 * Idempotent by (accountId, shipmentId, documentId, agentName, lineNumber,
 * decisionSummary, status): every agent step in PipelineOrchestrator can be
 * re-invoked for the same underlying event (a pipeline retry, a reattach, an
 * upstream retry after a partial failure) and, when nothing about the
 * shipment actually changed since the last run, produces byte-identical
 * decision content -- most visibly the gated/blocked-path decisions
 * ("Missing country of origin", "Missing Commercial Invoice", etc.), which
 * fire on every re-run of a shipment stuck missing the same prerequisite.
 * Without a check here, each re-run piles another identical row into the
 * Decisions/Actions inbox instead of leaving the one that's still open.
 *
 * The fingerprint intentionally includes `status`: a decision only counts as
 * "the same still-open finding" when it hasn't been reviewed yet and the new
 * write would leave it in the same status. Once a human approves/rejects a
 * decision (status changes away from what a fresh run would write) or the
 * agent's output genuinely changes (different decisionSummary -- a new
 * confidence, a different proposed code), this intentionally does NOT match,
 * so a legitimately new proposal always gets its own row for review.
 */
export async function createAgentDecision(args: {
  data: Prisma.AgentDecisionUncheckedCreateInput | Prisma.AgentDecisionCreateInput;
}) {
  const uncheckedData = args.data as Prisma.AgentDecisionUncheckedCreateInput;
  const existing = await db.agentDecision.findFirst({
    where: {
      accountId: uncheckedData.accountId,
      shipmentId: uncheckedData.shipmentId ?? null,
      documentId: uncheckedData.documentId ?? null,
      agentName: uncheckedData.agentName,
      lineNumber: uncheckedData.lineNumber ?? null,
      decisionSummary: uncheckedData.decisionSummary,
      status: uncheckedData.status ?? undefined,
    },
  });
  if (existing) return existing;

  return db.agentDecision.create(args);
}
