import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import {
  notificationCategory,
  notificationTypeMeta,
  resolveNotificationHref,
} from "@/modules/notifications/notificationRouting";

export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { accountId: ctx.accountId, userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.notification.count({
      where: { accountId: ctx.accountId, userId: ctx.userId, read: false },
    }),
  ]);

  // Categorize + deep-link server-side so the bell renders straight from the row.
  const enriched = notifications.map((n) => ({
    ...n,
    category: notificationCategory(n.type),
    categoryLabel: notificationTypeMeta(n.type).label,
    href: resolveNotificationHref(n),
  }));

  return NextResponse.json({ notifications: enriched, unreadCount, requestId });
});
