import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { DomainError } from "@/lib/api/error";
import { assistDecisionSchema } from "@/lib/valuation/assistContracts";
import { saveAssistDecision } from "@/lib/valuation/assistDeclarationService";
export const POST=withAuthenticatedRoute<{id:string}>(async ({req,ctx,params})=>{
  const input=assistDecisionSchema.parse(await req.json());
  if(input.amount!==undefined && !await hasPermission("valuation.override"))throw new DomainError("Valuation override permission is required.","FORBIDDEN",403);
  return NextResponse.json(await saveAssistDecision(ctx.accountId,ctx.userId,params.id,input,false));
},{permission:"valuation.update",write:true});
