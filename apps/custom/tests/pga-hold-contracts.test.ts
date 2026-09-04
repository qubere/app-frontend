import { describe, expect, it } from "vitest";
import { holdNoticeSchema, holdResponseSchema, AGENCIES, getPreparationFields, restoreHoldDraft, validatePreparation } from "@/lib/pga/holdContracts";
import { parseInboundHoldNotice } from "@/lib/abi/inboundHoldNoticeParser";
import { composeMessageSet } from "@/lib/abi/pgaMessageSet/composeMessageSet";
import { getHoldCodeEntry } from "@/lib/abi/holdCodeDictionary";
describe("hold preparation and evidence boundaries",()=>{
  it.each(AGENCIES)("provides a preparation checklist for %s without certifying a filing",agency=>{
    expect(getPreparationFields(agency)?.length).toBeGreaterThan(0);
    expect(()=>composeMessageSet(agency,{})).toThrow(/approved/);
  });
  it("expires a draft after 24 hours, preserving the exact cutoff",()=>{
    const now=new Date("2026-09-02T12:00:00Z");
    expect(restoreHoldDraft({importer:"A"},new Date("2026-09-01T12:00:00Z"),now)).toEqual({importer:"A"});
    expect(restoreHoldDraft({importer:"A"},new Date("2026-09-01T11:59:59Z"),now)).toBeNull();
  });
  it("does not invent interpretations or unsupported schemas",()=>{
    expect(getHoldCodeEntry("FDA","47-B")).toBeUndefined();
    expect(getPreparationFields("TTB")).toBeNull();
  });
  it("does not guess an agency from a bare 1A record",()=>expect(()=>parseInboundHoldNotice("1A")).toThrow());
  it("requires original evidence in normalized ingestion",()=>{
    expect(()=>parseInboundHoldNotice({agencyCode:"FDA",holdCode:"1A"})).toThrow();
  });
  it("reports inline preparation errors",()=>{
    expect(validatePreparation("FDA",{importer:"",description:"Food",quantity:"-1"})).toMatchObject({importer:expect.any(String),quantity:expect.any(String)});
  });
});

it("preserves leading whitespace and line endings in original agency evidence", () => {
  const raw = "  source evidence  \r\n";
  expect(holdNoticeSchema.parse({ shipmentId: "s", externalKey: "ref", agencyCode: "FDA", holdCode: "code", reasonText: "reason", rawNotice: raw, issuedAt: "2026-01-01T00:00:00Z" }).rawNotice).toBe(raw);
  expect(holdResponseSchema.parse({ version: 0, submissionId: "sub", status: "Processing", responseCode: "code", reason: "reason", rawResponse: raw, responseAt: "2026-01-01T00:00:00Z" }).rawResponse).toBe(raw);
});
