import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { holdDraftSchema } from "@/lib/pga/holdContracts";
import { saveHoldDraft } from "@/lib/pga/holdService";
export const PATCH = withAuthenticatedRoute<{id: string}>(async ({ req, ctx, params }) => {
  const input = holdDraftSchema.parse(await req.json());
  return NextResponse.json(await saveHoldDraft(ctx.accountId, ctx.userId, params.id, input.version, input.formInput));
}, { permission: "pga.update", write: true });
