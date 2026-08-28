import { NextResponse } from "next/server";
import { getAccountContext, getEffectiveUserScope, hasPermission } from "@qubere/auth";
import { db } from "@qubere/db";

const meCache = new Map<string, { data: any; time: number }>();
const CACHE_TTL_MS = 300 * 1000; // 300 seconds (5 minutes)

export function invalidateMeCache(userId?: string) {
  if (userId) {
    for (const key of meCache.keys()) {
      if (key.startsWith(userId)) meCache.delete(key);
    }
  } else {
    meCache.clear();
  }
}

export async function GET(req: Request) {
  const ctx = await getAccountContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const forceRefresh = new URL(req.url).searchParams.get("refresh") === "1";
  const cacheKey = `${ctx.userId}:${ctx.accountId}`;
  const cached = meCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
      },
    });
  }

  const scope = await getEffectiveUserScope(ctx.userId, ctx.accountId, ctx.roleNames || []);

  const [user, authorizedClients] = await Promise.all([
    db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    }),
    db.client.findMany({
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
    }),
  ]);

  const email = user?.email || ctx.email || "porter@target.com";
  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email : (ctx.firstName ? `${ctx.firstName} ${ctx.lastName || ""}`.trim() : email);

  const perms = new Set(ctx.permissions || []);
  const isOwnerOrAdmin = ctx.isPlatformAdmin || ctx.roleNames.includes("OWNER") || ctx.roleNames.includes("ADMIN");

  const hasPorterView = isOwnerOrAdmin || perms.has("portal.porter") || perms.has("portal.access");
  const hasCustomsAccess = hasPorterView || perms.has("portal.customs.read") || perms.has("portal.shipments.read");
  const hasTmsAccess = hasPorterView || perms.has("portal.tms.read") || perms.has("portal.orders.read");
  const canUploadDocuments = isOwnerOrAdmin || perms.has("portal.documents.create");
  const canRespondRequests = isOwnerOrAdmin || perms.has("portal.requests.respond");

  const responseData = {
    user: {
      id: user?.id || ctx.userId,
      email,
      name,
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
  };

  meCache.set(cacheKey, { data: responseData, time: Date.now() });

  return NextResponse.json(responseData, {
    headers: {
      "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
    },
  });
}
