import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { authorizeDisbursement } from "@/modules/billing/funds/disbursementService";

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  if (!(await hasPermission("billing.funds.authorize"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.authorize required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const force = Boolean(body.force);

  try {
    const updated = await authorizeDisbursement({
      accountId: ctx.accountId,
      disbursementId: id,
      forceHardBlockOverride: force,
    });
    return NextResponse.json({ disbursement: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to authorize disbursement" }, { status: 422 });
  }
}, { write: true });
