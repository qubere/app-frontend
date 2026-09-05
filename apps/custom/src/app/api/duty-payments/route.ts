import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import {
  createDutyPaymentInstruction,
  listDutyPaymentInstructions,
} from "@/modules/payments/achDutyPaymentService";

const createSchema = z.object({
  statementRecordId: z.string().nullish(),
  statementNumber: z.string().min(1).max(40),
  statementType: z.enum(["DAILY", "PERIODIC_MONTHLY"]),
  statementDate: z.string().datetime(),
  filerCode: z.string().max(10).nullish(),
  totalDutyAmount: z.number().nonnegative(),
  totalFeeAmount: z.number().nonnegative(),
  totalAmountDue: z.number().nonnegative(),
  paymentMethod: z.enum(["ACH_DEBIT", "ACH_CREDIT"]).optional(),
  // Full number is accepted for convenience but never stored; only last 4 kept.
  payerAccountNumber: z.string().max(30).nullish(),
});

export const GET = withAuthenticatedRoute(
  async ({ ctx, req, requestId }) => {
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    const payments = await listDutyPaymentInstructions(ctx.accountId, status);
    return NextResponse.json({ payments, requestId });
  },
  { permission: "billing.payment.view" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return buildErrorResponse(400, "MALFORMED_JSON", "Failed to parse JSON body", undefined, requestId);
    }
    let input;
    try {
      input = createSchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        return buildErrorResponse(400, "INVALID_INPUT", "Invalid duty payment", err.issues, requestId);
      }
      throw err;
    }

    const payment = await createDutyPaymentInstruction({
      accountId: ctx.accountId,
      statementRecordId: input.statementRecordId ?? null,
      statementNumber: input.statementNumber,
      statementType: input.statementType,
      statementDate: input.statementDate,
      filerCode: input.filerCode ?? null,
      totalDutyAmount: input.totalDutyAmount,
      totalFeeAmount: input.totalFeeAmount,
      totalAmountDue: input.totalAmountDue,
      paymentMethod: input.paymentMethod,
      payerAccountNumber: input.payerAccountNumber ?? null,
      createdByUserId: ctx.userId,
    });

    return NextResponse.json({ payment, requestId }, { status: 201 });
  },
  { permission: "billing.payment.record", write: true }
);
