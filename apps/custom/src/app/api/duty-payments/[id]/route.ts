import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import {
  getDutyPaymentInstruction,
  updateDutyPaymentStatus,
} from "@/modules/payments/achDutyPaymentService";

const patchSchema = z.object({
  status: z.enum(["SCHEDULED", "SUBMITTED", "SETTLED", "FAILED", "CANCELLED"]),
  scheduledAt: z.string().datetime().optional(),
  failureReason: z.string().max(500).optional(),
});

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const payment = await getDutyPaymentInstruction(ctx.accountId, params.id);
    if (!payment) return buildErrorResponse(404, "NOT_FOUND", "Duty payment not found", undefined, requestId);
    return NextResponse.json({ payment, requestId });
  },
  { permission: "billing.payment.view" }
);

export const PATCH = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params, requestId }) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return buildErrorResponse(400, "MALFORMED_JSON", "Failed to parse JSON body", undefined, requestId);
    }
    let input;
    try {
      input = patchSchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        return buildErrorResponse(400, "INVALID_INPUT", "Invalid status change", err.issues, requestId);
      }
      throw err;
    }

    const result = await updateDutyPaymentStatus(ctx.accountId, params.id, input.status, {
      scheduledAt: input.scheduledAt,
      failureReason: input.failureReason,
    });
    if (!result.ok) {
      if (result.reason === "NOT_FOUND") {
        return buildErrorResponse(404, "NOT_FOUND", "Duty payment not found", undefined, requestId);
      }
      return buildErrorResponse(
        409,
        "INVALID_TRANSITION",
        `Cannot move a ${result.from} payment to ${input.status}`,
        undefined,
        requestId
      );
    }
    return NextResponse.json({ payment: result.payment, requestId });
  },
  { permission: "billing.payment.record", write: true }
);
