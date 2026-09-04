import { beforeEach, describe, expect, it, vi } from "vitest";

// findOrCreateEntity's own LegalEntity-matching logic is untouched by #320
// Phase 1 -- see entity-domain.test.ts for normalizeName coverage. This file
// covers only the new Party-bridging side effect on the create branch: it
// must never run when called from inside a caller's transaction
// (materializers.ts's PartyRoleMaterializer), must never block entity
// creation on failure, and must never auto-link an uncertain match.

const mocks = vi.hoisted(() => ({
  db: {
    legalEntity: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

const resolvePartyForCompany = vi.fn();
vi.mock("@/modules/party/partyResolutionService", () => ({
  resolvePartyForCompany: (...args: unknown[]) => resolvePartyForCompany(...args),
}));

const { EntityResolutionService } = await import("../src/modules/entity/entityResolutionService");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.legalEntity.findMany.mockResolvedValue([]); // no existing candidates -> always the create branch
  mocks.db.legalEntity.create.mockResolvedValue({ id: "legal-new" });
  resolvePartyForCompany.mockResolvedValue({ outcome: "CREATED", partyId: "party-1", party: { id: "party-1" } });
});

describe("EntityResolutionService.findOrCreateEntity -- Party bridge (#320 Phase 1)", () => {
  it("resolves and links a Party when called with no external transaction", async () => {
    await EntityResolutionService.findOrCreateEntity("acct-1", "Acme Components Ltd", { country: "US", taxIdentifier: "123456789" });

    expect(resolvePartyForCompany).toHaveBeenCalledWith(
      { accountId: "acct-1", userId: null, requestId: null },
      { legalName: "Acme Components Ltd", country: "US", taxId: "123456789" }
    );
    expect(mocks.db.legalEntity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ partyId: "party-1" }),
    }));
  });

  it("never resolves a party when called inside a caller's transaction", async () => {
    const tx = { legalEntity: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: "legal-tx" }) } };

    await EntityResolutionService.findOrCreateEntity("acct-1", "Acme Components Ltd", undefined, tx);

    expect(resolvePartyForCompany).not.toHaveBeenCalled();
    expect(tx.legalEntity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ partyId: null }),
    }));
  });

  it("leaves the entity unlinked when resolution only finds candidates -- never auto-links", async () => {
    resolvePartyForCompany.mockResolvedValue({ outcome: "CANDIDATES", status: "POSSIBLE_MATCH", candidates: [{ partyId: "party-maybe" }] });

    await EntityResolutionService.findOrCreateEntity("acct-1", "Acme Components Ltd");

    expect(mocks.db.legalEntity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ partyId: null }),
    }));
  });

  it("still creates the entity when party resolution throws -- fail-open", async () => {
    resolvePartyForCompany.mockRejectedValue(new Error("screening unavailable"));

    const result = await EntityResolutionService.findOrCreateEntity("acct-1", "Acme Components Ltd");

    expect(result).toEqual({ id: "legal-new" });
    expect(mocks.db.legalEntity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ partyId: null }),
    }));
  });

  it("defaults the resolution country to US, matching the row it writes, when none is supplied", async () => {
    await EntityResolutionService.findOrCreateEntity("acct-1", "No Country Co");

    const [, resolveInput] = resolvePartyForCompany.mock.calls[0]!;
    expect(resolveInput.country).toBe("US");
    expect(mocks.db.legalEntity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ country: "US" }),
    }));
  });

  it("does not resolve a party for a high-confidence reuse -- nothing new was created", async () => {
    mocks.db.legalEntity.findMany.mockResolvedValue([
      { id: "legal-existing", legalName: "Acme Components Ltd", taxIdentifier: null, customsProfiles: [] },
    ]);
    mocks.db.legalEntity.findUnique.mockResolvedValue({ id: "legal-existing" });

    const result = await EntityResolutionService.findOrCreateEntity("acct-1", "Acme Components Ltd");

    expect(result).toEqual({ id: "legal-existing" });
    expect(resolvePartyForCompany).not.toHaveBeenCalled();
    expect(mocks.db.legalEntity.create).not.toHaveBeenCalled();
  });
});
