import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({
  assist:{findFirst:vi.fn(),create:vi.fn()},importerOfRecord:{findFirst:vi.fn()},party:{findMany:vi.fn()},customsFiling:{findFirst:vi.fn()},
  assistDecision:{findMany:vi.fn()},assistDeclaration:{findMany:vi.fn()},audit:vi.fn(),
}));
vi.mock("@/lib/db",()=>({db:mocks}));
vi.mock("@/lib/audit",async()=>({...(await vi.importActual<object>("@/lib/audit/auditActions")),createAuditLog:mocks.audit}));
import { getAssist, createAssist } from "@/lib/valuation/assistRegistryService";
import { getAssistMatches, assistLineMatches } from "@/lib/valuation/assistMatchingService";
beforeEach(()=>vi.clearAllMocks());
describe("assist tenant isolation",()=>{
  it("treats a different account's assist as absent and scopes the query",async()=>{
    mocks.assist.findFirst.mockResolvedValue(null);
    await expect(getAssist("account-a","assist-b")).rejects.toMatchObject({status:404});
    expect(mocks.assist.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:"assist-b",accountId:"account-a"}}));
  });
  it("scopes the filing before reading any assist decisions",async()=>{
    mocks.customsFiling.findFirst.mockResolvedValue(null);
    await expect(getAssistMatches("account-a","filing-b")).rejects.toMatchObject({status:404});
    expect(mocks.customsFiling.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:"filing-b",accountId:"account-a"}}));
    expect(mocks.assistDecision.findMany).not.toHaveBeenCalled();
  });
  it("rejects a foreign importer before creating a registry row",async()=>{
    mocks.importerOfRecord.findFirst.mockResolvedValue(null);
    await expect(createAssist("account-a","user-a",{type:"tooling",description:"Mold",importerOfRecordId:"importer-b",totalValue:"100",currency:"USD",allocationMethod:"lump_sum",allocationBasis:"entries",estimatedVolume:null,estimatedImportValue:null,skuPattern:null,suppliers:[],hts:[],effectiveFrom:new Date().toISOString(),effectiveTo:null})).rejects.toMatchObject({status:404});
    expect(mocks.importerOfRecord.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:"importer-b",accountId:"account-a"}}));
    expect(mocks.assist.create).not.toHaveBeenCalled();
  });
  it("requires supplier AND manufacturer when both are scoped",()=>{
    const scope={suppliers:[{partyId:"supplier-a",role:"SUPPLIER"},{partyId:"manufacturer-a",role:"MANUFACTURER"}],hts:[{prefix:"8480"}],skuPattern:null};
    const line={htsCode:"8480.10.0000",partNumber:null};
    expect(assistLineMatches(scope,line,[{partyId:"supplier-a",role:"SUPPLIER"}])).toBe(false);
    expect(assistLineMatches(scope,line,[{partyId:"supplier-a",role:"SUPPLIER"},{partyId:"manufacturer-a",role:"MANUFACTURER"}])).toBe(true);
    expect(assistLineMatches(scope,{...line,htsCode:"3926.90"},[{partyId:"supplier-a",role:"SUPPLIER"},{partyId:"manufacturer-a",role:"MANUFACTURER"}])).toBe(false);
  });
});
