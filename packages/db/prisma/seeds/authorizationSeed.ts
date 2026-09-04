import { PrismaClient } from "@prisma/client";
import { PERMISSION_CATALOGUE, SYSTEM_ROLES, defaultPermissionsForRole } from "@qubere/auth";

export async function seedAuthorizationData(db: PrismaClient): Promise<{
  permissionsCreated: number;
  rolesCreated: number;
  grantsAdded: number;
}> {
  console.log("🔒 Seeding Qubere Authorization & Permission Catalog...");

  let permissionsCreated = 0;
  let rolesCreated = 0;
  let grantsAdded = 0;

  // 1. Seed/Update Permissions
  const existingPermissions = await db.permission.findMany({
    select: { id: true, name: true, description: true },
  });
  const permissionByName = new Map(existingPermissions.map((p) => [p.name, p]));

  for (const def of PERMISSION_CATALOGUE) {
    const existing = permissionByName.get(def.name);
    if (existing) {
      if (existing.description !== def.description) {
        await db.permission.update({
          where: { id: existing.id },
          data: { description: def.description },
        });
      }
      continue;
    }

    // Not found under its current name -- check whether this is a rename of
    // a permission already in the DB (via formerNames) before creating a new
    // row. Renaming the existing row in place (rather than creating a new
    // one) preserves its id, so every RolePermission grant already pointing
    // at it -- including custom, tenant-created roles the rest of this seed
    // never touches -- follows the rename for free.
    const formerMatch = def.formerNames
      ?.map((formerName) => permissionByName.get(formerName))
      .find((p): p is NonNullable<typeof p> => p !== undefined);

    if (formerMatch) {
      const renamed = await db.permission.update({
        where: { id: formerMatch.id },
        data: { name: def.name, description: def.description },
      });
      permissionByName.delete(formerMatch.name);
      permissionByName.set(renamed.name, renamed);
      console.log(`  ↳ Renamed permission "${formerMatch.name}" -> "${def.name}" (existing grants preserved).`);
      continue;
    }

    const created = await db.permission.create({
      data: {
        name: def.name,
        description: def.description,
      },
    });
    permissionByName.set(created.name, created);
    permissionsCreated++;
  }

  // 2. Seed System Roles
  const existingRoles = await db.role.findMany({
    where: { OR: [{ isSystem: true }, { accountId: null }] },
    select: { id: true, name: true },
  });
  const roleByName = new Map(existingRoles.map((r) => [r.name.toUpperCase(), r]));

  for (const roleName of SYSTEM_ROLES) {
    if (!roleByName.has(roleName)) {
      const created = await db.role.create({
        data: {
          name: roleName,
          description: `System Role: ${roleName.replace(/_/g, " ")}`,
          isSystem: true,
          accountId: null,
        },
      });
      roleByName.set(roleName, created);
      rolesCreated++;
    }
  }

  // 3. Grant default permissions to each System Role
  for (const roleName of SYSTEM_ROLES) {
    const role = roleByName.get(roleName);
    if (!role) continue;

    const existingGrants = await db.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    });
    const grantedPermissionIds = new Set(existingGrants.map((g) => g.permissionId));

    const defaultPermNames = defaultPermissionsForRole(roleName);
    for (const permName of defaultPermNames) {
      const perm = permissionByName.get(permName);
      if (!perm) continue;

      if (!grantedPermissionIds.has(perm.id)) {
        await db.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
        grantsAdded++;
      }
    }
  }

  console.log(
    `✅ Authorization Seed complete: ${permissionsCreated} permissions created, ${rolesCreated} roles created, ${grantsAdded} grants added.`
  );

  return { permissionsCreated, rolesCreated, grantsAdded };
}
