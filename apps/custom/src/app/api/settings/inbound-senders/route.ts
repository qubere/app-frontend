import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { createInboundSenderRoute, InboundSenderAlreadyRoutedError, InboundSenderBlockedError } from "@/modules/inbound/senderRouting";

export const GET = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  const [routes, memberships] = await Promise.all([
    db.inboundSenderRoute.findMany({
      where: { accountId: ctx.accountId, ...(new URL(req.url).searchParams.has("clientId") ? { clientId: new URL(req.url).searchParams.get("clientId") || null } : {}) },
      include: { defaultAssignedToUser: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.accountMembership.findMany({
      where: { accountId: ctx.accountId, status: "ACTIVE" },
      include: { user: true },
    }),
  ]);

  return NextResponse.json({
    requestId,
    accountName: ctx.accountName,
    publicDocumentAddress: process.env.RESEND_PUBLIC_DOCUMENT_ADDRESS ?? "docs@inbound.qubere.ai",
    routes,
    teamMembers: memberships.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
    })),
  });
});

const createSchema = z.object({
  email: z.string().trim().email(),
  clientId: z.string().min(1).nullable().optional(),
  defaultAssignedToUserId: z.string().optional(),
});

export const POST = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  const bodyVal = await parseAndValidateBody(req, createSchema, requestId);
  if ("response" in bodyVal) return bodyVal.response;
  const { email, clientId, defaultAssignedToUserId } = bodyVal.data;

  if (defaultAssignedToUserId) {
    const membership = await db.accountMembership.findFirst({
      where: { accountId: ctx.accountId, userId: defaultAssignedToUserId, status: "ACTIVE" },
});
    if (!membership) {
      return buildErrorResponse(
        422,
        "ASSIGNEE_NOT_A_MEMBER",
        "The default assignee must be an active member of this organization.",
        undefined,
        requestId
      );
    }
  }

  try {
    const route = await createInboundSenderRoute({
      accountId: ctx.accountId,
      email,
      clientId,
      defaultAssignedToUserId,
      createdByUserId: ctx.userId,
      auditSource: "UI",
      requestId,
    });

    return NextResponse.json({ route, requestId });
  } catch (error) {
    if (error instanceof InboundSenderAlreadyRoutedError) {
      // Never reveal which other account already claimed this sender.
      return buildErrorResponse(409, "SENDER_ALREADY_ROUTED", error.message, undefined, requestId);
    }
    if (error instanceof InboundSenderBlockedError) {
      return buildErrorResponse(409, "SENDER_BLOCKED", error.message, undefined, requestId);
    }
    throw error;
  }
}, { permission: "settings.manage", write: true });
