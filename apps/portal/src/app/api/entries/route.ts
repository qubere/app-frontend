import { NextResponse } from "next/server";
import { getAccountContext, getEffectiveUserScope } from "@qubere/auth";
import { getCustomerPublishedEntries } from "@qubere/db";

export async function GET(req: Request) {
  const ctx = await getAccountContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);
  const url = new URL(req.url);
  const shipmentId = url.searchParams.get("shipmentId") || undefined;
  const clientId = url.searchParams.get("clientId") || (scope.authorizedClientIds.length > 0 ? scope.authorizedClientIds[0] : undefined);
  const cursor = url.searchParams.get("cursor") || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 50);

  const result = await getCustomerPublishedEntries({
    accountId: ctx.accountId,
    clientId,
    shipmentId,
    limit,
    cursor,
  });

  return NextResponse.json(result);
}
