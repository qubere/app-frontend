import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, createAuditLogMock } = vi.hoisted(() => ({
  dbMock: {
    inboundSenderRoute: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  createAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
  withDataModeContext: (_mode: null, fn: () => unknown) => fn(),
}));

vi.mock("@/lib/audit", () => ({ createAuditLog: createAuditLogMock }));

import {
  blockInboundSenderRoute,
  createInboundSenderRoute,
  InboundSenderAlreadyRoutedError,
} from "@/modules/inbound/senderRouting";

describe("inbound sender route lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAuditLogMock.mockResolvedValue(undefined);
  });

  it("reactivates a revoked sender for the same account", async () => {
    dbMock.inboundSenderRoute.findUnique.mockResolvedValue({ id: "route_1", accountId: "acct_a", status: "REVOKED" });
    dbMock.inboundSenderRoute.update.mockResolvedValue({
      id: "route_1",
      accountId: "acct_a",
      displaySenderEmail: "RachitLohani@gmail.com",
      normalizedSenderEmail: "rachitlohani@gmail.com",
      status: "ACTIVE",
    });

    const route = await createInboundSenderRoute({
      accountId: "acct_a",
      email: " RachitLohani@gmail.com ",
      createdByUserId: "user_1",
    });

    expect(route.status).toBe("ACTIVE");
    expect(dbMock.inboundSenderRoute.create).not.toHaveBeenCalled();
    expect(dbMock.inboundSenderRoute.update).toHaveBeenCalledWith({
      where: { id: "route_1" },
      data: { displaySenderEmail: "RachitLohani@gmail.com", defaultAssignedToUserId: null, status: "ACTIVE" },
    });
    expect(createAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "inbound_sender_route.reactivated",
      metadata: expect.objectContaining({ normalizedSenderEmail: "rachitlohani@gmail.com", previousStatus: "REVOKED" }),
    }));
  });

  it("does not let a different account claim an existing sender", async () => {
    dbMock.inboundSenderRoute.findUnique.mockResolvedValue({ id: "route_1", accountId: "acct_a", status: "ACTIVE" });

    await expect(createInboundSenderRoute({
      accountId: "acct_b",
      email: "rachitlohani@gmail.com",
      createdByUserId: "user_2",
    })).rejects.toBeInstanceOf(InboundSenderAlreadyRoutedError);

    expect(dbMock.inboundSenderRoute.create).not.toHaveBeenCalled();
    expect(dbMock.inboundSenderRoute.update).not.toHaveBeenCalled();
  });

  it("creates a durable blocked sender rule", async () => {
    dbMock.inboundSenderRoute.findUnique.mockResolvedValue(null);
    dbMock.inboundSenderRoute.create.mockResolvedValue({ id: "route_blocked", accountId: "acct_a", status: "BLOCKED" });

    await blockInboundSenderRoute({
      accountId: "acct_a",
      email: "spam@example.com",
      blockedByUserId: "user_1",
    });

    expect(dbMock.inboundSenderRoute.create).toHaveBeenCalledWith({
      data: {
        accountId: "acct_a",
        normalizedSenderEmail: "spam@example.com",
        displaySenderEmail: "spam@example.com",
        defaultAssignedToUserId: null,
        status: "BLOCKED",
        createdByUserId: "user_1",
      },
    });
    expect(createAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ action: "inbound_sender_route.blocked" }));
  });
});
