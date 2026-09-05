import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { transmitCbpReconciliationEntry } from "@/modules/reconciliation/cbpReconciliationService";

/** Marks a PREPARED reconciliation entry as TRANSMITTED to CBP. */
export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const result = await transmitCbpReconciliationEntry(ctx.accountId, params.id);
    if (result === null) {
      return buildErrorResponse(404, "NOT_FOUND", "Reconciliation entry not found", undefined, requestId);
    }
    if (!result.ok) {
      return buildErrorResponse(
        409,
        "NOT_PREPARED",
        `Only a PREPARED entry can be transmitted (current: ${result.status})`,
        undefined,
        requestId
      );
    }
    return NextResponse.json({ entry: result.entry, requestId });
  },
  { permission: "psc.manage", write: true }
);
