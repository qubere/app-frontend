/**
 * GET /api/compliance/batches/templates -- lists this tenant's saved
 * column-mapping templates.
 *
 * POST /api/compliance/batches/templates -- creates one ({ name,
 * fieldMappings }, JSON body).
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { ComplianceBatchTemplateService, ComplianceBatchTemplateValidationError } from "@/modules/complianceBatch/templates";

export const GET = withAuthenticatedRoute(
  async ({ ctx, requestId }) => {
    const templates = await ComplianceBatchTemplateService.list(ctx.accountId);
    return NextResponse.json({ templates, requestId });
  },
  { permission: "compliance.bulk_screening.view" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    let body: { name?: unknown; fieldMappings?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Expected a JSON body", requestId }, { status: 400 });
    }

    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required", requestId }, { status: 400 });
    }

    try {
      const template = await ComplianceBatchTemplateService.create(
        ctx.accountId,
        ctx.userId ?? null,
        body.name,
        body.fieldMappings
      );
      return NextResponse.json({ template, requestId }, { status: 201 });
    } catch (err) {
      if (err instanceof ComplianceBatchTemplateValidationError) {
        return NextResponse.json({ error: err.message, requestId }, { status: 400 });
      }
      throw err;
    }
  },
  { permission: "compliance.bulk_screening.create", write: true }
);
