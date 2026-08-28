import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { buildErrorResponse } from "@/lib/api/error";
import { z } from "zod";

const bodySchema = z.object({
  body: z.string().min(1, "Message cannot be empty"),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, requestId, params }) => {
    const { id } = await params;
    const bodyRes = await parseAndValidateBody(req, bodySchema, requestId);
    if ("response" in bodyRes) return bodyRes.response;
    const { body } = bodyRes.data;

    const request = await db.customerRequest.findFirst({
      where: { id, accountId: ctx.accountId },
      select: { id: true, accountId: true, clientId: true },
    });

    if (!request) {
      return buildErrorResponse(404, "NOT_FOUND", "Customer request not found", undefined, requestId);
    }

    const [createdMessage] = await db.$transaction([
      db.customerRequestMessage.create({
        data: {
          requestId: id,
          accountId: request.accountId,
          clientId: request.clientId,
          authorUserId: ctx.userId,
          authorType: "BROKER",
          body,
        },
      }),
      db.customerRequest.update({
        where: { id },
        data: {
          status: "OPEN",
          version: { increment: 1 },
        },
      }),
    ]);

    return NextResponse.json({ message: createdMessage });
  },
  { permission: "shipments.manage", write: true }
);
