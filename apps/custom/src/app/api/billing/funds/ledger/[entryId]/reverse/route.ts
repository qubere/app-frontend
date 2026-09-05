import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { reverseLedgerEntry } from "@/modules/billing/funds/ledgerService";

export const POST = withAuthenticatedRoute<{ entryId: string }>(async ({ req, ctx, params }) => {
  if (!(await hasPermission("billing.funds.adjust"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.adjust required" }, { status: 403 });
  }

  const { entryId } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !body.reason) {
    return NextResponse.json({ error: "Reversal reason is required" }, { status: 400 });
  }

  const allowOverride = await hasPermission("billing.funds.override");
  const idempotencyKey = req.headers.get("idempotency-key") || body.idempotencyKey || `reverse-${entryId}-${Date.now()}`;

  try {
    const entry = await reverseLedgerEntry({
      accountId: ctx.accountId,
      entryId,
      reason: body.reason,
      createdById: ctx.userId,
      idempotencyKey,
      allowNegativeBalanceOverride: allowOverride,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process reversal" }, { status: 400 });
  }
}, { write: true });
