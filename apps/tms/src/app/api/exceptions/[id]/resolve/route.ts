import { NextResponse } from "next/server";
import { withAuthenticatedRoute, hasPermission } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog, RISK_ACCEPTANCE_PERMISSION } from "@qubere/decisions";
import { z } from "zod";
import { queueTmsMemoryEvent } from "@/lib/inngest/functions/tmsMemoryExtraction";

const resolveExceptionSchema = z.object({
  actionType: z.enum(["NOTIFY_CARRIER", "ADJUST_ETA", "REROUTE", "EXPEDITE", "CANCEL_REBOOK"]),
  resolutionNotes: z.string().min(1),
});

export const POST = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params, requestId }) => {
    const { id } = await params;
    const body = await req.json();
    const parsed = resolveExceptionSchema.parse(body);

    const exception = await db.exceptionItem.findFirst({
      where: { id, accountId: ctx.accountId },
    });

    if (!exception) {
      return NextResponse.json({ error: "Exception not found" }, { status: 404 });
    }

    // 2-tier permission enforcement (Section 1 & Phase 5):
    // High-impact actions (REROUTE, EXPEDITE, CANCEL_REBOOK) require the stricter risk acceptance permission.
    const isHighImpactAction = ["REROUTE", "EXPEDITE", "CANCEL_REBOOK"].includes(parsed.actionType);

    if (isHighImpactAction) {
      const allowed = await hasPermission(RISK_ACCEPTANCE_PERMISSION);
      if (!allowed) {
        return NextResponse.json(
          {
            error: `Missing required risk-acceptance permission: ${RISK_ACCEPTANCE_PERMISSION} for action ${parsed.actionType}`,
          },
          { status: 403 }
        );
      }
    }

    const resolvedStatus = isHighImpactAction ? "Waived" : "Resolved";

    const updatedException = await db.exceptionItem.update({
      where: { id },
      data: {
        status: resolvedStatus,
        resolvedAt: new Date(),
        assignedToUserId: ctx.userId,
        resolutionNote: parsed.resolutionNotes,
      },
    });

    await createAuditLog({
      accountId: ctx.accountId,
      userId: ctx.userId,
      action: isHighImpactAction ? "LOGISTICS_EXCEPTION_WAIVED" : "LOGISTICS_EXCEPTION_RESOLVED",
      entity: "ExceptionItem",
      entityId: id,
      source: "API",
      requestId,
      metadata: {
        actionType: parsed.actionType,
        resolutionNotes: parsed.resolutionNotes,
        isHighImpactAction,
      },
    });

    await queueTmsMemoryEvent({
      kind: "EXCEPTION_RESOLVED",
      accountId: ctx.accountId,
      eventId: requestId,
      exceptionId: id,
    }).catch((error) => console.error("[TMS memory] Failed to enqueue exception resolution", error));

    return NextResponse.json({ exception: updatedException });
  },
  { permission: "exceptions.resolve", write: true }
);
