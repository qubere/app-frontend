// Classification parsing/normalization + structural validation for the
// License Determination request path (prompt sections 6-8). This performs
// FORMAT validation only -- it never looks up whether a code is actually
// controlled (no ECCN/USML/Schedule-B/ICN rule dataset is ingested in this
// repo). Actual control-outcome lookups belong to the rule resolver, which
// must fail safe (RULE_DATA_UNAVAILABLE) rather than guess.
import type { ClassificationInput, ClassificationType, NormalizedClassification } from "./types";

const ECCN_PATTERN = /^[0-9][A-E][0-9]{3}(\.[a-z0-9](\.[0-9]+)*)?$/i;
const USML_PATTERN = /^[IVXLCDM]{1,7}\([a-z0-9]+\)$|^(CAT|CATEGORY)?\s*[IVXLCDM]{1,7}\b/i;
const HTS_PATTERN = /^\d{4}\.\d{2}(\.\d{2,4})?$|^\d{8,10}$/;
const SCHEDULE_B_PATTERN = /^\d{10}$/;
const ICN_PATTERN = /^[A-Z0-9][A-Z0-9._-]{2,39}$/i;

function normalizeValue(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Validates the structural shape of a classification value for its declared
 * type. Returns `formatValid: false` (never throws) for a malformed value so
 * callers can route to INVALID_CLASSIFICATION deterministically.
 */
export function normalizeClassification(input: ClassificationInput): NormalizedClassification {
  const raw = (input.value ?? "").trim();
  const normalizedValue = normalizeValue(raw);

  if (!raw) {
    return { ...input, normalizedValue, formatValid: false, formatError: "Classification value is empty." };
  }

  const pattern = patternFor(input.type);
  const formatValid = pattern.test(normalizedValue);

  return {
    ...input,
    normalizedValue,
    formatValid,
    formatError: formatValid ? undefined : `Value does not match the expected ${input.type} format.`,
  };
}

function patternFor(type: ClassificationType): RegExp {
  switch (type) {
    case "ECCN":
      return ECCN_PATTERN;
    case "USML":
      return USML_PATTERN;
    case "HTS":
      return HTS_PATTERN;
    case "SCHEDULE_B":
      return SCHEDULE_B_PATTERN;
    case "ICN":
      return ICN_PATTERN;
    default:
      return /.*/;
  }
}

export const CLASSIFICATION_TYPES: ClassificationType[] = ["ECCN", "USML", "HTS", "SCHEDULE_B", "ICN"];

export function isKnownClassificationType(type: string): type is ClassificationType {
  return (CLASSIFICATION_TYPES as string[]).includes(type);
}
