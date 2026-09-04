// Opt-in cross-validation helpers for the Drawback (TFTEA / Core Drawback)
// chapter, wiring its wire-format code fields against CBP's published
// reference-data lookup tables (Appendix B, ACE Error Dictionary). Additive
// only — never called from `build.ts`/`parse.ts`, so an unrecognized code
// still round-trips structurally.

import { isValidCountryCode } from "@/lib/abi/countryCurrencyCodes";
import { isValidUnitOfMeasure } from "@/lib/abi/unitsOfMeasure";
import { getAllAbiErrors, type ErrorDictionaryEntry } from "@/lib/abi/errorDictionary";

/**
 * Validates a Unit of Measure Code (Appendix B). Shared by Records 42
 * (Import Quantity/UOM), 50 (Manufactured Article), 60 (Export/Destroy), and
 * 70 (TFTEA Export/Destroy) — all four use the same field name and semantics.
 */
export function validateUnitOfMeasureCode(code: string): boolean {
  return isValidUnitOfMeasure(code);
}

/**
 * Validates the Record 64 (NAFTA/USMCA) Country of Export (Appendix B). Note:
 * the field's own spec note additionally restricts this to CA or MX — that
 * narrower business rule isn't a reference-data lookup and is left to the
 * caller; this helper only confirms the code is a recognized CBP country code.
 */
export function validateCountryOfExport(code: string): boolean {
  return isValidCountryCode(code);
}

/**
 * Validates the Record 60/70 Country of Ultimate Destination (Appendix B).
 */
export function validateCountryOfUltimateDestination(code: string): boolean {
  return isValidCountryCode(code);
}

/**
 * Resolves an E1-Record condition/disposition code to its ACE Error
 * Dictionary entries. Condition codes are context-dependent and not globally
 * unique, so every matching entry is returned rather than a single best guess.
 */
export function resolveConditionCode(code: string): ErrorDictionaryEntry[] {
  return getAllAbiErrors(code);
}
