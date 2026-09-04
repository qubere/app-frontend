import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";

export interface AutonomyPolicyConfig {
  // Core policy
  maxFinancialCommitment: number;
  minAutoConfidence: number;
  allowedAutoActions: string[];
  forbiddenAutoActions: string[];
  // TMS autonomy extensions
  autonomyMode: "SUPERVISED" | "BALANCED" | "AUTONOMOUS" | "CUSTOM";
  financialThreshold: number | null;
  marginThreshold: number | null;
  carrierApprovalRequired: boolean;
  requireInsurance: boolean;
  requireCustomsRelease: boolean;
  requireHumanApproval: boolean;
}

export const DEFAULT_AUTONOMY_POLICY: AutonomyPolicyConfig = {
  maxFinancialCommitment: 5000,
  minAutoConfidence: 80.0,
  // A missing tenant policy must never grant write authority. Accounts opt in
  // to individual autonomous actions through their AgentPolicyConfig row.
  allowedAutoActions: [],
  forbiddenAutoActions: [
    "CUSTOMS_HOLD_OVERRIDE",
    "UNVERIFIED_INVOICE_PAYMENT",
    "MANUAL_ENTRY_OVERRIDE",
  ],
  autonomyMode: "SUPERVISED",
  financialThreshold: 5000,
  marginThreshold: 10.0,
  carrierApprovalRequired: true,
  requireInsurance: true,
  requireCustomsRelease: true,
  requireHumanApproval: false,
};

/**
 * Loads the per-account, per-agent policy from DB (AgentPolicyConfig).
 * Falls back to a deny-by-default supervised policy when no DB row exists.
 * This service is TMS-specific; it must not inherit a permissive default from
 * the customs auto-approval implementation.
 */
export async function loadPolicyForAgent(
  ctx: AccountContext,
  agentName: string
): Promise<AutonomyPolicyConfig> {
  const row = await db.agentPolicyConfig
    ?.findUnique({
      where: {
        accountId_agentName: { accountId: ctx.accountId, agentName },
      },
    })
    .catch(() => null);

  if (!row) {
    return { ...DEFAULT_AUTONOMY_POLICY };
  }

  return {
    maxFinancialCommitment:
      row.financialThreshold != null
        ? Number(row.financialThreshold)
        : DEFAULT_AUTONOMY_POLICY.maxFinancialCommitment,
    minAutoConfidence: row.autoThreshold ?? DEFAULT_AUTONOMY_POLICY.minAutoConfidence,
    allowedAutoActions: Array.isArray(row.allowedAutoActions)
      ? row.allowedAutoActions.filter((value): value is string => typeof value === "string")
      : [],
    forbiddenAutoActions: Array.isArray(row.forbiddenAutoActions)
      ? row.forbiddenAutoActions.filter((value): value is string => typeof value === "string")
      : DEFAULT_AUTONOMY_POLICY.forbiddenAutoActions,
    autonomyMode:
      (row.autonomyMode as AutonomyPolicyConfig["autonomyMode"]) ?? "SUPERVISED",
    financialThreshold:
      row.financialThreshold != null ? Number(row.financialThreshold) : null,
    marginThreshold: row.marginThreshold != null ? Number(row.marginThreshold) : null,
    carrierApprovalRequired: row.carrierApprovalRequired ?? true,
    requireInsurance: row.requireInsurance ?? true,
    requireCustomsRelease: row.requireCustomsRelease ?? true,
    requireHumanApproval: row.requireHumanApproval ?? false,
  };
}

export interface EvaluatePolicyActionInput {
  actionType: string;
  financialAmount?: number;
  currency?: string;
  confidenceScore: number;
  requiredInputsPresent?: boolean;
  dataFresh?: boolean;
  reversible?: boolean;
  carrierApproved?: boolean;
  insuranceValid?: boolean;
  customsReleased?: boolean;
  grossMarginPct?: number;
  /** Pass to override DB lookup — used in tests */
  policyOverride?: Partial<AutonomyPolicyConfig>;
}

export interface PolicyEvaluation {
  allowed: boolean;
  reason: string;
  triageState: "AUTO_VERIFIED" | "NEEDS_HUMAN_REVIEW";
  gate?: string;
}

