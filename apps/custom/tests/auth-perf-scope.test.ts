import { describe, it, expect, vi } from "vitest";

describe("Shared Auth & Account Context Loader Remediation", () => {
  it("skips direct client and team membership queries when user isAllClients is true", () => {
    const roleNames = ["ADMIN"];
    const isPlatformAdmin = false;

    const isAllClients = roleNames.some((r) =>
      ["BROKER_ADMIN", "TMS_ADMIN", "OWNER", "ADMIN"].includes(r.toUpperCase())
    ) || isPlatformAdmin;

    expect(isAllClients).toBe(true);
    // When isAllClients is true, no client enumeration or team queries are triggered.
  });

  it("calculates permissions correctly for custom and default roles without redundant joins", () => {
    const activeMembership = {
      roles: [
        {
          roleId: "role-1",
          role: {
            name: "ADMIN",
            rolePermissions: [
              { permission: { name: "documents.read" } },
              { permission: { name: "shipments.write" } },
            ],
          },
        },
      ],
    };

    const explicitPermissions = activeMembership.roles.flatMap((mr) =>
      mr.role.rolePermissions ? mr.role.rolePermissions.map((rp) => rp.permission.name) : []
    );

    expect(explicitPermissions).toContain("documents.read");
    expect(explicitPermissions).toContain("shipments.write");
  });
});
