import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { getPortalWorkspaceScope, resolvePortalClientScope } from "@qubere/auth";
import { getCustomerInvoices } from "@qubere/db";

export const GET = withPortalAccount(async (ctx, req: Request) => {

  const scope = await getPortalWorkspaceScope(ctx);
  const url = new URL(req.url);
  const shipmentId = url.searchParams.get("shipmentId") || undefined;
  const cursor = url.searchParams.get("cursor") || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 50);

  const clientScope = resolvePortalClientScope(scope, url.searchParams.get("clientId"));
  if (clientScope.forbidden) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const result = await getCustomerInvoices({
    accountId: ctx.accountId,
    clientIds: clientScope.clientIds,
    shipmentId,
    limit,
    cursor,
  });

  return NextResponse.json(result);
});