export function evaluatePolicyConfig(
  policy: AutonomyPolicyConfig,
  input: EvaluatePolicyActionInput
): PolicyEvaluation {
  const actionType = input.actionType.toUpperCase();
  const financialAmount = input.financialAmount ?? 0;
  const confidence = input.confidenceScore;

  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
    return {
      allowed: false,
      reason: "Confidence must be a finite value between 0 and 100.",
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "INVALID_CONFIDENCE",
    };
  }

  if (input.requiredInputsPresent === false) {
    return {
      allowed: false,
      reason: "Required operational inputs are missing.",
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "MISSING_REQUIRED_INPUT",
    };
  }

  if (input.dataFresh === false) {
    return {
      allowed: false,
      reason: "The evidence used for this action is stale.",
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "STALE_EVIDENCE",
    };
  }

  // Gate 0: SUPERVISED mode — never auto-execute
  if (policy.autonomyMode === "SUPERVISED") {
    return {
      allowed: false,
      reason: "Account is in SUPERVISED autonomy mode — all actions require human review.",
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "AUTONOMY_MODE_SUPERVISED",
    };
  }

  // Gate 1: Explicitly forbidden actions
  if (policy.forbiddenAutoActions.includes(actionType)) {
    return {
      allowed: false,
      reason: `Action '${actionType}' is explicitly forbidden from autonomous execution by tenant policy.`,
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "FORBIDDEN_ACTION",
    };
  }

  // Gate 2: Human approval required override
  if (policy.requireHumanApproval) {
    return {
      allowed: false,
      reason: "Agent policy requires human approval for all actions on this account.",
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "REQUIRE_HUMAN_APPROVAL",
    };
  }

  // Gate 3: Financial threshold
  const threshold = policy.financialThreshold ?? policy.maxFinancialCommitment;
  if (financialAmount > threshold) {
    return {
      allowed: false,
      reason: `Financial amount $${financialAmount.toFixed(2)} exceeds autonomy threshold of $${threshold.toFixed(2)}.`,
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "FINANCIAL_THRESHOLD",
    };
  }

  // Gate 4: AI confidence score
  if (confidence < policy.minAutoConfidence) {
    return {
      allowed: false,
      reason: `AI confidence ${confidence}% is below the minimum required ${policy.minAutoConfidence}%.`,
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "CONFIDENCE_THRESHOLD",
    };
  }

  // Gate 5: Every execution mode, including AUTONOMOUS, is constrained by an
  // explicit per-account action allowlist.
  if (!policy.allowedAutoActions.includes(actionType)) {
    return {
      allowed: false,
      reason: `Action '${actionType}' is not in the allowed auto-execution list for this account.`,
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "NOT_IN_ALLOWED_LIST",
    };
  }


  if (policy.carrierApprovalRequired && input.carrierApproved === false) {
    return {
      allowed: false,
      reason: "The selected carrier is not approved for autonomous execution.",
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "CARRIER_NOT_APPROVED",
    };
  }

  if (policy.requireInsurance && input.insuranceValid === false) {
    return {
      allowed: false,
      reason: "Valid carrier insurance is required for this action.",
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "INSURANCE_REQUIRED",
    };
  }

  if (policy.requireCustomsRelease && input.customsReleased === false) {
    return {
      allowed: false,
      reason: "Confirmed customs release is required for this action.",
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "CUSTOMS_RELEASE_REQUIRED",
    };
  }

  if (
    policy.marginThreshold != null &&
    input.grossMarginPct != null &&
    input.grossMarginPct < policy.marginThreshold
  ) {
    return {
      allowed: false,
      reason: `Gross margin ${input.grossMarginPct.toFixed(2)}% is below the configured ${policy.marginThreshold.toFixed(2)}% floor.`,
      triageState: "NEEDS_HUMAN_REVIEW",
      gate: "MARGIN_THRESHOLD",
    };
  }

  // Passed all policy gates → AUTO_VERIFIED
  return {
    allowed: true,
    reason: `Action '${actionType}' passed all autonomy policy gates (confidence ${confidence}%, amount $${financialAmount.toFixed(2)} <= $${threshold.toFixed(2)}).`,
    triageState: "AUTO_VERIFIED",
    gate: "ALL_GATES_PASSED",
  };
}

export async function evaluateAutonomyPolicy(
  ctx: AccountContext,
  input: EvaluatePolicyActionInput,
  agentName = "DEFAULT"
): Promise<PolicyEvaluation> {
  const loadedPolicy = input.policyOverride
    ? { ...DEFAULT_AUTONOMY_POLICY, ...input.policyOverride }
    : await loadPolicyForAgent(ctx, agentName);
  return evaluatePolicyConfig(loadedPolicy, input);
}
