import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { listQuarantinedInboundEmails } from "@/modules/inbound/quarantineReview";

export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  if (!ctx.isPlatformAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Platform Admin only", requestId } },
      { status: 403 }
    );
  }

  const items = await listQuarantinedInboundEmails();

  return NextResponse.json({
    items,
    summary: { total: items.length },
    timestamp: new Date().toISOString(),
  });
});
