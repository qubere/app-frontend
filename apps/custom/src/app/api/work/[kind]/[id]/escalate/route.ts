import { NextRequest, NextResponse } from "next/server";
import { getAccountContext } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ kind: string; id: string }> }
) {
  const params = await props.params;
  const context = await getAccountContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { kind, id } = params;
  const body = await request.json().catch(() => ({}));
  const note = body.note || "Manual escalation requested.";
  const now = new Date();

  // Find account owner or team manager as default target
  const managerMembership = await db.accountMembership.findFirst({
    where: { accountId: context.accountId, status: "ACTIVE" },
    select: { userId: true },
  });
  const targetUserId = managerMembership?.userId || context.userId;

  if (kind === "decision") {
    const decision = await db.agentDecision.findFirst({
      where: { id, accountId: context.accountId },
    });
    if (!decision) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }

    const newLevel = (decision.escalationLevel || 0) + 1;

    const event = await db.escalationEvent.create({
      data: {
        accountId: context.accountId,
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
      data: {
        escalationLevel: newLevel,
        escalatedAt: now,
        assignedToUserId: targetUserId,
      },
    });

    return NextResponse.json({ success: true, eventId: event.id, level: newLevel });
  }

  if (kind === "exception") {
    const exception = await db.exceptionItem.findFirst({
      where: { id, accountId: context.accountId },
    });
    if (!exception) {
      return NextResponse.json({ error: "Exception not found" }, { status: 404 });
    }

    const newLevel = (exception.escalationLevel || 0) + 1;

    const event = await db.escalationEvent.create({
      data: {
        accountId: context.accountId,
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
      data: {
        escalationLevel: newLevel,
        escalatedAt: now,
        assignedToUserId: targetUserId,
      },
    });

    return NextResponse.json({ success: true, eventId: event.id, level: newLevel });
  }

  return NextResponse.json({ error: `Unsupported work kind: ${kind}` }, { status: 400 });
}
