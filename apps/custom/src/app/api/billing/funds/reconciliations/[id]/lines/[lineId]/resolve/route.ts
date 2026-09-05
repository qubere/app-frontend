import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { resolveReconciliationLine } from "@/modules/billing/funds/reconciliationService";

export const POST = withAuthenticatedRoute<{ id: string; lineId: string }>(async ({ req, ctx, params }) => {
  if (!(await hasPermission("billing.funds.reconcile"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.reconcile required" }, { status: 403 });
  }

  const { lineId } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !body.action) {
    return NextResponse.json({ error: "Action (ACCEPT | ADJUST | EXCEPTION | RELINK) is required" }, { status: 400 });
  }

  const hasOverride = await hasPermission("billing.funds.override");

  try {
    const line = await resolveReconciliationLine({
      accountId: ctx.accountId,
      lineId,
      action: body.action,
      userId: ctx.userId,
      hasOverridePermission: hasOverride,
      adjustmentAmount: body.adjustmentAmount ? Number(body.adjustmentAmount) : undefined,
    });
    return NextResponse.json({ line });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Line resolution failed" }, { status: 400 });
  }
}, { write: true });
