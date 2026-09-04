import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { z } from "zod";
import { autoDispatchTender } from "@/modules/tenders/services/tenderService";

const autoDispatchSchema = z.object({
  shipmentId: z.string().min(1),
  mode: z.string().optional(),
  equipment: z.string().optional(),
  freightQuoteId: z.string().optional(),
});

/**
 * POST /api/tenders/auto-dispatch
 *
 * Policy-gated: scores eligible carriers and creates a tender draft for the
 * top-ranked carrier. A provider integration must acknowledge delivery before
 * the tender can transition to SENT.
 */
export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();
  const parsed = autoDispatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { shipmentId, ...options } = parsed.data;
  const result = await autoDispatchTender(ctx, shipmentId, options);

  return NextResponse.json({
    dispatched: result.dispatched,
    ...(result.tender && {
      tenderId: result.tender.id,
      carrierId: result.tender.carrierId,
      expiresAt: result.tender.expiresAt,
    }),
    ...(result.carrier && {
      carrierName: result.carrier.carrierName,
      carrierScore: result.carrier.score,
    }),
    reason: result.reason ?? null,
  });
}, { permission: "tenders.send", write: true });
