import { describe, expect, it } from "vitest";
import { Decimal } from "@/lib/tariff/decimal";
import { calculateAssistAllocation, apportionAssistToLines, addAssistToCustomsValue } from "@/lib/valuation/assistAllocation";
const base={totalValue:"100.00",remainingValue:"100.00",allocationMethod:"equal_allocation",allocationBasis:"entries",estimatedVolume:"3"};
describe("assist allocation",()=>{
  it("absorbs the final rounding cent across three entries",()=>{
    let remaining=new Decimal(100);const amounts=[];
    for(let i=0;i<3;i++){const amount=calculateAssistAllocation({...base,remainingValue:remaining},{units:1,fobValue:100,declaredCount:i});amounts.push(amount.toFixed(2));remaining=remaining.minus(amount);}
    expect(amounts).toEqual(["33.33","33.33","33.34"]);expect(remaining.toFixed(2)).toBe("0.00");
  });
  it("caps lump sums and overrides at the remaining balance",()=>expect(calculateAssistAllocation({...base,allocationMethod:"lump_sum",remainingValue:"4.32"},{units:1,fobValue:50}).toFixed(2)).toBe("4.32"));
  it("allocates by units",()=>expect(calculateAssistAllocation({...base,allocationBasis:"units",estimatedVolume:"1000"},{units:15,fobValue:50}).toFixed(2)).toBe("1.50"));
  it("allocates proportionally in assist currency",()=>expect(calculateAssistAllocation({...base,allocationMethod:"value_proportional",estimatedImportValue:"1000"},{units:1,fobValue:"123.45"}).toFixed(2)).toBe("12.35"));
  it("returns zero without overspending an amortized assist",()=>expect(calculateAssistAllocation({...base,remainingValue:"0"},{units:1,fobValue:100}).isZero()).toBe(true));
  it("rejects zero denominators and fractional entry counts",()=>{
    expect(()=>calculateAssistAllocation({...base,estimatedVolume:"0"},{units:1,fobValue:1})).toThrow();
    expect(()=>calculateAssistAllocation({...base,estimatedVolume:"1.5"},{units:1,fobValue:1})).toThrow();
  });
  it("keeps distributed cents equal to the confirmed amount",()=>{
    const allocations=apportionAssistToLines("10.00",[{id:"a",value:"1",quantity:1},{id:"b",value:"1",quantity:1},{id:"c",value:"1",quantity:1}]);
    expect(allocations.map(a=>a.amount)).toEqual(["3.33","3.33","3.34"]);
  });
  it("uses the existing customs valuation engine",()=>expect(addAssistToCustomsValue("123.45","6.78","USD")).toBe(130.23));
  it("rejects negative, NaN, and impossible balances",()=>{
    for(const remainingValue of ["-1","NaN","101"])expect(()=>calculateAssistAllocation({...base,remainingValue},{units:1,fobValue:10})).toThrow();
  });
});
