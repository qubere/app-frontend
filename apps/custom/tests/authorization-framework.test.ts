import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@qubere/db";
import {
  PERMISSION_CATALOGUE,
  SYSTEM_ROLES,
  defaultPermissionsForRole,
  can,
  authorizeResource,
  startImpersonationSession,
  endImpersonationSession,
  logAuditEvent,
} from "@qubere/auth";

describe("Qubere Unified Authorization & Permissions Framework", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. PERMISSION CATALOG & DEFAULT ROLES ─────────────────────────────────

  describe("Permission Catalog & Role Matrix", () => {
    it("defines atomic permissions in dot-separated format", () => {
      for (const def of PERMISSION_CATALOGUE) {
        expect(def.name).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
        expect(def.description).toBeTruthy();
        expect(def.category).toBeTruthy();
      }
    });

    it("includes required Customs permission catalog", () => {
      const names = PERMISSION_CATALOGUE.map((p) => p.name);
      expect(names).toContain("client.read");
      expect(names).toContain("client.create");
      expect(names).toContain("shipment.read");
      expect(names).toContain("shipment.create");
      expect(names).toContain("document.upload");
      expect(names).toContain("entry.read");
      expect(names).toContain("entry.submit");
      expect(names).toContain("classification.override");
      expect(names).toContain("origin.approve");
      expect(names).toContain("valuation.approve");
      expect(names).toContain("compliance.override");
      expect(names).toContain("pga.approve");
      expect(names).toContain("filing.submit");
      expect(names).toContain("billing.approve");
      expect(names).toContain("audit.read");
    });

    it("includes required TMS permission catalog", () => {
      const names = PERMISSION_CATALOGUE.map((p) => p.name);
      expect(names).toContain("customer.read");
      expect(names).toContain("order.create");
      expect(names).toContain("load.dispatch");
      expect(names).toContain("stop.resequence");
      expect(names).toContain("carrier.approve");
      expect(names).toContain("rate.override");
      expect(names).toContain("quote.send");
      expect(names).toContain("tender.send");
      expect(names).toContain("tracking.update");
      expect(names).toContain("invoice.approve");
      expect(names).toContain("integration.configure");
    });

    it("includes Qubere Super Admin system permissions", () => {
      const names = PERMISSION_CATALOGUE.map((p) => p.name);
      expect(names).toContain("system.users.read");
      expect(names).toContain("system.users.manage");
      expect(names).toContain("system.tenants.read");
      expect(names).toContain("system.audit.read");
      expect(names).toContain("system.impersonate.write");
    });

    it("evaluates default role capabilities correctly", () => {
      const viewerPerms = defaultPermissionsForRole("BROKER_VIEWER");
      expect(viewerPerms).toContain("shipment.read");
      expect(viewerPerms).not.toContain("shipment.create");
      expect(viewerPerms).not.toContain("shipment.update");
      expect(viewerPerms).not.toContain("entry.submit");

      const specialistPerms = defaultPermissionsForRole("BROKER_SPECIALIST");
      expect(specialistPerms).toContain("shipment.create");
      expect(specialistPerms).toContain("entry.create");
      expect(specialistPerms).not.toContain("entry.submit");
      expect(specialistPerms).not.toContain("classification.override");

      const managerPerms = defaultPermissionsForRole("BROKER_MANAGER");
      expect(managerPerms).toContain("entry.approve");
      expect(managerPerms).toContain("compliance.approve");
      expect(managerPerms).not.toContain("integration.configure");

      const adminPerms = defaultPermissionsForRole("BROKER_ADMIN");
      expect(adminPerms).toContain("entry.submit");
      expect(adminPerms).toContain("client.manage_settings");
      expect(adminPerms).toContain("integration.configure");

      const dispatcherPerms = defaultPermissionsForRole("TMS_DISPATCHER");
      expect(dispatcherPerms).toContain("load.dispatch");
      expect(dispatcherPerms).toContain("tender.send");
      expect(dispatcherPerms).not.toContain("integration.configure");

      const tmsBillingPerms = defaultPermissionsForRole("TMS_BILLING");
      expect(tmsBillingPerms).toContain("invoice.approve");
      expect(tmsBillingPerms).not.toContain("load.dispatch");
    });
  });

  // ─── 2. FRONTEND PERMISSION & SCOPE HELPER (can) ───────────────────────────

  describe("Frontend Authorization Helper (can)", () => {
    it("grants access to wildcard platform/owner roles", () => {
      expect(can("shipment.delete", { isPlatformAdmin: true })).toBe(true);
      expect(can("entry.submit", { roleNames: ["OWNER"] })).toBe(true);
      expect(can("integration.configure", { roleNames: ["BROKER_ADMIN"] })).toBe(true);
    });

    it("enforces permission check for regular users", () => {
      expect(
        can("shipment.read", {
          permissions: ["shipment.read"],
          roleNames: ["BROKER_SPECIALIST"],
        })
      ).toBe(true);

      expect(
        can("entry.submit", {
          permissions: ["shipment.read", "entry.read"],
          roleNames: ["BROKER_SPECIALIST"],
        })
      ).toBe(false);
    });

    it("enforces resource client scope checking", () => {
      const options = {
        permissions: ["shipment.update"],
        roleNames: ["BROKER_SPECIALIST"],
        authorizedClientIds: ["client-101", "client-102"],
        isAllClients: false,
      };

      expect(can("shipment.update", { ...options, clientId: "client-101" })).toBe(true);
      expect(can("shipment.update", { ...options, clientId: "client-999" })).toBe(false);
    });
  });

  // ─── 3. IMPERSONATION SESSION SECURITY ──────────────────────────────────────

  describe("Impersonation Session Rules", () => {
    it("prevents non-super-admin from starting impersonation", async () => {
      vi.spyOn(db.user, "findUnique").mockResolvedValue({
        id: "user-regular",
        email: "user@example.com",
        platformRoles: [],
      } as any);

      await expect(
        startImpersonationSession({
          actorUserId: "user-regular",
          targetAccountId: "acc-1",
          targetUserId: "user-target",
          reason: "Support investigation",
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it("requires a detailed reason (minimum 5 chars)", async () => {
      await expect(
        startImpersonationSession({
          actorUserId: "user-admin",
          targetAccountId: "acc-1",
          targetUserId: "user-target",
          reason: "abc",
        })
      ).rejects.toThrow(/valid reason/);
    });
  });

  // ─── 4. RESOURCE OWNERSHIP & PRIVILEGE ESCALATION ─────────────────────────

  describe("Resource Ownership & Scope Validation", () => {
    it("rejects unauthorized client scope cross-tenant access", async () => {
      vi.spyOn(db.user, "findUnique").mockResolvedValue({
        id: "user-spec",
        platformRoles: [],
        memberships: [
          {
            accountId: "broker-account-1",
            roles: [
              {
                roleId: "r-spec",
                role: {
                  name: "BROKER_SPECIALIST",
                  rolePermissions: [{ permission: { name: "shipment.read" } }],
                },
              },
            ],
          },
        ],
      } as any);

      vi.spyOn(db.userClientAssignment, "findMany").mockResolvedValue([
        { clientId: "client-a" },
      ] as any);

      vi.spyOn(db.accountTeamMembership, "findMany").mockResolvedValue([] as any);

      // Attempting to access Client B's shipment
      const result = await authorizeResource({
        userId: "user-spec",
        accountId: "broker-account-1",
        permission: "shipment.read",
        clientId: "client-b",
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("outside user's authorized scope");
    });

    it("allows access when client is within user's assigned scope", async () => {
      vi.spyOn(db.user, "findUnique").mockResolvedValue({
        id: "user-spec",
        platformRoles: [],
        memberships: [
          {
            accountId: "broker-account-1",
            roles: [
              {
                roleId: "r-spec",
                role: {
                  name: "BROKER_SPECIALIST",
                  rolePermissions: [{ permission: { name: "shipment.read" } }],
                },
              },
            ],
          },
        ],
      } as any);

      vi.spyOn(db.userClientAssignment, "findMany").mockResolvedValue([
        { clientId: "client-a" },
      ] as any);

      vi.spyOn(db.accountTeamMembership, "findMany").mockResolvedValue([] as any);

      const result = await authorizeResource({
        userId: "user-spec",
        accountId: "broker-account-1",
        permission: "shipment.read",
        clientId: "client-a",
      });

      expect(result.allowed).toBe(true);
      expect(result.clientId).toBe("client-a");
    });

    it("rejects request if organizationId parameter mismatches active account context", async () => {
      const result = await authorizeResource({
        userId: "user-spec",
        accountId: "broker-account-1",
        organizationId: "broker-account-999",
        permission: "shipment.read",
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Organization ID mismatch");
    });
  });
});
