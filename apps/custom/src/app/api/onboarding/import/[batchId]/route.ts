import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { getBatchProgress } from "@/modules/onboarding/bulkImport.service";

export const GET = withAuthenticatedRoute(
  async ({ ctx, requestId, params }) => {
    const batchId = params.batchId as string;
    const progress = await getBatchProgress(ctx.accountId, batchId);
    if (!progress) return buildErrorResponse(404, "NOT_FOUND", "Batch not found", undefined, requestId);
    return NextResponse.json({ ...progress, requestId });
  },
  { permission: "onboarding.manage" }
);
