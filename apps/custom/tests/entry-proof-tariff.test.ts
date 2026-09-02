import { describe, it, expect, vi } from 'vitest';
const database = vi.hoisted(() => ({ htsRelease: { findFirst: vi.fn(async () => ({ id: 'r1' })) }, htsNode: { findMany: vi.fn(async () => [{ htsNumberNormalized: '8481805090', dutyRates: [{ rateColumn: 'General', rawRateText: '5%' }, { rateColumn: 'Section301', rateType: 'SECTION_301', rawRateText: '25%', adValoremPercent: 25, trancheId: 'List3' }] }]) }, adcvdOrder: { findMany: vi.fn(async () => []) }, adCvdCompanyRate: { findMany: vi.fn(async () => []) }, section301Rate: { findMany: vi.fn(async () => []) }, section232Rate: { findMany: vi.fn(async () => []) } }));
const { db } = await import('@/lib/db');
for (const [model, delegate] of Object.entries(database))
    for (const [method, fn] of Object.entries(delegate))
        vi.spyOn((db as any)[model], method as any).mockImplementation(fn as any);
const { computeFilingTariff, loadLineDutyRates, parsePublishedDutyRate } = await import('@/lib/tariff/dutyEngine');
describe('proof tariff parity', () => {
    it('resolves the same code separately for two approved manufacturer rates', async () => {
        database.adcvdOrder.findMany.mockResolvedValue([{ caseNumber: 'A-570-TEST', respondentCountries: ['CN'], htsCodesInScope: ['84818050'] }] as any);
        database.adCvdCompanyRate.findMany.mockResolvedValue(['Maker A', 'Maker B'].map((manufacturerName, index) => ({ manufacturerName, countryOfOrigin: 'CN', isSeparateRate: true, reviewStatus: 'APPROVED', depositRatePct: (index + 1) * 10 })) as any);
        try {
            const rates = await loadLineDutyRates(['Maker A', 'Maker B'].map(manufacturer => ({ htsCode: '8481.80.5090', countryOfOrigin: 'CN', manufacturer })), 'r1');
            expect(rates.map(r => r.antidumpingRate)).toEqual([10, 20]);
        } finally { database.adcvdOrder.findMany.mockResolvedValue([]); database.adCvdCompanyRate.findMany.mockResolvedValue([]); }
    });

    it('does not calculate specific or compound rates as ad valorem', () => { expect(parsePublishedDutyRate('5 cents/kg')).toBeNull(); expect(parsePublishedDutyRate('5% + 10 cents/kg')).toBeNull(); expect(parsePublishedDutyRate('5.5%')).toBe(0.055); });
    it('omits entry harbor fees for air transport', () => { const r = computeFilingTariff([{ htsCode: 'x', totalValue: 1000 }], { x: { generalDutyRate: 'Free' } }, undefined, { isOcean: false }); expect(r.totalFees).toBe(31.67); });
    it('prefers approved active Section 301 rows over node rates and surfaces pending review', async () => {
        database.section301Rate.findMany.mockResolvedValueOnce([{ dutyRatePct: 50, tranche: 'FOUR_YEAR_REVIEW', reviewStatus: 'APPROVED', effectiveDate: new Date('2020-01-01'), expirationDate: null }] as any);
        const [approved] = await loadLineDutyRates([{ htsCode: '8481.80.5090', countryOfOrigin: 'CN' }], 'r1');
        expect(approved.section301AdditionalRate).toBe(50);
        database.section301Rate.findMany.mockResolvedValueOnce([{ dutyRatePct: 50, tranche: 'FOUR_YEAR_REVIEW', reviewStatus: 'PENDING', effectiveDate: new Date('2020-01-01'), expirationDate: null }] as any);
        const [pending] = await loadLineDutyRates([{ htsCode: '8481.80.5090', countryOfOrigin: 'CN' }], 'r1');
        expect(pending.section301Status).toBe('REVIEW_REQUIRED');
        expect(pending.section301Applicable).toBe(false);
    });
    it('includes AD/CVD in entry totals, not just line totals', () => { const r = computeFilingTariff([{ htsCode: 'x', totalValue: 1000 }], { x: { generalDutyRate: '5%', antidumpingRate: 10, countervailingRate: 2 } }); expect(r.totalDuty).toBe(170); expect(r.totalAmount).toBe(202.92); expect(r.lineResults[0].totalDutyAmount).toBe(r.totalDuty); });
    it('applies the entry MPF minimum once across multiple lines', () => { const r = computeFilingTariff([{ htsCode: 'x', totalValue: 100 }, { htsCode: 'x', totalValue: 100 }], { x: { generalDutyRate: 'Free' } }); expect(r.totalFees).toBe(31.92); });
    it('resolves identical HTS independently by country with a pinned release', async () => { const lines = [{ htsCode: '8481.80.5090', countryOfOrigin: 'CN', totalValue: 1000 }, { htsCode: '8481.80.5090', countryOfOrigin: 'DE', totalValue: 1000 }]; const rates = await loadLineDutyRates(lines, 'r1'); expect(rates.map(r => r.section301Status)).toEqual(['EVALUATED_APPLICABLE', 'EVALUATED_NOT_APPLICABLE']); const result = computeFilingTariff(lines, {}, rates); expect(result.lineResults.map(l => l.section301Amount)).toEqual([250, 0]); expect(database.htsRelease.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'r1', country: 'US' } })); });
});
