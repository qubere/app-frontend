import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { getAssistMatches } from "@/lib/valuation/assistMatchingService";
import { z } from "zod";
export const GET = withAuthenticatedRoute(async ({req,ctx}) => {
  const filingId=z.string().min(1).parse(new URL(req.url).searchParams.get("filingId"));
  const result=await getAssistMatches(ctx.accountId,filingId);
  return NextResponse.json({matches:result.matches,staleDecisions:result.staleDecisions,declarations:result.declarations,filingStatus:result.filing.filingStatus,
    canUpdate:await hasPermission("valuation.update"),canOverride:await hasPermission("valuation.override")});
},{permission:"valuation.read"});
