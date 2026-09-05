import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { db as prisma } from "@qubere/db";
import { runStatementReconciliation } from "@/modules/billing/funds/reconciliationService";

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  if (!(await hasPermission("billing.funds.view"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.view required" }, { status: 403 });
  }

  const reconciliations = await prisma.statementReconciliation.findMany({
    where: { accountId: ctx.accountId },
    include: {
      statementRecord: true,
      lines: true,
    },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json({ reconciliations });
});

export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  if (!(await hasPermission("billing.funds.reconcile"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.reconcile required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.statementRecordId) {
    return NextResponse.json({ error: "statementRecordId is required" }, { status: 400 });
  }

  try {
    const recon = await runStatementReconciliation({
      accountId: ctx.accountId,
      statementRecordId: body.statementRecordId,
      createdById: ctx.userId,
    });
    return NextResponse.json({ reconciliation: recon });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Reconciliation failed" }, { status: 400 });
  }
});
