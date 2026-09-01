import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { assistInputSchema } from "@/lib/valuation/assistContracts";
import { createAssist, expireAssists, assistInclude } from "@/lib/valuation/assistRegistryService";
import { z } from "zod";
export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  const q = new URL(req.url).searchParams;
  const page = z.coerce.number().int().min(0).max(10000).parse(q.get("page") ?? 0);
  const status = z.enum(["Draft","Active","Suspended","Amortized"]).optional().parse(q.get("status") || undefined);
  await expireAssists(ctx.accountId);
  const where = { accountId:ctx.accountId, ...(status ? {status}:{}), ...(q.get("importerId") ? {importerOfRecordId:q.get("importerId")!}:{}) };
  const [assists,total] = await Promise.all([db.assist.findMany({where,include:assistInclude,orderBy:[{createdAt:"desc"},{id:"asc"}],take:24,skip:page*24}), db.assist.count({where})]);
  return NextResponse.json({assists,total,page});
},{permission:"valuation.read"});
export const POST = withAuthenticatedRoute(async ({req,ctx}) => NextResponse.json({assist:await createAssist(ctx.accountId,ctx.userId,assistInputSchema.parse(await req.json()))},{status:201}),{permission:"valuation.update",write:true});
