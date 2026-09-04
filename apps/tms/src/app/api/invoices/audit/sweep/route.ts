import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import {
  sweepPendingInvoices,
  runFreightAuditAgent,
} from "@/modules/invoices/services/freightAuditAgent";
import { z } from "zod";

/**
 * POST /api/invoices/audit/sweep
 *
 * Sweeps all PENDING carrier invoices with a confirmed POD
 * and runs the Freight Audit Agent on each.
 *
 * Can be triggered:
 *   - On a daily cron schedule
 *   - Manually by an operator
 *   - By an Inngest event (INVOICE_RECEIVED with hasPod: true)
 */
export const POST = withAuthenticatedRoute(async ({ ctx }) => {
  const result = await sweepPendingInvoices(ctx);

  return NextResponse.json({
    success: true,
    ...result,
    message:
      `Freight audit sweep complete. ` +
      `Evaluated: ${result.evaluated}, ` +
      `Auto-approved: ${result.autoApproved}, ` +
      `Escalated: ${result.escalated}, ` +
      `Errors: ${result.errors}.`,
  });
}, { permission: "carrier_invoices.match", write: true });

const auditSingleSchema = z.object({
  carrierInvoiceId: z.string().min(1),
});

/**
 * PUT /api/invoices/audit/sweep
 *
 * Run freight audit on a single specific invoice.
 * Body: { carrierInvoiceId: string }
 */
export const PUT = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();
  const parsed = auditSingleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "carrierInvoiceId is required" },
      { status: 400 }
    );
  }

  const result = await runFreightAuditAgent(ctx, parsed.data.carrierInvoiceId);
  return NextResponse.json(result);
}, { permission: "carrier_invoices.match", write: true });
