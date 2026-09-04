import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { z } from "zod";

const createQuoteSchema = z.object({
  shipmentId: z.string(),
  carrierId: z.string(),
  amount: z.number().positive(),
  sellAmount: z.number().positive().optional(),
  currency: z.string().default("USD"),
  transitDays: z.number().int().positive().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  source: z.enum(["MANUAL", "PROVIDER_API"]).default("MANUAL"),
  providerName: z.string().optional().nullable(),
});

export const GET = withAuthenticatedRoute(
  async ({ req, ctx }) => {
    const url = new URL(req.url);
    const shipmentId = url.searchParams.get("shipmentId");

    const quotes = await db.freightQuote.findMany({
      where: {
        accountId: ctx.accountId,
        ...(shipmentId ? { shipmentId } : {}),
      },
      orderBy: { sellAmount: "asc" },
    });

    return NextResponse.json({ quotes });
  },
  { permission: "transportation_orders.read" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const body = await req.json();
    const parsed = createQuoteSchema.parse(body);

    const quoteAmount = parsed.amount;
    const sellAmt = parsed.sellAmount ?? quoteAmount;

    const quote = await db.freightQuote.create({
      data: {
        accountId: ctx.accountId,
        shipmentId: parsed.shipmentId,
        carrierId: parsed.carrierId,
        amount: quoteAmount,
        sellAmount: sellAmt,
        currency: parsed.currency,
        transitDays: parsed.transitDays ?? null,
        validUntil: parsed.validUntil ? new Date(parsed.validUntil) : null,
        source: parsed.source,
        providerName: parsed.providerName ?? null,
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: "FREIGHT_QUOTE_CREATED",
      entity: "FreightQuote",
      entityId: quote.id,
      source: "API",
      requestId,
    });

    return NextResponse.json({ quote }, { status: 201 });
  },
  { permission: "transportation_orders.write", write: true }
);
