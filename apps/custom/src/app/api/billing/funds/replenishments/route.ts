import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { db as prisma } from "@qubere/db";
import { evaluateAndCreateReplenishmentRequests } from "@/modules/billing/funds/replenishmentService";

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  if (!(await hasPermission("billing.funds.view"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.view required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const state = url.searchParams.get("state") || undefined;
  const disbursementAccountId = url.searchParams.get("disbursementAccountId") || undefined;

  const where: any = { accountId: ctx.accountId };
  if (state) where.state = state;
  if (disbursementAccountId) where.disbursementAccountId = disbursementAccountId;

  const replenishments = await prisma.replenishmentRequest.findMany({
    where,
    include: { disbursementAccount: { include: { client: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ replenishments });
});

export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  if (!(await hasPermission("billing.funds.manage"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.manage required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.autoTrigger) {
    const created = await evaluateAndCreateReplenishmentRequests(ctx.accountId);
    return NextResponse.json({ createdCount: created.length, replenishments: created });
  }

  if (!body.disbursementAccountId || !body.amount || !(Number(body.amount) > 0)) {
    return NextResponse.json({ error: "disbursementAccountId and a positive amount are required" }, { status: 400 });
  }

  // Never trust a caller-supplied disbursementAccountId — confirm it belongs to
  // this tenant before writing a row that references it.
  const disbursementAccount = await prisma.dutyDisbursementAccount.findFirst({
    where: { id: body.disbursementAccountId, accountId: ctx.accountId },
    select: { id: true },
  });
  if (!disbursementAccount) {
    return NextResponse.json({ error: "Disbursement account not found" }, { status: 404 });
  }

  const reqObj = await prisma.replenishmentRequest.create({
    data: {
      accountId: ctx.accountId,
      disbursementAccountId: disbursementAccount.id,
      amount: new Prisma.Decimal(body.amount),
      dueDate: body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      note: body.note || undefined,
      createdById: ctx.userId,
    },
  });

  return NextResponse.json({ replenishment: reqObj }, { status: 201 });
}, { write: true });
