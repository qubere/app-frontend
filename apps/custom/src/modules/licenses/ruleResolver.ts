// Canonical rule-routing/evaluation core for License Determination (prompt
// sections 9-21). Deterministic only -- no LLM/AI call may influence any
// value returned from here (prompt's hard constraint). Given that no
// jurisdiction-specific regulatory rule datasets are ingested in this repo
// (see schema.prisma's comment above LicenseDeterminationStatus and
// docs/LICENSE-DETERMINATION-GAP-MATRIX.md), this resolver deliberately
// fails safe to RULE_DATA_UNAVAILABLE for the actual controlled/not-
// controlled call, rather than fabricating an outcome. It still performs
// every check that IS safely decidable without that dataset: structural
// classification validity, required-field completeness, universal
// sensitive-end-use review escalation, and account-level enable/disable
// gating.
import type { LicenseDeterminationOutcome, LicenseDeterminationRequestInput } from "./types";
import { normalizeClassification } from "./classification";
import { normalizeConditions } from "./conditions";
import { MISSING_INPUT_CODES } from "./types";

const RULE_VERSION = "generic-fail-safe-v1";

export interface AccountLicenseGates {
  licenseDeterminationEnabled: boolean;
  importControlDeterminationEnabled: boolean;
  genericExportLicenseDeterminationEnabled: boolean;
}

/**
 * Evaluates a single License Determination request into a base outcome
 * (before any explicit license-exception claim or reviewer override is
 * applied). Pure function -- no I/O, fully unit-testable.
 */
export function resolveLicenseDetermination(
  input: LicenseDeterminationRequestInput,
  gates: AccountLicenseGates
): LicenseDeterminationOutcome {
  if (!gates.licenseDeterminationEnabled) {
    return outcome("BLOCKED", "License Determination is disabled for this account.");
  }
  if (input.operationType === "IMPORT" && !gates.importControlDeterminationEnabled) {
    return outcome("BLOCKED", "Import Control Determination is disabled for this account.");
  }
  if (input.operationType === "EXPORT" && !gates.genericExportLicenseDeterminationEnabled) {
    return outcome("BLOCKED", "Generic Export License Determination is disabled for this account.");
  }

  const classification = normalizeClassification(input.classification);
  if (!classification.formatValid) {
    return outcome(
      "INVALID_CLASSIFICATION",
      classification.formatError ?? "Classification value failed structural validation.",
      { missingInputs: [MISSING_INPUT_CODES.CLASSIFICATION] }
    );
  }

  const missingInputs: string[] = [];
  if (input.operationType === "EXPORT" && !input.destinationCountry) {
    missingInputs.push(MISSING_INPUT_CODES.DESTINATION_COUNTRY);
  }
  if (input.operationType === "IMPORT" && !input.originCountry) {
    missingInputs.push("originCountry");
  }
  if (missingInputs.length > 0) {
    return outcome("INCOMPLETE", "Required jurisdiction input(s) are missing.", { missingInputs });
  }

  const conditions = normalizeConditions(input.conditions);
  if (conditions.hasSensitiveEndUse) {
    return outcome(
      "REVIEW_REQUIRED",
      "One or more sensitive end-use/end-user flags are TRUE; human compliance review is required regardless of licensing outcome.",
      { evidence: { conditions: conditions.flags } }
    );
  }

  const unknownSensitive = conditions.unknownFlags.filter((key) =>
    ["governmentEndUser", "militaryEndUser", "nuclearEndUse", "missileTechnologyEndUse", "chemicalBiologicalEndUse", "militaryEndUseCountry"].includes(
      key
    )
  );
  if (unknownSensitive.length > 0) {
    return outcome(
      "INCOMPLETE",
      "One or more end-use/end-user conditions were not provided and cannot be assumed false.",
      { missingInputs: [MISSING_INPUT_CODES.END_USE_CONDITIONS, ...unknownSensitive] }
    );
  }

  if (conditions.flags.encryptionItem === "TRUE" && conditions.flags.encryptionSelfClassified === "UNKNOWN") {
    return outcome(
      "INCOMPLETE",
      "Item is flagged as an encryption item but self-classification status was not provided.",
      { missingInputs: [MISSING_INPUT_CODES.ENCRYPTION_CONDITIONS] }
    );
  }

  // No jurisdiction-specific rule dataset is ingested -- fail safe rather
  // than fabricate LICENSE_REQUIRED/NO_LICENSE_REQUIRED (prompt section 65,
  // 103). RPL (replacement-parts) evidence is preserved but cannot soften
  // this outcome without real rule data backing that determination.
  return outcome(
    "RULE_DATA_UNAVAILABLE",
    "No jurisdiction-specific export/import control rule dataset is available to complete this determination. Route to manual compliance review.",
    {
      evidence: {
        classification: { type: classification.type, normalizedValue: classification.normalizedValue },
        conditions: conditions.flags,
        replacementPartsAsserted: conditions.isReplacementParts,
      },
    }
  );
}

function outcome(
  status: LicenseDeterminationOutcome["status"],
  reason: string,
  extra?: Partial<LicenseDeterminationOutcome>
): LicenseDeterminationOutcome {
  return {
    status,
    baseDecision: status,
    finalDecision: status,
    reason,
    ruleSource: "GENERIC",
    ruleVersion: RULE_VERSION,
    ...extra,
  };
}
