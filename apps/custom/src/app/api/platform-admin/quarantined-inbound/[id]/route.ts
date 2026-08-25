import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { buildErrorResponse } from "@/lib/api/error";
import { parseAndValidateBody, validatePathParams } from "@/lib/api/validation";
import {
  releaseQuarantinedInboundEmail,
  discardQuarantinedInboundEmail,
  AssigneeNotAMemberError,
  InboundSenderAlreadyRoutedError,
} from "@/modules/inbound/quarantineReview";

type Params = { id: string };

const pathSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("RELEASE"),
    accountId: z.string().min(1),
    defaultAssignedToUserId: z.string().optional(),
    createSenderRoute: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("DISCARD"),
    reason: z.string().max(500).optional(),
  }),
]);

export const POST = withAuthenticatedRoute<Params>(async ({ req, ctx, params, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Platform Admin only", requestId } },
      { status: 403 }
    );
  }

  const path = validatePathParams(params, pathSchema, requestId);
  if ("response" in path) return path.response;

  const body = await parseAndValidateBody(req, bodySchema, requestId);
  if ("response" in body) return body.response;

  try {
    if (body.data.action === "RELEASE") {
      const item = await releaseQuarantinedInboundEmail({
        inboundEmailId: path.data.id,
        accountId: body.data.accountId,
        defaultAssignedToUserId: body.data.defaultAssignedToUserId,
        createSenderRoute: body.data.createSenderRoute,
        adminUserId: ctx.userId,
      });
      return NextResponse.json({ item, requestId });
    }

    const item = await discardQuarantinedInboundEmail({
      inboundEmailId: path.data.id,
      adminUserId: ctx.userId,
      reason: body.data.reason,
    });
    return NextResponse.json({ item, requestId });
  } catch (error) {
    if (error instanceof AssigneeNotAMemberError) {
      return buildErrorResponse(422, "ASSIGNEE_NOT_A_MEMBER", error.message, undefined, requestId);
    }
    if (error instanceof InboundSenderAlreadyRoutedError) {
      return buildErrorResponse(409, "SENDER_ALREADY_ROUTED", error.message, undefined, requestId);
    }
    throw error;
  }
});
