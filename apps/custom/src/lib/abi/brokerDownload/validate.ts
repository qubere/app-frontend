// Opt-in cross-validation helpers for the Broker Download chapter, wiring its
// wire-format code fields against CBP's published reference-data lookup
// tables (Appendix B). Additive only — never called from `build.ts`/
// `parse.ts`. Broker Download is output-only (CBP pushes this data to ABI
// filers), so these helpers exist to flag CBP-sent codes Qubere doesn't yet
// recognize, not to gate anything Qubere itself transmits.

import { isValidModeOfTransportationCode } from "@/lib/abi/validCodes";
import { isValidCountryCode } from "@/lib/abi/countryCurrencyCodes";
import { isValidEquipmentDescriptionCode } from "@/lib/abi/equipmentDescriptionCodes";

/**
 * Validates the 1M-Record's Transportation Indicator against the Appendix B
 * Mode of Transportation code table (the field's own doc comment confirms
 * this chapter reuses that same code domain — 10/11/20/21/30, etc.).
 */
export function validateTransportationIndicator(code: string): boolean {
  return isValidModeOfTransportationCode(code);
}

/**
 * Validates a Country Code (Appendix B). Shared by the 1M-Record (Manifest
 * Header) and 1D-Record (Bill Cargo Description) — both use the same
 * 2-letter ISO country code domain.
 */
export function validateCountryCode(code: string): boolean {
  return isValidCountryCode(code);
}

/**
 * Validates the 1C-Record's (Bill of Lading Container) Container/Equipment
 * Description Code against Appendix B — the exact use case
 * `equipmentDescriptionCodes.ts` documents itself as covering.
 */
export function validateContainerDescriptionCode(code: string): boolean {
  return isValidEquipmentDescriptionCode(code);
}
