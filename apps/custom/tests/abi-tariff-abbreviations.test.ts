import { describe, it, expect } from 'vitest';
import {
  ABI_TARIFF_ABBREVIATIONS,
  HTS_UOM_X_NOTE,
  lookupTariffAbbreviation,
  isValidTariffAbbreviation,
} from '../src/lib/abi/tariffAbbreviations';

describe('CATAIR Appendix C – Tariff Abbreviations Reference Data', () => {
  it('contains exactly 100 HTS Unit of Measure entries', () => {
    expect(ABI_TARIFF_ABBREVIATIONS.length).toBe(100);
  });

  it('has correct page distribution: 53 entries on Page 6 and 47 entries on Page 7', () => {
    const page6Entries = ABI_TARIFF_ABBREVIATIONS.filter(e => e.page === 6);
    const page7Entries = ABI_TARIFF_ABBREVIATIONS.filter(e => e.page === 7);

    expect(page6Entries.length).toBe(53);
    expect(page7Entries.length).toBe(47);

    // Verify first and last entries on Page 6
    expect(page6Entries[0].code).toBe('AC');
    expect(page6Entries[page6Entries.length - 1].code).toBe('KVA');

    // Verify first and last entries on Page 7
    expect(page7Entries[0].code).toBe('KVAR');
    expect(page7Entries[page7Entries.length - 1].code).toBe('YD');
  });

  it('verifies exact extracted text for key sample entries', () => {
    expect(lookupTariffAbbreviation('AC')).toEqual({
      code: 'AC',
      description: 'Alternating Current',
      page: 6,
    });

    expect(lookupTariffAbbreviation('ASTM')).toEqual({
      code: 'ASTM',
      description: 'American Society for Testing Materials',
      page: 6,
    });

    expect(lookupTariffAbbreviation('BBL')).toEqual({
      code: 'BBL',
      description: 'Barrels',
      page: 6,
    });

    expect(lookupTariffAbbreviation('DOZ')).toEqual({
      code: 'DOZ',
      description: 'Dozen',
      page: 6,
    });

    expect(lookupTariffAbbreviation('KG')).toEqual({
      code: 'KG',
      description: '1,000 Grams',
      page: 6,
    });

    expect(lookupTariffAbbreviation('LB')).toEqual({
      code: 'LB',
      description: 'Pounds, (weight) avdp)',
      page: 7,
    });

    expect(lookupTariffAbbreviation('PCS')).toEqual({
      code: 'PCS',
      description: 'Pieces',
      page: 7,
    });

    expect(lookupTariffAbbreviation('GBQ')).toEqual({
      code: 'GBQ',
      description: 'Giqabecquerel',
      page: 6,
    });

    expect(lookupTariffAbbreviation('STN')).toEqual({
      code: 'STN',
      description: 'Short Ton (2000 LB) (Weight)',
      page: 7,
    });
  });

  it('handles code X / X* with page 8 footnote note', () => {
    const entryStar = lookupTariffAbbreviation('X*');
    const entryClean = lookupTariffAbbreviation('X');

    expect(entryStar).toBeDefined();
    expect(entryClean).toBeDefined();
    expect(entryStar?.code).toBe('X*');
    expect(entryStar?.description).toBe('Quantity Not Required (valid only for HTS statistical reporting)');
    expect(entryStar?.page).toBe(7);
    expect(entryStar?.note).toBe(HTS_UOM_X_NOTE);
    expect(entryClean).toEqual(entryStar);
  });

  it('correctly validates valid and invalid tariff abbreviation codes', () => {
    expect(isValidTariffAbbreviation('AC')).toBe(true);
    expect(isValidTariffAbbreviation('ac')).toBe(true);
    expect(isValidTariffAbbreviation('BBL')).toBe(true);
    expect(isValidTariffAbbreviation('X')).toBe(true);
    expect(isValidTariffAbbreviation('X*')).toBe(true);
    expect(isValidTariffAbbreviation('YD')).toBe(true);

    expect(isValidTariffAbbreviation('INVALID')).toBe(false);
    expect(isValidTariffAbbreviation('ZZZ')).toBe(false);
    expect(isValidTariffAbbreviation('')).toBe(false);
  });

  it('ensures all entries have non-empty codes, descriptions, and valid page citations', () => {
    ABI_TARIFF_ABBREVIATIONS.forEach(entry => {
      expect(entry.code).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect([6, 7]).toContain(entry.page);
    });
  });
});
