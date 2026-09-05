import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import {
  getPriorDisclosure,
  updatePriorDisclosureStatus,
} from "@/modules/postEntry/priorDisclosureCalculator";

const patchSchema = z.object({
  status: z.enum(["TENDERED", "ACKNOWLEDGED", "CLOSED"]),
});

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, params, requestId }) => {
    const disclosure = await getPriorDisclosure(ctx.accountId, params.id);
    if (!disclosure) return buildErrorResponse(404, "NOT_FOUND", "Prior disclosure not found", undefined, requestId);
    return NextResponse.json({ disclosure, requestId });
  },
  { permission: "psc.read" }
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
        return buildErrorResponse(400, "INVALID_INPUT", "Invalid status", err.issues, requestId);
      }
      throw err;
    }

    const result = await updatePriorDisclosureStatus(ctx.accountId, params.id, input.status);
    if (!result.ok) {
      if (result.reason === "NOT_FOUND") {
        return buildErrorResponse(404, "NOT_FOUND", "Prior disclosure not found", undefined, requestId);
      }
      return buildErrorResponse(
        409,
        "INVALID_TRANSITION",
        `Cannot move a ${result.from} disclosure to ${input.status}`,
        undefined,
        requestId
      );
    }
    return NextResponse.json({ disclosure: result.disclosure, requestId });
  },
  { permission: "psc.manage", write: true }
);
