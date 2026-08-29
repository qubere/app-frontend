import { db } from "@/lib/db";
import { computeAutoAssignment } from "./autoRoute";

/**
 * Work-item lifecycle hooks (WM-S-03 / WM-S-04).
 *
 * Called once, right after a NEEDS_REVIEW AgentDecision or an Open
 * ExceptionItem is created, to:
 *   1. stamp the review SLA due date (from SlaPolicy, else a built-in default), and
 *   2. auto-route the item to the client's assigned owner / team, if any.
 *
 * Both operations are best-effort: a failure here must never block decision
 * or exception creation, so every caller wraps this in try/catch.
 */

type WorkKind = "decision" | "exception";
type Priority = "critical" | "high" | "normal";

const DEFAULT_SLA_HOURS: Record<WorkKind, Record<Priority, number>> = {
  decision: { critical: 4, high: 12, normal: 48 },
  exception: { critical: 6, high: 18, normal: 72 },
};

async function resolveSlaHours(
  accountId: string,
  workKind: WorkKind,
  priority: Priority
): Promise<number> {
  const exact = await db.slaPolicy.findFirst({
    where: { accountId, workKind, priority },
  });
  if (exact) return exact.reviewHours;

  const anyPriority = await db.slaPolicy.findFirst({
    where: { accountId, workKind, priority: null },
  });
  if (anyPriority) return anyPriority.reviewHours;

  return DEFAULT_SLA_HOURS[workKind][priority];
}

function decisionPriority(triageState: string | null): Priority {
  return triageState === "BLOCKED" ? "critical" : "high";
}

const EXCEPTION_SEVERITY_PRIORITY: Record<string, Priority> = {
  Critical: "critical",
  High: "high",
  Medium: "normal",
  Low: "normal",
};

export async function initializeDecisionWorkItem(decisionId: string): Promise<void> {
  const d = await db.agentDecision.findUnique({
    where: { id: decisionId },
    select: {
      id: true,
      accountId: true,
      shipmentId: true,
      triageState: true,
      assignedToUserId: true,
      reviewSlaDueAt: true,
    },
  });
  if (!d) return;
  // Only items that actually wait on a human get an SLA clock / routing.
  if (d.triageState !== "NEEDS_REVIEW" && d.triageState !== "BLOCKED") return;

  const patch: Record<string, unknown> = {};

  if (!d.reviewSlaDueAt) {
    const hours = await resolveSlaHours(d.accountId, "decision", decisionPriority(d.triageState));
    patch.reviewSlaDueAt = new Date(Date.now() + hours * 3_600_000);
  }

  if (!d.assignedToUserId && d.shipmentId) {
    const route = await computeAutoAssignment(d.shipmentId, d.accountId);
    if (route.assignedToUserId) {
      patch.assignedToUserId = route.assignedToUserId;
      patch.assignmentSource = route.assignmentSource;
      patch.assignedAt = new Date();
      patch.assignedBy = "SYSTEM";
    }
  }

  if (Object.keys(patch).length > 0) {
    await db.agentDecision.update({ where: { id: d.id }, data: patch });
  }
}

export async function initializeExceptionWorkItem(exceptionId: string): Promise<void> {
  const e = await db.exceptionItem.findUnique({
    where: { id: exceptionId },
    select: {
      id: true,
      accountId: true,
      shipmentId: true,
      severity: true,
      status: true,
      assignedToUserId: true,
      slaDueAt: true,
    },
  });
  if (!e) return;
  if (e.status !== "Open") return;

  const priority = EXCEPTION_SEVERITY_PRIORITY[e.severity] ?? "normal";
  const patch: Record<string, unknown> = {};

  if (!e.slaDueAt) {
    const hours = await resolveSlaHours(e.accountId, "exception", priority);
    patch.slaDueAt = new Date(Date.now() + hours * 3_600_000);
  }

  if (!e.assignedToUserId && e.shipmentId) {
    const route = await computeAutoAssignment(e.shipmentId, e.accountId);
    if (route.assignedToUserId) {
      patch.assignedToUserId = route.assignedToUserId;
      patch.assignmentSource = route.assignmentSource;
      patch.assignedAt = new Date();
    }
  }

  if (Object.keys(patch).length > 0) {
    await db.exceptionItem.update({ where: { id: e.id }, data: patch });
  }
}
