import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { assistDecisionSchema } from "@/lib/valuation/assistContracts";
import { saveAssistDecision } from "@/lib/valuation/assistDeclarationService";
export const POST=withAuthenticatedRoute<{id:string}>(async ({req,ctx,params})=>NextResponse.json(await saveAssistDecision(ctx.accountId,ctx.userId,params.id,assistDecisionSchema.parse(await req.json()),true)),{permission:"valuation.update",write:true});
