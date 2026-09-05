import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import {
  flagEntryForCbpReconciliation,
  listCbpReconciliationFlags,
} from "@/modules/reconciliation/cbpReconciliationService";

const flagSchema = z.object({
  filingId: z.string().nullish(),
  entryNumber: z.string().min(1).max(30),
  entryDate: z.string().datetime(),
  reconcilableIssues: z
    .array(z.enum(["VALUE", "CLASSIFICATION", "FTA_ELIGIBILITY", "SECTION_9802"]))
    .min(1),
  estimatedDutyDifference: z.number().optional(),
});

export const GET = withAuthenticatedRoute(
  async ({ ctx, req, requestId }) => {
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    const flags = await listCbpReconciliationFlags(ctx.accountId, status);
    return NextResponse.json({ flags, requestId });
  },
  { permission: "psc.read" }
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
      input = flagSchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        return buildErrorResponse(400, "INVALID_INPUT", "Invalid reconciliation flag", err.issues, requestId);
      }
      throw err;
    }

    const flag = await flagEntryForCbpReconciliation({
      accountId: ctx.accountId,
      filingId: input.filingId ?? null,
      entryNumber: input.entryNumber,
      entryDate: input.entryDate,
      reconcilableIssues: input.reconcilableIssues,
      estimatedDutyDifference: input.estimatedDutyDifference,
      createdByUserId: ctx.userId,
    });

    return NextResponse.json({ flag, requestId }, { status: 201 });
  },
  { permission: "psc.manage", write: true }
);
