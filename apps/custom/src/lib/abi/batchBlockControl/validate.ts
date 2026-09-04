// Opt-in cross-validation helper for the Batch & Block Control chapter,
// wiring its X1-Record condition code against the ACE Error Dictionary.
// Additive only — never called from `build.ts`/`parse.ts`.
//
// This chapter already carries a local, narrative-only `CONDITION_CODES`
// table (see `conditionCodes.ts`, `lookupConditionNarrative`) scoped to the
// X01-X43/999 codes this chapter's own CATAIR pages document. This helper
// instead resolves against the full ACE Error Dictionary, which carries a
// fuller `explanation` field (and, for X-series codes, an update date) for
// the same condition codes — useful for a richer diagnostic view without
// replacing the chapter-local table.

import { getAllAbiErrors, type ErrorDictionaryEntry } from "@/lib/abi/errorDictionary";

/**
 * Resolves an X1-Record condition code (e.g. "X12", or "999" for the final
 * disposition) to its ACE Error Dictionary entries. Condition codes are
 * context-dependent and not globally unique, so every matching entry is
 * returned rather than a single best guess. Note: "999" (BATCH REJECTED) is
 * this chapter's own synthetic final-disposition code and isn't present in
 * the ACE Error Dictionary — resolving it returns an empty array; use
 * `lookupConditionNarrative("999")` from `conditionCodes.ts` for that one.
 */
export function resolveConditionCode(code: string): ErrorDictionaryEntry[] {
  return getAllAbiErrors(code);
}
