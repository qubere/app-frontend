import { NextResponse } from "next/server";
import { getAccountContext, getEffectiveUserScope, resolvePortalClientScope } from "@qubere/auth";
import { getCustomerInvoices } from "@qubere/db";

export async function GET(req: Request) {
  const ctx = await getAccountContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);
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
}
