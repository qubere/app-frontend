import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { getEffectiveUserScope, resolvePortalClientScope } from "@qubere/auth";
import { db } from "@qubere/db";

export const GET = withPortalAccount(async (ctx, req: Request) => {

  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const clientId = url.searchParams.get("clientId");
  const cursor = url.searchParams.get("cursor") || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 50);

  const clientScope = resolvePortalClientScope(scope, clientId);
  if (clientScope.forbidden) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const clientFilter =
    clientScope.clientIds === null ? {} : { clientId: { in: clientScope.clientIds } };

  const requests = await db.customerRequest.findMany({
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { updatedAt: "desc" },
    where: {
      accountId: ctx.accountId,
      ...clientFilter,
      ...(status ? { status } : {}),
    },
    include: {
      shipment: {
        select: { id: true, shipmentNumber: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, authorType: true },
      },
    },
  });

  let nextCursor: string | undefined = undefined;
  if (requests.length > limit) {
    const nextItem = requests.pop();
    nextCursor = nextItem?.id;
  }

  const items = requests.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    dueAt: r.dueAt,
    domain: r.domain,
    shipmentId: r.shipmentId,
    shipmentNumber: r.shipment?.shipmentNumber || null,
    lastMessage: r.messages[0] || null,
    updatedAt: r.updatedAt,
  }));

  return NextResponse.json({ items, nextCursor });
});
