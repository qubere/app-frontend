import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { resolveMatchProposal } from "@/modules/matching/ambiguousMatchService";
import { z } from "zod";

const resolveSchema = z.object({
  action: z.enum(["CONFIRM", "CREATE_NEW", "REJECT"]),
  selectedPartyId: z.string().nullable().optional(),
  selectedProductId: z.string().nullable().optional(),
});

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const { id } = await params;
  const json = await req.json();
  const parsed = resolveSchema.parse(json);

  const updated = await resolveMatchProposal(
    { accountId: ctx.accountId, userId: ctx.userId },
    {
      proposalId: id,
      action: parsed.action,
      selectedPartyId: parsed.selectedPartyId ?? null,
      selectedProductId: parsed.selectedProductId ?? null,
    }
  );

  return NextResponse.json({ success: true, proposal: updated });
}, { permission: "parties.manage", write: true });
