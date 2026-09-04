import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    client: { findFirst: vi.fn() },
    legalEntity: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    importerOfRecord: { findFirst: vi.fn(), create: vi.fn() },
    onboardingCase: { create: vi.fn() },
    onboardingEntity: { create: vi.fn() },
    onboardingEvent: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

const resolvePartyForCompany = vi.fn();
const ensurePartyRole = vi.fn();
vi.mock("@/modules/party/partyResolutionService", () => ({
  resolvePartyForCompany: (...args: unknown[]) => resolvePartyForCompany(...args),
  ensurePartyRole: (...args: unknown[]) => ensurePartyRole(...args),
}));

const { createImporter } = await import("../src/modules/importers/importerCreate.service");

const newLegalEntity = {
  legalName: "Northwind Foods LLC",
  entityType: "US_LLC",
  country: "US",
  importerNumberType: "EIN" as const,
  importerNumber: "12-3456789",
  addressLine1: "100 Harbor Way",
  city: "Oakland",
  stateProvince: "CA",
  postalCode: "94607",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation((callback: (tx: typeof mocks.db) => unknown) => callback(mocks.db));
  mocks.db.client.findFirst.mockResolvedValue({ id: "client-1", name: "Northwind Trade Group" });
  resolvePartyForCompany.mockResolvedValue({ outcome: "CREATED", partyId: "party-1", party: { id: "party-1" } });
  ensurePartyRole.mockResolvedValue(undefined);
  mocks.db.legalEntity.create.mockResolvedValue({
    id: "legal-1",
    accountId: "broker-1",
    clientId: "client-1",
    ...newLegalEntity,
    tradeName: null,
    addressLine2: null,
    taxIdentifier: "123456789",
    taxIdentifierType: "EIN",
    importerOfRecord: null,
  });
  mocks.db.importerOfRecord.findFirst.mockResolvedValue(null);
  mocks.db.importerOfRecord.create.mockResolvedValue({ id: "importer-1", name: newLegalEntity.legalName });
  mocks.db.onboardingCase.create.mockResolvedValue({ id: "case-1", currentStep: 2 });
  mocks.db.onboardingEntity.create.mockResolvedValue({ id: "entity-1" });
  mocks.db.onboardingEvent.create.mockResolvedValue({ id: "event-1" });
  mocks.db.auditLog.create.mockResolvedValue({ id: "audit-1" });
});

