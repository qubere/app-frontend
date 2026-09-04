import { AbiFixedWidthError } from "./fixedWidth";

/**
 * CATAIR Entry Number check-digit computation, per Appendix E ("Valid Entry
 * Numbers"). An Entry Number is Entry Filer Code (3AN) + a 7-digit transaction
 * number + a 1-digit check digit. This module is shared across every CATAIR
 * chapter that references an entry number (Entry Summary, Cargo Release, Entry
 * Summary Query, ...), not just Entry Summary Create/Update.
 *
 * Source: docs/plans/catair-source-docs/appendix-e-valid-entry-numbers.pdf
 */

// Appendix E's letter-to-digit substitution table: three groups of the alphabet
// (A-I, J-R, S-Z) each cycling 1-9 independently — not a single mod-9 formula.
const LETTER_DIGIT_MAP: Record<string, string> = {
  A: "1", B: "2", C: "3", D: "4", E: "5", F: "6", G: "7", H: "8", I: "9",
  J: "1", K: "2", L: "3", M: "4", N: "5", O: "6", P: "7", Q: "8", R: "9",
  S: "2", T: "3", U: "4", V: "5", W: "6", X: "7", Y: "8", Z: "9",
};

function toNumericEntryFilerCode(entryFilerCode: string): string {
  if (!/^[A-Z0-9]{3}$/.test(entryFilerCode)) {
    throw new AbiFixedWidthError(
      `Entry Filer Code must be exactly 3 uppercase alphanumeric characters, got "${entryFilerCode}".`
    );
  }
  return entryFilerCode
    .split("")
    .map((ch) => LETTER_DIGIT_MAP[ch] ?? ch)
    .join("");
}

/**
 * Computes the Appendix E check digit for an entry number: a Luhn (mod 10)
 * checksum over the 10-digit string formed by the numeric entry filer code (3
 * digits, after letter substitution) followed by the 7-digit transaction number.
 * Verified against Appendix E's own worked example (filer B76, transaction
 * 0324527 -> check digit 8).
 */
export function computeEntryNumberCheckDigit(entryFilerCode: string, transactionNumber: string): string {
  if (!/^[0-9]{7}$/.test(transactionNumber)) {
    throw new AbiFixedWidthError(`Transaction number must be exactly 7 digits, got "${transactionNumber}".`);
  }
  const digits = (toNumericEntryFilerCode(entryFilerCode) + transactionNumber).split("").map(Number);

  let total = 0;
  for (let i = 0; i < digits.length; i++) {
    const positionFromRight = digits.length - i;
    if (positionFromRight % 2 === 1) {
      const doubled = digits[i] * 2;
      total += doubled > 9 ? doubled - 9 : doubled;
    } else {
      total += digits[i];
    }
  }
  return String((10 - (total % 10)) % 10);
}

/** Builds the full 8-char Entry Number field (7-digit transaction number, zero
 * padded, + check digit) from a raw transaction number. */
export function buildEntryNumber(entryFilerCode: string, transactionNumber: number | string): string {
  const padded = String(transactionNumber).padStart(7, "0");
  if (!/^[0-9]{7}$/.test(padded)) {
    throw new AbiFixedWidthError(`Transaction number must fit in 7 digits, got "${transactionNumber}".`);
  }
  return padded + computeEntryNumberCheckDigit(entryFilerCode, padded);
}

/** Validates that an 8-char Entry Number field's check digit is consistent with
 * its transaction number and the given Entry Filer Code, per Appendix E. */
export function isValidEntryNumberCheckDigit(entryFilerCode: string, entryNumber: string): boolean {
  if (!/^[0-9]{8}$/.test(entryNumber)) return false;
  const transactionNumber = entryNumber.slice(0, 7);
  const checkDigit = entryNumber.slice(7);
  return computeEntryNumberCheckDigit(entryFilerCode, transactionNumber) === checkDigit;
}
