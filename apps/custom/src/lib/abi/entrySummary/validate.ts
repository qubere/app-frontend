// Opt-in cross-validation helpers for the Entry Summary (AE) chapter, wiring
// its wire-format code fields against CBP's published reference-data lookup
// tables (Appendix B, Appendix B US-state list, and the ACE Error Dictionary).
//
// These are deliberately NOT called from `build.ts`/`parse.ts`/
// `assembleTransaction.ts` — a record with a code CBP hasn't published yet (or
// has since retired) must still encode/decode structurally. Callers that want
// semantic validation (e.g. a pre-submission linter, a UI warning banner)
// invoke these explicitly.

import { isValidEntryTypeCode, isValidModeOfTransportationCode } from "@/lib/abi/validCodes";
import { isValidCountryCode } from "@/lib/abi/countryCurrencyCodes";
import { isValidUnitOfMeasure } from "@/lib/abi/unitsOfMeasure";
import { isValidLocationCode } from "@/lib/abi/locationCodes";
import { getAllAbiErrors, type ErrorDictionaryEntry } from "@/lib/abi/errorDictionary";

/** Validates the 10-Record's Entry Type Code (Appendix B). */
export function validateEntryTypeCode(code: string): boolean {
  return isValidEntryTypeCode(code);
}

/** Validates the 10-Record's Mode of Transportation Code (Appendix B). */
export function validateModeOfTransportationCode(code: string): boolean {
  return isValidModeOfTransportationCode(code);
}

/**
 * Validates the 40-Record's Country of Origin Code. Per the field's own spec
 * note, "**" is a legitimate "unknown" sentinel, not a real ISO country code —
 * treated as valid here rather than flagged.
 */
export function validateCountryOfOriginCode(code: string): boolean {
  if (code.trim() === "**") return true;
  return isValidCountryCode(code);
}

/** Validates the 40-Record's Country of Export Code (Appendix B). */
export function validateCountryOfExportCode(code: string): boolean {
  return isValidCountryCode(code);
}

/**
 * Validates a 50-Record Unit of Measure Code (Quantity 1/2/3's paired UOM,
 * Appendix B).
 */
export function validateUnitOfMeasureCode(code: string): boolean {
  return isValidUnitOfMeasure(code);
}

/** Validates the 11-Record's US State of Destination Code (Appendix B, US region). */
export function validateUsStateOfDestinationCode(code: string): boolean {
  return isValidLocationCode(code, "US");
}

/**
 * Resolves an E1-Record condition/disposition code to its ACE Error
 * Dictionary entries. Condition codes are context-dependent and not globally
 * unique (the same code can carry different narratives across chapters/query
 * types), so this returns every matching entry rather than guessing at one.
 */
export function resolveConditionCode(code: string): ErrorDictionaryEntry[] {
  return getAllAbiErrors(code);
}
