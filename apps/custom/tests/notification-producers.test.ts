import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LicenseAlert } from "@/modules/licenses/alertsService";
import {
  groupLicenseAlerts,
  licenseAlertMessage,
  licenseAlertNotificationType,
} from "@/modules/licenses/licenseAlertNotifications";

const dbMock = vi.hoisted(() => ({
  accountMembership: { findMany: vi.fn() },
  notification: { findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const expiring = (id: string, num: string): LicenseAlert => ({
  type: "EXPIRING",
  licenseId: id,
  licenseNumber: num,
  message: `License ${num} expires on 2026-09-30.`,
});
const lowQty = (id: string, num: string, line: number): LicenseAlert => ({
  type: "REMAINING_QUANTITY_LOW",
  licenseId: id,
  licenseNumber: num,
  licenseLineId: `${id}-l${line}`,
  lineNumber: line,
  message: `License ${num} line ${line} has 12.0% quantity remaining.`,
});

describe("licenseAlertNotificationType", () => {
  it("splits expiring from utilization", () => {
    expect(licenseAlertNotificationType(expiring("a", "L1"))).toBe("LICENSE_EXPIRING");
    expect(licenseAlertNotificationType(lowQty("a", "L1", 1))).toBe("LICENSE_UTILIZATION");
  });
});

describe("groupLicenseAlerts", () => {
  it("collapses to one entry per (license, type)", () => {
    const grouped = groupLicenseAlerts([
      expiring("lic1", "L-001"),
      lowQty("lic1", "L-001", 1),
      lowQty("lic1", "L-001", 2),
      expiring("lic2", "L-002"),
    ]);
    expect(grouped).toHaveLength(3);
    const util = grouped.find((g) => g.licenseId === "lic1" && g.type === "LICENSE_UTILIZATION")!;
    expect(util.messages).toHaveLength(2);
  });

  it("summarizes a multi-line utilization group and passes single messages through", () => {
    const [util] = groupLicenseAlerts([lowQty("l", "L-9", 1), lowQty("l", "L-9", 2)]);
    expect(licenseAlertMessage(util)).toBe("License L-9: 2 lines near their licensed limit.");

    const [one] = groupLicenseAlerts([lowQty("l", "L-9", 1)]);
    expect(licenseAlertMessage(one)).toContain("line 1 has 12.0% quantity remaining");

    const [exp] = groupLicenseAlerts([expiring("l", "L-9")]);
    expect(licenseAlertMessage(exp)).toBe("License L-9 expires on 2026-09-30.");
  });
});

describe("notifyAccountRoleHolders", () => {
  beforeEach(() => {
    dbMock.accountMembership.findMany.mockReset();
    dbMock.notification.findFirst.mockReset();
    dbMock.notification.create.mockReset();
  });

  it("queries OWNER/ADMIN plus a permission's holders and notifies each unique user once", async () => {
    const { notifyAccountRoleHolders } = await import("@/modules/notifications/notifyAccount");
    dbMock.accountMembership.findMany.mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" },
      { userId: "u1" }, // holds two matching roles -> still notified once
    ]);
    dbMock.notification.create.mockResolvedValue({ id: "n" });

    const created = await notifyAccountRoleHolders({
      accountId: "acc",
      permission: "licenses.view",
      type: "LICENSE_EXPIRING",
      message: "L-1 expires soon",
      entityType: "License",
      entityId: "lic1",
    });

    expect(created).toBe(2);
    expect(dbMock.notification.create).toHaveBeenCalledTimes(2);

    const where = dbMock.accountMembership.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("ACTIVE");
    expect(where.roles.some.role.OR).toEqual([
      { name: { in: ["OWNER", "ADMIN"] } },
      { rolePermissions: { some: { permission: { name: "licenses.view" } } } },
    ]);
  });

  it("returns 0 when the account has no matching members", async () => {
    const { notifyAccountRoleHolders } = await import("@/modules/notifications/notifyAccount");
    dbMock.accountMembership.findMany.mockResolvedValue([]);
    const created = await notifyAccountRoleHolders({
      accountId: "acc",
      type: "LICENSE_EXPIRING",
      message: "x",
    });
    expect(created).toBe(0);
    expect(dbMock.notification.create).not.toHaveBeenCalled();
  });
});
