// Opt-in cross-validation helpers for the Cargo Release (SE) chapter, wiring
// its wire-format code fields against CBP's published reference-data lookup
// tables (Appendix B). Additive only — never called from `build.ts`/
// `parse.ts`, so an unrecognized code still round-trips structurally; CBP's
// valid-value lists get revised more often than the wire format does.

import { isValidEntryTypeCode, isValidModeOfTransportationCode } from "@/lib/abi/validCodes";
import { isValidCountryCode } from "@/lib/abi/countryCurrencyCodes";
import { isValidUnitOfMeasure } from "@/lib/abi/unitsOfMeasure";

/** Validates the SE10-Record's Entry Type Code (Appendix B). */
export function validateEntryTypeCode(code: string): boolean {
  return isValidEntryTypeCode(code);
}

/** Validates the SE10-Record's Mode of Transportation Code (Appendix B). */
export function validateModeOfTransportationCode(code: string): boolean {
  return isValidModeOfTransportationCode(code);
}

/** Validates the SE40-Record's Country of Origin (Appendix B). */
export function validateCountryOfOrigin(code: string): boolean {
  return isValidCountryCode(code);
}

/**
 * Validates an SE36/SE56-Record entity Country Code (Appendix B). Shared by
 * both the header-entity (SE36) and line-entity (SE56) geo records — they use
 * the same field name and semantics.
 */
export function validateEntityCountryCode(code: string): boolean {
  return isValidCountryCode(code);
}

/** Validates the SE16-Record's (Conveyance) split-quantity Unit of Measure (Appendix B). */
export function validateConveyanceUnitOfMeasure(code: string): boolean {
  return isValidUnitOfMeasure(code);
}
