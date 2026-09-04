import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
export const GET=withAuthenticatedRoute(async ({req,ctx})=>{
  const q=new URL(req.url).searchParams; const search=(q.get("q")??"").trim().slice(0,100);
  const [importers,parties]=await Promise.all([
    db.importerOfRecord.findMany({where:{accountId:ctx.accountId,...(search?{name:{contains:search,mode:"insensitive" as const}}:{})},select:{id:true,name:true},orderBy:{name:"asc"},take:100}),
    db.party.findMany({where:{accountId:ctx.accountId,deletedAt:null,...(q.get("partyId")?{id:q.get("partyId")!}:search?{names:{some:{rawName:{contains:search,mode:"insensitive" as const}}}}:{})},
      include:{names:{where:{isPrimary:true,status:"ACTIVE"},take:1}},orderBy:{createdAt:"desc"},take:100})
  ]);
  return NextResponse.json({importers,parties:parties.map(p=>({id:p.id,name:p.names[0]?.rawName??p.internalPartyCode??p.id}))});
},{permission:"valuation.read"});
