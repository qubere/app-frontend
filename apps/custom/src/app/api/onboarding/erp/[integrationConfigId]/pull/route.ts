import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { pullErpData } from "@/modules/onboarding/erpImport.service";

export const POST = withAuthenticatedRoute(
  async ({ ctx, requestId, params }) => {
    const integrationConfigId = params.integrationConfigId as string;
    try {
      const result = await pullErpData(ctx.accountId, integrationConfigId);
      return NextResponse.json({ ...result, requestId }, { status: 201 });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "NOT_FOUND") return buildErrorResponse(404, "NOT_FOUND", "ERP integration not found", undefined, requestId);
      return buildErrorResponse(500, "ERP_PULL_FAILED", e.message ?? "ERP pull failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage" }
);
