import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { buildErrorResponse } from "@/lib/api/error";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["OPEN", "CUSTOMER_RESPONDED", "IN_PROGRESS", "PROCESSING", "RESOLVED", "CLOSED"]),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, requestId, params }) => {
    const { id } = await params;
    const body = await req.json();
    const parse = statusSchema.safeParse(body);
    if (!parse.success) {
      return buildErrorResponse(400, "INVALID_INPUT", "Invalid status value", parse.error.format(), requestId);
    }

    const { status } = parse.data;

    const request = await db.customerRequest.findFirst({
      where: { id },
      select: { id: true },
    });

    if (!request) {
      return buildErrorResponse(404, "NOT_FOUND", "Customer request not found", undefined, requestId);
    }

    const updated = await db.customerRequest.update({
      where: { id },
      data: {
        status,
        ...(status === "RESOLVED" || status === "CLOSED"
          ? { closedAt: new Date(), closedByUserId: ctx.userId }
          : { closedAt: null, closedByUserId: null }),
      },
    });

    return NextResponse.json({ request: updated });
  }
);
