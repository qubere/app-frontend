/** DELETE /api/compliance/batches/templates/:id -- removes one of this tenant's saved column-mapping templates. */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { ComplianceBatchTemplateService } from "@/modules/complianceBatch/templates";

export const DELETE = withAuthenticatedRoute<{ id: string }>(
  async ({ params, ctx, requestId }) => {
    const deleted = await ComplianceBatchTemplateService.delete(ctx.accountId, params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Template not found", requestId }, { status: 404 });
    }
    return NextResponse.json({ requestId });
  },
  { permission: "compliance.bulk_screening.create", write: true }
);
