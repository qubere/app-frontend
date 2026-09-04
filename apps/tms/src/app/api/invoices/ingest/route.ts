import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { z } from "zod";
import {
  ingestCarrierInvoice,
  batchIngestCarrierInvoices,
} from "@/modules/invoices/services/invoiceIngestionService";

const lineSchema = z.object({
  chargeType: z.string().min(1),
  description: z.string().optional(),
  amount: z.number(),
});

const singleInvoiceSchema = z.object({
  shipmentId: z.string().min(1),
  carrierId: z.string().min(1),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().datetime().optional(),
  totalAmount: z.number().optional(),
  currency: z.string().default("USD"),
  lines: z.array(lineSchema).min(1),
  sourceDocument: z.string().optional(),
  source: z
    .enum(["EDI_210", "EMAIL_PARSE", "MANUAL", "AP_UPLOAD"])
    .default("MANUAL"),
});

const batchSchema = z.object({
  invoices: z.array(singleInvoiceSchema).min(1).max(50),
});

/**
 * POST /api/invoices/ingest
 *
 * Single invoice: body matches singleInvoiceSchema
 * Batch: body = { invoices: [...] }
 */
export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();

  // Detect batch vs single
  if (Array.isArray(body.invoices)) {
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid batch input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await batchIngestCarrierInvoices(
      ctx,
      parsed.data.invoices.map((inv) => ({
        ...inv,
        invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate) : undefined,
      }))
    );

    return NextResponse.json(result);
  }

  // Single invoice
  const parsed = singleInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await ingestCarrierInvoice(ctx, {
    ...parsed.data,
    invoiceDate: parsed.data.invoiceDate
      ? new Date(parsed.data.invoiceDate)
      : undefined,
  });

  return NextResponse.json(result, { status: 201 });
});
