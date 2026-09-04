import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { createAuditLog } from "@qubere/decisions";
import { z } from "zod";
import { queueTmsMemoryEvent } from "@/lib/inngest/functions/tmsMemoryExtraction";

interface RouteParams {
  id: string;
}

/**
 * PATCH /api/work-items/[id]/resolve
 *
 * Resolves a work queue item — either an ExceptionItem or an AgentDecision.
 * Body: { action: "approve" | "reject" | "resolve", note?: string, itemType?: "EXCEPTION" | "DECISION" }
 */
export const PATCH = withAuthenticatedRoute<RouteParams>(
  async ({ req, ctx, params, requestId }) => {
    const { id } = await params;
    const parsed = z.object({
      action: z.enum(["approve", "reject", "resolve"]),
      note: z.string().trim().min(1).max(2000).optional(),
      itemType: z.enum(["EXCEPTION", "DECISION"]).optional(),
    }).safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid work-item action", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { action, note, itemType } = parsed.data;
    const hasPermission = (permission: string) =>
      ctx.isPlatformAdmin || ctx.permissions.includes(permission);

    // Try AgentDecision first (most common from ops dashboard)
    if (!itemType || itemType === "DECISION") {
      const decision = await db.agentDecision
        .findFirst({ where: { id, accountId: ctx.accountId } })
        .catch(() => null);

      if (decision) {
        if (action === "approve") {
          if (!hasPermission("decisions.approve")) {
            return NextResponse.json({ error: "Missing permission 'decisions.approve'." }, { status: 403 });
          }
          await db.agentDecision.update({
            where: { id },
            data: {
              autoApproved: false,
              status: "Approved",
              triageState: "APPROVED",
              reviewedByUserId: ctx.userId,
            },
          });
          await createAuditLog({
            accountId: ctx.accountId,
            userId: ctx.userId,
            action: "AGENT_DECISION_APPROVED",
            entity: "AgentDecision",
            entityId: id,
            source: "UI",
            requestId,
            metadata: { note: note ?? null },
          });
          await queueTmsMemoryEvent({
            kind: "DECISION_REVIEWED",
            accountId: ctx.accountId,
            eventId: requestId,
            decisionId: id,
            action: "approve",
            note,
          }).catch((error) =>
            console.error("[TMS memory] Failed to enqueue decision approval", error)
          );
          return NextResponse.json({
            success: true,
            type: "DECISION",
            action: "APPROVED",
            id,
          });
        }

        if (action === "reject") {
          if (!hasPermission("decisions.reject")) {
            return NextResponse.json({ error: "Missing permission 'decisions.reject'." }, { status: 403 });
          }
          await db.agentDecision.update({
            where: { id },
            data: {
              autoApproved: false,
              status: "Rejected",
              triageState: "REJECTED",
              reviewedByUserId: ctx.userId,
              blockedReason: note ?? "Rejected by operator.",
            },
          });
          await createAuditLog({
            accountId: ctx.accountId,
            userId: ctx.userId,
            action: "AGENT_DECISION_REJECTED",
            entity: "AgentDecision",
            entityId: id,
            source: "UI",
            requestId,
            metadata: { note: note ?? null },
          });
          await queueTmsMemoryEvent({
            kind: "DECISION_REVIEWED",
            accountId: ctx.accountId,
            eventId: requestId,
            decisionId: id,
            action: "reject",
            note,
          }).catch((error) =>
            console.error("[TMS memory] Failed to enqueue decision rejection", error)
          );
          return NextResponse.json({
            success: true,
            type: "DECISION",
            action: "REJECTED",
            id,
          });
        }
      }
    }

    // Try ExceptionItem
    if (!itemType || itemType === "EXCEPTION") {
      const exception = await db.exceptionItem
        .findFirst({ where: { id, accountId: ctx.accountId } })
        .catch(() => null);

      if (exception) {
        if (action !== "resolve") {
          return NextResponse.json(
            { error: "Exceptions only support the 'resolve' action on this endpoint." },
            { status: 400 }
          );
        }
        if (!hasPermission("exceptions.resolve")) {
          return NextResponse.json({ error: "Missing permission 'exceptions.resolve'." }, { status: 403 });
        }
        if (!note) {
          return NextResponse.json(
            { error: "A resolution note describing the verified fix is required." },
            { status: 400 }
          );
        }
        await db.exceptionItem.update({
          where: { id },
          data: {
            status: "Resolved",
            resolvedAt: new Date(),
            resolvedBy: ctx.userId,
            resolvedByName: ctx.email ?? "Operator",
            resolutionNote: note,
          },
        });
        await createAuditLog({
          accountId: ctx.accountId,
          userId: ctx.userId,
          action: "EXCEPTION_RESOLVED",
          entity: "ExceptionItem",
          entityId: id,
          source: "UI",
          requestId,
          metadata: { resolutionNote: note },
        });
        await queueTmsMemoryEvent({
          kind: "EXCEPTION_RESOLVED",
          accountId: ctx.accountId,
          eventId: requestId,
          exceptionId: id,
        }).catch((error) =>
          console.error("[TMS memory] Failed to enqueue exception resolution", error)
        );
        return NextResponse.json({
          success: true,
          type: "EXCEPTION",
          action: "RESOLVED",
          id,
        });
      }
    }

    return NextResponse.json({ error: "Work item not found" }, { status: 404 });
  },
  { write: true }
);
