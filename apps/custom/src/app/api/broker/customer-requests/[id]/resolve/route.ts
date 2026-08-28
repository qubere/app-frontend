import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { buildErrorResponse } from "@/lib/api/error";

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ ctx, requestId, params }) => {
    const { id } = await params;

    const request = await db.customerRequest.findFirst({
      where: { id, accountId: ctx.accountId },
      select: { id: true },
    });

    if (!request) {
      return buildErrorResponse(404, "NOT_FOUND", "Customer request not found", undefined, requestId);
    }

    const updated = await db.customerRequest.update({
      where: { id },
      data: {
        status: "RESOLVED",
      },
    });

    return NextResponse.json({ request: updated });
  },
  { permission: "shipments.manage", write: true }
);
