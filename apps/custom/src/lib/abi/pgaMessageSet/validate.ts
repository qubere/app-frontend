// Opt-in cross-validation helpers for the PGA (Participating Government
// Agencies) Message Set chapter, wiring its wire-format code fields against
// CBP's published reference-data lookup tables (Appendix V, Appendix B).
// Additive only — never called from `build.ts`/`parse.ts`, so an
// unrecognized code still round-trips structurally.

import { isValidGovernmentAgencyCode } from "@/lib/abi/governmentAgencyCodes";
import { isValidCountryCode } from "@/lib/abi/countryCurrencyCodes";
import { isValidUnitOfMeasure } from "@/lib/abi/unitsOfMeasure";

/** Validates the PG01-Record's Government Agency Code (Appendix V). */
export function validateGovernmentAgencyCode(code: string): boolean {
  return isValidGovernmentAgencyCode(code);
}

/**
 * Validates a Unit of Measure Code (Appendix B). Shared by PG04
 * (Constituent Element), PG14 (LPCO Details), PG26 (Packaging Breakdown), and
 * PG29 (Commodity Quantities, all four net/gross fields) — all use the same
 * Appendix B code domain.
 */
export function validateUnitOfMeasureCode(code: string): boolean {
  return isValidUnitOfMeasure(code);
}

/**
 * Validates a Country Code (Appendix B). Shared by PG06 (Source Processing),
 * PG20 (Entity Address), PG32 (Commodity Routing), and PG34 (Travel Document
 * Nationality) — all use the same 2-letter ISO country code domain.
 */
export function validateCountryCode(code: string): boolean {
  return isValidCountryCode(code);
}
