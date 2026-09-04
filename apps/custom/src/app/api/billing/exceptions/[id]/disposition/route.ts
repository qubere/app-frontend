import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams } from "@/lib/api/validation";
import { hasPermission } from "@/lib/auth";
import { disposeBillingException } from "@/lib/billing/disposeBillingException";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });

const bodySchema = z.object({
  disposition: z.enum(["RESOLVED", "WAIVED"]),
  reason: z.string().trim().min(1, "A resolution reason is required"),
});

/**
 * Resolve or waive a billing exception from the Today lane. Same core
 * transition as the billing workspace server action
 * (app/billing/exceptions/actions.ts) -- resolve and waive gate on different
 * permissions.
 */
export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, requestId, params }) => {
  const paramsVal = validatePathParams(params, paramsSchema, requestId);
  if ("response" in paramsVal) return paramsVal.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body", requestId }, { status: 400 });
  }
  const { disposition, reason } = parsed.data;

  const permission = disposition === "WAIVED" ? "billing.exception.waive" : "billing.exception.resolve";
  if (!(await hasPermission(permission))) {
    return NextResponse.json({ error: `Forbidden: ${permission} required`, requestId }, { status: 403 });
  }

  try {
    await disposeBillingException(
      { accountId: ctx.accountId, userId: ctx.userId, dataMode: ctx.dataMode },
      paramsVal.data.id,
      reason,
      disposition
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update billing exception", requestId },
      { status: 409 }
    );
  }

  revalidatePath("/app/billing/exceptions");
  revalidatePath("/app/billing");
  return NextResponse.json({ success: true, requestId });
}, { write: true });
