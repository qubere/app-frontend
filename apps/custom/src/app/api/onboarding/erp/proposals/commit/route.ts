import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { z } from "zod";
import { commitErpProposals } from "@/modules/onboarding/erpImport.service";

const commitSchema = z.object({
  integrationConfigId: z.string().min(1),
  items: z
    .array(
      z.object({
        proposalId: z.string(),
        action: z.enum(["create", "link_existing", "skip"]),
        linkTargetId: z.string().optional(),
      })
    )
    .min(1),
});

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const bodyVal = await parseAndValidateBody(req, commitSchema, requestId);
    if (!("data" in bodyVal)) return bodyVal.response;
    const { integrationConfigId, items } = bodyVal.data;

    try {
      const result = await commitErpProposals(
        ctx.accountId,
        ctx.userId ?? null,
        integrationConfigId,
        items
      );
      return NextResponse.json({ ...result, requestId }, { status: 201 });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "NOT_FOUND") return buildErrorResponse(404, "NOT_FOUND", e.message ?? "Not found", undefined, requestId);
      return buildErrorResponse(500, "COMMIT_FAILED", e.message ?? "Commit failed", undefined, requestId);
    }
  },
  { permission: "onboarding.manage" }
);
