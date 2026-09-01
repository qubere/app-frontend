// Typed condition normalization (prompt section 12). Every end-use /
// end-user / encryption / RPL flag is a 4-state value -- absent (treated as
// UNKNOWN), FALSE, TRUE, or DISABLED (explicitly turned off by the account).
// "Unknown" must never be silently collapsed into "false": callers that need
// a definite answer to make a LICENSE_REQUIRED/NO_LICENSE_REQUIRED call on an
// unknown flag must instead surface INCOMPLETE/REVIEW_REQUIRED.
import type { LicenseConditionsInput, TriState } from "./types";

// Keys of LicenseConditionsInput whose value is a TriState (excludes the
// free-text reference-number fields), so indexed access below stays TriState.
type TriStateKey = {
  [K in keyof LicenseConditionsInput]-?: LicenseConditionsInput[K] extends TriState | undefined ? K : never;
}[keyof LicenseConditionsInput];

export interface NormalizedConditions {
  flags: Record<string, TriState>;
  /** Flag names whose value is UNKNOWN (including entirely absent from the request). */
  unknownFlags: string[];
  /** True if any end-use/end-user sensitive flag resolved to TRUE. */
  hasSensitiveEndUse: boolean;
  /** True if the replacement-parts indicator is explicitly TRUE. */
  isReplacementParts: boolean;
  /** Free-text encryption exception reference numbers, when asserted -- evidence only, not validated against BIS records. */
  referenceNumbers: { zNumber: string | null; ccatsNumber: string | null };
}

const CONDITION_KEYS: TriStateKey[] = [
  "governmentEndUser",
  "militaryEndUser",
  "nuclearEndUse",
  "missileTechnologyEndUse",
  "chemicalBiologicalEndUse",
  "internalUseOnly",
  "usSubsidiary",
  "encryptionItem",
  "encryptionSelfClassified",
  "replacementPartsIndicator",
  "militaryEndUseCountry",
  "endUserCertificateOnFile",
  "customsFreeZone",
];

/** Sensitive end-use/end-user flags that, if TRUE, always force at least REVIEW_REQUIRED. */
const SENSITIVE_END_USE_KEYS: TriStateKey[] = [
  "governmentEndUser",
  "militaryEndUser",
  "nuclearEndUse",
  "missileTechnologyEndUse",
  "chemicalBiologicalEndUse",
  "militaryEndUseCountry",
];

export function normalizeConditions(input: LicenseConditionsInput | undefined): NormalizedConditions {
  const flags: Record<string, TriState> = {};
  const unknownFlags: string[] = [];

  for (const key of CONDITION_KEYS) {
    const value = input?.[key] ?? "UNKNOWN";
    flags[key] = value;
    if (value === "UNKNOWN") unknownFlags.push(key);
  }

  const hasSensitiveEndUse = SENSITIVE_END_USE_KEYS.some((key) => flags[key] === "TRUE");
  const isReplacementParts = flags.replacementPartsIndicator === "TRUE";
  const referenceNumbers = {
    zNumber: input?.encryptionExceptionZNumber?.trim() || null,
    ccatsNumber: input?.encryptionExceptionCcatsNumber?.trim() || null,
  };

  return { flags, unknownFlags, hasSensitiveEndUse, isReplacementParts, referenceNumbers };
}
