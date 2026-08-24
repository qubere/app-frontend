import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";

interface RouteParams {
  id: string;
}

export const POST = withAuthenticatedRoute<RouteParams>(
  async ({ ctx, params, requestId }) => {
    const { id } = await params;

    const invoice = await db.carrierInvoice.findFirst({
      where: {
        id,
        accountId: ctx.accountId,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Carrier invoice not found" },
        { status: 404 }
      );
    }

    const updated = await db.carrierInvoice.update({
      where: { id },
      data: {
        settlementStatus: "PAID",
        settledAt: new Date(),
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "CARRIER_INVOICE_SETTLED",
      entity: "CarrierInvoice",
      entityId: invoice.id,
      source: "API",
      requestId,
    });

    return NextResponse.json({ invoice: updated });
  },
  { permission: "tms.access", write: true }
);
