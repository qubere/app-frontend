/** POST /api/compliance/batches/:id/cancel -- stops a not-yet-terminal batch; in-flight records still finish. */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { ComplianceBatchService, ComplianceBatchStateError } from "@/modules/complianceBatch/service";

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ params, ctx, requestId }) => {
    try {
      const batch = await ComplianceBatchService.cancelBatch(ctx.accountId, params.id, ctx.userId ?? null, requestId);
      if (!batch) {
        return NextResponse.json({ error: "Batch not found", requestId }, { status: 404 });
      }
      return NextResponse.json({ batch, requestId });
    } catch (err) {
      if (err instanceof ComplianceBatchStateError) {
        return NextResponse.json({ error: err.message, requestId }, { status: 409 });
      }
      throw err;
    }
  },
  { permission: "compliance.bulk_screening.cancel", write: true }
);
