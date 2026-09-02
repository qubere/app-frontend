import { NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/auth-guards';
import { publishEntryProof } from '@/lib/filing/entryProofService';
export const POST = withAuthenticatedRoute<{id:string}>(async ({ctx,params}) => {
  try {
    const proof=await publishEntryProof((await params).id,ctx);
    return NextResponse.json({message:'Entry Proof published to customer portal',filingId:proof.filingId,entryProofId:proof.id,version:proof.version,customerVisibleAt:proof.publishedAt});
  } catch(e) {
    if(e instanceof Error && e.message.startsWith('PROOF_')) return NextResponse.json({error:e.message},{status:e.message.includes('RETRY')?409:422});
    throw e;
  }
},{permission:'filing.approve',write:true});
