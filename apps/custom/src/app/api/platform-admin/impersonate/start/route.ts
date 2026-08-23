import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { startImpersonationSession } from "@qubere/auth";

export const POST = withAuthenticatedRoute(
  async ({ ctx, req }) => {
    try {
      const body = await req.json();
      const { targetAccountId, targetUserId, reason, durationMinutes } = body;

      if (!targetAccountId || !targetUserId || !reason) {
        return NextResponse.json(
          { error: "targetAccountId, targetUserId, and reason are required." },
          { status: 400 }
        );
      }

      const session = await startImpersonationSession({
        actorUserId: ctx.actorUserId,
        targetAccountId,
        targetUserId,
        reason,
        durationMinutes: durationMinutes ? Number(durationMinutes) : 60,
      });

      return NextResponse.json({ success: true, session });
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to start impersonation" },
        { status: 400 }
      );
    }
  },
  { permission: "system.impersonate.write" }
);
