import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { withScopedIdempotency } from "@/lib/api/scopedIdempotency";
import { holdSubmitSchema } from "@/lib/pga/holdContracts";
import { recordManualSubmission } from "@/lib/pga/holdService";
export const POST = withAuthenticatedRoute<{id: string}>(async ({ req, ctx, params, requestId }) =>
  withScopedIdempotency(req, ctx.accountId, requestId, async () => {
    const input = holdSubmitSchema.parse(await req.json());
    const submission = await recordManualSubmission(ctx.accountId, ctx.userId, params.id, req.headers.get("Idempotency-Key")!, input);
    return { submission, message: "Manual filing recorded. Awaiting an agency response; acceptance has not been confirmed." };
  }), { permission: "pga.approve", write: true });
