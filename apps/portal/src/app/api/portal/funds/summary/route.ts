import { NextResponse } from "next/server";
import { db as prisma } from "@qubere/db";
import { withPortalAccount, portalScope, portalData, noStore } from "@/lib/portal-scope";

export const GET = withPortalAccount(async (_ctx, req: Request) => {
  const s = await portalScope(req, "portal.access");
  if (s.error) return s.error;

  return portalData(s.ctx, async () => {
    const clientId = s.clientIds?.[0];
    if (!clientId) {
      return NextResponse.json({ error: "No client scoped" }, { status: 400, ...noStore });
    }

    const setup = await prisma.dutyPaymentSetup.findFirst({
      where: { accountId: s.ctx.accountId, clientId },
    });

    if (setup && setup.mode === "DUTY_DIRECT_PAY") {
      return NextResponse.json({
        isDutyDirectPay: true,
        mode: "DUTY_DIRECT_PAY",
        message: "This importer pays CBP directly; no advance account needed.",
      }, noStore);
    }

    const account = await prisma.dutyDisbursementAccount.findFirst({
      where: { accountId: s.ctx.accountId, clientId },
    });

    if (!account) {
      return NextResponse.json({
        account: null,
        currentBalance: 0,
        minimumBalance: 0,
        targetBalance: 0,
        currency: "USD",
        status: "ACTIVE",
        isDutyDirectPay: false,
      }, noStore);
    }

    // Compute basic days of cover
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const paidEntries = await prisma.fundsLedgerEntry.aggregate({
      where: {
        disbursementAccountId: account.id,
        type: { in: ["DUTY_DISBURSEMENT", "FEE_DISBURSEMENT", "TAX_DISBURSEMENT"] },
        effectiveAt: { gte: thirtyDaysAgo },
      },
      _sum: { amount: true },
    });

    const sum30 = Math.abs(Number(paidEntries._sum.amount || 0));
    const dailyAvg = sum30 / 30;
    const cur = Number(account.currentBalance);
    const daysOfCover = dailyAvg > 0 ? cur / dailyAvg : cur > 0 ? 999 : 0;

    return NextResponse.json({
      account: {
        id: account.id,
        currentBalance: cur,
        minimumBalance: Number(account.minimumBalance),
        targetBalance: Number(account.targetBalance),
        currency: account.currency,
        status: account.status,
        daysOfCover: Math.round(daysOfCover * 10) / 10,
      },
      isDutyDirectPay: false,
      mode: setup?.mode || "BROKER_DISBURSES",
    }, noStore);
  });
});