describe("createImporter", () => {
  it("creates one linked filing identity and starts onboarding", async () => {
    const result = await createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "client-1",
      path: "STANDARD",
      legalEntity: newLegalEntity,
    });

    expect(result.importer.id).toBe("importer-1");
    expect(mocks.db.importerOfRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      clientId: "client-1",
      legalEntityId: "legal-1",
      irsEin: "123456789",
    }) });
    expect(mocks.db.onboardingCase.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      primaryImporterId: "importer-1",
      clientId: "client-1",
      status: "in_progress",
      currentStep: 2,
    }) });
  });

  it("resolves a Party for a brand-new legal entity and links it (#320 Phase 1)", async () => {
    await createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "client-1",
      path: "STANDARD",
      legalEntity: newLegalEntity,
    });

    expect(resolvePartyForCompany).toHaveBeenCalledWith(
      { accountId: "broker-1", userId: "user-1", requestId: null },
      expect.objectContaining({
        legalName: "Northwind Foods LLC",
        country: "US",
        taxId: "123456789",
        address: expect.objectContaining({ addressLine1: "100 Harbor Way", city: "Oakland" }),
      })
    );
    expect(mocks.db.legalEntity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ partyId: "party-1" }),
      include: expect.anything(),
    });
    expect(ensurePartyRole).toHaveBeenCalledWith(
      { accountId: "broker-1", userId: "user-1", requestId: null },
      "party-1",
      "IMPORTER"
    );
  });

  it("leaves the legal entity unlinked when resolution only finds candidates -- never auto-links, and never adds a role for an unlinked party", async () => {
    resolvePartyForCompany.mockResolvedValue({ outcome: "CANDIDATES", status: "POSSIBLE_MATCH", candidates: [{ partyId: "party-maybe" }] });

    await createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "client-1",
      path: "STANDARD",
      legalEntity: newLegalEntity,
    });

    expect(mocks.db.legalEntity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ partyId: null }),
      include: expect.anything(),
    });
    expect(ensurePartyRole).not.toHaveBeenCalled();
  });

  it("still creates the importer when party resolution fails -- the bridge is additive, never a blocker", async () => {
    resolvePartyForCompany.mockRejectedValue(new Error("screening service unavailable"));

    const result = await createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "client-1",
      path: "STANDARD",
      legalEntity: newLegalEntity,
    });

    expect(result.importer.id).toBe("importer-1");
    expect(mocks.db.legalEntity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ partyId: null }),
      include: expect.anything(),
    });
    expect(ensurePartyRole).not.toHaveBeenCalled();
  });

  it("does not resolve a party for the CBP-assigned-number path -- that number is not a tax identifier", async () => {
    await createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "client-1",
      path: "STANDARD",
      legalEntity: { ...newLegalEntity, importerNumberType: "CBP_ASSIGNED", importerNumber: null, cbpImporterNumber: "CBP123" },
    });

    const [, resolveInput] = resolvePartyForCompany.mock.calls[0]!;
    expect(resolveInput.taxId).toBeNull();
  });

  it("reuses an eligible legal entity instead of duplicating it, and adds the IMPORTER role to its already-bridged party", async () => {
    mocks.db.legalEntity.findFirst.mockResolvedValue({
      id: "legal-existing",
      accountId: "broker-1",
      clientId: "client-1",
      legalName: "Northwind Foods LLC",
      taxIdentifier: "123456789",
      taxIdentifierType: "EIN",
      country: "US",
      addressLine1: "100 Harbor Way",
      addressLine2: null,
      city: "Oakland",
      stateProvince: "CA",
      postalCode: "94607",
      partyId: "party-existing",
      importerOfRecord: null,
    });

    await createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "client-1",
      path: "SWITCHING",
      legalEntityId: "legal-existing",
    });

    expect(mocks.db.legalEntity.create).not.toHaveBeenCalled();
    expect(mocks.db.importerOfRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      legalEntityId: "legal-existing",
    }) });
    // Backfilling an already-existing legal entity's party link is the
    // dedicated backfill script's job (#320 §6.2), not this route's.
    expect(resolvePartyForCompany).not.toHaveBeenCalled();
    // But the deliberate act of registering it as an importer NOW still
    // adds the role to whatever party it's already bridged to -- this is
    // the "known supplier becomes an importer" payoff scenario (spec §3.3).
    expect(ensurePartyRole).toHaveBeenCalledWith(
      { accountId: "broker-1", userId: "user-1", requestId: null },
      "party-existing",
      "IMPORTER"
    );
  });

  it("does not add a party role when the existing legal entity has no party link yet", async () => {
    mocks.db.legalEntity.findFirst.mockResolvedValue({
      id: "legal-existing",
      accountId: "broker-1",
      clientId: "client-1",
      legalName: "Northwind Foods LLC",
      partyId: null,
      importerOfRecord: null,
    });

    await createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "client-1",
      path: "SWITCHING",
      legalEntityId: "legal-existing",
    });

    expect(ensurePartyRole).not.toHaveBeenCalled();
  });

  it("returns the existing importer when the filing identity is already registered", async () => {
    mocks.db.legalEntity.findFirst.mockResolvedValue({
      id: "legal-existing",
      clientId: "client-1",
      importerOfRecord: { id: "importer-existing", name: "Northwind Foods LLC" },
    });

    await expect(createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "client-1",
      path: "STANDARD",
      legalEntityId: "legal-existing",
    })).rejects.toMatchObject({
      code: "CONFLICT",
      details: { existingImporter: { id: "importer-existing", name: "Northwind Foods LLC" } },
    });
    expect(mocks.db.importerOfRecord.create).not.toHaveBeenCalled();
  });

  it("does not accept a client from another broker account", async () => {
    mocks.db.client.findFirst.mockResolvedValue(null);
    await expect(createImporter({
      accountId: "broker-1",
      userId: "user-1",
      clientId: "other-client",
      path: "STANDARD",
      legalEntity: newLegalEntity,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.db.legalEntity.create).not.toHaveBeenCalled();
    // An invalid client should fail fast, before the wasted work (and
    // Restricted Party Screening) of resolving a party that will never be used.
    expect(resolvePartyForCompany).not.toHaveBeenCalled();
    expect(ensurePartyRole).not.toHaveBeenCalled();
  });
});
