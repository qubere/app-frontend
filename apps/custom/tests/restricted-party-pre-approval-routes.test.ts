import { describe, it, expect, vi, beforeEach } from "vitest";

// Party-level Pre-Approval API routes: create + revoke.
// Covers: tenant isolation (party/approval scoped to the caller's account),
// permission-route wiring (approve vs revoke are distinct permissions), and
// that the routes translate preApproval.ts's typed errors into the right
// HTTP status codes rather than leaking a 500.

const { dbMock } = vi.hoisted(() => {
  return {
    dbMock: {
      party: { findFirst: vi.fn() },
      partyScreeningApproval: { findFirst: vi.fn() },
    },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

const guardOptionsByRoute: Array<{ permission?: string; write?: boolean }> = [];
vi.mock("@/lib/api/auth-guards", () => ({
  withAuthenticatedRoute: (handler: any, options: any) => {
    guardOptionsByRoute.push(options);
    return (req: any, context: any) =>
      handler({ req, ctx: { accountId: "acct_1", userId: "user_1" }, requestId: "req_1", params: context?.params ?? {} });
  },
}));

const { createPreApproval, revokePreApproval } = vi.hoisted(() => ({
  createPreApproval: vi.fn(),
  revokePreApproval: vi.fn(),
}));
vi.mock("@/modules/agents/compliance/restrictedParty/preApproval", async () => {
  const actual = await vi.importActual<typeof import("@/modules/agents/compliance/restrictedParty/preApproval")>(
    "@/modules/agents/compliance/restrictedParty/preApproval"
  );
  return {
    ...actual,
    createPreApproval,
    revokePreApproval,
  };
});

const {
  PartyNotFoundForApprovalError,
  PartyHasNoActiveIdentityForApprovalError,
  PreApprovalNotFoundError,
} = await import("@/modules/agents/compliance/restrictedParty/preApproval");

const { POST } = await import(
  "@/app/api/v1/parties/[partyId]/restricted-party-screening/pre-approval/route"
);
const { PATCH } = await import(
  "@/app/api/v1/parties/[partyId]/restricted-party-screening/pre-approval/[approvalId]/route"
);

function jsonRequest(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST .../pre-approval: grants a party-level pre-approval", () => {
  it("requires the compliance.restricted_party_approve permission, not an ordinary write permission", () => {
    expect(guardOptionsByRoute).toContainEqual({ permission: "compliance.restricted_party_approve", write: true });
  });

  it("returns 404 rather than creating an approval when the party does not belong to this account", async () => {
    dbMock.party.findFirst.mockResolvedValue(null);

    const response = await POST(jsonRequest({}), { params: { partyId: "party_other_tenant" } });

    expect(response.status).toBe(404);
    expect(dbMock.party.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "party_other_tenant", accountId: "acct_1" } })
    );
    expect(createPreApproval).not.toHaveBeenCalled();
  });

  it("scopes creation to the caller's account and the caller as approver", async () => {
    dbMock.party.findFirst.mockResolvedValue({ id: "party_1" });
    createPreApproval.mockResolvedValue({ id: "approval_1", status: "PRE_APPROVED" });

    const response = await POST(
      jsonRequest({ reason: "Trusted long-standing customer" }),
      { params: { partyId: "party_1" } }
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ success: true, approval: { id: "approval_1" } });
    expect(createPreApproval).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acct_1", partyId: "party_1", approvedByUserId: "user_1" })
    );
  });

  it("returns 404 when the party has no active identity to approve, rather than a raw 500", async () => {
    dbMock.party.findFirst.mockResolvedValue({ id: "party_1" });
    createPreApproval.mockRejectedValue(new PartyNotFoundForApprovalError("Party not found"));

    const response = await POST(jsonRequest({}), { params: { partyId: "party_1" } });
    expect(response.status).toBe(404);
  });

  it("returns 422 when the party has no active identity to screen against", async () => {
    dbMock.party.findFirst.mockResolvedValue({ id: "party_1" });
    createPreApproval.mockRejectedValue(new PartyHasNoActiveIdentityForApprovalError("No active identity"));

    const response = await POST(jsonRequest({}), { params: { partyId: "party_1" } });
    expect(response.status).toBe(422);
  });
});

describe("PATCH .../pre-approval/[approvalId]: revokes a party-level pre-approval", () => {
  it("requires the compliance.restricted_party_revoke permission, distinct from approve", () => {
    expect(guardOptionsByRoute).toContainEqual({ permission: "compliance.restricted_party_revoke", write: true });
  });

  it("returns 404 when the approval does not belong to this account, even if the id exists elsewhere", async () => {
    dbMock.partyScreeningApproval.findFirst.mockResolvedValue(null);

    const response = await PATCH(jsonRequest({}), { params: { partyId: "party_1", approvalId: "approval_other_tenant" } });

    expect(response.status).toBe(404);
    expect(dbMock.partyScreeningApproval.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "approval_other_tenant", accountId: "acct_1", partyId: "party_1" } })
    );
    expect(revokePreApproval).not.toHaveBeenCalled();
  });

  it("returns 404 when the approval id does not belong to the given partyId (cross-party mismatch)", async () => {
    dbMock.partyScreeningApproval.findFirst.mockResolvedValue(null);

    const response = await PATCH(jsonRequest({}), { params: { partyId: "party_wrong", approvalId: "approval_1" } });

    expect(response.status).toBe(404);
  });

  it("revokes and returns the updated approval on success", async () => {
    dbMock.partyScreeningApproval.findFirst.mockResolvedValue({ id: "approval_1" });
    revokePreApproval.mockResolvedValue({ id: "approval_1", status: "REVOKED" });

    const response = await PATCH(
      jsonRequest({ reason: "Party re-flagged" }),
      { params: { partyId: "party_1", approvalId: "approval_1" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, approval: { status: "REVOKED" } });
    expect(revokePreApproval).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acct_1", approvalId: "approval_1", revokedByUserId: "user_1" })
    );
  });

  it("returns 404 when revocation itself reports the approval as not found", async () => {
    dbMock.partyScreeningApproval.findFirst.mockResolvedValue({ id: "approval_1" });
    revokePreApproval.mockRejectedValue(new PreApprovalNotFoundError("Pre-approval not found"));

    const response = await PATCH(jsonRequest({}), { params: { partyId: "party_1", approvalId: "approval_1" } });
    expect(response.status).toBe(404);
  });
});
