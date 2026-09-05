import { NextResponse } from "next/server";
import { db as prisma } from "@qubere/db";
import { withPortalAccount, portalScope, portalData, noStore } from "@/lib/portal-scope";

export const GET = withPortalAccount(async (_ctx, req: Request) => {
  const s = await portalScope(req, "portal.access");
  if (s.error) return s.error;

  return portalData(s.ctx, async () => {
    const clientIds = s.clientIds ?? [];
    if (clientIds.length === 0) return NextResponse.json({ replenishments: [] }, noStore);

    const account = await prisma.dutyDisbursementAccount.findFirst({
      where: { accountId: s.ctx.accountId, clientId: { in: clientIds } },
    });

    if (!account) return NextResponse.json({ replenishments: [] }, noStore);

    const replenishments = await prisma.replenishmentRequest.findMany({
      where: {
        disbursementAccountId: account.id,
        state: { in: ["REQUESTED", "NOTIFIED", "OVERDUE"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const wireInstructions = {
      bankName: "First National Commerce Bank",
      accountName: "Qubere Customs Client Trust Account",
      routingNumber: "021000021",
      accountNumberEnding: "9876",
      swiftCode: "FNCBUS33XXX",
      referencePattern: `ADVANCE-${account.clientId.slice(-6).toUpperCase()}`,
    };

    return NextResponse.json({ replenishments, wireInstructions }, noStore);
  });
});
