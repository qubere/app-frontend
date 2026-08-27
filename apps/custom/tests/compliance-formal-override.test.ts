import { describe, it, expect, vi, beforeEach } from "vitest";

// formalOverride.ts -- a ComplianceFormalOverride is a separate, human-only,
// reason-mandatory decision layered on top of an existing compliance result.
// Covers: reason/human-user requirements, that the original decision is
// preserved verbatim, and that revocation only ever sets fields in place --
// it must never delete the row or allow a double-revoke.

const { dbMock, createAuditLogMock } = vi.hoisted(() => ({
  dbMock: {
    complianceFormalOverride: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
  createAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({
  createAuditLog: createAuditLogMock,
  AuditAction: { DECISION_OVERRIDDEN: "DECISION_OVERRIDDEN" },
}));
vi.mock("@/modules/agents/agentLogger", () => ({ logAgentError: vi.fn() }));

const { createFormalOverride, revokeFormalOverride, FormalOverrideValidationError } = await import(
  "@/modules/compliance/formalOverride"
);

beforeEach(() => {
  vi.clearAllMocks();
  createAuditLogMock.mockResolvedValue(undefined);
});

describe("createFormalOverride", () => {
  const baseInput = {
    accountId: "acct_1",
    resultRefType: "RestrictedPartyScreeningResult",
    resultRefId: "rps_1",
    originalDecision: "HIT",
    overrideDecision: "CLEARED",
    reason: "Confirmed false positive after manual investigation",
    overriddenByUserId: "user_1",
  };

  it("rejects an empty reason", async () => {
    await expect(createFormalOverride({ ...baseInput, reason: "   " })).rejects.toBeInstanceOf(
      FormalOverrideValidationError
    );
    expect(dbMock.complianceFormalOverride.create).not.toHaveBeenCalled();
  });

  it("rejects a missing human user id", async () => {
    await expect(createFormalOverride({ ...baseInput, overriddenByUserId: "" })).rejects.toBeInstanceOf(
      FormalOverrideValidationError
    );
    expect(dbMock.complianceFormalOverride.create).not.toHaveBeenCalled();
  });

  it("rejects a missing resultRefType/resultRefId", async () => {
    await expect(createFormalOverride({ ...baseInput, resultRefId: "" })).rejects.toBeInstanceOf(
      FormalOverrideValidationError
    );
  });

  it("preserves the original decision verbatim alongside the override decision", async () => {
    dbMock.complianceFormalOverride.create.mockResolvedValue({ id: "override_1", ...baseInput });

    await createFormalOverride(baseInput);

    const call = dbMock.complianceFormalOverride.create.mock.calls[0][0];
    expect(call.data.originalDecision).toBe("HIT");
    expect(call.data.overrideDecision).toBe("CLEARED");
    expect(call.data.overriddenByUserId).toBe("user_1");
  });

  it("writes a defense-in-depth AuditLog entry, but never lets an AuditLog failure roll back the override", async () => {
    dbMock.complianceFormalOverride.create.mockResolvedValue({ id: "override_1", ...baseInput });
    createAuditLogMock.mockRejectedValue(new Error("audit db down"));

    const override = await createFormalOverride(baseInput);

    expect(override.id).toBe("override_1");
    expect(createAuditLogMock).toHaveBeenCalled();
  });
});

describe("revokeFormalOverride", () => {
  const revokeInput = {
    id: "override_1",
    accountId: "acct_1",
    revokedByUserId: "user_2",
    revokedReason: "Override was granted in error",
  };

  it("rejects an empty revokedReason", async () => {
    await expect(revokeFormalOverride({ ...revokeInput, revokedReason: "" })).rejects.toBeInstanceOf(
      FormalOverrideValidationError
    );
    expect(dbMock.complianceFormalOverride.update).not.toHaveBeenCalled();
  });

  it("rejects a missing human user id", async () => {
    await expect(revokeFormalOverride({ ...revokeInput, revokedByUserId: "" })).rejects.toBeInstanceOf(
      FormalOverrideValidationError
    );
  });

  it("404s (via validation error) when the override does not exist for this tenant", async () => {
    dbMock.complianceFormalOverride.findFirst.mockResolvedValue(null);
    await expect(revokeFormalOverride(revokeInput)).rejects.toBeInstanceOf(FormalOverrideValidationError);
    expect(dbMock.complianceFormalOverride.update).not.toHaveBeenCalled();
  });

  it("rejects revoking an already-revoked override", async () => {
    dbMock.complianceFormalOverride.findFirst.mockResolvedValue({
      id: "override_1",
      accountId: "acct_1",
      revokedAt: new Date("2026-01-01"),
    });
    await expect(revokeFormalOverride(revokeInput)).rejects.toBeInstanceOf(FormalOverrideValidationError);
    expect(dbMock.complianceFormalOverride.update).not.toHaveBeenCalled();
  });

  it("sets revoked fields in place via update -- never calls delete", async () => {
    dbMock.complianceFormalOverride.findFirst.mockResolvedValue({
      id: "override_1",
      accountId: "acct_1",
      revokedAt: null,
      resultRefType: "RestrictedPartyScreeningResult",
      resultRefId: "rps_1",
    });
    dbMock.complianceFormalOverride.update.mockResolvedValue({
      id: "override_1",
      revokedByUserId: "user_2",
      revokedAt: new Date(),
      revokedReason: revokeInput.revokedReason,
    });

    await revokeFormalOverride(revokeInput);

    expect(dbMock.complianceFormalOverride.update).toHaveBeenCalledWith({
      where: { id: "override_1" },
      data: expect.objectContaining({
        revokedByUserId: "user_2",
        revokedReason: revokeInput.revokedReason,
        revokedAt: expect.any(Date),
      }),
    });
    expect((dbMock.complianceFormalOverride as any).delete).toBeUndefined();
  });

  it("scopes the existence lookup by accountId -- cannot revoke another tenant's override", async () => {
    dbMock.complianceFormalOverride.findFirst.mockResolvedValue(null);
    await expect(revokeFormalOverride(revokeInput)).rejects.toBeInstanceOf(FormalOverrideValidationError);
    expect(dbMock.complianceFormalOverride.findFirst).toHaveBeenCalledWith({
      where: { id: "override_1", accountId: "acct_1" },
    });
  });
});
