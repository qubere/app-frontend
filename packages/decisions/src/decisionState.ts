/**
 * Decision status vocabulary.
 *
 * Agents wrote whichever string felt right — "Needs Review", "Review Required",
 * "Attention", blocked sentinels — resulting in four readers that each guessed
 * differently.  Every literal the codebase has ever written normalizes here.
 */

export const DECISION_STATES = [
  "NEEDS_REVIEW",
  "AUTO_VERIFIED",
  "BLOCKED",
  "APPROVED",
  "REJECTED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export type DecisionState = (typeof DECISION_STATES)[number];

/** States where a human action is still expected. */
export const ACTIONABLE_DECISION_STATES: readonly DecisionState[] = [
  "NEEDS_REVIEW",
  "BLOCKED",
];

/** States where no further human action is needed. */
export const TERMINAL_DECISION_STATES: readonly DecisionState[] = [
  "AUTO_VERIFIED",
  "APPROVED",
  "REJECTED",
];

/** Separators are dropped so "Needs Review", "NEEDS_REVIEW", "needsreview" all map. */
function collapse(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Every raw literal this codebase has ever written paired with its canonical state. */
const STATUS_ALIASES: [string, DecisionState][] = [
  // Canonical names
  ["NEEDS_REVIEW", "NEEDS_REVIEW"],
  ["AUTO_VERIFIED", "AUTO_VERIFIED"],
  ["BLOCKED", "BLOCKED"],
  ["APPROVED", "APPROVED"],
  ["REJECTED", "REJECTED"],
  ["IN_PROGRESS", "IN_PROGRESS"],
  ["COMPLETED", "COMPLETED"],

  // Legacy strings written by agents
  ["Needs Review", "NEEDS_REVIEW"],
  ["Review Required", "NEEDS_REVIEW"],
  ["Attention", "NEEDS_REVIEW"],
  ["Pending", "NEEDS_REVIEW"],

  // Agent blocked sentinels written to proposedDescription / status
  ["BLOCKED_DEPENDENCY", "BLOCKED"],
  ["WAITING_FOR_EXTRACTION", "BLOCKED"],
  ["BLOCKED_MISSING_DESCRIPTION", "BLOCKED"],

  // Skipped/Paused are effectively BLOCKED: the agent did not act
  ["Skipped", "BLOCKED"],
  ["Skipped - Missing Invoice Data", "BLOCKED"],
  ["Paused", "BLOCKED"],

  // Pipeline-level aggregate — distinct from per-decision APPROVED
  ["COMPLETED_NO_ACTION", "COMPLETED"],

  // Legacy approval strings
  ["Auto-Approved", "AUTO_VERIFIED"],
  ["Verified", "AUTO_VERIFIED"],
];

/** Collapsed-key lookup for normalizeDecisionStatus. */
const RAW_TO_STATE = new Map<string, DecisionState>(
  STATUS_ALIASES.map(([raw, state]) => [collapse(raw), state])
);

export function normalizeDecisionStatus(raw: string | null | undefined): DecisionState | null {
  if (typeof raw !== "string") return null;
  return RAW_TO_STATE.get(collapse(raw)) ?? null;
}

export function isActionableDecisionState(state: DecisionState): boolean {
  return ACTIONABLE_DECISION_STATES.includes(state);
}

export function isTerminalDecisionState(state: DecisionState): boolean {
  return TERMINAL_DECISION_STATES.includes(state);
}

export function isAutoVerified(state: DecisionState): boolean {
  return state === "AUTO_VERIFIED";
}

export function isHumanApproved(state: DecisionState): boolean {
  return state === "APPROVED";
}

export function actionableStatusVariants(): string[] {
  const variants = new Set<string>();
  for (const [raw, state] of STATUS_ALIASES) {
    if (isActionableDecisionState(state)) variants.add(raw);
  }
  return [...variants];
}

export const ACTIONABLE_TRIAGE_STATES: readonly DecisionState[] = [
  "NEEDS_REVIEW",
  "BLOCKED",
];

export type TriageCategory = "blocked" | "review" | "verified";

export function triageDecision(decision: {
  status: string;
  triageState?: string | null;
  proposedDescription?: string | null;
  reviewedByUserId?: string | null;
}): TriageCategory {
  if (decision.triageState) {
    const ts = decision.triageState;
    if (ts === "BLOCKED" || ts === "REJECTED") return "blocked";
    if (ts === "APPROVED" || ts === "AUTO_VERIFIED" || ts === "COMPLETED" || ts === "IN_PROGRESS") {
      return "verified";
    }
    if (ts === "NEEDS_REVIEW") return "review";
  }

  if (
    decision.proposedDescription === "BLOCKED_DEPENDENCY" ||
    decision.proposedDescription === "WAITING_FOR_EXTRACTION" ||
    decision.proposedDescription === "BLOCKED_MISSING_DESCRIPTION"
  ) {
    return "blocked";
  }

  const state = normalizeDecisionStatus(decision.status);

  if (!state) return "review";

  if (state === "BLOCKED") return "blocked";
  if (state === "REJECTED") return "blocked";
  if (state === "APPROVED" || state === "AUTO_VERIFIED" || state === "COMPLETED" || state === "IN_PROGRESS") {
    return "verified";
  }

  return "review";
}

export function decisionStateLabel(state: DecisionState): string {
  switch (state) {
    case "NEEDS_REVIEW": return "Needs Review";
    case "AUTO_VERIFIED": return "Auto-Verified";
    case "BLOCKED": return "Blocked";
    case "APPROVED": return "Approved";
    case "REJECTED": return "Rejected";
    case "IN_PROGRESS": return "In Progress";
    case "COMPLETED": return "Completed";
  }
}

export function statusVariantsForState(targetState: DecisionState): string[] {
  const variants = new Set<string>();
  for (const [raw, state] of STATUS_ALIASES) {
    if (state === targetState) variants.add(raw);
  }
  return [...variants];
}

export function statusVariantsForStates(states: DecisionState[]): string[] {
  const variants = new Set<string>();
  for (const [raw, state] of STATUS_ALIASES) {
    if (states.includes(state)) variants.add(raw);
  }
  return [...variants];
}

export function getActionableDecisionWhereFilter() {
  return {
    OR: [
      { triageState: { in: [...ACTIONABLE_TRIAGE_STATES] } },
      { triageState: null, status: { in: actionableStatusVariants() } },
    ],
  };
}

export function getAllReviewableDecisionWhereFilter() {
  return {
    OR: [
      { triageState: { in: [...DECISION_STATES] } },
      { triageState: null, status: { in: statusVariantsForStates([...DECISION_STATES]) } },
    ],
  };
}
