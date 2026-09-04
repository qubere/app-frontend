/**
 * Deterministic Domain Validators — LLM Universal Field Hydration
 *
 * Validates type, format, structure, check-digits, and domain constraints
 * for normalized canonical field values.
 */

export type ValidatorFn = (value: unknown) => boolean;

const VALID_INCOTERMS = new Set([
  "EXW",
  "FCA",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
]);

export const VALIDATOR_REGISTRY: Record<string, ValidatorFn> = {
  nonEmptyString: (value: unknown): boolean => {
    return typeof value === "string" && value.trim().length > 0;
  },

  iso2CountryValidator: (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    return /^[A-Z]{2}$/.test(value.trim().toUpperCase());
  },

  isoCurrencyValidator: (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    return /^[A-Z]{3}$/.test(value.trim().toUpperCase());
  },

  isoIncotermValidator: (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    return VALID_INCOTERMS.has(value.trim().toUpperCase());
  },

  isoDateValidator: (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  },

  positiveDecimalValidator: (value: unknown): boolean => {
    if (typeof value === "number") return !isNaN(value) && value >= 0;
    const parsed = parseFloat(String(value));
    return !isNaN(parsed) && parsed >= 0;
  },

  positiveIntegerValidator: (value: unknown): boolean => {
    if (typeof value === "number") return Number.isInteger(value) && value >= 0;
    const parsed = parseInt(String(value), 10);
    return !isNaN(parsed) && parsed >= 0;
  },

  htsCodeStructureValidator: (value: unknown): boolean => {
    if (!value) return false;
    const digits = String(value).replace(/[^0-9]/g, "");
    return digits.length >= 6 && digits.length <= 10;
  },

  scheduleDPortValidator: (value: unknown): boolean => {
    if (!value) return false;
    const digits = String(value).replace(/[^0-9]/g, "");
    return digits.length === 4;
  },

  cbpEntryNumberValidator: (value: unknown): boolean => {
    if (!value) return false;
    const cleaned = String(value).replace(/[^a-zA-Z0-9]/g, "");
    return cleaned.length === 11;
  },
};

export function validateValue(validatorNames: string[], value: unknown): { isValid: boolean; failedValidator?: string } {
  for (const name of validatorNames) {
    const validator = VALIDATOR_REGISTRY[name];
    if (validator && !validator(value)) {
      return { isValid: false, failedValidator: name };
    }
  }
  return { isValid: true };
}
