import { getAccountContext } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { UserManagementPanel } from "./UserManagementPanel";

export default async function AdminUsersPage() {
  const context = await getAccountContext();

  if (!context) {
    return null;
  }

  // AccountMembership carries an Account relation (dataMode-scoped) --
  // without this wrapper the query silently defaults to PRODUCTION isolation.
  // (Role itself is deliberately excluded from dataMode scoping -- see
  // packages/db/src/index.ts -- so the db.role calls below are unaffected.)
  const memberships = await withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () =>
    db.accountMembership.findMany({
      where: { accountId: context.accountId },
      include: { user: true, roles: { include: { role: true } } },
      orderBy: { createdAt: "desc" },
    })
  );

  let availableRoles = await db.role.findMany({
    where: { OR: [{ accountId: context.accountId }, { accountId: null }] },
    orderBy: { name: "asc" },
  });

  if (availableRoles.length === 0) {
    await Promise.all(
      SYSTEM_ROLES.map((name) =>
        db.role.create({
          data: { name, isSystem: true, accountId: null, description: `System ${name} Role` },
        }).catch(() => null)
      )
    );
    availableRoles = await db.role.findMany({
      where: { OR: [{ accountId: context.accountId }, { accountId: null }] },
      orderBy: { name: "asc" },
    });
  }

  const formattedMembers = memberships.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    email: m.user.email,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    roleNames: m.roles.map((mr) => mr.role.name),
  }));

  return (
    <UserManagementPanel
      accountName={context.accountName}
      members={formattedMembers}
      currentUserId={context.userId}
      availableRoles={availableRoles.map((r) => r.name)}
    />
  );
}
