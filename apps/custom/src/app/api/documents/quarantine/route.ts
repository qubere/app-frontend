import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db, withDataModeContext } from "@/lib/db";
import { listQuarantinedInboundEmails } from "@/modules/inbound/quarantineReview";

export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  // A quarantined InboundEmail has no accountId by definition (see
  // quarantineReview.ts) -- the shared inbound address means an unrecognized
  // sender can't yet be attributed to a tenant. Filtering by ctx.accountId
  // would therefore always return zero rows, silently pretending the queue
  // is empty. Until per-account mailbox routing lands (see
  // docs/architecture/INBOUND_EMAIL_TENANT_ROUTING.md), only platform admins
  // can safely see this queue -- showing it to a tenant would leak another
  // tenant's inbound mail (subject, sender, attachments) before it has been
  // attributed to anyone.
  const [items, accounts] = await Promise.all([
    ctx.isPlatformAdmin ? listQuarantinedInboundEmails() : Promise.resolve([]),
    ctx.isPlatformAdmin
      ? // Account itself is dataMode-scoped; this route runs inside the
        // calling admin's own ctx.dataMode (usually PRODUCTION). Without
        // this bypass, DEMO/SANDBOX accounts silently vanish from the
        // routing dropdown -- same class of bug as the sibling
        // listQuarantinedInboundEmails() call above, which already bypasses.
        withDataModeContext(null, async () =>
          db.account.findMany({
            where: { deletedAt: null, status: "ACTIVE" },
            select: { id: true, name: true, type: true },
            orderBy: { name: "asc" },
          })
        )
      : Promise.resolve([{ id: ctx.accountId, name: ctx.accountName, type: ctx.accountType }]),
  ]);

  return NextResponse.json({
    items,
    accounts,
    canRouteAcrossAccounts: ctx.isPlatformAdmin,
    requestId,
  });
}, { permission: "documents.read" });
