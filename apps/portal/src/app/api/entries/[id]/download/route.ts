import { NextResponse } from "next/server";
import { authorizePortalResource } from "@qubere/auth";
import { db } from "@qubere/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const filing = await db.customsFiling.findUnique({
    where: { id },
    select: {
      id: true,
      entryNumber: true,
      accountId: true,
      customerVisibleAt: true,
      shipment: { select: { clientId: true } },
    },
  });

  if (!filing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const auth = await authorizePortalResource({
    permission: "portal.entries.download",
    resourceAccountId: filing.accountId,
    resourceClientId: filing.shipment?.clientId,
    customerVisibleAt: filing.customerVisibleAt,
  });

  if (!auth.authorized || auth.errorResponse || !auth.ctx) {
    return auth.errorResponse || NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Audit PDF download
  await db.auditLog.create({
    data: {
      accountId: filing.accountId,
      userId: auth.ctx.userId,
      actorUserId: auth.ctx.userId,
      effectiveUserId: auth.ctx.userId,
      action: "CUSTOMER_PORTAL_ENTRY_SUMMARY_DOWNLOAD",
      entity: "CustomsFiling",
      entityId: filing.id,
      clientId: filing.shipment?.clientId,
      newValue: { entryNumber: filing.entryNumber },
      source: "PORTAL_UI",
    },
  });

  const pdfMockHeader = `%PDF-1.4\n1 0 obj\n<< /Title (CBP Form 7501 Entry Summary ${filing.entryNumber}) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
  const pdfBuffer = Buffer.from(pdfMockHeader, "utf-8");

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CBP-Form-7501-${filing.entryNumber}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
