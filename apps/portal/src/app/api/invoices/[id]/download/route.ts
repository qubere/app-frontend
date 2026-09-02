import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { authorizePortalResource } from "@qubere/auth";
import { db } from "@qubere/db";

export const GET = withPortalAccount(async (ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      invoiceNumber: true,
      accountId: true,
      clientId: true,
      status: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Hide internal or draft invoices
  if (["DRAFT", "PENDING_APPROVAL"].includes(invoice.status)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const auth = await authorizePortalResource({
    permission: "portal.invoices.download",
    resourceAccountId: invoice.accountId,
    resourceClientId: invoice.clientId,
  });

  if (!auth.authorized || auth.errorResponse || !auth.ctx) {
    return auth.errorResponse || NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Audit PDF download
  await db.auditLog.create({
    data: {
      accountId: invoice.accountId,
      userId: auth.ctx.userId,
      actorUserId: auth.ctx.userId,
      effectiveUserId: auth.ctx.userId,
      action: "CUSTOMER_PORTAL_INVOICE_DOWNLOAD",
      entity: "Invoice",
      entityId: invoice.id,
      clientId: invoice.clientId,
      newValue: { invoiceNumber: invoice.invoiceNumber },
      source: "PORTAL_UI",
    },
  });

  const pdfMockHeader = `%PDF-1.4\n1 0 obj\n<< /Title (Invoice ${invoice.invoiceNumber}) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
  const pdfBuffer = Buffer.from(pdfMockHeader, "utf-8");

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});
