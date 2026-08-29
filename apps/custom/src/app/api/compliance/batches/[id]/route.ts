/** GET /api/compliance/batches/:id -- returns one ComplianceBatch's summary for the current tenant. */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { ComplianceBatchService } from "@/modules/complianceBatch/service";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ params, ctx, requestId }) => {
    const batch = await ComplianceBatchService.getBatch(ctx.accountId, params.id);
    if (!batch) {
      return NextResponse.json({ error: "Batch not found", requestId }, { status: 404 });
    }
    return NextResponse.json({ batch, requestId });
  },
  { permission: "compliance.bulk_screening.view" }
);
