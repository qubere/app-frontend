import { NextResponse } from "next/server";
import { db as prisma } from "@qubere/db";
import { withPortalAccount, portalScope, portalData, noStore } from "@/lib/portal-scope";

export const POST = withPortalAccount(async (_ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await portalScope(req, "portal.access");
  if (s.error) return s.error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  return portalData(s.ctx, async () => {
    const clientIds = s.clientIds ?? [];
    if (clientIds.length === 0) {
      return NextResponse.json({ error: "No client scoped" }, { status: 400, ...noStore });
    }
    const account = await prisma.dutyDisbursementAccount.findFirst({
      where: { accountId: s.ctx.accountId, clientId: { in: clientIds } },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404, ...noStore });
    }

    const requestObj = await prisma.replenishmentRequest.findFirst({
      where: { id, disbursementAccountId: account.id },
    });

    if (!requestObj) {
      return NextResponse.json({ error: "Request not found" }, { status: 404, ...noStore });
    }

    if (!["REQUESTED", "NOTIFIED", "OVERDUE"].includes(requestObj.state)) {
      return NextResponse.json(
        { error: `Replenishment request is already ${requestObj.state.toLowerCase()}` },
        { status: 409, ...noStore }
      );
    }

    // Create a pending notification exception for staff confirmation
    await prisma.billingException.create({
      data: {
        accountId: s.ctx.accountId,
        type: "IMPORTER_PAYMENT_MARKED_SENT",
        severity: "INFO",
        status: "OPEN",
        description: `Importer marked payment sent for replenishment ${id}: Ref ${body.referenceNo || "N/A"}, Amount $${Number(body.amount || requestObj.amount).toFixed(2)}.`,
        clientId: account.clientId,
      },
    });

    const updated = await prisma.replenishmentRequest.update({
      where: { id },
      data: { state: "NOTIFIED" },
    });

    return NextResponse.json({ replenishment: updated }, noStore);
  });
});
