import { describe, it, expect } from "vitest";
import {
  SYSTEM_ROLES,
  defaultPermissionsForRole,
  findPermission,
  PERMISSION_CATALOGUE,
} from "./permissions";

describe("Customer Portal Roles and Permissions Catalogue", () => {
  it("should contain all required portal customer roles in SYSTEM_ROLES", () => {
    expect(SYSTEM_ROLES).toContain("CUSTOMER_ADMIN");
    expect(SYSTEM_ROLES).toContain("CUSTOMER_USER");
    expect(SYSTEM_ROLES).toContain("CUSTOMER_VIEWER");
    expect(SYSTEM_ROLES).toContain("CUSTOMER_CUSTOMS_USER");
    expect(SYSTEM_ROLES).toContain("CUSTOMER_TMS_USER");
  });

  it("should register atomic portal permissions in PERMISSION_CATALOGUE", () => {
    const portalPermissions = [
      "porter",
      "portal.porter",
      "portal.access",
      "portal.customs.read",
      "portal.shipments.read",
      "portal.entries.read",
      "portal.entries.download",
      "portal.tms.read",
      "portal.orders.read",
      "portal.loads.read",
      "portal.documents.read",
      "portal.documents.create",
      "portal.requests.read",
      "portal.requests.respond",
      "portal.invoices.read",
      "portal.invoices.download",
      "portal.users.manage",
    ];

    for (const permName of portalPermissions) {
      const def = findPermission(permName);
      expect(def).not.toBeNull();
      expect(def?.category).toBe("Customer");
    }
  });

  it("should grant appropriate default permissions to CUSTOMER_ADMIN", () => {
    const permissions = defaultPermissionsForRole("CUSTOMER_ADMIN");
    expect(permissions).toContain("portal.access");
    expect(permissions).toContain("portal.customs.read");
    expect(permissions).toContain("portal.tms.read");
    expect(permissions).toContain("portal.documents.create");
    expect(permissions).toContain("portal.requests.respond");
    expect(permissions).toContain("portal.users.manage");
  });

  it("should grant appropriate default permissions to CUSTOMER_USER", () => {
    const permissions = defaultPermissionsForRole("CUSTOMER_USER");
    expect(permissions).toContain("portal.access");
    expect(permissions).toContain("portal.shipments.read");
    expect(permissions).toContain("portal.documents.create");
    expect(permissions).toContain("portal.requests.respond");
    expect(permissions).not.toContain("portal.users.manage");
  });

  it("should restrict CUSTOMER_VIEWER from mutation permissions", () => {
    const permissions = defaultPermissionsForRole("CUSTOMER_VIEWER");
    expect(permissions).toContain("portal.access");
    expect(permissions).toContain("portal.shipments.read");
    expect(permissions).not.toContain("portal.documents.create");
    expect(permissions).not.toContain("portal.requests.respond");
    expect(permissions).not.toContain("portal.users.manage");
  });

  it("should enforce product-specific scoping for CUSTOMER_CUSTOMS_USER and CUSTOMER_TMS_USER", () => {
    const customsPerms = defaultPermissionsForRole("CUSTOMER_CUSTOMS_USER");
    expect(customsPerms).toContain("portal.customs.read");
    expect(customsPerms).not.toContain("portal.tms.read");

    const tmsPerms = defaultPermissionsForRole("CUSTOMER_TMS_USER");
    expect(tmsPerms).toContain("portal.tms.read");
    expect(tmsPerms).not.toContain("portal.customs.read");
  });
});
