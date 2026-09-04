// Opt-in cross-validation helpers for the eBond Create/Update chapter, wiring
// its wire-format code fields against CBP's published reference-data lookup
// tables (Appendix B, ACE Error Dictionary). Additive only — never called
// from `build.ts`/`parse.ts`.

import { isValidEntryTypeCode } from "@/lib/abi/validCodes";
import { getAllAbiErrors, type ErrorDictionaryEntry } from "@/lib/abi/errorDictionary";

/**
 * Validates the Single Transaction Bond record's Entry Type Code (Appendix
 * B) — mandatory only when Transaction ID Type Code is "1" (Entry#).
 */
export function validateEntryTypeCode(code: string): boolean {
  return isValidEntryTypeCode(code);
}

/**
 * Resolves the output message record's condition code to its ACE Error
 * Dictionary entries. Condition codes are context-dependent and not globally
 * unique, so every matching entry is returned rather than a single best guess.
 */
export function resolveConditionCode(code: string): ErrorDictionaryEntry[] {
  return getAllAbiErrors(code);
}
