import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ctxMock,
  getQuarantinedInboundEmailMock,
  releaseQuarantinedInboundEmailMock,
  discardQuarantinedInboundEmailMock,
  blockQuarantinedInboundEmailMock,
} = vi.hoisted(() => ({
  ctxMock: {
    accountId: "acct_a",
    accountName: "Acme Broker",
    accountType: "BROKER",
    userId: "user_1",
    isPlatformAdmin: false,
  },
  getQuarantinedInboundEmailMock: vi.fn(),
  releaseQuarantinedInboundEmailMock: vi.fn(),
  discardQuarantinedInboundEmailMock: vi.fn(),
  blockQuarantinedInboundEmailMock: vi.fn(),
}));

vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: (args: unknown) => unknown) => (req: Request) =>
    handler({ req, ctx: ctxMock, requestId: "req_test" }),
}));

vi.mock("@/modules/inbound/quarantineReview", () => ({
  getQuarantinedInboundEmail: getQuarantinedInboundEmailMock,
  releaseQuarantinedInboundEmail: releaseQuarantinedInboundEmailMock,
  discardQuarantinedInboundEmail: discardQuarantinedInboundEmailMock,
  blockQuarantinedInboundEmail: blockQuarantinedInboundEmailMock,
}));

import { POST } from "@/app/api/documents/quarantine/bulk/route";

function bulkRequest(body: unknown) {
  return POST(new Request("http://test/api/documents/quarantine/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({}) });
}

describe("documents quarantine bulk actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getQuarantinedInboundEmailMock.mockResolvedValue({ id: "email_1", accountId: "acct_a" });
    releaseQuarantinedInboundEmailMock.mockResolvedValue({ id: "email_1" });
    discardQuarantinedInboundEmailMock.mockResolvedValue({ id: "email_1" });
    blockQuarantinedInboundEmailMock.mockResolvedValue({ id: "email_1" });
  });

  it("releases selected email into the authenticated account and remembers its sender", async () => {
    const response = await bulkRequest({
      action: "RELEASE",
      items: [{ inboundEmailId: "email_1" }],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ succeeded: ["email_1"], failed: [] }));
    expect(releaseQuarantinedInboundEmailMock).toHaveBeenCalledWith({
      inboundEmailId: "email_1",
      accountId: "acct_a",
      createSenderRoute: true,
      adminUserId: "user_1",
    });
  });

  it("blocks a sender through the durable block action", async () => {
    await bulkRequest({ action: "BLOCK", items: [{ inboundEmailId: "email_1" }] });

    expect(blockQuarantinedInboundEmailMock).toHaveBeenCalledWith({
      inboundEmailId: "email_1",
      accountId: "acct_a",
      adminUserId: "user_1",
      requestId: "req_test",
    });
  });

  it("refuses to act on another account's quarantined email", async () => {
    getQuarantinedInboundEmailMock.mockResolvedValue({ id: "email_1", accountId: "acct_b" });

    const response = await bulkRequest({ action: "DISCARD", items: [{ inboundEmailId: "email_1" }] });
    const body = await response.json();

    expect(body.succeeded).toEqual([]);
    expect(body.failed[0].message).toContain("does not belong to your account");
    expect(discardQuarantinedInboundEmailMock).not.toHaveBeenCalled();
  });
});
