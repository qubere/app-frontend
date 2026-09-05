import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { markDisbursementPaid } from "@/modules/billing/funds/disbursementService";

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  if (!(await hasPermission("billing.funds.disburse"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.disburse required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !body.actualAmount || Number(body.actualAmount) <= 0) {
    return NextResponse.json({ error: "Positive actualAmount is required" }, { status: 400 });
  }

  const allowOverride = await hasPermission("billing.funds.override");
  const idempotencyKey = req.headers.get("idempotency-key") || body.idempotencyKey || `markpaid-${id}-${Date.now()}`;

  try {
    const updated = await markDisbursementPaid({
      accountId: ctx.accountId,
      disbursementId: id,
      paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
      cbpPaymentRef: body.cbpPaymentRef,
      actualAmount: Number(body.actualAmount),
      dutyAmount: body.dutyAmount ? Number(body.dutyAmount) : undefined,
      taxAmount: body.taxAmount ? Number(body.taxAmount) : undefined,
      feeAmount: body.feeAmount ? Number(body.feeAmount) : undefined,
      feeBreakdown: body.feeBreakdown,
      paymentMethod: body.paymentMethod,
      createdById: ctx.userId,
      idempotencyKey,
      allowNegativeBalanceOverride: allowOverride,
    });
    return NextResponse.json({ disbursement: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to mark disbursement paid" }, { status: 400 });
  }
}, { write: true });
