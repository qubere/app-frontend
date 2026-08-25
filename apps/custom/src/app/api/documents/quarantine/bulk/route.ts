import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { parseAndValidateBody } from "@/lib/api/validation";
import {
  blockQuarantinedInboundEmail,
  discardQuarantinedInboundEmail,
  getQuarantinedInboundEmail,
  releaseQuarantinedInboundEmail,
} from "@/modules/inbound/quarantineReview";

const bodySchema = z.object({
  action: z.enum(["RELEASE", "DISCARD", "BLOCK"]),
  items: z
    .array(z.object({ inboundEmailId: z.string().min(1), accountId: z.string().min(1).optional() }))
    .min(1)
    .max(100),
});

export const POST = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  const parsed = await parseAndValidateBody(req, bodySchema, requestId);
  if ("response" in parsed) return parsed.response;

  const succeeded: string[] = [];
  const failed: Array<{ inboundEmailId: string; message: string }> = [];

  for (const item of parsed.data.items) {
    try {
      const email = await getQuarantinedInboundEmail(item.inboundEmailId);
      if (!email) throw new Error("Quarantined email no longer exists.");

      if (!ctx.isPlatformAdmin && email.accountId !== ctx.accountId) {
        throw new Error("This quarantined email does not belong to your account.");
      }

      const targetAccountId = ctx.isPlatformAdmin
        ? item.accountId ?? email.accountId
        : ctx.accountId;

      if (parsed.data.action !== "DISCARD" && !targetAccountId) {
        throw new Error("Choose an account before releasing or blocking this email.");
      }
      if (!ctx.isPlatformAdmin && item.accountId && item.accountId !== ctx.accountId) {
        throw new Error("You cannot route a document into another account.");
      }

      if (parsed.data.action === "RELEASE") {
        await releaseQuarantinedInboundEmail({
          inboundEmailId: item.inboundEmailId,
          accountId: targetAccountId!,
          createSenderRoute: true,
          adminUserId: ctx.userId,
        });
      } else if (parsed.data.action === "BLOCK") {
        await blockQuarantinedInboundEmail({
          inboundEmailId: item.inboundEmailId,
          accountId: targetAccountId!,
          adminUserId: ctx.userId,
          requestId,
        });
      } else {
        await discardQuarantinedInboundEmail({
          inboundEmailId: item.inboundEmailId,
          adminUserId: ctx.userId,
          reason: "discarded_from_documents_queue",
        });
      }

      succeeded.push(item.inboundEmailId);
    } catch (error) {
      failed.push({
        inboundEmailId: item.inboundEmailId,
        message: error instanceof Error ? error.message : "Action failed.",
      });
    }
  }

  return NextResponse.json({
    action: parsed.data.action,
    succeeded,
    failed,
    requestId,
  });
}, { permission: "documents.create", write: true });
