/**
 * Fan-out helpers for account-level bell notifications -- events that have no
 * single natural assignee (a license expiring, a regulatory notice, a billing
 * anomaly). They go to the people who can act on them: account owners/admins
 * plus anyone holding a named permission.
 */

import { db } from "@/lib/db";
import { notify, type NotifyArgs } from "./notify";

export interface NotifyRoleHoldersArgs extends Omit<NotifyArgs, "userId"> {
  /** Role names that should receive this, on top of OWNER/ADMIN (always included). */
  extraRoles?: string[];
  /** A permission whose holders should also receive this. */
  permission?: string;
}

/**
 * Resolve the active members of `accountId` who are OWNER/ADMIN, hold one of
 * `extraRoles`, or are granted `permission`, and notify each of them.
 * De-duplicates users. Returns the number of notifications created.
 */
export async function notifyAccountRoleHolders(args: NotifyRoleHoldersArgs): Promise<number> {
  const { accountId, extraRoles = [], permission, ...rest } = args;

  const roleNames = ["OWNER", "ADMIN", ...extraRoles];
  const roleOr: Record<string, unknown>[] = [{ name: { in: roleNames } }];
  if (permission) {
    roleOr.push({ rolePermissions: { some: { permission: { name: permission } } } });
  }

  const memberships = await db.accountMembership.findMany({
    where: {
      accountId,
      status: "ACTIVE",
      deletedAt: null,
      roles: { some: { role: { OR: roleOr } } },
    },
    select: { userId: true },
  });

  const userIds = [...new Set(memberships.map((m) => m.userId))];
  let created = 0;
  for (const userId of userIds) {
    const res = await notify({ accountId, userId, ...rest });
    if (res.created) created += 1;
  }
  return created;
}
