import { NextRequest, NextResponse } from "next/server";
import { getAccountContext } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const context = await getAccountContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { items, action, assigneeUserId, note } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  const targetUserId = action === "unassign" ? null : assigneeUserId || null;
  const now = new Date();

  const succeeded: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const item of items) {
    const { kind, id } = item;
    const key = `${kind}:${id}`;

    try {
      if (kind === "decision") {
        const decision = await db.agentDecision.findFirst({
          where: { id, accountId: context.accountId },
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
            assignedBy: context.userId,
            assignmentSource: "MANUAL",
            // Mark first touched if reviewer is taking action
            firstTouchedAt: decision.firstTouchedAt || now,
          },
        });

        if (targetUserId) {
          await db.notification.create({
            data: {
              accountId: context.accountId,
              userId: targetUserId,
              type: "WORK_ASSIGNED",
              message: note || `Decision ${decision.decisionSummary} has been assigned to you.`,
              entityType: "AgentDecision",
              entityId: id,
            },
          });
        }

        succeeded.push(key);
      } else if (kind === "exception") {
        const exception = await db.exceptionItem.findFirst({
          where: { id, accountId: context.accountId },
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
            firstTouchedAt: exception.firstTouchedAt || now,
          },
        });

        if (targetUserId) {
          await db.notification.create({
            data: {
              accountId: context.accountId,
              userId: targetUserId,
              type: "WORK_ASSIGNED",
              message: note || `Exception [${exception.category}] ${exception.description} has been assigned to you.`,
              entityType: "ExceptionItem",
              entityId: id,
            },
          });
        }

        succeeded.push(key);
      } else {
        failed.push({ id: key, reason: "unsupported_kind" });
      }
    } catch (err: any) {
      failed.push({ id: key, reason: err.message || "update_failed" });
    }
  }

  return NextResponse.json({ succeeded, failed });
}
