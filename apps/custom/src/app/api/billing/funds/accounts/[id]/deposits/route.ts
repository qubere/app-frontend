import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { postLedgerEntry } from "@/modules/billing/funds/ledgerService";
import { satisfyReplenishmentRequest } from "@/modules/billing/funds/replenishmentService";

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  if (!(await hasPermission("billing.funds.deposit"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.deposit required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !body.amount || Number(body.amount) <= 0) {
    return NextResponse.json({ error: "Positive deposit amount is required" }, { status: 400 });
  }

  const idempotencyKey = req.headers.get("idempotency-key") || body.idempotencyKey || `deposit-${id}-${Date.now()}`;
  const isReplenishment = Boolean(body.replenishmentRequestId);
  const type = isReplenishment ? "REPLENISHMENT_RECEIPT" : "ADVANCE_DEPOSIT";

  try {
    const entry = await postLedgerEntry({
      accountId: ctx.accountId,
      disbursementAccountId: id,
      type,
      amount: Number(body.amount),
      description: body.notes || (isReplenishment ? "Replenishment receipt" : `Advance deposit (Ref: ${body.referenceNo || "N/A"})`),
      effectiveAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
      replenishmentRequestId: body.replenishmentRequestId,
      createdById: ctx.userId,
      idempotencyKey,
    });

    if (body.replenishmentRequestId) {
      await satisfyReplenishmentRequest({
        accountId: ctx.accountId,
        requestId: body.replenishmentRequestId,
        depositId: entry.id,
        depositAmount: Number(body.amount),
        createdById: ctx.userId,
      });
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to record deposit" }, { status: 400 });
  }
});
