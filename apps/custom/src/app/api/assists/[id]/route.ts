import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { assistPatchSchema } from "@/lib/valuation/assistContracts";
import { getAssist, updateAssist } from "@/lib/valuation/assistRegistryService";
import { z } from "zod";
export const GET = withAuthenticatedRoute<{id:string}>(async ({req,ctx,params}) => {
  const assist=await getAssist(ctx.accountId,params.id);
  const page=z.coerce.number().int().min(0).max(10000).parse(new URL(req.url).searchParams.get("page")??0);
  const [declarations,total]=await Promise.all([db.assistDeclaration.findMany({where:{accountId:ctx.accountId,assistId:assist.id},include:{filing:{select:{entryNumber:true}}},orderBy:{declaredAt:"desc"},take:50,skip:page*50}),db.assistDeclaration.count({where:{accountId:ctx.accountId,assistId:assist.id}})]);
  return NextResponse.json({assist,declarations,total,page});
},{permission:"valuation.read"});
export const PATCH = withAuthenticatedRoute<{id:string}>(async ({req,ctx,params}) => NextResponse.json({assist:await updateAssist(ctx.accountId,ctx.userId,params.id,assistPatchSchema.parse(await req.json()))}),{permission:"valuation.update",write:true});
