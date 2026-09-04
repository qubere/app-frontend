// Opt-in cross-validation helpers for the Entry Summary Query (ESQ) chapter,
// wiring its wire-format code fields against CBP's published reference-data
// lookup tables. Additive only — never called from `build.ts`/`parse.ts`/
// `assembleQuery.ts`, so an unrecognized code still round-trips structurally.

import { isValidEntryTypeCode } from "@/lib/abi/validCodes";
import { getAllAbiErrors, type ErrorDictionaryEntry } from "@/lib/abi/errorDictionary";

/** Validates the JF-Record's Entry Type Code (Appendix B). */
export function validateEntryTypeCode(code: string): boolean {
  return isValidEntryTypeCode(code);
}

/**
 * Resolves a JZ-Record (Query Returned Condition) condition code to its full
 * ACE Error Dictionary entries. This chapter already carries a local,
 * narrative-only `CONDITION_CODES` table (see `conditionCodes.ts`) scoped to
 * the codes actually observed in this chapter's own worked examples; this
 * helper instead resolves against the full ACE Error Dictionary, which
 * documents additional codes and a fuller `explanation` field. Condition
 * codes are context-dependent and not globally unique, so every matching
 * entry is returned rather than a single best guess.
 */
export function resolveConditionCode(code: string): ErrorDictionaryEntry[] {
  return getAllAbiErrors(code);
}
