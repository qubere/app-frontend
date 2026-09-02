import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { authorizePortalResource } from "@qubere/auth";
import { generateSimplePdfBuffer } from "@qubere/billing/pdfGenerator";
import { db } from "@qubere/db";

export const GET = withPortalAccount(async (ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id, accountId: ctx.accountId },
    select: {
      id: true,
      invoiceNumber: true,
      accountId: true,
      clientId: true,
      status: true,
      issueDate: true,
      dueDate: true,
      currency: true,
      subtotal: true,
      totalDiscounts: true,
      totalTax: true,
      totalAmount: true,
      paidAmount: true,
      balanceDue: true,
      client: { select: { name: true } },
      lines: {
        select: { description: true, quantity: true, unitPrice: true, amount: true },
      },
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

  const money = (v: unknown) => `$${Number(v).toFixed(2)}`;
  const pdfBuffer = generateSimplePdfBuffer({
    title: `Invoice ${invoice.invoiceNumber}`,
    subtitle: invoice.client?.name ?? "Customer",
    metadata: {
      "Invoice Number": invoice.invoiceNumber,
      "Issue Date": new Date(invoice.issueDate).toLocaleDateString(),
      "Due Date": new Date(invoice.dueDate).toLocaleDateString(),
      "Currency": invoice.currency,
      "Status": invoice.status,
      "Subtotal": money(invoice.subtotal),
      "Discounts": money(invoice.totalDiscounts),
      "Tax": money(invoice.totalTax),
      "Total Amount": money(invoice.totalAmount),
      "Paid Amount": money(invoice.paidAmount),
      "Balance Due": money(invoice.balanceDue),
    },
    tables: [
      {
        heading: "Line Items",
        columns: [
          { key: "description", label: "Description", width: 280 },
          { key: "quantity", label: "Qty", width: 60 },
          { key: "unitPrice", label: "Unit Price", width: 96 },
          { key: "amount", label: "Amount", width: 96 },
        ],
        rows: invoice.lines.map((line) => ({
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: money(line.unitPrice),
          amount: money(line.amount),
        })),
      },
    ],
  });

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});
