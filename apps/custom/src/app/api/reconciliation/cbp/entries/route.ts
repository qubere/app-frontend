import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import {
  createCbpReconciliationEntry,
  listCbpReconciliationEntries,
} from "@/modules/reconciliation/cbpReconciliationService";

const createSchema = z.object({
  reconciliationEntryNumber: z.string().min(1).max(30),
});

export const GET = withAuthenticatedRoute(
  async ({ ctx, requestId }) => {
    const entries = await listCbpReconciliationEntries(ctx.accountId);
    return NextResponse.json({ entries, requestId });
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
        return buildErrorResponse(400, "INVALID_INPUT", "Invalid reconciliation entry", err.issues, requestId);
      }
      throw err;
    }

    const result = await createCbpReconciliationEntry({
      accountId: ctx.accountId,
      reconciliationEntryNumber: input.reconciliationEntryNumber,
      createdByUserId: ctx.userId,
    });
    if (!result.ok) {
      return buildErrorResponse(
        422,
        "NO_FLAGGED_ENTRIES",
        "No FLAGGED entries to bundle into a reconciliation entry",
        undefined,
        requestId
      );
    }
    return NextResponse.json({ entry: result.entry, requestId }, { status: 201 });
  },
  { permission: "psc.manage", write: true }
);
