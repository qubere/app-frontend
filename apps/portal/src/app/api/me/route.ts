import { NextResponse } from "next/server";
import { getAccountContext, getEffectiveUserScope, hasPermission } from "@qubere/auth";
import { db } from "@qubere/db";

export async function GET() {
  const ctx = await getAccountContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);

  // Fetch client details for authorized client IDs
  const authorizedClients = await db.client.findMany({
    where: {
      accountId: ctx.accountId,
      status: "ACTIVE",
      ...(scope.isAllClients ? {} : { id: { in: scope.authorizedClientIds } }),
    },
    select: {
      id: true,
      name: true,
      contactName: true,
      contactEmail: true,
    },
  });

  const hasPorterView = (await hasPermission("porter")) || (await hasPermission("portal.porter")) || (await hasPermission("portal.access"));
  const hasCustomsAccess = hasPorterView || (await hasPermission("portal.customs.read")) || (await hasPermission("portal.shipments.read"));
  const hasTmsAccess = hasPorterView || (await hasPermission("portal.tms.read")) || (await hasPermission("portal.orders.read"));
  const canUploadDocuments = await hasPermission("portal.documents.create");
  const canRespondRequests = await hasPermission("portal.requests.respond");

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
    },
    account: {
      id: ctx.accountId,
    },
    capabilities: {
      hasPorterView,
      hasCustomsAccess,
      hasTmsAccess,
      canUploadDocuments,
      canRespondRequests,
    },
    clients: authorizedClients,
  });
}
