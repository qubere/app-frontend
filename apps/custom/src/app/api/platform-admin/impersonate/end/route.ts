import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { endImpersonationSession } from "@qubere/auth";

export const POST = withAuthenticatedRoute(async ({ ctx }) => {
  try {
    const success = await endImpersonationSession({
      actorUserId: ctx.actorUserId,
      sessionId: ctx.impersonationSessionId,
    });
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to end impersonation" },
      { status: 400 }
    );
  }
});
