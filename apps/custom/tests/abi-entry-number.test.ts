import { describe, it, expect } from "vitest";
import { AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import {
  computeEntryNumberCheckDigit,
  buildEntryNumber,
  isValidEntryNumberCheckDigit,
} from "@/lib/abi/entryNumber";

describe("computeEntryNumberCheckDigit", () => {
  // Appendix E's own worked example: filer code B76 (-> numeric 276), transaction
  // 0324527, check digit 8. Verified by hand against every intermediate step
  // (odd-position sum 15, even-position sum 17, total 32, 10 - 2 = 8) before
  // writing this test.
  it("matches Appendix E's worked example (B76 / 0324527 -> 8)", () => {
    expect(computeEntryNumberCheckDigit("B76", "0324527")).toBe("8");
  });

  it("substitutes letters via Appendix E's three-group table (A-I, J-R, S-Z each 1-9)", () => {
    // Z -> 9, so filer "Z99" -> numeric "999".
    expect(computeEntryNumberCheckDigit("Z99", "0000000")).toBe(
      computeEntryNumberCheckDigit("999", "0000000")
    );
  });

  it("produces a check digit of 0 when the subtraction result would be 10", () => {
    // All-zero digits sum to 0; 10 - (0 % 10) % 10 = 0.
    expect(computeEntryNumberCheckDigit("000", "0000000")).toBe("0");
  });

  it("throws on a non-3-character or non-alphanumeric filer code", () => {
    expect(() => computeEntryNumberCheckDigit("N0", "0000000")).toThrow(AbiFixedWidthError);
    expect(() => computeEntryNumberCheckDigit("n01", "0000000")).toThrow(AbiFixedWidthError);
  });

  it("throws on a transaction number that isn't exactly 7 digits", () => {
    expect(() => computeEntryNumberCheckDigit("N01", "123")).toThrow(AbiFixedWidthError);
  });
});

describe("buildEntryNumber", () => {
  it("zero-pads the transaction number and appends the computed check digit", () => {
    expect(buildEntryNumber("B76", "324527")).toBe("0324527" + "8");
  });

  it("accepts a numeric transaction number", () => {
    expect(buildEntryNumber("B76", 324527)).toBe("03245278");
  });
});

describe("isValidEntryNumberCheckDigit", () => {
  it("accepts a correctly-computed entry number", () => {
    expect(isValidEntryNumberCheckDigit("B76", "03245278")).toBe(true);
  });

  it("rejects an entry number with a wrong check digit", () => {
    expect(isValidEntryNumberCheckDigit("B76", "03245270")).toBe(false);
  });

  it("rejects a malformed (non-8-digit) entry number rather than throwing", () => {
    expect(isValidEntryNumberCheckDigit("B76", "123")).toBe(false);
  });
});
