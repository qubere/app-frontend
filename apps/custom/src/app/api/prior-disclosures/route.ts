import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import {
  calculate1592PenaltyExposure,
  listPriorDisclosures,
  recordPriorDisclosureEntry,
} from "@/modules/postEntry/priorDisclosureCalculator";

const createSchema = z.object({
  filingId: z.string().nullish(),
  entryNumber: z.string().max(30).nullish(),
  description: z.string().min(1).max(2000),
  culpability: z.enum(["NEGLIGENCE", "GROSS_NEGLIGENCE", "FRAUD"]),
  actualDutyLoss: z.number().nonnegative(),
  enteredValue: z.number().nonnegative(),
  interestRatePct: z.number().min(0).max(25).optional(),
  yearsElapsed: z.number().min(0).max(20).optional(),
  // When true, only return the computed exposure without persisting.
  previewOnly: z.boolean().optional(),
});

export const GET = withAuthenticatedRoute(
  async ({ ctx, req, requestId }) => {
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    const disclosures = await listPriorDisclosures(ctx.accountId, status);
    return NextResponse.json({ disclosures, requestId });
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
      input = createSchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        return buildErrorResponse(400, "INVALID_INPUT", "Invalid prior disclosure", err.issues, requestId);
      }
      throw err;
    }

    const exposure = calculate1592PenaltyExposure({
      actualDutyLoss: input.actualDutyLoss,
      enteredValue: input.enteredValue,
      culpability: input.culpability,
      interestRatePct: input.interestRatePct,
      yearsElapsed: input.yearsElapsed,
    });

    if (input.previewOnly) {
      return NextResponse.json({ exposure, requestId });
    }

    const disclosure = await recordPriorDisclosureEntry({
      accountId: ctx.accountId,
      filingId: input.filingId ?? null,
      entryNumber: input.entryNumber ?? null,
      description: input.description,
      culpability: input.culpability,
      actualDutyLoss: input.actualDutyLoss,
      enteredValue: input.enteredValue,
      interestRatePct: input.interestRatePct,
      yearsElapsed: input.yearsElapsed,
      createdByUserId: ctx.userId,
    });

    return NextResponse.json({ disclosure, exposure, requestId }, { status: 201 });
  },
  { permission: "psc.create", write: true }
);
