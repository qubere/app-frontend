// Opt-in cross-validation helpers for the Statement Processing chapter,
// wiring its wire-format code fields against CBP's published reference-data
// lookup tables (Appendix B). Additive only — never called from `build.ts`/
// `parse.ts`.

import { isValidEntryTypeCode } from "@/lib/abi/validCodes";

/** Validates the Q1 (Daily Statement) Entry Type Code (Appendix B). */
export function validateEntryTypeCode(code: string): boolean {
  return isValidEntryTypeCode(code);
}
