import { NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/auth-guards';
import { generateEntryProof } from '@/lib/filing/entryProofService';
export const POST = withAuthenticatedRoute<{id:string}>(async ({ctx,params}) => {
  try { return NextResponse.json(await generateEntryProof((await params).id,ctx)); }
  catch(e) { if(e instanceof Error && e.message.startsWith('PROOF_REQUIRES')) return NextResponse.json({error:e.message},{status:422}); throw e; }
},{permission:'filing.approve',write:true});
