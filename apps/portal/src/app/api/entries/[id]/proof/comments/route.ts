import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@qubere/db';
import type { EntryProofPayload } from '@qubere/entry-proof';
import { authorizedProof } from '@/lib/entry-proof';
import { noStore, portalData } from '@/lib/portal-scope';
const schema=z.object({lineNumber:z.number().int().positive().optional(),body:z.string().trim().min(1).max(5000)}).strict();
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
 const result=await authorizedProof((await params).id,'portal.entries.comment');
 if(result.error) return result.error;
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success) return NextResponse.json({error:'INVALID_QUESTION'},{status:400});
 const {proof,auth}=result; const {lineNumber,body}=parsed.data;
 if(lineNumber && !(proof.payload as unknown as EntryProofPayload).lines.some(l=>l.lineNumber===lineNumber)) return NextResponse.json({error:'INVALID_LINE'},{status:400});
 const request=await portalData(auth.ctx!,()=>db.$transaction(async tx=>{
  const r=await tx.customerRequest.create({data:{accountId:proof.accountId,clientId:proof.clientId,shipmentId:proof.shipmentId,filingId:proof.filingId,domain:'CUSTOMS',type:'QUESTION',title:lineNumber?`Question about entry line ${lineNumber}`:'Question about Entry Proof',description:body,createdByUserId:auth.ctx!.userId,metadata:{entryProofId:proof.id,entryProofVersion:proof.version,...(lineNumber?{entryProofLineNumber:lineNumber}:{})},messages:{create:{accountId:proof.accountId,clientId:proof.clientId,authorUserId:auth.ctx!.userId,authorType:'CUSTOMER',body}}}});
  await tx.entryProofEvent.create({data:{entryProofId:proof.id,accountId:proof.accountId,type:'CUSTOMER_QUESTION',actorType:'CUSTOMER',actorUserId:auth.ctx!.userId,detail:{requestId:r.id,...(lineNumber?{lineNumber}:{})}}});return r;
 }));
 return NextResponse.json({id:request.id,href:`/requests/${request.id}`},{status:201,...noStore});
}
