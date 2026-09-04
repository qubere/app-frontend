import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { reconcileCarrierInvoice } from "../../../modules/invoices/invoiceMatcher";
import { z } from "zod";

const createInvoiceSchema = z.object({
  shipmentId: z.string(),
  carrierId: z.string(),
  documentId: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  totalAmount: z.number().positive(),
  currency: z.string().default("USD"),
  lines: z
    .array(
      z.object({
        chargeType: z.enum(["LINEHAUL", "FUEL_SURCHARGE", "ACCESSORIAL", "DETENTION", "OTHER"]),
        amount: z.number().positive(),
        description: z.string().optional().nullable(),
      })
    )
    .optional(),
});

export const GET = withAuthenticatedRoute(
  async ({ req, ctx }) => {
    const url = new URL(req.url);
    const shipmentId = url.searchParams.get("shipmentId");

    const invoices = await db.carrierInvoice.findMany({
      where: {
        accountId: ctx.accountId,
        ...(shipmentId ? { shipmentId } : {}),
      },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invoices });
  },
  { permission: "carrier_invoices.match" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const body = await req.json();
    const parsed = createInvoiceSchema.parse(body);

    const invoice = await db.carrierInvoice.create({
      data: {
        accountId: ctx.accountId,
        shipmentId: parsed.shipmentId,
        carrierId: parsed.carrierId,
        documentId: parsed.documentId ?? null,
        invoiceNumber: parsed.invoiceNumber ?? null,
        invoiceDate: parsed.invoiceDate ? new Date(parsed.invoiceDate) : null,
        totalAmount: parsed.totalAmount,
        currency: parsed.currency,
        matchStatus: "PENDING",
        lines: parsed.lines
          ? {
              create: parsed.lines.map((l) => ({
                accountId: ctx.accountId,
                chargeType: l.chargeType,
                amount: l.amount,
                description: l.description ?? null,
              })),
            }
          : undefined,
      },
      include: { lines: true },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "CARRIER_INVOICE_INGESTED",
      entity: "CarrierInvoice",
      entityId: invoice.id,
      source: "API",
      requestId,
    });

    // Automatically trigger 3-way match reconciliation
    const matchResult = await reconcileCarrierInvoice({
      accountId: ctx.accountId,
      carrierInvoiceId: invoice.id,
    });

    return NextResponse.json({ invoice, matchResult }, { status: 201 });
  },
  { permission: "carrier_invoices.match", write: true }
);
