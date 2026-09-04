/**
 * The one way to raise an in-app (bell) notification.
 *
 * Wraps db.notification.create with:
 *   - a typed `type` that notificationRouting.ts knows how to categorize + link
 *   - optional dedupe, replacing the ad-hoc "findFirst then maybe create"
 *     guard that inbound-email and quarantine-review each carried
 *
 * Delivery is best-effort: a notification is a nicety layered on top of the
 * real state change, so a failure here is logged and swallowed, never
 * propagated to the caller.
 */

import { db } from "@/lib/db";
import { NOTIFICATION_TYPE_META } from "./notificationRouting";

export interface NotifyArgs {
  accountId: string;
  userId: string;
  type: keyof typeof NOTIFICATION_TYPE_META | (string & {});
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  /**
   * When set, no notification is created if one already exists for this
   * (accountId, userId, type, entityType, entityId). Use for retry-safe
   * producers (cron sweeps, worker steps that can re-run).
   */
  dedupe?: boolean;
}

export async function notify(args: NotifyArgs): Promise<{ created: boolean }> {
  const { accountId, userId, type, message, entityType = null, entityId = null, dedupe = false } = args;

  try {
    if (dedupe) {
      const existing = await db.notification.findFirst({
        where: { accountId, userId, type, entityType, entityId },
        select: { id: true },
      });
      if (existing) return { created: false };
    }

    await db.notification.create({
      data: { accountId, userId, type, message, entityType, entityId },
    });
    return { created: true };
  } catch (err) {
    console.error("[notify] failed to create notification", { type, entityType, entityId, err });
    return { created: false };
  }
}
