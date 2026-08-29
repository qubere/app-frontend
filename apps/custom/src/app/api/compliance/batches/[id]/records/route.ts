/** GET /api/compliance/batches/:id/records -- lists BatchRecord rows for one batch, paginated. */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { ComplianceBatchService } from "@/modules/complianceBatch/service";

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? 1) || 1;
    const pageSize = Number(url.searchParams.get("pageSize") ?? 50) || 50;

    const batch = await ComplianceBatchService.getBatch(ctx.accountId, params.id);
    if (!batch) {
      return NextResponse.json({ error: "Batch not found", requestId }, { status: 404 });
    }

    const result = await ComplianceBatchService.listRecords(ctx.accountId, params.id, { page, pageSize });
    return NextResponse.json({ ...result, requestId });
  },
  { permission: "compliance.bulk_screening.view" }
);
