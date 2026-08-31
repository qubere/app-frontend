import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { getErpProposals } from "@/modules/onboarding/erpImport.service";

export const GET = withAuthenticatedRoute(
  async ({ ctx, requestId, params }) => {
    const integrationConfigId = params.integrationConfigId as string;
    const result = await getErpProposals(ctx.accountId, integrationConfigId);
    return NextResponse.json({ ...result, requestId });
  },
  { permission: "onboarding.manage" }
);
