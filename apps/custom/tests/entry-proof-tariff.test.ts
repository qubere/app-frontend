import {describe,it,expect,vi} from 'vitest';

const database=vi.hoisted(()=>({htsRelease:{findFirst:vi.fn(async()=>({id:'r1'}))},htsNode:{findMany:vi.fn(async()=>[{htsNumberNormalized:'8481805090',dutyRates:[{rateColumn:'General',rawRateText:'5%'},{rateColumn:'Section301',rateType:'SECTION_301',rawRateText:'25%',adValoremPercent:25,trancheId:'List3'}]}])},adcvdOrder:{findMany:vi.fn(async()=>[])},section232Rate:{findMany:vi.fn(async()=>[])}}));
vi.mock('@/lib/db',()=>({db:database}));
const {computeFilingTariff,loadLineDutyRates}=await import('@/lib/tariff/dutyEngine');
describe('proof tariff parity',()=>{
 it('includes AD/CVD in entry totals, not just line totals',()=>{const r=computeFilingTariff([{htsCode:'x',totalValue:1000}],{x:{generalDutyRate:'5%',antidumpingRate:10,countervailingRate:2}});expect(r.totalDuty).toBe(170);expect(r.totalAmount).toBe(202.92);expect(r.lineResults[0].totalDutyAmount).toBe(r.totalDuty)});
 it('applies the entry MPF minimum once across multiple lines',()=>{const r=computeFilingTariff([{htsCode:'x',totalValue:100},{htsCode:'x',totalValue:100}],{x:{generalDutyRate:'Free'}});expect(r.totalFees).toBe(31.92)});
 it('resolves identical HTS independently by country with a pinned release',async()=>{const lines=[{htsCode:'8481.80.5090',countryOfOrigin:'CN',totalValue:1000},{htsCode:'8481.80.5090',countryOfOrigin:'DE',totalValue:1000}];const rates=await loadLineDutyRates(lines,'r1');expect(rates.map(r=>r.section301Status)).toEqual(['EVALUATED_APPLICABLE','EVALUATED_NOT_APPLICABLE']);const result=computeFilingTariff(lines,{},rates);expect(result.lineResults.map(l=>l.section301Amount)).toEqual([250,0]);expect(database.htsRelease.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:'r1',country:'US'}}))});
});
