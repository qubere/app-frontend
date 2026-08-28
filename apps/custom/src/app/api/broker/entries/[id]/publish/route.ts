import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

export const POST = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const { id } = await params;

  const filing = await db.customsFiling.findFirst({
    where: { id, accountId: ctx.accountId },
    include: { shipment: { select: { clientId: true } } },
  });

  if (!filing) {
    return NextResponse.json({ error: "FILING_NOT_FOUND" }, { status: 404 });
  }

  const updatedFiling = await db.customsFiling.update({
    where: { id },
    data: {
      customerVisibleAt: new Date(),
      customerPublishedByUserId: ctx.userId,
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      accountId: ctx.accountId,
      userId: ctx.userId,
      actorUserId: ctx.userId,
      effectiveUserId: ctx.userId,
      action: "BROKER_ENTRY_SUMMARY_PUBLISH",
      entity: "CustomsFiling",
      entityId: id,
      clientId: filing.shipment?.clientId,
      newValue: { customerVisibleAt: updatedFiling.customerVisibleAt },
      source: "BROKER_WORKBENCH",
    },
  });

  return NextResponse.json({
    message: "Entry summary published to customer portal",
    filingId: updatedFiling.id,
    customerVisibleAt: updatedFiling.customerVisibleAt,
  });
}, { permission: "filing.approve", write: true });
