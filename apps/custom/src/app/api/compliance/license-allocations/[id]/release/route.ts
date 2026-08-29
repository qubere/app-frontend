/**
 * POST /api/compliance/license-allocations/[id]/release -- release a
 * RESERVED license allocation, reversing the ledger commitment it made.
 */
import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { releaseLicenseAllocation, LicenseEventConflictError } from "@/modules/licenses/allocationService";

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, params, ctx, requestId }) => {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const reason = typeof body?.reason === "string" ? body.reason : undefined;

    try {
      const allocation = await releaseLicenseAllocation({
        accountId: ctx.accountId,
        allocationId: params.id,
        userId: ctx.userId,
        reason,
      });
      return NextResponse.json({ allocation, requestId });
    } catch (error) {
      if (error instanceof LicenseEventConflictError) {
        return buildErrorResponse(409, "LICENSE_EVENT_CONFLICT", error.message, undefined, requestId);
      }
      if (error instanceof Error && error.message.includes("not found")) {
        return buildErrorResponse(404, "NOT_FOUND", error.message, undefined, requestId);
      }
      if (error instanceof Error && error.message.includes("not RESERVED")) {
        return buildErrorResponse(409, "INVALID_ALLOCATION_STATE", error.message, undefined, requestId);
      }
      throw error;
    }
  },
  { permission: "licenses.allocate", write: true }
);
