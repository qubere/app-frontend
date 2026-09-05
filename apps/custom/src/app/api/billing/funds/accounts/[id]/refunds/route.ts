import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { postLedgerEntry } from "@/modules/billing/funds/ledgerService";

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  if (!(await hasPermission("billing.funds.refund"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.refund required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !body.amount || Number(body.amount) <= 0) {
    return NextResponse.json({ error: "Positive refund amount is required" }, { status: 400 });
  }

  const allowOverride = await hasPermission("billing.funds.override");
  const idempotencyKey = req.headers.get("idempotency-key") || body.idempotencyKey || `refund-${id}-${Date.now()}`;

  try {
    const entry = await postLedgerEntry({
      accountId: ctx.accountId,
      disbursementAccountId: id,
      type: "REFUND_TO_CLIENT",
      amount: -Math.abs(Number(body.amount)),
      description: body.reason || "Refund to client",
      effectiveAt: new Date(),
      createdById: ctx.userId,
      idempotencyKey,
      allowNegativeBalanceOverride: allowOverride,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process refund" }, { status: 400 });
  }
});
