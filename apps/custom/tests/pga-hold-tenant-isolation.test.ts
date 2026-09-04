import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({pgaHold:{findFirst:vi.fn(),updateMany:vi.fn()},pgaHoldSubmission:{findFirst:vi.fn()},shipment:{findFirst:vi.fn()}}));
vi.mock("@/lib/db",()=>({db:mocks}));
vi.mock("@/lib/audit",async()=>({...(await vi.importActual<object>("@/lib/audit/auditActions")),createAuditLog:vi.fn()}));
import { getHold, saveHoldDraft } from "@/lib/pga/holdService";
beforeEach(()=>vi.clearAllMocks());
describe("PGA hold tenant isolation and concurrent editing",()=>{
  it("hides another tenant's notice and never reads submissions separately",async()=>{
    mocks.pgaHold.findFirst.mockResolvedValue(null);
    await expect(getHold("a","hold-b")).rejects.toMatchObject({status:404});
    expect(mocks.pgaHold.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:"hold-b",accountId:"a",shipment:{accountId:"a",deletedAt:null}}}));
    expect(mocks.pgaHoldSubmission.findFirst).not.toHaveBeenCalled();
  });
  it("refuses to overwrite a newer draft",async()=>{
    mocks.pgaHold.findFirst.mockResolvedValue({id:"h",status:"Open",shipmentId:"s"});
    mocks.pgaHold.updateMany.mockResolvedValue({count:0});
    await expect(saveHoldDraft("a","u","h",2,{description:"draft"})).rejects.toMatchObject({status:409,code:"HOLD_CONFLICT"});
    expect(mocks.pgaHold.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:"h",accountId:"a",version:2,status:"Open"}}));
  });
});
