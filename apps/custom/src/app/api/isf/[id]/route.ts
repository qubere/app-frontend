import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import {
  getImporterSecurityFiling,
  submitImporterSecurityFiling,
} from "@/modules/isf/isfTransactionService";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const filing = await getImporterSecurityFiling(ctx.accountId, params.id);
    if (!filing) return buildErrorResponse(404, "NOT_FOUND", "ISF filing not found", undefined, requestId);
    return NextResponse.json({ filing, requestId });
  },
  { permission: "entry.read" }
);

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const filing = await submitImporterSecurityFiling(ctx.accountId, params.id);
    if (!filing) return buildErrorResponse(404, "NOT_FOUND", "ISF filing not found", undefined, requestId);
    return NextResponse.json({ filing, requestId });
  },
  { permission: "entry.submit", write: true }
);
