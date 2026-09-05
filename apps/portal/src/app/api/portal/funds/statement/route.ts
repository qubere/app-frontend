import { NextResponse } from "next/server";
import { db as prisma } from "@qubere/db";
import { withPortalAccount, portalScope, portalData } from "@/lib/portal-scope";

export const GET = withPortalAccount(async (_ctx, req: Request) => {
  const s = await portalScope(req, "portal.access");
  if (s.error) return s.error;

  return portalData(s.ctx, async () => {
    const clientId = s.clientIds?.[0];
    if (!clientId) return new NextResponse("No client", { status: 400 });

    const account = await prisma.dutyDisbursementAccount.findFirst({
      where: { accountId: s.ctx.accountId, clientId },
      include: { client: true },
    });

    if (!account) return new NextResponse("Account not found", { status: 404 });

    const entries = await prisma.fundsLedgerEntry.findMany({
      where: { disbursementAccountId: account.id },
      orderBy: { effectiveAt: "asc" },
    });

    const header = `STATEMENT OF DISBURSEMENTS & CLIENT TRUST MOVEMENTS\nClient: ${account.client.name}\nCurrent Trust Balance: $${Number(account.currentBalance).toFixed(2)}\n\nDate,Type,Description,Amount,Running Balance\n`;
    const rows = entries
      .map(
        (e) =>
          `"${e.effectiveAt.toISOString().slice(0, 10)}","${e.type}","${e.description.replace(/"/g, '""')}",${e.amount.toString()},${e.runningBalance.toString()}`
      )
      .join("\n");

    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="statement-of-disbursements-${clientId}.csv"`,
      },
    });
  });
});
