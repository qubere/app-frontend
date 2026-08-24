import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { z } from "zod";
import { createTenderDraft } from "@/modules/tenders/services/tenderService";

const createTenderSchema = z.object({
  shipmentId: z.string().min(1).optional(),
  carrierId: z.string().min(1),
  freightQuoteId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const GET = withAuthenticatedRoute(
  async ({ req, ctx }: any) => {
    try {
      const tenders = await db.tender.findMany({
        where: { accountId: ctx.accountId },
        orderBy: { createdAt: "desc" },
        include: {
          shipment: true,
          freightQuote: true,
        },
      });
      return NextResponse.json({ tenders });
    } catch (err) {
      return NextResponse.json({ error: "Failed to fetch tenders" }, { status: 500 });
    }
  },
  { permission: "transportation_orders.read" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx }: any) => {
    try {
      const parsed = createTenderSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid tender request", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const result = await createTenderDraft(ctx, parsed.data);
      const tender = result.tender;

      return NextResponse.json({
        ok: true,
        tenderId: tender.id,
        shipmentId: tender.shipmentId,
        carrierId: tender.carrierId,
        status: tender.status,
        dispatched: false,
        wasIdempotent: result.wasIdempotent,
        message: "Tender draft created; no carrier message has been sent",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create tender draft";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  },
  { permission: "tenders.send", write: true }
);
