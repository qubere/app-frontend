import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { notify } from "@/modules/notifications/notify";

/** Hard ceiling for manual escalation bumps (1 = manager, 2 = owner). */
const MAX_MANUAL_LEVEL = 2;

export const POST = withAuthenticatedRoute<{ kind: string; id: string }>(async ({ req, ctx, params }) => {
  const { kind, id } = params;
  const body = await req.json().catch(() => ({}));
  const note = body.note || "Manual escalation requested.";
  const now = new Date();

  // Escalate to a real team manager, falling back to the account owner —
  // never to an arbitrary active member.
  const manager = await db.accountTeamMembership.findFirst({
    where: { role: "MANAGER", team: { accountId: ctx.accountId } },
    select: { userId: true },
  });
  const targetUserId = manager?.userId || ctx.ownerUserId || ctx.userId;

  if (kind === "decision") {
    const decision = await db.agentDecision.findFirst({
      where: { id, accountId: ctx.accountId },
    });
    if (!decision) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }

    if ((decision.escalationLevel || 0) >= MAX_MANUAL_LEVEL) {
      return NextResponse.json(
        { success: false, level: decision.escalationLevel, message: "Already at maximum escalation level." },
        { status: 409 }
      );
    }

    const newLevel = (decision.escalationLevel || 0) + 1;

    const event = await db.escalationEvent.create({
      data: {
        accountId: ctx.accountId,
        workKind: "decision",
        workItemId: id,
        ruleId: "manual",
        fromUserId: decision.assignedToUserId,
        toUserId: targetUserId,
        level: newLevel,
        reason: note,
      },
    });

    await db.agentDecision.update({
      where: { id },
      data: { escalationLevel: newLevel, escalatedAt: now, assignedToUserId: targetUserId },
    });

    if (targetUserId) {
      await notify({
        accountId: ctx.accountId,
        userId: targetUserId,
        type: "WORK_ESCALATED",
        message: `${decision.agentName}: ${note}`,
        entityType: "AgentDecision",
        entityId: id,
      });
    }

    return NextResponse.json({ success: true, eventId: event.id, level: newLevel });
  }

  if (kind === "exception") {
    const exception = await db.exceptionItem.findFirst({
      where: { id, accountId: ctx.accountId },
    });
    if (!exception) {
      return NextResponse.json({ error: "Exception not found" }, { status: 404 });
    }

    if ((exception.escalationLevel || 0) >= MAX_MANUAL_LEVEL) {
      return NextResponse.json(
        { success: false, level: exception.escalationLevel, message: "Already at maximum escalation level." },
        { status: 409 }
      );
    }

    const newLevel = (exception.escalationLevel || 0) + 1;

    const event = await db.escalationEvent.create({
      data: {
        accountId: ctx.accountId,
        workKind: "exception",
        workItemId: id,
        ruleId: "manual",
        fromUserId: exception.assignedToUserId,
        toUserId: targetUserId,
        level: newLevel,
        reason: note,
      },
    });

    await db.exceptionItem.update({
      where: { id },
      data: { escalationLevel: newLevel, escalatedAt: now, assignedToUserId: targetUserId },
    });

    if (targetUserId) {
      await notify({
        accountId: ctx.accountId,
        userId: targetUserId,
        type: "WORK_ESCALATED",
        message: exception.description,
        entityType: "ExceptionItem",
        entityId: id,
      });
    }

    return NextResponse.json({ success: true, eventId: event.id, level: newLevel });
  }

  return NextResponse.json({ error: `Unsupported work kind: ${kind}` }, { status: 400 });
}, { permission: "specialist.write", write: true });
