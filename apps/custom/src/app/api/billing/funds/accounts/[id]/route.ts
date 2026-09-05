import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { getDisbursementAccount, updateDisbursementAccount, calculateDaysOfCoverAndExposure } from "@/modules/billing/funds/accountService";

export const GET = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params }) => {
  if (!(await hasPermission("billing.funds.view"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.view required" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const account = await getDisbursementAccount(ctx.accountId, id);
    const metrics = await calculateDaysOfCoverAndExposure(ctx.accountId, id);
    return NextResponse.json({ account, metrics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Account not found" }, { status: 404 });
  }
});

export const PATCH = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  if (!(await hasPermission("billing.funds.manage"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.manage required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  try {
    const updated = await updateDisbursementAccount(ctx.accountId, id, {
      minimumBalance: body.minimumBalance !== undefined ? Number(body.minimumBalance) : undefined,
      targetBalance: body.targetBalance !== undefined ? Number(body.targetBalance) : undefined,
      autoRequestReplenishment: body.autoRequestReplenishment,
      autoAuthorizeUnder: body.autoAuthorizeUnder !== undefined ? (body.autoAuthorizeUnder === null ? null : Number(body.autoAuthorizeUnder)) : undefined,
      status: body.status,
    });
    return NextResponse.json({ account: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update account" }, { status: 400 });
  }
});
