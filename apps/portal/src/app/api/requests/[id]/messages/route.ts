import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { authorizePortalResource } from "@qubere/auth";
import { db } from "@qubere/db";
import { z } from "zod";

const messageSchema = z.object({
  body: z.string().min(1, "Message body cannot be empty"),
  version: z.number().optional(),
});

export const POST = withPortalAccount(async (ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const json = await req.json();
  const parseVal = messageSchema.safeParse(json);
  if (!parseVal.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parseVal.error.format() }, { status: 400 });
  }

  const { body, version } = parseVal.data;

  // 1. Fetch request for authorization check
  const request = await db.customerRequest.findUnique({
    where: { id },
    select: { id: true, accountId: true, clientId: true, version: true, status: true },
  });

  if (!request) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const auth = await authorizePortalResource({
    permission: "portal.requests.respond",
    resourceAccountId: request.accountId,
    resourceClientId: request.clientId,
  });

  if (!auth.authorized || auth.errorResponse || !auth.ctx) {
    return auth.errorResponse || NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // 2. Optimistic concurrency check
  if (version !== undefined && version !== request.version) {
    return NextResponse.json(
      { error: "CONFLICT", message: "Request was updated by another session. Please refresh." },
      { status: 409 }
    );
  }

  // 3. Append message and update request status in transaction
  const [createdMessage, updatedRequest] = await db.$transaction([
    db.customerRequestMessage.create({
      data: {
        requestId: id,
        accountId: request.accountId,
        clientId: request.clientId,
        authorUserId: auth.ctx.userId,
        authorType: "CUSTOMER",
        body,
      },
    }),
    db.customerRequest.update({
      where: { id },
      data: {
        status: "CUSTOMER_RESPONDED",
        version: { increment: 1 },
      },
    }),
    db.auditLog.create({
      data: {
        accountId: request.accountId,
        userId: auth.ctx.userId,
        actorUserId: auth.ctx.userId,
        effectiveUserId: auth.ctx.userId,
        action: "CUSTOMER_REQUEST_RESPOND",
        entity: "CustomerRequest",
        entityId: id,
        clientId: request.clientId,
        newValue: { bodyLength: body.length, status: "CUSTOMER_RESPONDED" },
        source: "PORTAL_UI",
      },
    }),
  ]);

  return NextResponse.json({
    message: createdMessage,
    requestStatus: updatedRequest.status,
    version: updatedRequest.version,
  });
});
