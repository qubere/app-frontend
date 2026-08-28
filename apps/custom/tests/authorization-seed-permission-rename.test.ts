import { describe, it, expect, vi, beforeEach } from "vitest";
import { seedAuthorizationData } from "../../../packages/db/prisma/seeds/authorizationSeed";

// Exercises the formerNames rename-in-place branch added to seedAuthorizationData:
// a permission catalogued under a new name, whose formerNames lists a name that
// already exists in the database, must be renamed on its existing row (same id,
// so RolePermission grants follow automatically) rather than created as a new row.

function fakeDb(overrides: Record<string, unknown> = {}) {
  return {
    permission: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      create: vi.fn(async ({ data }: any) => ({ id: `perm_${data.name}`, ...data })),
    },
    role: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: any) => ({ id: `role_${data.name}`, ...data })),
    },
    rolePermission: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({})),
    },
    ...overrides,
  } as any;
}

describe("seedAuthorizationData renames a permission via formerNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the existing row in place instead of creating a duplicate", async () => {
    const db = fakeDb({
      permission: {
        findMany: vi.fn(async () => [
          { id: "perm_existing_1", name: "compliance.restricted_party_approve", description: "old description" },
        ]),
        update: vi.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
        create: vi.fn(async ({ data }: any) => ({ id: `perm_${data.name}`, ...data })),
      },
    });

    const result = await seedAuthorizationData(db);

    // The old row was renamed, not duplicated: no create call ever names the old
    // permission under its new name.
    expect(db.permission.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "compliance.restricted_party.approve" }) })
    );

    expect(db.permission.update).toHaveBeenCalledWith({
      where: { id: "perm_existing_1" },
      data: { name: "compliance.restricted_party.approve", description: expect.any(String) },
    });

    // Renaming a permission that was already seeded must not count as a fresh
    // creation: only the update call should touch it, and permissionsCreated
    // must not be incremented for it.
    expect(db.permission.update).toHaveBeenCalledTimes(1);
  });

  it("preserves the row id so existing RolePermission grants follow the rename", async () => {
    const grantedPermissionIds = new Set(["perm_existing_1"]);
    const db = fakeDb({
      permission: {
        findMany: vi.fn(async () => [
          { id: "perm_existing_1", name: "compliance.restricted_party_approve", description: "old description" },
        ]),
        update: vi.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
        create: vi.fn(async ({ data }: any) => ({ id: `perm_${data.name}`, ...data })),
      },
      role: {
        findMany: vi.fn(async () => [{ id: "role_BROKER_ADMIN", name: "BROKER_ADMIN" }]),
        create: vi.fn(async ({ data }: any) => ({ id: `role_${data.name}`, ...data })),
      },
      rolePermission: {
        findMany: vi.fn(async ({ where }: any) =>
          where.roleId === "role_BROKER_ADMIN"
            ? [...grantedPermissionIds].map((permissionId) => ({ permissionId }))
            : []
        ),
        create: vi.fn(async () => ({})),
      },
    });

    await seedAuthorizationData(db);

    // BROKER_ADMIN already held the pre-rename row's id; since the rename keeps
    // that id, no redundant grant should be created for that role/permission pair.
    expect(db.rolePermission.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: "role_BROKER_ADMIN", permissionId: "perm_existing_1" }),
      })
    );
  });

  it("creates a brand-new row when neither the current nor any former name exists yet", async () => {
    const db = fakeDb();

    await seedAuthorizationData(db);

    expect(db.permission.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "compliance.restricted_party.approve" }) })
    );
    expect(db.permission.update).not.toHaveBeenCalled();
  });
});
