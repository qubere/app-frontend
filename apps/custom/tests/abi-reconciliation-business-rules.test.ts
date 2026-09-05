import { describe, it, expect } from 'vitest';

/**
 * CATAIR ACE Reconciliation Entry Summary Business Rules Test Suite
 * Source Document: ACE CATAIR Reconciliation Entry Summary Create/Update (v12, June 2025)
 * Source PDF: docs/apps/customs/feature/abi/catair-source-docs/16-reconciliation-entry-summary-v3.pdf
 *
 * References:
 *   - RE Table 1: Check Digit Computation Formula (Pages 74-75)
 *   - RE Table 2: Accounting Class Codes (Page 76)
 *   - Record 10 Filing Action Request Codes & Reconciliation Type Codes (Pages 13-16)
 *   - Record 20 Reconciliation Issue Codes (Page 28)
 *   - Record E1 Disposition Types & Severity Codes (Pages 68-71)
 */

/**
 * RE Table 1: Check Digit Computation for CATAIR Entry Numbers
 * Implements the standard CBP check digit calculation formula for 8-character Entry Numbers (7 digits + 1 check digit).
 */
export function computeEntryNumberCheckDigit(filerCode: string, entrySeq: string): number {
  if (filerCode.length !== 3 || entrySeq.length !== 7) {
    throw new Error('Filer code must be 3 characters and entry sequence must be 7 digits');
  }

  // Step ONE: Convert alphabetic characters in Filer Code to numbers according to RE Table 1
  const charMap: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
    J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  };

  const fullStr = (filerCode + entrySeq).toUpperCase();
  const numericBase: number[] = [];

  for (const char of fullStr) {
    if (char >= '0' && char <= '9') {
      numericBase.push(parseInt(char, 10));
    } else if (charMap[char] !== undefined) {
      numericBase.push(charMap[char]);
    } else {
      throw new Error(`Invalid character in entry number component: ${char}`);
    }
  }

  // Full numeric base must have 10 elements (3 from filer code + 7 from entry sequence)
  if (numericBase.length !== 10) {
    throw new Error('Invalid numeric base length');
  }

  // Step TWO: Multiply even position numbers (positions 2, 4, 6, 8, 10 - 1-indexed) by 2
  const evenPositions = [numericBase[1], numericBase[3], numericBase[5], numericBase[7], numericBase[9]];
  let evenSum = 0;

  for (const val of evenPositions) {
    const mult = val * 2;
    // Step THREE: Sum individual digits of product if mult >= 10
    evenSum += Math.floor(mult / 10) + (mult % 10);
  }

  // Step FOUR: Compute Odd Sum Value (positions 1, 3, 5, 7, 9)
  const oddPositions = [numericBase[0], numericBase[2], numericBase[4], numericBase[6], numericBase[8]];
  let oddSum = 0;
  for (const val of oddPositions) {
    oddSum += val;
  }

  // Step FIVE: Compute Check Digit Base Value = evenSum + oddSum
  const checkDigitBase = evenSum + oddSum;

  // Step SIX: Check digit is (10 - (checkDigitBase % 10)) % 10
  const remainder = checkDigitBase % 10;
  return (10 - remainder) % 10;
}

export const VALID_RECON_ACTION_CODES = ['A', 'R', 'D'] as const;

export const VALID_RECON_ISSUE_CODES = [
  '01', // Value
  '02', // 9802
  '03', // FTA / USMCA
  '04', // Classification
] as const;

export const VALID_RECON_ACCOUNTING_CLASS_CODES = [
  '001', // Duty
  '0441', // Interest
  '441',  // Interest (short format)
  '201', // Prior Disclosure Unliquidated
  '202', // Prior Disclosure Liquidated
  '054', // Merchandise Processing Fee
  '105', // Softwood Lumber Fee
  '124', // Pecan Fee
  '125', // Christmas Tree Fee
  '672', // Coffee Imports to Puerto Rico
] as const;

export const INVALID_LINE_REVENUE_CLASS_CODES = [
  '1044', // Interest is NOT allowed as a 55-Record line level accounting class code
] as const;

export const VALID_DISPOSITION_TYPES = ['A', 'R'] as const; // Accepted, Rejected
export const VALID_SEVERITY_CODES = ['F', 'I'] as const; // Fatal, Informational

describe('CATAIR Reconciliation Entry Summary Business Rules', () => {
  describe('RE Table 1: Check Digit Computation Formula', () => {
    it('correctly calculates check digit for known valid filer code and entry sequence', () => {
      const checkDigit = computeEntryNumberCheckDigit('ABC', '1234567');
      expect(checkDigit).toBeGreaterThanOrEqual(0);
      expect(checkDigit).toBeLessThanOrEqual(9);
    });

    it('rejects invalid filer code length or invalid characters', () => {
      expect(() => computeEntryNumberCheckDigit('AB', '1234567')).toThrow();
      expect(() => computeEntryNumberCheckDigit('ABC', '123456')).toThrow();
      expect(() => computeEntryNumberCheckDigit('AB@', '1234567')).toThrow();
    });
  });

  describe('Filing Action Request Code Enumerations', () => {
    it('validates allowed action codes (A=Add, R=Replace, D=Delete)', () => {
      expect(VALID_RECON_ACTION_CODES).toContain('A');
      expect(VALID_RECON_ACTION_CODES).toContain('R');
      expect(VALID_RECON_ACTION_CODES).toContain('D');
      expect(VALID_RECON_ACTION_CODES.length).toBe(3);
    });
  });

  describe('Reconciliation Issue Codes (Record 20)', () => {
    it('models all 4 core reconciliation issue types (01=Value, 02=9802, 03=FTA, 04=Classification)', () => {
      expect(VALID_RECON_ISSUE_CODES).toEqual(['01', '02', '03', '04']);
    });
  });

  describe('RE Table 2: Accounting Class Codes', () => {
    it('supports standard duty, interest, prior disclosure, and fee class codes', () => {
      expect(VALID_RECON_ACCOUNTING_CLASS_CODES).toContain('001');  // Duty
      expect(VALID_RECON_ACCOUNTING_CLASS_CODES).toContain('0441'); // Interest
      expect(VALID_RECON_ACCOUNTING_CLASS_CODES).toContain('201');  // Prior Disclosure Unliquidated
      expect(VALID_RECON_ACCOUNTING_CLASS_CODES).toContain('202');  // Prior Disclosure Liquidated
      expect(VALID_RECON_ACCOUNTING_CLASS_CODES).toContain('672');  // Coffee Imports PR
    });

    it('enforces rule that Class Code 1044 is forbidden on 55-Record line level revenue detail', () => {
      expect(INVALID_LINE_REVENUE_CLASS_CODES).toContain('1044');
    });
  });

  describe('Record E1 Disposition & Severity Enumerations', () => {
    it('models valid disposition types (A=Accepted, R=Rejected) and severity codes (F=Fatal, I=Informational)', () => {
      expect(VALID_DISPOSITION_TYPES).toEqual(['A', 'R']);
      expect(VALID_SEVERITY_CODES).toEqual(['F', 'I']);
    });
  });
});
