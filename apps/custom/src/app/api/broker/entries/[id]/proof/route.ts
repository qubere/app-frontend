import { NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/auth-guards';
import { db } from '@/lib/db';
export const GET = withAuthenticatedRoute<{id:string}>(async ({ctx,params}) => {
  const filingId=(await params).id;
  const proof=await db.entryProof.findFirst({where:{filingId,accountId:ctx.accountId},orderBy:{version:'desc'},include:{events:{orderBy:{createdAt:'desc'}}}});
  if(!proof) return NextResponse.json({error:'NOT_FOUND'},{status:404});
  const findings=await db.complianceFinding.findMany({where:{filingId,accountId:ctx.accountId}});
  return NextResponse.json({...proof,internalFindings:findings},{headers:{'Cache-Control':'no-store'}});
},{permission:'filing.read'});
