import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { notify } from "@/modules/notifications/notify";

export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  const body = await req.json();
  const { items, action, assigneeUserId, note } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  const targetUserId = action === "unassign" ? null : assigneeUserId || null;
  const now = new Date();

  // Assignee must be a member of the caller's account.
  if (targetUserId) {
    const member = await db.accountMembership.findFirst({
      where: { accountId: ctx.accountId, userId: targetUserId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Assignee is not a member of this account." }, { status: 400 });
    }
  }

  const succeeded: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const item of items) {
    const { kind, id } = item;
    const key = `${kind}:${id}`;

    try {
      if (kind === "decision") {
        const decision = await db.agentDecision.findFirst({
          where: { id, accountId: ctx.accountId },
        });
        if (!decision) {
          failed.push({ id: key, reason: "not_found" });
          continue;
        }

        await db.agentDecision.update({
          where: { id },
          data: {
            assignedToUserId: targetUserId,
            assignedAt: targetUserId ? now : null,
            assignedBy: ctx.userId,
            assignmentSource: "MANUAL",
            // NOTE: assignment is not "first touch" — firstTouchedAt is set when
            // the assignee actually reviews the item, so an unworked assigned
            // item can still breach SLA and escalate.
          },
        });

        if (targetUserId) {
          await notify({
            accountId: ctx.accountId,
            userId: targetUserId,
            type: "WORK_ASSIGNED",
            message: note || `Decision ${decision.decisionSummary} has been assigned to you.`,
            entityType: "AgentDecision",
            entityId: id,
          });
        }

        succeeded.push(key);
      } else if (kind === "exception") {
        const exception = await db.exceptionItem.findFirst({
          where: { id, accountId: ctx.accountId },
        });
        if (!exception) {
          failed.push({ id: key, reason: "not_found" });
          continue;
        }

        await db.exceptionItem.update({
          where: { id },
          data: {
            assignedToUserId: targetUserId,
            assignedAt: targetUserId ? now : null,
            assignmentSource: "MANUAL",
          },
        });

        if (targetUserId) {
          await notify({
            accountId: ctx.accountId,
            userId: targetUserId,
            type: "WORK_ASSIGNED",
            message: note || `Exception [${exception.category}] ${exception.description} has been assigned to you.`,
            entityType: "ExceptionItem",
            entityId: id,
          });
        }

        succeeded.push(key);
      } else {
        failed.push({ id: key, reason: "unsupported_kind" });
      }
    } catch (err: any) {
      failed.push({ id: key, reason: err?.message || "update_failed" });
    }
  }

  return NextResponse.json({ succeeded, failed });
}, { permission: "specialist.write", write: true });
