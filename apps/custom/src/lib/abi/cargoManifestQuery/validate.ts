// Opt-in cross-validation helpers for the Cargo Manifest/In-bond/Entry Status
// Query chapter, wiring its wire-format code fields against CBP's published
// reference-data lookup tables (Appendix B, ACE Error Dictionary). Additive
// only — never called from `build.ts`/`parse.ts`.

import { isValidEntryTypeCode } from "@/lib/abi/validCodes";
import { getAllAbiErrors, type ErrorDictionaryEntry } from "@/lib/abi/errorDictionary";

/**
 * Validates an Entry Type Code (Appendix B). Shared by the WO10-Record
 * (Entry Status Processing Header) and WR1-Record Output (Manifest
 * Conveyance Result) — both use the same field name and semantics.
 */
export function validateEntryTypeCode(code: string): boolean {
  return isValidEntryTypeCode(code);
}

/**
 * Resolves a WR0-Record (Entry Query Error) Error Message ID to its ACE Error
 * Dictionary entries. Condition/error codes are context-dependent and not
 * globally unique, so every matching entry is returned rather than a single
 * best guess.
 */
export function resolveQueryErrorCode(code: string): ErrorDictionaryEntry[] {
  return getAllAbiErrors(code);
}

/**
 * Resolves a WO60-Record (Disposition/Status Result) Disposition Action Code
 * to its ACE Error Dictionary entries. Same context-dependent, non-unique
 * caveat as `resolveQueryErrorCode`.
 */
export function resolveDispositionActionCode(code: string): ErrorDictionaryEntry[] {
  return getAllAbiErrors(code);
}
