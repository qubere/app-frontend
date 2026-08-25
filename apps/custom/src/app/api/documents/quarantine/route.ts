import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { listQuarantinedInboundEmails } from "@/modules/inbound/quarantineReview";

export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  const [items, accounts] = await Promise.all([
    listQuarantinedInboundEmails(ctx.isPlatformAdmin ? undefined : { accountId: ctx.accountId }),
    ctx.isPlatformAdmin
      ? db.account.findMany({
          where: { deletedAt: null, status: "ACTIVE" },
          select: { id: true, name: true, type: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([{ id: ctx.accountId, name: ctx.accountName, type: ctx.accountType }]),
  ]);

  return NextResponse.json({
    items,
    accounts,
    canRouteAcrossAccounts: ctx.isPlatformAdmin,
    requestId,
  });
}, { permission: "documents.read" });
