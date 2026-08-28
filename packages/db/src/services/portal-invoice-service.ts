import { db } from "../index";
import type { InvoiceStatus } from "@prisma/client";

export interface PortalInvoiceDto {
  id: string;
  invoiceNumber: string;
  clientId: string;
  shipmentId: string | null;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

const CUSTOMER_VISIBLE_STATUSES: InvoiceStatus[] = [
  "SENT",
  "APPROVED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
];

/**
 * Retrieves customer-safe issued invoices for an authorized client.
 * Strictly excludes internal cost margins, rate rules, buy costs, and agent internal notes.
 */
export async function getCustomerInvoices(params: {
  accountId: string;
  clientId?: string;
  shipmentId?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: PortalInvoiceDto[]; nextCursor?: string }> {
  const { accountId, clientId, shipmentId, limit = 25, cursor } = params;

  const invoices = await db.invoice.findMany({
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { issueDate: "desc" },
    where: {
      accountId,
      ...(clientId ? { clientId } : {}),
      status: { in: CUSTOMER_VISIBLE_STATUSES },
      ...(shipmentId ? { lines: { some: { shipmentId } } } : {}),
    },
    include: {
      lines: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          shipmentId: true,
        },
      },
    },
  });

  let nextCursor: string | undefined = undefined;
  if (invoices.length > limit) {
    const nextItem = invoices.pop();
    nextCursor = nextItem?.id;
  }

  const items: PortalInvoiceDto[] = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientId: inv.clientId,
    shipmentId: inv.lines.find((l) => l.shipmentId)?.shipmentId || null,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    currency: inv.currency,
    totalAmount: Number(inv.totalAmount),
    paidAmount: inv.paidAmount ? Number(inv.paidAmount) : 0,
    balanceDue: Number(inv.totalAmount) - (inv.paidAmount ? Number(inv.paidAmount) : 0),
    status: inv.status,
    lineItems: inv.lines.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      amount: Number(li.amount),
    })),
  }));

  return { items, nextCursor };
}
