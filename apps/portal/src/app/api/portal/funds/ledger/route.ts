import { NextResponse } from "next/server";
import { db as prisma } from "@qubere/db";
import { withPortalAccount, portalScope, portalData, noStore } from "@/lib/portal-scope";

export const GET = withPortalAccount(async (_ctx, req: Request) => {
  const s = await portalScope(req, "portal.access");
  if (s.error) return s.error;

  return portalData(s.ctx, async () => {
    const clientId = s.clientIds?.[0];
    if (!clientId) return NextResponse.json({ entries: [] }, noStore);

    const account = await prisma.dutyDisbursementAccount.findFirst({
      where: { accountId: s.ctx.accountId, clientId },
    });

    if (!account) return NextResponse.json({ entries: [] }, noStore);

    const entries = await prisma.fundsLedgerEntry.findMany({
      where: { disbursementAccountId: account.id },
      orderBy: { effectiveAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ entries }, noStore);
  });
});
