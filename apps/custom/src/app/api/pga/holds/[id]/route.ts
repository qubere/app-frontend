import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { getHoldDetail } from "@/lib/pga/holdService";
export const GET = withAuthenticatedRoute<{id: string}>(async ({ ctx, params }) => {
  const [detail, canUpdate, canApprove] = await Promise.all([getHoldDetail(ctx.accountId, params.id), hasPermission("pga.update"), hasPermission("pga.approve")]);
  return NextResponse.json({ ...detail, permissions: { canUpdate, canApprove } });
}, { permission: "pga.read" });
