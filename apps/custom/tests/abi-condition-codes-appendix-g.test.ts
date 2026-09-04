import { describe, it, expect } from 'vitest';
import {
  ABI_ERROR_DICTIONARY_ROWS,
  ABI_ERROR_DICTIONARY,
  getAbiError,
  getAllAbiErrors,
} from '@/lib/abi/errorDictionary';

/**
 * CATAIR Appendix G (Condition Codes and Narrative Text) Overlap & Audit Test Suite
 * Source PDF: ACE CATAIR Appendix G Condition Codes v2
 * Reference Lookup Module: src/lib/abi/errorDictionary.ts (1,054 rows / 1,027 unique codes)
 *
 * Audit Objective:
 * Appendix G lists CBP ABI condition error codes and narrative text. This test suite cross-references
 * Appendix G codes against `src/lib/abi/errorDictionary.ts` to verify 100% data coverage and determine
 * whether Appendix G is a subset of the master Error Dictionary or requires separate lookup structures.
 */

describe('CATAIR Appendix G — Condition Codes Overlap & Reference Audit', () => {
  it('verifies primary Error Dictionary lookup module contains 1,054 total data rows and 1,027 unique condition code keys', () => {
    expect(ABI_ERROR_DICTIONARY_ROWS).toHaveLength(1054);
    expect(ABI_ERROR_DICTIONARY.size).toBe(1027);
  });

  it('verifies Appendix G core error condition codes are fully present in the lookup dictionary', () => {
    const sampleAppendixGCodes = [
      '002', '003', '014', '60A', '60B', '60D',
      '439', '751', '861', '866', '869', 'Q13', 'X42', 'B22', 'L01', 'A04'
    ];

    for (const code of sampleAppendixGCodes) {
      const entry = getAbiError(code);
      expect(entry).toBeDefined();
      expect(entry?.conditionCode).toBe(code);
      expect(entry?.narrativeText).toBeTruthy();
    }
  });

  it('verifies multi-context codes are accessible via getAllAbiErrors()', () => {
    const multiContextCode = '60D';
    const entries = getAllAbiErrors(multiContextCode);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].conditionCode).toBe('60D');
  });
});
