import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { withdrawCbpReconciliationFlag } from "@/modules/reconciliation/cbpReconciliationService";

export const DELETE = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const flag = await withdrawCbpReconciliationFlag(ctx.accountId, params.id);
    if (!flag) return buildErrorResponse(404, "NOT_FOUND", "Reconciliation flag not found", undefined, requestId);
    return NextResponse.json({ flag, requestId });
  },
  { permission: "psc.manage", write: true }
);
